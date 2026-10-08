const crypto = require('crypto');
const config = require('../../config');
const db = require('../../shared/db');

/**
 * Recruitment Intelligence store.
 *
 * Owns the four new tables behind the university ↔ company recruitment
 * workflow: engagements (drives), engagement messages (the in-platform
 * communication timeline), company recommendations (AI + human decisions) and
 * candidate shares (early access / resume sharing with audit fields).
 *
 * Follows the house store pattern (adminContentStore / recruiterShare):
 * same hardened pool via shared/db, JSON columns parsed on read, graceful
 * volatile in-memory mode when the database is not configured.
 */

const nowIso = () => new Date().toISOString();
const toDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const parse = value => {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? JSON.parse(value) : value;
};

class RecruitmentStore {
  constructor() {
    this.engagements = new Map();
    this.messages = new Map();
    this.recommendations = new Map();
    this.shares = new Map();
    this.pool = null;
  }

  async initialize() {
    if (!config.databaseConfigured) {
      require('../../shared/logger').db.warn('Recruitment store: database not configured, using volatile in-memory storage.');
      return;
    }
    this.pool = db.createPool({ connectionLimit: 5 });
    const connection = await this.pool.getConnection();
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS recruitment_engagements (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        title VARCHAR(220) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'proposed',
        roles JSON NULL,
        job_description MEDIUMTEXT NULL,
        role_analysis JSON NULL,
        eligibility JSON NULL,
        proposed_start DATE NULL,
        proposed_end DATE NULL,
        confirmed_start DATE NULL,
        confirmed_end DATE NULL,
        provisional BOOLEAN NOT NULL DEFAULT TRUE,
        proposal_note TEXT NULL,
        created_by VARCHAR(64) NOT NULL,
        company_contact VARCHAR(255) NULL,
        pipeline_stage VARCHAR(40) NOT NULL DEFAULT 'identified',
        final_outcome VARCHAR(64) NULL,
        priority_snapshot JSON NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      )`);
      await connection.query(`CREATE TABLE IF NOT EXISTS recruitment_messages (
        id VARCHAR(64) PRIMARY KEY,
        engagement_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        sender_role VARCHAR(16) NOT NULL,
        sender_id VARCHAR(64) NULL,
        sender_name VARCHAR(180) NULL,
        recipient_role VARCHAR(16) NOT NULL,
        body TEXT NOT NULL,
        attachments JSON NULL,
        kind VARCHAR(32) NOT NULL DEFAULT 'message',
        system_meta JSON NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_recmsg_engagement (engagement_id, created_at)
      )`);
      await connection.query(`CREATE TABLE IF NOT EXISTS recruitment_recommendations (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        score INT NOT NULL,
        recommendation VARCHAR(24) NOT NULL,
        factors JSON NOT NULL,
        reasons JSON NOT NULL,
        source VARCHAR(24) NOT NULL DEFAULT 'ai',
        decision VARCHAR(24) NULL,
        decided_by VARCHAR(64) NULL,
        decision_reason TEXT NULL,
        decided_at DATETIME NULL,
        engagement_id VARCHAR(64) NULL,
        generated_at DATETIME NOT NULL,
        INDEX idx_recrec_company (company_id, generated_at)
      )`);
      await connection.query(`CREATE TABLE IF NOT EXISTS recruitment_shares (
        id VARCHAR(64) PRIMARY KEY,
        engagement_id VARCHAR(64) NULL,
        company_id VARCHAR(64) NOT NULL,
        recruiter_id VARCHAR(64) NOT NULL,
        role_title VARCHAR(220) NULL,
        job_post_id VARCHAR(64) NULL,
        student_id VARCHAR(64) NOT NULL,
        resume_id VARCHAR(64) NULL,
        access_level VARCHAR(24) NOT NULL DEFAULT 'summary',
        ai_brief TEXT NULL,
        ai_match JSON NULL,
        approved_by VARCHAR(64) NULL,
        approved_by_name VARCHAR(180) NULL,
        shared_by VARCHAR(64) NOT NULL,
        shared_by_name VARCHAR(180) NULL,
        policy_mode VARCHAR(32) NOT NULL DEFAULT 'university_controlled',
        status VARCHAR(24) NOT NULL DEFAULT 'shared',
        company_response VARCHAR(24) NULL,
        company_response_note TEXT NULL,
        responded_at DATETIME NULL,
        revoked_at DATETIME NULL,
        revoked_by VARCHAR(64) NULL,
        accessed_at DATETIME NULL,
        access_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_recshare_company (company_id, created_at)
      )`);
    } finally {
      connection.release();
    }
  }

  makeId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  }

  // ---------------------------------------------------------------- engagements
  engagement(row) {
    if (!row) return null;
    return {
      id: row.id,
      companyId: row.company_id || row.companyId,
      title: row.title,
      status: row.status,
      roles: parse(row.roles) || [],
      jobDescription: row.job_description || row.jobDescription || '',
      roleAnalysis: parse(row.role_analysis || row.roleAnalysis) || null,
      eligibility: parse(row.eligibility || row.eligibility) || null,
      proposedStart: toDate(row.proposed_start || row.proposedStart),
      proposedEnd: toDate(row.proposed_end || row.proposedEnd),
      confirmedStart: toDate(row.confirmed_start || row.confirmedStart),
      confirmedEnd: toDate(row.confirmed_end || row.confirmedEnd),
      provisional: row.provisional === undefined ? true : Boolean(row.provisional),
      proposalNote: row.proposal_note || row.proposalNote || '',
      createdBy: row.created_by || row.createdBy,
      companyContact: row.company_contact || row.companyContact || '',
      pipelineStage: row.pipeline_stage || row.pipelineStage || 'identified',
      finalOutcome: row.final_outcome || row.finalOutcome || null,
      prioritySnapshot: parse(row.priority_snapshot || row.prioritySnapshot) || null,
      createdAt: toDate(row.created_at || row.createdAt) || nowIso(),
      updatedAt: toDate(row.updated_at || row.updatedAt) || nowIso()
    };
  }

  async saveEngagement(engagement) {
    const record = {
      provisional: true,
      roles: [],
      jobDescription: '',
      roleAnalysis: null,
      eligibility: null,
      proposalNote: '',
      companyContact: '',
      finalOutcome: null,
      prioritySnapshot: null,
      ...engagement,
      id: engagement.id || this.makeId('re'),
      updatedAt: nowIso(),
      createdAt: engagement.createdAt || nowIso()
    };
    if (this.pool) {
      const sqlDate = value => value ? new Date(value) : null;
      await this.pool.execute(
        `INSERT INTO recruitment_engagements
          (id,company_id,title,status,roles,job_description,role_analysis,eligibility,proposed_start,proposed_end,confirmed_start,confirmed_end,provisional,proposal_note,created_by,company_contact,pipeline_stage,final_outcome,priority_snapshot,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE title=VALUES(title),status=VALUES(status),roles=VALUES(roles),job_description=VALUES(job_description),role_analysis=VALUES(role_analysis),eligibility=VALUES(eligibility),proposed_start=VALUES(proposed_start),proposed_end=VALUES(proposed_end),confirmed_start=VALUES(confirmed_start),confirmed_end=VALUES(confirmed_end),provisional=VALUES(provisional),proposal_note=VALUES(proposal_note),company_contact=VALUES(company_contact),pipeline_stage=VALUES(pipeline_stage),final_outcome=VALUES(final_outcome),priority_snapshot=VALUES(priority_snapshot),updated_at=VALUES(updated_at)`,
        [record.id, record.companyId, record.title, record.status, JSON.stringify(record.roles || []), record.jobDescription || null,
          record.roleAnalysis ? JSON.stringify(record.roleAnalysis) : null, record.eligibility ? JSON.stringify(record.eligibility) : null,
          sqlDate(record.proposedStart), sqlDate(record.proposedEnd), sqlDate(record.confirmedStart), sqlDate(record.confirmedEnd),
          record.provisional, record.proposalNote || null, record.createdBy, record.companyContact || null,
          record.pipelineStage, record.finalOutcome, record.prioritySnapshot ? JSON.stringify(record.prioritySnapshot) : null,
          new Date(record.createdAt), new Date(record.updatedAt)]
      );
    } else {
      this.engagements.set(record.id, record);
    }
    return record;
  }

  async getEngagement(id) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM recruitment_engagements WHERE id=?', [id]), { label: 'getEngagement' });
      return this.engagement(rows[0]);
    }
    return this.engagement(this.engagements.get(id));
  }

  async listEngagements(filter = {}) {
    const rows = this.pool
      ? await db.withRetry(() => this.pool.query('SELECT * FROM recruitment_engagements ORDER BY updated_at DESC'), { label: 'listEngagements' }).then(([rows]) => rows)
      : [...this.engagements.values()];
    return rows
      .map(row => this.engagement(row))
      .filter(item => (!filter.companyId || item.companyId === filter.companyId) && (!filter.status || item.status === filter.status));
  }

  // ------------------------------------------------------------------- messages
  message(row) {
    if (!row) return null;
    return {
      id: row.id,
      engagementId: row.engagement_id || row.engagementId,
      companyId: row.company_id || row.companyId,
      senderRole: row.sender_role || row.senderRole,
      senderId: row.sender_id || row.senderId || null,
      senderName: row.sender_name || row.senderName || '',
      recipientRole: row.recipient_role || row.recipientRole,
      body: row.body || '',
      attachments: parse(row.attachments) || [],
      kind: row.kind || 'message',
      systemMeta: parse(row.system_meta || row.systemMeta) || null,
      createdAt: toDate(row.created_at || row.createdAt) || nowIso()
    };
  }

  async addMessage(message) {
    const record = {
      attachments: [],
      kind: 'message',
      systemMeta: null,
      senderId: null,
      senderName: '',
      ...message,
      id: this.makeId('msg'),
      createdAt: nowIso()
    };
    if (this.pool) {
      await this.pool.execute(
        `INSERT INTO recruitment_messages (id,engagement_id,company_id,sender_role,sender_id,sender_name,recipient_role,body,attachments,kind,system_meta,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [record.id, record.engagementId, record.companyId, record.senderRole, record.senderId, record.senderName, record.recipientRole,
          record.body, JSON.stringify(record.attachments || []), record.kind, record.systemMeta ? JSON.stringify(record.systemMeta) : null, new Date(record.createdAt)]
      );
    } else {
      this.messages.set(record.id, record);
    }
    return record;
  }

  async listMessages(engagementId) {
    const rows = this.pool
      ? (await db.withRetry(() => this.pool.execute('SELECT * FROM recruitment_messages WHERE engagement_id=? ORDER BY created_at ASC, id ASC', [engagementId]), { label: 'listMessages' }))[0]
      : [...this.messages.values()].filter(message => message.engagementId === engagementId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return rows.map(row => this.message(row));
  }

  /**
   * Latest message timestamp per engagement. Returns Map<engagementId, {createdAt}>.
   * Pure aggregate query (GROUP BY on the selected non-aggregate column) so it
   * is safe under sql_mode=only_full_group_by.
   */
  async latestMessageForEngagements(engagementIds) {
    if (!engagementIds.length) return new Map();
    if (!this.pool) {
      const map = new Map();
      for (const id of engagementIds) {
        const list = [...this.messages.values()].filter(message => message.engagementId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (list[0]) map.set(id, { createdAt: list[0].createdAt });
      }
      return map;
    }
    const safeIds = engagementIds.map(id => String(id).replace(/[^a-zA-Z0-9_]/g, ''));
    const [rows] = await db.withRetry(() => this.pool.query(
      `SELECT engagement_id, MAX(created_at) AS latest_created
       FROM recruitment_messages
       WHERE engagement_id IN (${safeIds.map(() => '?').join(',')})
       GROUP BY engagement_id`,
      safeIds
    ), { label: 'latestMessages' });
    const map = new Map();
    for (const row of rows) {
      const createdAt = toDate(row.latest_created);
      if (createdAt) map.set(String(row.engagement_id), { createdAt });
    }
    return map;
  }

  // ---------------------------------------------- recommendations (audit trail)
  recommendation(row) {
    if (!row) return null;
    return {
      id: row.id,
      companyId: row.company_id || row.companyId,
      score: Number(row.score),
      recommendation: row.recommendation,
      factors: parse(row.factors) || {},
      reasons: parse(row.reasons) || [],
      source: row.source || 'ai',
      decision: row.decision || null,
      decidedBy: row.decided_by || row.decidedBy || null,
      decisionReason: row.decision_reason || row.decisionReason || null,
      decidedAt: toDate(row.decided_at || row.decidedAt),
      engagementId: row.engagement_id || row.engagementId || null,
      generatedAt: toDate(row.generated_at || row.generatedAt) || nowIso()
    };
  }

  async saveRecommendation(record) {
    const full = {
      decision: null,
      decidedBy: null,
      decisionReason: null,
      decidedAt: null,
      engagementId: null,
      ...record,
      id: record.id || this.makeId('rec'),
      generatedAt: record.generatedAt || nowIso()
    };
    if (this.pool) {
      await this.pool.execute(
        `INSERT INTO recruitment_recommendations (id,company_id,score,recommendation,factors,reasons,source,decision,decided_by,decision_reason,decided_at,engagement_id,generated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE score=VALUES(score),recommendation=VALUES(recommendation),factors=VALUES(factors),reasons=VALUES(reasons),source=VALUES(source),decision=VALUES(decision),decided_by=VALUES(decided_by),decision_reason=VALUES(decision_reason),decided_at=VALUES(decided_at),engagement_id=VALUES(engagement_id),generated_at=VALUES(generated_at)`,
        [full.id, full.companyId, full.score, full.recommendation, JSON.stringify(full.factors || {}), JSON.stringify(full.reasons || []), full.source,
          full.decision, full.decidedBy, full.decisionReason, full.decidedAt ? new Date(full.decidedAt) : null, full.engagementId, new Date(full.generatedAt)]
      );
    } else {
      this.recommendations.set(full.id, full);
    }
    return full;
  }

  async getRecommendation(id) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM recruitment_recommendations WHERE id=?', [id]), { label: 'getRecommendation' });
      return this.recommendation(rows[0]);
    }
    return this.recommendation(this.recommendations.get(id));
  }

  async listRecommendations(filter = {}) {
    const rows = this.pool
      ? (await db.withRetry(() => this.pool.query('SELECT * FROM recruitment_recommendations ORDER BY generated_at DESC'), { label: 'listRecommendations' }))[0]
      : [...this.recommendations.values()].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
    return rows.map(row => this.recommendation(row)).filter(item => !filter.companyId || item.companyId === filter.companyId);
  }

  // --------------------------------------------------------------- candidate shares
  share(row) {
    if (!row) return null;
    return {
      id: row.id,
      engagementId: row.engagement_id || row.engagementId || null,
      companyId: row.company_id || row.companyId,
      recruiterId: row.recruiter_id || row.recruiterId,
      roleTitle: row.role_title || row.roleTitle || null,
      jobPostId: row.job_post_id || row.jobPostId || null,
      studentId: row.student_id || row.studentId,
      resumeId: row.resume_id || row.resumeId || null,
      accessLevel: row.access_level || row.accessLevel || 'summary',
      aiBrief: row.ai_brief || row.aiBrief || null,
      aiMatch: parse(row.ai_match || row.aiMatch) || null,
      approvedBy: row.approved_by || row.approvedBy || null,
      approvedByName: row.approved_by_name || row.approvedByName || null,
      sharedBy: row.shared_by || row.sharedBy,
      sharedByName: row.shared_by_name || row.sharedByName || null,
      policyMode: row.policy_mode || row.policyMode || 'university_controlled',
      status: row.status || 'shared',
      companyResponse: row.company_response || row.companyResponse || null,
      companyResponseNote: row.company_response_note || row.companyResponseNote || null,
      respondedAt: toDate(row.responded_at || row.respondedAt),
      revokedAt: toDate(row.revoked_at || row.revokedAt),
      revokedBy: row.revoked_by || row.revokedBy || null,
      accessedAt: toDate(row.accessed_at || row.accessedAt),
      accessCount: Number(row.access_count || row.accessCount || 0),
      createdAt: toDate(row.created_at || row.createdAt) || nowIso(),
      updatedAt: toDate(row.updated_at || row.updatedAt) || nowIso()
    };
  }

  async saveShare(share) {
    const record = {
      accessLevel: 'summary',
      policyMode: 'university_controlled',
      status: 'shared',
      aiBrief: null,
      aiMatch: null,
      approvedBy: null,
      approvedByName: null,
      roleTitle: null,
      jobPostId: null,
      engagementId: null,
      resumeId: null,
      ...share,
      id: share.id || this.makeId('rcs'),
      updatedAt: nowIso(),
      createdAt: share.createdAt || nowIso()
    };
    if (this.pool) {
      await this.pool.execute(
        `INSERT INTO recruitment_shares
          (id,engagement_id,company_id,recruiter_id,role_title,job_post_id,student_id,resume_id,access_level,ai_brief,ai_match,approved_by,approved_by_name,shared_by,shared_by_name,policy_mode,status,company_response,company_response_note,responded_at,revoked_at,revoked_by,accessed_at,access_count,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE engagement_id=VALUES(engagement_id),role_title=VALUES(role_title),job_post_id=VALUES(job_post_id),resume_id=VALUES(resume_id),access_level=VALUES(access_level),ai_brief=VALUES(ai_brief),ai_match=VALUES(ai_match),approved_by=VALUES(approved_by),approved_by_name=VALUES(approved_by_name),policy_mode=VALUES(policy_mode),status=VALUES(status),company_response=VALUES(company_response),company_response_note=VALUES(company_response_note),responded_at=VALUES(responded_at),revoked_at=VALUES(revoked_at),revoked_by=VALUES(revoked_by),accessed_at=VALUES(accessed_at),access_count=VALUES(access_count),updated_at=VALUES(updated_at)`,
        [record.id, record.engagementId, record.companyId, record.recruiterId, record.roleTitle, record.jobPostId, record.studentId, record.resumeId,
          record.accessLevel, record.aiBrief, record.aiMatch ? JSON.stringify(record.aiMatch) : null, record.approvedBy, record.approvedByName,
          record.sharedBy, record.sharedByName, record.policyMode, record.status, record.companyResponse, record.companyResponseNote,
          record.respondedAt ? new Date(record.respondedAt) : null, record.revokedAt ? new Date(record.revokedAt) : null, record.revokedBy,
          record.accessedAt ? new Date(record.accessedAt) : null, record.accessCount, new Date(record.createdAt), new Date(record.updatedAt)]
      );
    } else {
      this.shares.set(record.id, record);
    }
    return record;
  }

  async getShare(id) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM recruitment_shares WHERE id=?', [id]), { label: 'getShare' });
      return this.share(rows[0]);
    }
    return this.share(this.shares.get(id));
  }

  async listShares(filter = {}) {
    const rows = this.pool
      ? (await db.withRetry(() => this.pool.query('SELECT * FROM recruitment_shares ORDER BY created_at DESC'), { label: 'listShares' }))[0]
      : [...this.shares.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return rows
      .map(row => this.share(row))
      .filter(item =>
        (!filter.companyId || item.companyId === filter.companyId)
        && (!filter.engagementId || item.engagementId === filter.engagementId)
        && (!filter.recruiterId || item.recruiterId === filter.recruiterId)
        && (!filter.studentId || item.studentId === filter.studentId));
  }
}

module.exports = new RecruitmentStore();
