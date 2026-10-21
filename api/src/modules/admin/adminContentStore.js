const crypto = require('crypto');
const config = require('../../config');
const db = require('../../shared/db');

class AdminContentStore {
  constructor() { this.companies = new Map(); this.jobPosts = new Map(); this.applications = new Map(); this.pool = null; }

  async initialize() {
    if (!config.databaseConfigured) { require('../../shared/logger').db.warn('Admin content store: database not configured, using volatile in-memory storage.'); return; }
    this.pool = db.createPool({ connectionLimit: 10 });
    const connection = await this.pool.getConnection();
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS companies (id VARCHAR(64) PRIMARY KEY, name VARCHAR(180) NOT NULL, slug VARCHAR(180) NOT NULL UNIQUE, website VARCHAR(500), description TEXT, status VARCHAR(24) NOT NULL DEFAULT 'active', created_by VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)`);
      await connection.query(`CREATE TABLE IF NOT EXISTS job_posts (id VARCHAR(64) PRIMARY KEY, company_id VARCHAR(64) NOT NULL, title VARCHAR(180) NOT NULL, description TEXT NOT NULL, location VARCHAR(180), employment_type VARCHAR(64), application_url VARCHAR(500), work_mode VARCHAR(64), salary_min DECIMAL(12,2) NULL, salary_max DECIMAL(12,2) NULL, salary_currency VARCHAR(8) NULL, required_skills JSON NULL, eligibility JSON NULL, application_deadline DATETIME NULL, attachments JSON NULL, application_form JSON NULL, audience JSON NULL, review_note TEXT NULL, submitted_at DATETIME NULL, reviewed_by VARCHAR(64) NULL, reviewed_at DATETIME NULL, status VARCHAR(24) NOT NULL DEFAULT 'draft', published_at DATETIME NULL, created_by VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, FOREIGN KEY (company_id) REFERENCES companies(id))`);
      for (const statement of [
        'ALTER TABLE job_posts ADD COLUMN work_mode VARCHAR(64)',
        'ALTER TABLE job_posts ADD COLUMN salary_min DECIMAL(12,2) NULL',
        'ALTER TABLE job_posts ADD COLUMN salary_max DECIMAL(12,2) NULL',
        'ALTER TABLE job_posts ADD COLUMN salary_currency VARCHAR(8)',
        'ALTER TABLE job_posts ADD COLUMN required_skills JSON NULL',
        'ALTER TABLE job_posts ADD COLUMN eligibility JSON NULL',
        'ALTER TABLE job_posts ADD COLUMN application_deadline DATETIME NULL',
        'ALTER TABLE job_posts ADD COLUMN attachments JSON NULL',
        'ALTER TABLE job_posts ADD COLUMN application_form JSON NULL',
        'ALTER TABLE job_posts ADD COLUMN audience JSON NULL',
        'ALTER TABLE job_posts ADD COLUMN review_note TEXT NULL',
        'ALTER TABLE job_posts ADD COLUMN submitted_at DATETIME NULL',
        'ALTER TABLE job_posts ADD COLUMN reviewed_by VARCHAR(64) NULL',
        'ALTER TABLE job_posts ADD COLUMN reviewed_at DATETIME NULL',
        'ALTER TABLE job_posts ADD COLUMN updated_by VARCHAR(64) NULL',
        'ALTER TABLE companies ADD COLUMN logo_url VARCHAR(500)',
        'ALTER TABLE companies ADD COLUMN logo_public_id VARCHAR(200)'
      ]) { try { await connection.query(statement); } catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; } }
      // Backfill updated_by for rows that predate the column (updated_at was
      // already NOT NULL from creation, so no backfill needed for it).
      try { await connection.query('UPDATE job_posts SET updated_by = created_by WHERE updated_by IS NULL'); } catch (error) { /* best-effort backfill */ }
      await connection.query(`CREATE TABLE IF NOT EXISTS applications (id VARCHAR(64) PRIMARY KEY, job_post_id VARCHAR(64) NOT NULL, student_id VARCHAR(64) NOT NULL, resume_id VARCHAR(64) NULL, selected_resume JSON NULL, profile_snapshot JSON NOT NULL, answers JSON NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'applied', internal_note TEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE KEY unique_job_student (job_post_id, student_id), FOREIGN KEY (job_post_id) REFERENCES job_posts(id))`);
      await connection.query(`CREATE TABLE IF NOT EXISTS placement_policy (id VARCHAR(32) PRIMARY KEY, config JSON NOT NULL, updated_by VARCHAR(64) NULL, updated_at DATETIME NOT NULL)`);
      for (const statement of [
        'ALTER TABLE applications ADD COLUMN resume_id VARCHAR(64) NULL',
        'ALTER TABLE applications ADD COLUMN selected_resume JSON NULL'
      ]) { try { await connection.query(statement); } catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; } }
      for (const statement of [
        'ALTER TABLE applications ADD INDEX idx_applications_student_created (student_id, created_at)',
        'ALTER TABLE job_posts ADD INDEX idx_job_posts_status_updated (status, updated_at)'
      ]) { try { await connection.query(statement); } catch (error) { if (error.code !== 'ER_DUP_KEYNAME') throw error; } }
    } finally { connection.release(); }
  }

  makeId(prefix) { return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`; }
  company(row) { if (!row) return null; return { id: row.id, name: row.name, slug: row.slug, website: row.website || '', description: row.description || '', logoUrl: row.logo_url || row.logoUrl || '', logoPublicId: row.logo_public_id || row.logoPublicId || '', status: row.status, createdBy: row.created_by || row.createdBy, createdAt: new Date(row.created_at || row.createdAt).toISOString(), updatedAt: new Date(row.updated_at || row.updatedAt).toISOString() }; }
  parse(value, fallback) { if (value === null || value === undefined) return fallback; return typeof value === 'string' ? JSON.parse(value) : value; }
  jobPost(row) { if (!row) return null; return { id: row.id, companyId: row.company_id || row.companyId, title: row.title, description: row.description, location: row.location || '', employmentType: row.employment_type || row.employmentType || '', applicationUrl: row.application_url || row.applicationUrl || '', workMode: row.work_mode || row.workMode || '', salaryMin: row.salary_min !== undefined && row.salary_min !== null && row.salary_min !== '' ? Number(row.salary_min) : (row.salaryMin !== undefined && row.salaryMin !== null && row.salaryMin !== '' ? Number(row.salaryMin) : null), salaryMax: row.salary_max !== undefined && row.salary_max !== null && row.salary_max !== '' ? Number(row.salary_max) : (row.salaryMax !== undefined && row.salaryMax !== null && row.salaryMax !== '' ? Number(row.salaryMax) : null), salaryCurrency: row.salary_currency || row.salaryCurrency || 'INR', requiredSkills: this.parse(row.required_skills || row.requiredSkills, []), eligibility: this.parse(row.eligibility, { minCgpa: null, allowedDepartments: [], allowedBatches: [], maxActiveBacklogs: null }), applicationDeadline: row.application_deadline || row.applicationDeadline ? new Date(row.application_deadline || row.applicationDeadline).toISOString() : null, attachments: this.parse(row.attachments, []), applicationForm: this.parse(row.application_form || row.applicationForm, { fields: [] }), audience: this.parse(row.audience, { type: 'all' }), reviewNote: row.review_note || row.reviewNote || null, submittedAt: (row.submitted_at || row.submittedAt) ? new Date(row.submitted_at || row.submittedAt).toISOString() : null, reviewedBy: row.reviewed_by || row.reviewedBy || null, reviewedAt: (row.reviewed_at || row.reviewedAt) ? new Date(row.reviewed_at || row.reviewedAt).toISOString() : null, status: row.status, publishedAt: row.published_at || row.publishedAt ? new Date(row.published_at || row.publishedAt).toISOString() : null, createdBy: row.created_by || row.createdBy, updatedBy: row.updated_by || row.updatedBy || null, createdAt: new Date(row.created_at || row.createdAt).toISOString(), updatedAt: new Date(row.updated_at || row.updatedAt).toISOString() }; }

  async listCompanies() { if (this.pool) { const [rows] = await db.withRetry(() => this.pool.query("SELECT * FROM companies WHERE status <> 'archived' ORDER BY name ASC"), { label: 'listCompanies' }); return rows.map(row => this.company(row)); } return [...this.companies.values()].filter(company => company.status !== 'archived').sort((a, b) => a.name.localeCompare(b.name)).map(row => this.company(row)); }
  async getCompany(id) { if (this.pool) { const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM companies WHERE id=?', [id]), { label: 'getCompany' }); return this.company(rows[0]); } return this.company(this.companies.get(id)); }
  async findCompanyBySlug(slug) { if (this.pool) { const [rows] = await db.withRetry(() => this.pool.execute("SELECT * FROM companies WHERE slug=? AND status <> 'archived' LIMIT 1", [slug]), { label: 'findCompanyBySlug' }); return this.company(rows[0]); } return this.company([...this.companies.values()].find(company => company.slug === slug && company.status !== 'archived')); }
  async saveCompany(company) { const record = { ...company, id: company.id || this.makeId('co'), createdAt: company.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }; if (this.pool) { await this.pool.execute(`INSERT INTO companies (id,name,slug,website,description,logo_url,logo_public_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),slug=VALUES(slug),website=VALUES(website),description=VALUES(description),logo_url=VALUES(logo_url),logo_public_id=VALUES(logo_public_id),status=VALUES(status),updated_at=VALUES(updated_at)`, [record.id, record.name, record.slug, record.website || null, record.description || null, record.logoUrl || null, record.logoPublicId || null, record.status, record.createdBy, new Date(record.createdAt), new Date(record.updatedAt)]); } else this.companies.set(record.id, record); return this.company(record); }
  async archiveCompany(id) { const company = await this.getCompany(id); if (!company) return null; company.status = 'archived'; return this.saveCompany(company); }

  async listJobPosts(status) { if (this.pool) { const params = []; const filter = status && typeof status === 'string' && status.trim() !== '' ? ' WHERE j.status=?' : ''; if (filter) params.push(status); const [rows] = await db.withRetry(() => this.pool.execute(`SELECT j.*, c.name company_name, c.logo_url company_logo_url FROM job_posts j LEFT JOIN companies c ON c.id=j.company_id${filter} ORDER BY j.updated_at DESC`, params), { label: 'listJobPosts' }); return rows.map(row => ({ ...this.jobPost(row), companyName: row.company_name, companyLogoUrl: row.company_logo_url })); } return [...this.jobPosts.values()].filter(job => !status || job.status === status).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(row => { const comp = this.companies.get(row.companyId); return { ...this.jobPost(row), companyName: comp?.name || 'Unknown company', companyLogoUrl: comp?.logoUrl || '' }; }); }
  async getJobPost(id) { if (this.pool) { const [rows] = await db.withRetry(() => this.pool.execute('SELECT j.*, c.name company_name, c.logo_url company_logo_url FROM job_posts j LEFT JOIN companies c ON c.id=j.company_id WHERE j.id=?', [id]), { label: 'getJobPost' }); return rows[0] ? { ...this.jobPost(rows[0]), companyName: rows[0].company_name, companyLogoUrl: rows[0].company_logo_url } : null; } const job = this.jobPosts.get(id); if (!job) return null; const comp = this.companies.get(job.companyId); return { ...this.jobPost(job), companyName: comp?.name || 'Unknown company', companyLogoUrl: comp?.logoUrl || '' }; }
  async archiveJobPost(id) { const job = await this.getJobPost(id); if (!job) return null; const record = { ...job, status: 'archived', publishedAt: null }; if (this.pool) { await this.pool.execute("UPDATE job_posts SET status='archived', published_at=NULL, updated_at=NOW() WHERE id=?", [id]); return record; } this.jobPosts.set(id, record); return record; }
  async saveJobPost(job) { const record = { ...job, id: job.id || this.makeId('job'), workMode: job.workMode || '', salaryMin: job.salaryMin ?? null, salaryMax: job.salaryMax ?? null, salaryCurrency: job.salaryCurrency || 'INR', requiredSkills: job.requiredSkills || [], eligibility: job.eligibility || { minCgpa: null, allowedDepartments: [], allowedBatches: [], maxActiveBacklogs: null }, applicationDeadline: job.applicationDeadline || null, attachments: job.attachments || [], applicationForm: job.applicationForm || { fields: [] }, audience: job.audience || { type: 'all' }, status: job.status || 'draft', publishedAt: job.publishedAt || null, updatedBy: job.updatedBy || null, createdAt: job.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }; if (this.pool) { await this.pool.execute(`INSERT INTO job_posts (id,company_id,title,description,location,employment_type,application_url,work_mode,salary_min,salary_max,salary_currency,required_skills,eligibility,application_deadline,attachments,application_form,audience,review_note,submitted_at,reviewed_by,reviewed_at,status,published_at,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE company_id=VALUES(company_id),title=VALUES(title),description=VALUES(description),location=VALUES(location),employment_type=VALUES(employment_type),application_url=VALUES(application_url),work_mode=VALUES(work_mode),salary_min=VALUES(salary_min),salary_max=VALUES(salary_max),salary_currency=VALUES(salary_currency),required_skills=VALUES(required_skills),eligibility=VALUES(eligibility),application_deadline=VALUES(application_deadline),attachments=VALUES(attachments),application_form=VALUES(application_form),audience=VALUES(audience),review_note=VALUES(review_note),submitted_at=VALUES(submitted_at),reviewed_by=VALUES(reviewed_by),reviewed_at=VALUES(reviewed_at),status=VALUES(status),published_at=VALUES(published_at),created_by=VALUES(created_by),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)`, [record.id, record.companyId, record.title, record.description, record.location || null, record.employmentType || null, record.applicationUrl || null, record.workMode || null, record.salaryMin, record.salaryMax, record.salaryCurrency || null, JSON.stringify(record.requiredSkills), JSON.stringify(record.eligibility), record.applicationDeadline ? new Date(record.applicationDeadline) : null, JSON.stringify(record.attachments), JSON.stringify(record.applicationForm), JSON.stringify(record.audience), record.reviewNote || null, record.submittedAt ? new Date(record.submittedAt) : null, record.reviewedBy || null, record.reviewedAt ? new Date(record.reviewedAt) : null, record.status, record.publishedAt ? new Date(record.publishedAt) : null, record.createdBy, record.updatedBy, new Date(record.createdAt), new Date(record.updatedAt)]); } else this.jobPosts.set(record.id, record); return this.getJobPost(record.id); }

  application(row) {
    if (!row) return null;
    return {
      id: row.id,
      jobPostId: row.job_post_id || row.jobPostId,
      studentId: row.student_id || row.studentId,
      resumeId: row.resume_id || row.resumeId || null,
      selectedResume: this.parse(row.selected_resume || row.selectedResume, null),
      profileSnapshot: this.parse(row.profile_snapshot || row.profileSnapshot, {}),
      answers: this.parse(row.answers, {}),
      status: row.status,
      internalNote: row.internal_note || row.internalNote || '',
      createdAt: new Date(row.created_at || row.createdAt).toISOString(),
      updatedAt: new Date(row.updated_at || row.updatedAt).toISOString()
    };
  }

  async listApplications(jobPostId) {
    if (this.pool) {
      const params = [];
      const filter = jobPostId ? ' WHERE job_post_id=?' : '';
      if (jobPostId) params.push(jobPostId);
      const [rows] = await db.withRetry(() => this.pool.execute(`SELECT * FROM applications${filter} ORDER BY created_at DESC`, params), { label: 'listApplications' });
      return rows.map(row => this.application(row));
    }
    return [...this.applications.values()]
      .filter(item => !jobPostId || item.jobPostId === jobPostId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(row => this.application(row));
  }

  async listStudentApplications(studentId) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM applications WHERE student_id=? ORDER BY created_at DESC', [studentId]), { label: 'listStudentApplications' });
      return rows.map(row => this.application(row));
    }
    return [...this.applications.values()].filter(row => (row.student_id || row.studentId) === studentId)
      .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)).map(row => this.application(row));
  }

  async getJobPostsByIds(ids) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return [];
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute(`SELECT j.*, c.name company_name, c.logo_url company_logo_url FROM job_posts j LEFT JOIN companies c ON c.id=j.company_id WHERE j.id IN (${unique.map(() => '?').join(',')})`, unique), { label: 'getJobPostsByIds' });
      return rows.map(row => ({ ...this.jobPost(row), companyName: row.company_name, companyLogoUrl: row.company_logo_url }));
    }
    return unique.map(id => { const row = this.jobPosts.get(id); if (!row) return null; const company = this.companies.get(row.companyId); return { ...this.jobPost(row), companyName: company?.name || 'Unknown company', companyLogoUrl: company?.logoUrl || '' }; }).filter(Boolean);
  }

  async getPlacementStats(studentId) {
    if (!this.pool) return null; // Existing volatile-development route computes from maps.
    const read = (sql, params = []) => db.withRetry(() => this.pool.execute(sql, params), { label: 'getPlacementStats' });
    const [[[mine]], [[campus]], [[live]], [[students]], [companies]] = await Promise.all([
      read("SELECT COUNT(*) applications, SUM(status='shortlisted') shortlisted, SUM(status='interview') interviews, SUM(status='selected') selected, SUM(status='rejected') rejected FROM applications WHERE student_id=?", [studentId]),
      read("SELECT COUNT(*) totalApplications, SUM(status='selected') offers FROM applications"),
      read("SELECT COUNT(*) activeOpportunities FROM job_posts WHERE status='published'"),
      read('SELECT COUNT(*) students FROM students WHERE is_admin=FALSE AND is_recruiter=FALSE'),
      read("SELECT COALESCE(NULLIF(c.name,''),'Unknown') companyName, COUNT(*) applications, SUM(a.status='selected') selected FROM applications a INNER JOIN job_posts j ON j.id=a.job_post_id LEFT JOIN companies c ON c.id=j.company_id GROUP BY COALESCE(NULLIF(c.name,''),'Unknown') ORDER BY applications DESC LIMIT 8")
    ]);
    const numberFields = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0]));
    const cohort = numberFields({ ...campus, ...students });
    return { me: { ...numberFields(mine), ...numberFields(live) }, cohort: { ...cohort, applicationRate: cohort.students ? Math.round(cohort.totalApplications / cohort.students * 10) / 10 : 0 }, perCompany: companies.map(row => ({ companyName: row.companyName, applications: Number(row.applications), selected: Number(row.selected) || 0 })) };
  }

  async getApplication(id) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM applications WHERE id=?', [id]), { label: 'getApplication' });
      return this.application(rows[0]);
    }
    return this.application(this.applications.get(id));
  }

  async findApplication(jobPostId, studentId) {
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM applications WHERE job_post_id=? AND student_id=?', [jobPostId, studentId]), { label: 'findApplication' });
      return this.application(rows[0]);
    }
    return this.application([...this.applications.values()].find(item => item.jobPostId === jobPostId && item.studentId === studentId));
  }

  async saveApplication(application) {
    const record = {
      ...application,
      id: application.id || this.makeId('app'),
      resumeId: application.resumeId || null,
      selectedResume: application.selectedResume || null,
      status: application.status || 'applied',
      internalNote: application.internalNote || '',
      createdAt: application.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (this.pool) {
      await this.pool.execute(
        `INSERT INTO applications (id,job_post_id,student_id,resume_id,selected_resume,profile_snapshot,answers,status,internal_note,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE resume_id=VALUES(resume_id),selected_resume=VALUES(selected_resume),profile_snapshot=VALUES(profile_snapshot),answers=VALUES(answers),status=VALUES(status),internal_note=VALUES(internal_note),updated_at=VALUES(updated_at)`,
        [
          record.id,
          record.jobPostId,
          record.studentId,
          record.resumeId || null,
          JSON.stringify(record.selectedResume || null),
          JSON.stringify(record.profileSnapshot || {}),
          JSON.stringify(record.answers || {}),
          record.status,
          record.internalNote,
          new Date(record.createdAt),
          new Date(record.updatedAt)
        ]
      );
    } else {
      this.applications.set(record.id, record);
    }
    return this.application(record);
  }

  async getPlacementPolicy() {
    const defaultPolicy = {
      enabled: true,
      upgradeMultiplier: 1.5,
      maxOffersAllowed: 2,
      brackets: [
        { id: 'tier_1', name: 'Standard (< 7 LPA)', minLpa: 0, maxLpa: 7.0 },
        { id: 'tier_2', name: 'Dream (7 - 14 LPA)', minLpa: 7.0001, maxLpa: 14.0 },
        { id: 'tier_3', name: 'Super Dream (14+ LPA)', minLpa: 14.0001, maxLpa: null }
      ]
    };
    if (this.pool) {
      const [rows] = await db.withRetry(() => this.pool.execute('SELECT * FROM placement_policy WHERE id=?', ['default']), { label: 'getPlacementPolicy' });
      if (rows && rows[0]) {
        return { ...defaultPolicy, ...this.parse(rows[0].config, {}) };
      }
    }
    if (this.placementPolicy) return { ...defaultPolicy, ...this.placementPolicy };
    return defaultPolicy;
  }

  async savePlacementPolicy(policyConfig, adminId) {
    if (this.pool) {
      await this.pool.execute(
        `INSERT INTO placement_policy (id, config, updated_by, updated_at) VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE config=VALUES(config), updated_by=VALUES(updated_by), updated_at=NOW()`,
        ['default', JSON.stringify(policyConfig), adminId || null]
      );
    } else {
      this.placementPolicy = policyConfig;
    }
    return this.getPlacementPolicy();
  }
}

module.exports = new AdminContentStore();
