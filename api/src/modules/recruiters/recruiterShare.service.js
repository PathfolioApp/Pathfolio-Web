const crypto = require('crypto');
const config = require('../../config');
const db = require('../../shared/db');
const studentStore = require('../students/studentStore');
const auditLog = require('../../shared/auditLog.service');
const { checkEligibility } = require('../admin/adminContent.service');

const clean = value => String(value || '').trim();
const SHARE_STATUSES = ['shared', 'viewed', 'feedback'];

/**
 * Recruiter Shares ("Student Shortlist / Candidate Referral").
 *
 * This is the controlled bridge between the admin's student search and the
 * recruiter portal: an admin selects students and shares them with a specific
 * recruiter (optionally tied to a job posting). Recruiters can only ever see
 * students explicitly listed in a share created for them, never the broader
 * student population.
 *
 * Recruiter-facing student fields are whitelisted: name, roll number,
 * department, batch, structured interests, achievements, internships and the
 * default resume link. Family context and authentication data stay private.
 */
class RecruiterShareService {
  constructor() { this.shares = new Map(); this.pool = null; }

  async initialize() {
    if (!config.databaseConfigured) { require('../../shared/logger').db.warn('Recruiter shares: database not configured, using volatile in-memory storage.'); return; }
    this.pool = db.createPool({ connectionLimit: 5 });
    const connection = await this.pool.getConnection();
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS recruiter_shares (id VARCHAR(64) PRIMARY KEY, recruiter_id VARCHAR(64) NOT NULL, job_post_id VARCHAR(64) NULL, note TEXT, status VARCHAR(24) NOT NULL DEFAULT 'shared', student_ids JSON NOT NULL, created_by VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, recruiter_viewed_at DATETIME NULL, recruiter_feedback JSON NULL)`);
    } finally { connection.release(); }
  }

  row(row) {
    if (!row) return null;
    const parse = value => (typeof value === 'string' ? JSON.parse(value) : value);
    const toDate = value => { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); };
    return {
      id: row.id,
      recruiterId: row.recruiter_id || row.recruiterId,
      jobPostId: row.job_post_id || row.jobPostId || null,
      note: row.note || '',
      status: row.status,
      studentIds: parse(row.student_ids || row.studentIds) || [],
      createdBy: row.created_by || row.createdBy,
      createdAt: toDate(row.created_at || row.createdAt) || new Date().toISOString(),
      updatedAt: toDate(row.updated_at || row.updatedAt) || new Date().toISOString(),
      recruiterViewedAt: toDate(row.recruiter_viewed_at || row.recruiterViewedAt),
      recruiterFeedback: parse(row.recruiter_feedback || row.recruiterFeedback) || []
    };
  }

  async saveShare(share) {
    const record = { ...share, id: share.id || `share_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, updatedAt: new Date().toISOString() };
    if (this.pool) {
      await this.pool.execute(
        `INSERT INTO recruiter_shares (id,recruiter_id,job_post_id,note,status,student_ids,created_by,created_at,updated_at,recruiter_viewed_at,recruiter_feedback) VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE note=VALUES(note),status=VALUES(status),student_ids=VALUES(student_ids),updated_at=VALUES(updated_at),recruiter_viewed_at=VALUES(recruiter_viewed_at),recruiter_feedback=VALUES(recruiter_feedback)`,
        [record.id, record.recruiterId, record.jobPostId || null, record.note || null, record.status, JSON.stringify(record.studentIds), record.createdBy, new Date(record.createdAt), new Date(record.updatedAt), record.recruiterViewedAt ? new Date(record.recruiterViewedAt) : null, JSON.stringify(record.recruiterFeedback || [])]
      );
    } else {
      this.shares.set(record.id, record);
    }
    return record;
  }

  async getShare(id) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM recruiter_shares WHERE id=?', [id]), { label: 'getShare' });
      return this.row(rows[0]);
    }
    return this.row(this.shares.get(id));
  }

  async listShares(filter = {}) {
    const all = this.pool
      ? (await (async () => { const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM recruiter_shares ORDER BY created_at DESC'), { label: 'listShares' }); return rows.map(row => this.row(row)); })())
      : [...this.shares.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(row => this.row(row));
    return all.filter(share => (!filter.recruiterId || share.recruiterId === filter.recruiterId) && (!filter.createdBy || share.createdBy === filter.createdBy));
  }

  /** Whitelisted, recruiter-safe projection of a student record. */
  recruiterSafeStudent(student, job) {
    if (!student) return null;
    const resumeUrl = student.personal?.resumeUrl || null;
    return {
      id: student.id,
      fullName: student.personal?.fullName || '',
      rollNumber: student.academic?.rollNumber || '',
      department: student.academic?.department || '',
      batchYear: student.academic?.batchYear || '',
      cgpa: student.academic?.cgpa ?? null,
      avatarUrl: student.personal?.avatarUrl || '',
      interests: {
        hobbies: (student.interests?.hobbies || []).map(item => typeof item === 'string' ? { name: item, proficiency: null, reason: '' } : { name: item.name, proficiency: item.proficiency, reason: item.reason }),
        passions: (student.interests?.passions || []).map(item => typeof item === 'string' ? { name: item, proficiency: null, reason: '' } : { name: item.name, proficiency: item.proficiency, reason: item.reason })
      },
      achievements: (student.achievements || []).map(item => ({ title: item.title, category: item.category, description: item.description, year: item.year })),
      internships: (student.internships || []).map(item => ({ companyName: item.companyName, role: item.role, startDate: item.startDate, endDate: item.endDate, currentlyWorking: item.currentlyWorking, location: item.location, workMode: item.workMode, description: item.description, skills: item.skills || [] })),
      resumeUrl,
      emailShared: student.profileSettings?.visibility === 'public',
      email: student.profileSettings?.visibility === 'public' ? student.personal?.email || null : null,
      eligibility: job ? { issues: checkEligibility(student, job), meetsAll: checkEligibility(student, job).length === 0 } : null
    };
  }

  /** Admin: create a share of selected students for one recruiter. */
  async createShare({ recruiterId, jobPostId = null, studentIds = [], note = '', createdBy }) {
    if (!recruiterId) throw new Error('A target recruiter is required.');
    const ids = [...new Set((Array.isArray(studentIds) ? studentIds : []).map(id => clean(id)).filter(Boolean))];
    if (!ids.length) throw new Error('Select at least one student to share.');
    const recruiter = await studentStore.getStudentById(recruiterId);
    if (!recruiter || (!recruiter.isRecruiter && !recruiter.isAdmin)) throw new Error('The target account is not a recruiter.');
    if (jobPostId) {
      const job = await require('../admin/adminContentStore').getJobPost(jobPostId);
      if (!job) { const error = new Error('Job post not found.'); error.statusCode = 404; throw error; }
    }
    // Validate every selected id belongs to a real student.
    for (const id of ids) {
      const student = await studentStore.getStudentById(id);
      if (!student) throw new Error(`Student ${id} was not found.`);
    }
    const share = await this.saveShare({ recruiterId, jobPostId: jobPostId || null, studentIds: ids, note: clean(note).slice(0, 500), status: 'shared', createdBy });
    await auditLog.record({ actorId: createdBy, action: 'share.create', entityType: 'recruiter_share', entityId: share.id, entityLabel: `${ids.length} student(s)`, detail: `Shared with a recruiter${jobPostId ? ' for a specific job' : ''}.` });
    await studentStore.createNotification(recruiterId, { title: 'New candidates shared with you', message: `The placement team shared ${ids.length} candidate${ids.length === 1 ? '' : 's'} with your company.`, type: 'share' });
    return share;
  }

  /** Admin-facing listing with recruiter identity resolved. */
  async listForAdmin() {
    const shares = await this.listShares();
    const enriched = await Promise.all(shares.map(async share => {
      const recruiter = await studentStore.getStudentById(share.recruiterId);
      let job = null;
      if (share.jobPostId) job = await require('../admin/adminContentStore').getJobPost(share.jobPostId);
      return {
        ...share,
        recruiterName: recruiter?.personal?.fullName || 'Unknown recruiter',
        recruiterEmail: recruiter?.personal?.email || '',
        jobTitle: job?.title || null,
        companyName: job?.companyName || null,
        studentCount: share.studentIds.length
      };
    }));
    return enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async countForRecruiter(recruiterId) {
    return (await this.listShares({ recruiterId })).length;
  }

  /** Recruiter-facing listing: only shares addressed to this recruiter. */
  async listForRecruiter(recruiterId) {
    const shares = await this.listShares({ recruiterId });
    return Promise.all(shares.map(share => this.hydrateForRecruiter(share, { markViewed: false })));
  }

  async getForRecruiter(shareId, recruiterId) {
    const share = await this.getShare(shareId);
    if (!share || share.recruiterId !== recruiterId) {
      const error = new Error('Shared candidate list not found.'); error.statusCode = 404; throw error;
    }
    return this.hydrateForRecruiter(share, { markViewed: true });
  }

  /** Resolve students + job for a share; optionally transition shared → viewed. */
  async hydrateForRecruiter(share, { markViewed }) {
    let job = null;
    if (share.jobPostId) job = await require('../admin/adminContentStore').getJobPost(share.jobPostId);
    const students = (await Promise.all(share.studentIds.map(id => studentStore.getStudentById(id))))
      .filter(Boolean)
      .map(student => this.recruiterSafeStudent(student, job));
    let updated = share;
    if (markViewed && share.status === 'shared') {
      updated = await this.saveShare({ ...share, status: 'viewed', recruiterViewedAt: new Date().toISOString() });
    }
    return {
      id: updated.id,
      status: updated.status,
      note: updated.note,
      createdAt: updated.createdAt,
      viewedAt: updated.recruiterViewedAt,
      feedback: updated.recruiterFeedback || [],
      job: job ? { id: job.id, title: job.title, companyName: job.companyName, location: job.location, employmentType: job.employmentType, workMode: job.workMode } : null,
      students
    };
  }

  /** Recruiter records per-student feedback; share transitions to feedback status. */
  async recordFeedback(shareId, recruiterId, input) {
    const share = await this.getShare(shareId);
    if (!share || share.recruiterId !== recruiterId) {
      const error = new Error('Shared candidate list not found.'); error.statusCode = 404; throw error;
    }
    const studentId = clean(input?.studentId);
    const feedback = clean(input?.feedback).slice(0, 500);
    const status = ['interested', 'not-interested', 'shortlisted', 'interview', 'selected', 'rejected'].includes(clean(input?.status)) ? clean(input?.status) : null;
    if (!studentId || (!feedback && !status)) throw new Error('Feedback or a status is required.');
    if (!share.studentIds.includes(studentId)) throw { statusCode: 403, message: 'That student is not part of this share.' };
    const entry = { studentId, status, feedback, at: new Date().toISOString() };
    const existing = (share.recruiterFeedback || []).filter(item => item.studentId !== studentId);
    const updated = await this.saveShare({ ...share, recruiterFeedback: [...existing, entry], status: 'feedback' });
    await auditLog.record({ actorId: recruiterId, action: 'share.feedback', entityType: 'recruiter_share', entityId: updated.id, entityLabel: 'Candidate feedback', detail: status ? `Status set to ${status}.` : 'Feedback recorded.' });
    await studentStore.createNotification(share.createdBy, { title: 'Recruiter feedback recorded', message: `Feedback was recorded on a shared candidate list.`, type: 'share' });
    return { id: updated.id, status: updated.status, feedback: updated.recruiterFeedback };
  }
}

module.exports = new RecruiterShareService();
module.exports.SHARE_STATUSES = SHARE_STATUSES;
