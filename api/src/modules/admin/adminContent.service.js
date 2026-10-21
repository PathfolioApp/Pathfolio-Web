const store = require('./adminContentStore');
const studentStore = require('../students/studentStore');
const auditLog = require('../../shared/auditLog.service');

const clean = value => String(value || '').trim();
const slugify = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const missing = (value, label) => { if (!clean(value)) throw new Error(`${label} is required.`); };
const notFound = label => { const error = new Error(`${label} not found.`); error.statusCode = 404; return error; };
const ensureLegacyInterests = interests => {
  // Older records stored plain tag strings; wrap them into the structured shape.
  const normalize = list => Array.isArray(list)
    ? list.map(item => typeof item === 'string' ? { name: item, proficiency: 'beginner', reason: '' } : item)
    : [];
  const source = interests || {};
  return { hobbies: normalize(source.hobbies), passions: normalize(source.passions) };
};
const allowedApplicationFields = new Set(['fullName', 'email', 'rollNumber', 'department', 'batchYear', 'resumeUrl', 'portfolioUrl', 'skills', 'cgpa']);
const normalizeAttachments = attachments => Array.isArray(attachments) ? attachments.map(item => ({ name: clean(item.name), url: clean(item.url), type: clean(item.type) })).filter(item => item.name && item.url).slice(0, 10) : [];
const normalizeForm = form => ({ fields: Array.isArray(form?.fields) ? form.fields.map((field, index) => ({ id: clean(field.id) || `field_${index + 1}`, label: clean(field.label), type: ['text', 'textarea', 'url'].includes(field.type) ? field.type : 'text', required: Boolean(field.required) })).filter(field => field.label).slice(0, 20) : [] });
const placementPolicy = require('./placementPolicy.service');
const resumeStore = require('../resumes/resumeStore');

const academicNumber = value => value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value);

const checkEligibility = (student, job, upgradeCheck = null) => {
  const issues = [];
  const criteria = job.eligibility || {};

  // CGPA Check
  const cgpa = academicNumber(student.academic?.cgpa);
  if (criteria.minCgpa !== null && criteria.minCgpa !== undefined) {
    if (!Number.isFinite(cgpa)) issues.push(`minimum CGPA ${criteria.minCgpa} (your CGPA is not on record)`);
    else if (cgpa < criteria.minCgpa) issues.push(`minimum CGPA ${criteria.minCgpa} (yours is ${cgpa})`);
  }

  // 10th Percentage Check
  if (criteria.minTenthPercentage !== null && criteria.minTenthPercentage !== undefined) {
    const tenth = academicNumber(student.academic?.tenthPercentage);
    if (!Number.isFinite(tenth)) issues.push(`minimum 10th percentage ${criteria.minTenthPercentage}% (not on record)`);
    else if (tenth < criteria.minTenthPercentage) issues.push(`minimum 10th percentage ${criteria.minTenthPercentage}% (yours is ${tenth}%)`);
  }

  // 12th Percentage Check
  if (criteria.minTwelfthPercentage !== null && criteria.minTwelfthPercentage !== undefined) {
    const twelfth = academicNumber(student.academic?.twelfthPercentage);
    if (!Number.isFinite(twelfth)) issues.push(`minimum 12th percentage ${criteria.minTwelfthPercentage}% (not on record)`);
    else if (twelfth < criteria.minTwelfthPercentage) issues.push(`minimum 12th percentage ${criteria.minTwelfthPercentage}% (yours is ${twelfth}%)`);
  }

  // Missing counts are unknown, not evidence of zero backlogs or gap years.
  for (const [field, limit, label] of [
    ['activeBacklogs', 'maxActiveBacklogs', 'active backlog(s)'],
    ['historicalBacklogs', 'maxHistoricalBacklogs', 'historical backlog(s)'],
    ['gapYears', 'maxGapYears', 'gap year(s)']
  ]) {
    if (criteria[limit] !== null && criteria[limit] !== undefined) {
      const value = academicNumber(student.academic?.[field]);
      if (!Number.isFinite(value)) issues.push(`at most ${criteria[limit]} ${label} (not on record)`);
      else if (value > criteria[limit]) issues.push(`at most ${criteria[limit]} ${label} (you have ${value})`);
    }
  }

  // Department Restriction
  if (criteria.allowedDepartments?.length && (!(student.academic?.department || '').trim() || !criteria.allowedDepartments.some(dept => (student.academic?.department || '').toLowerCase().includes(dept.toLowerCase()) || dept.toLowerCase().includes((student.academic?.department || '').toLowerCase())))) {
    issues.push(`department restriction (${criteria.allowedDepartments.join(', ')})`);
  }

  // Batch Restriction
  if (criteria.allowedBatches?.length && !criteria.allowedBatches.some(batch => String(student.academic?.batchYear || '').includes(batch))) {
    issues.push(`batch restriction (${criteria.allowedBatches.join(', ')})`);
  }

  // Placement Upgrade Policy Check
  if (upgradeCheck && Array.isArray(upgradeCheck.issues) && upgradeCheck.issues.length > 0) {
    issues.push(...upgradeCheck.issues);
  }

  return issues;
};

const JOB_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'published', 'closed'];

async function notifyAdminsOfSubmission(job) {
  const students = await studentStore.listStudents();
  await Promise.all(students.filter(student => student.isAdmin).map(admin => studentStore.createNotification(admin.id, { title: 'Job awaiting approval', message: `${job.companyName || 'A recruiter'} submitted "${job.title}" for review.`, type: 'job' })));
}

class AdminContentService {
  async companies() { return store.listCompanies(); }
  async importCompanies(rows, adminId) { if (!Array.isArray(rows)) throw new Error('CSV rows are required.'); const summary = { imported: 0, duplicates: 0, errors: [], companies: [] }; const seen = new Set(); for (let index = 0; index < rows.length; index += 1) { const row = rows[index] || {}; const name = clean(row.name); const line = index + 2; if (!name) { summary.errors.push({ row: line, message: 'Company name is required.' }); continue; } const slug = slugify(row.slug || name); if (seen.has(slug) || await store.findCompanyBySlug(slug)) { summary.duplicates += 1; continue; } seen.add(slug); try { const company = await store.saveCompany({ name, slug, website: clean(row.website), description: clean(row.description), logoUrl: clean(row.logourl || row.logo_url || row.logoUrl), logoPublicId: '', status: 'active', createdBy: adminId }); summary.imported += 1; summary.companies.push(company); } catch (error) { summary.errors.push({ row: line, message: error.message }); } } return summary; }
  async createCompany(input, adminId) { missing(input.name, 'Company name'); const name = clean(input.name); const slug = slugify(input.slug || name); missing(slug, 'Company slug'); if (await store.findCompanyBySlug(slug)) throw new Error('A company with that name already exists.'); return store.saveCompany({ name, slug, website: clean(input.website), description: clean(input.description), logoUrl: clean(input.logoUrl), logoPublicId: clean(input.logoPublicId), status: 'active', createdBy: adminId }); }
  async updateCompany(id, input) { const existing = await store.getCompany(id); if (!existing || existing.status === 'archived') throw notFound('Company'); const name = input.name === undefined ? existing.name : clean(input.name); missing(name, 'Company name'); const slug = slugify(input.slug === undefined ? existing.slug : input.slug || name); const conflict = await store.findCompanyBySlug(slug); if (conflict && conflict.id !== id) throw new Error('A company with that name already exists.'); return store.saveCompany({ ...existing, name, slug, website: input.website === undefined ? existing.website : clean(input.website), description: input.description === undefined ? existing.description : clean(input.description), logoUrl: input.logoUrl === undefined ? existing.logoUrl : clean(input.logoUrl), logoPublicId: input.logoPublicId === undefined ? existing.logoPublicId : clean(input.logoPublicId) }); }
  async archiveCompany(id) { const archived = await store.archiveCompany(id); if (!archived) throw notFound('Company'); return archived; }

  async jobs(status) { return store.listJobPosts(status); }
  async getJobPost(id) { return store.getJobPost(id); }

  /** Resolve a company by id, or find-or-create one by name (typed input). */
  async resolveCompany({ companyId, companyName }, adminId) {
    if (companyId) {
      const company = await store.getCompany(companyId);
      if (!company || company.status === 'archived') throw notFound('Company');
      return company;
    }
    const name = clean(companyName);
    if (!name) throw new Error('Company name is required.');
    if (name.length > 180) throw new Error('Company name is too long.');
    const slug = slugify(name);
    const existing = await store.findCompanyBySlug(slug);
    if (existing) return existing;
    return store.saveCompany({ name, slug, website: '', description: '', logoUrl: '', logoPublicId: '', status: 'active', createdBy: adminId });
  }
  async createJob(input, adminId, { enforceAudience = false, actorIsRecruiter = false } = {}) { missing(input.companyId || input.companyName, 'Company'); missing(input.title, 'Job title'); missing(input.description, 'Job description'); const company = await this.resolveCompany(input, adminId); return store.saveJobPost({ companyId: company.id, title: clean(input.title), description: clean(input.description), location: clean(input.location), employmentType: clean(input.employmentType), applicationUrl: clean(input.applicationUrl), workMode: clean(input.workMode), salaryMin: input.salaryMin === undefined ? null : Number(input.salaryMin) || null, salaryMax: input.salaryMax === undefined ? null : Number(input.salaryMax) || null, salaryCurrency: clean(input.salaryCurrency) || 'INR', requiredSkills: Array.isArray(input.requiredSkills) ? [...new Set(input.requiredSkills.map(clean).filter(Boolean))].slice(0, 25) : [], eligibility: { minCgpa: input.eligibility?.minCgpa === undefined || input.eligibility?.minCgpa === null || input.eligibility?.minCgpa === '' ? null : Number(input.eligibility.minCgpa), minTenthPercentage: input.eligibility?.minTenthPercentage === undefined || input.eligibility?.minTenthPercentage === null || input.eligibility?.minTenthPercentage === '' ? null : Number(input.eligibility.minTenthPercentage), minTwelfthPercentage: input.eligibility?.minTwelfthPercentage === undefined || input.eligibility?.minTwelfthPercentage === null || input.eligibility?.minTwelfthPercentage === '' ? null : Number(input.eligibility.minTwelfthPercentage), allowedDepartments: Array.isArray(input.eligibility?.allowedDepartments) ? input.eligibility.allowedDepartments.map(clean).filter(Boolean).slice(0, 15) : [], allowedBatches: Array.isArray(input.eligibility?.allowedBatches) ? input.eligibility.allowedBatches.map(clean).filter(Boolean).slice(0, 10) : [], maxActiveBacklogs: input.eligibility?.maxActiveBacklogs === undefined || input.eligibility?.maxActiveBacklogs === '' ? null : Number(input.eligibility.maxActiveBacklogs) }, applicationDeadline: clean(input.applicationDeadline) || null, attachments: normalizeAttachments(input.attachments), applicationForm: normalizeForm(input.applicationForm), audience: enforceAudience ? { type: 'all' } : (input.audience || { type: 'all' }), status: 'draft', createdBy: adminId }); }
  /**
   * Edit a job post. Allowed for every status (draft, pending_approval,
   * approved, published, closed, rejected): the placement team may need to fix
   * a typo on a live post without unpublishing it. Saving NEVER changes the
   * post's status or clears its publish/review bookkeeping - only an explicit
   * publish/unpublish/review action does. `updated_at`/`updated_by` are
   * stamped for the "Edited ..." indicator and audit trail.
   */
  async updateJob(id, input, { editorId } = {}) {
    const existing = await store.getJobPost(id);
    if (!existing) throw notFound('Job post');
    const companyId = (input.companyId !== undefined || input.companyName !== undefined) ? (await this.resolveCompany({ companyId: input.companyId, companyName: input.companyName }, existing.createdBy)).id : existing.companyId;
    const title = input.title === undefined ? existing.title : clean(input.title);
    const description = input.description === undefined ? existing.description : clean(input.description);
    missing(title, 'Job title');
    missing(description, 'Job description');
    const saved = await store.saveJobPost({
      ...existing,
      companyId,
      title,
      description,
      location: input.location === undefined ? existing.location : clean(input.location),
      employmentType: input.employmentType === undefined ? existing.employmentType : clean(input.employmentType),
      applicationUrl: input.applicationUrl === undefined ? existing.applicationUrl : clean(input.applicationUrl),
      workMode: input.workMode === undefined ? existing.workMode : clean(input.workMode),
      salaryMin: input.salaryMin === undefined ? existing.salaryMin : Number(input.salaryMin) || null,
      salaryMax: input.salaryMax === undefined ? existing.salaryMax : Number(input.salaryMax) || null,
      salaryCurrency: input.salaryCurrency === undefined ? existing.salaryCurrency : clean(input.salaryCurrency) || 'INR',
      requiredSkills: input.requiredSkills === undefined ? existing.requiredSkills : [...new Set(input.requiredSkills.map(clean).filter(Boolean))].slice(0, 25),
      eligibility: input.eligibility === undefined ? existing.eligibility : {
        minCgpa: input.eligibility?.minCgpa === undefined || input.eligibility?.minCgpa === null || input.eligibility?.minCgpa === '' ? null : Number(input.eligibility.minCgpa),
        minTenthPercentage: input.eligibility?.minTenthPercentage === undefined || input.eligibility?.minTenthPercentage === null || input.eligibility?.minTenthPercentage === '' ? null : Number(input.eligibility.minTenthPercentage),
        minTwelfthPercentage: input.eligibility?.minTwelfthPercentage === undefined || input.eligibility?.minTwelfthPercentage === null || input.eligibility?.minTwelfthPercentage === '' ? null : Number(input.eligibility.minTwelfthPercentage),
        allowedDepartments: Array.isArray(input.eligibility?.allowedDepartments) ? input.eligibility.allowedDepartments.map(clean).filter(Boolean).slice(0, 15) : [],
        allowedBatches: Array.isArray(input.eligibility?.allowedBatches) ? input.eligibility.allowedBatches.map(clean).filter(Boolean).slice(0, 10) : [],
        maxActiveBacklogs: input.eligibility?.maxActiveBacklogs === undefined || input.eligibility?.maxActiveBacklogs === '' ? null : Number(input.eligibility.maxActiveBacklogs)
      },
      applicationDeadline: input.applicationDeadline === undefined ? existing.applicationDeadline : clean(input.applicationDeadline) || null,
      attachments: input.attachments === undefined ? existing.attachments : normalizeAttachments(input.attachments),
      applicationForm: input.applicationForm === undefined ? existing.applicationForm : normalizeForm(input.applicationForm),
      audience: input.audience === undefined ? existing.audience : input.audience,
      // Status and lifecycle fields are preserved exactly as they were.
      status: existing.status,
      reviewNote: existing.reviewNote,
      publishedAt: existing.publishedAt,
      updatedBy: editorId || existing.updatedBy || null
    });
    // Audit trail: who edited which post and when (Logs page).
    let editorName = '';
    if (editorId) {
      const editor = await studentStore.getStudentById(editorId);
      editorName = editor?.personal?.fullName || '';
    }
    const companyName = saved.companyName || (await store.getCompany(saved.companyId))?.name || '';
    await auditLog.record({
      actorId: editorId || existing.createdBy,
      actorName: editorName,
      action: 'job.edit',
      entityType: 'job_post',
      entityId: saved.id,
      entityLabel: saved.title,
      detail: `Edited "${saved.title}"${companyName ? ` (${companyName})` : ''} while ${saved.status === 'published' ? 'live' : saved.status.replace('_', ' ')}.`
    });
    return saved;
  }
  async publishJob(id, adminId) { const existing = await store.getJobPost(id); if (!existing) throw notFound('Job post'); if (!['published', 'approved', 'draft'].includes(existing.status)) throw new Error('Only draft or approved jobs can be published by an administrator.'); missing(existing.title, 'Job title'); missing(existing.description, 'Job description'); const company = await store.getCompany(existing.companyId); if (!company || company.status === 'archived') throw notFound('Company'); const published = await store.saveJobPost({ ...existing, status: 'published', publishedAt: new Date().toISOString() });
    if (existing.status !== 'published') { await auditLog.record({ actorId: adminId, action: 'job.publish', entityType: 'job_post', entityId: published.id, entityLabel: published.title, detail: `Published to students (${published.companyName || existing.companyName || 'company'}).` }); } const students = (await studentStore.listStudents()).filter(student => !student.isAdmin && !student.isRecruiter); await Promise.all(students.map(student => studentStore.createNotification(student.id, { title: `New opportunity: ${published.title}`, message: `${published.companyName} has published a new opportunity.`, type: 'opportunity' }))); return published; }
  async unpublishJob(id) { const existing = await store.getJobPost(id); if (!existing) throw notFound('Job post'); return store.saveJobPost({ ...existing, status: 'closed', publishedAt: existing.publishedAt }); }
  async reopenJob(id) { const existing = await store.getJobPost(id); if (!existing) throw notFound('Job post'); if (existing.status !== 'closed') throw new Error('Only closed jobs can be reopened.'); return store.saveJobPost({ ...existing, status: 'approved', publishedAt: null }); }
  async closeJob(id) { const existing = await store.getJobPost(id); if (!existing) throw notFound('Job post'); return store.saveJobPost({ ...existing, status: 'closed' }); }

  /** Recruiter submits a draft for admin approval. Recruiters cannot publish. */
  async submitJobForApproval(id, recruiterId) { const existing = await store.getJobPost(id); if (!existing) throw notFound('Job post'); if (existing.createdBy !== recruiterId) throw { statusCode: 403, message: 'You can only submit your own job posts.' }; if (!['draft', 'rejected'].includes(existing.status)) throw new Error('Only drafts or rejected jobs can be submitted for approval.'); missing(existing.title, 'Job title'); missing(existing.description, 'Job description'); const submitted = await store.saveJobPost({ ...existing, status: 'pending_approval', submittedAt: new Date().toISOString(), reviewNote: null }); await auditLog.record({ actorId: recruiterId, actorName: existing.createdByName || 'Recruiter', action: 'job.submit', entityType: 'job_post', entityId: submitted.id, entityLabel: submitted.title, detail: `Job submitted for approval (${existing.companyName || 'company'}).` }); await notifyAdminsOfSubmission(submitted); return submitted; }

  /** Admin decision on a pending job: approve or reject (with an optional note). */
  async reviewJob(id, adminId, { decision, note }) {
    const existing = await store.getJobPost(id);
    if (!existing) throw notFound('Job post');
    if (existing.status !== 'pending_approval') throw new Error('Only jobs pending approval can be reviewed.');
    const action = clean(decision).toLowerCase();
    if (!['approve', 'reject'].includes(action)) throw new Error('Decision must be approve or reject.');
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const reviewed = await store.saveJobPost({ ...existing, status: nextStatus, reviewNote: clean(note) || null, reviewedBy: adminId, reviewedAt: new Date().toISOString() });
    await auditLog.record({ actorId: adminId, action: action === 'approve' ? 'job.approve' : 'job.reject', entityType: 'job_post', entityId: reviewed.id, entityLabel: reviewed.title, detail: action === 'approve' ? 'Job approved.' : `Changes requested${reviewed.reviewNote ? `: ${reviewed.reviewNote}` : '.'}` });
    await studentStore.createNotification(reviewed.createdBy, { title: action === 'approve' ? `Job approved: ${reviewed.title}` : `Job needs changes: ${reviewed.title}`, message: action === 'approve' ? 'Your job post was approved. An administrator will publish it to students.' : reviewed.reviewNote || 'Your job post was not approved. Review the note and resubmit.', type: 'job' });
    return reviewed;
  }
  async applications(jobPostId) { if (jobPostId && !await store.getJobPost(jobPostId)) throw notFound('Job post'); return store.listApplications(jobPostId); }
  async updateApplication(id, input) { const existing = await store.getApplication(id); if (!existing) throw notFound('Application'); const statuses = new Set(['applied', 'shortlisted', 'interview', 'selected', 'rejected']); if (input.status && !statuses.has(input.status)) throw new Error('Invalid application status.'); const updated = await store.saveApplication({ ...existing, status: input.status || existing.status, internalNote: input.internalNote === undefined ? existing.internalNote : clean(input.internalNote) }); await studentStore.createNotification(updated.studentId, { title: `Application update: ${updated.status}`, message: `Your application status has been updated for a Pathfolio opportunity.`, type: 'application' }); return updated; }
  async updateApplicationsBulk(ids, input) {
    if (!Array.isArray(ids) || ids.length === 0) return { updatedCount: 0, applications: [] };
    const statuses = new Set(['applied', 'shortlisted', 'interview', 'selected', 'rejected']);
    if (input.status && !statuses.has(input.status)) throw new Error('Invalid application status.');
    const results = [];
    for (const id of ids) {
      try {
        const app = await this.updateApplication(id, input);
        results.push(app);
      } catch (err) {
        // continue updating the rest of the selected batch
      }
    }
    return { updatedCount: results.length, applications: results };
  }
  async publishedJobs() { return store.listJobPosts('published'); }
  async publishedJobsForStudent(studentId, profile = null) {
    const student = profile?.id === studentId ? profile : await studentStore.getStudentById(studentId);
    if (!student) throw notFound('Student');
    const [jobs, myApps] = await Promise.all([store.listJobPosts('published'), store.listStudentApplications(studentId)]);
    const appliedMap = new Map(myApps.map(a => [a.jobPostId, a]));
    const context = jobs.length ? await placementPolicy.createEligibilityContext(studentId, { applications: myApps, jobs }) : null;

    const result = [];
    for (const job of jobs) {
      const upgradeCheck = await placementPolicy.evaluateUpgradeEligibility(studentId, job, context);
      const issues = checkEligibility(student, job, upgradeCheck);
      const existingApplication = appliedMap.get(job.id) || null;

      result.push({
        ...job,
        hasApplied: Boolean(existingApplication),
        application: existingApplication,
        deadlinePassed: Boolean(job.applicationDeadline && new Date(job.applicationDeadline) < new Date()),
        eligibility: {
          ...job.eligibility,
          issues,
          meetsAll: issues.length === 0,
          upgradePolicy: upgradeCheck
        }
      });
    }
    return result;
  }

  async apply(jobPostId, studentId, payload = {}) {
    const job = await store.getJobPost(jobPostId);
    if (!job || job.status !== 'published') throw notFound('Published job post');
    if (job.applicationDeadline && new Date(job.applicationDeadline) < new Date()) {
      throw new Error('The application deadline for this role has passed.');
    }
    if (await store.findApplication(jobPostId, studentId)) {
      throw new Error('You have already applied to this opportunity.');
    }
    const student = await studentStore.getStudentById(studentId);
    if (!student) throw notFound('Student');

    // Run eligibility checks (academics + placement upgrade policy)
    const upgradeCheck = await placementPolicy.evaluateUpgradeEligibility(studentId, job);
    const eligibilityIssues = checkEligibility(student, job, upgradeCheck);
    if (eligibilityIssues.length) {
      throw new Error(`You do not meet the eligibility criteria: ${eligibilityIssues.join('; ')}.`);
    }

    // Extract resumeId & custom form answers
    const resumeId = typeof payload === 'object' && payload?.resumeId ? payload.resumeId : null;
    const answers = typeof payload === 'object' && payload?.answers ? payload.answers : (typeof payload === 'object' && !payload?.resumeId ? payload : {});

    // Resolve resume
    let chosenResume = null;
    if (resumeId) {
      chosenResume = await resumeStore.findOwnedResume(studentId, resumeId);
    }
    if (!chosenResume) {
      const resumes = await resumeStore.list(studentId);
      chosenResume = resumes.find(r => r.isDefault) || resumes[0];
    }
    if (!chosenResume) {
      throw new Error('Please upload at least one resume before submitting an application.');
    }

    const form = job.applicationForm || { fields: [] };
    const safeAnswers = {};
    for (const field of form.fields || []) {
      const value = clean(answers?.[field.id]);
      if (field.required && !value) throw new Error(`${field.label} is required.`);
      if (value) safeAnswers[field.id] = value;
    }

    // Generate lightweight, verified immutable profile snapshot
    const socials = {
      linkedin: student.social?.linkedin || '',
      github: student.social?.github || '',
      portfolio: student.social?.portfolio || '',
      leetcode: student.social?.leetcode || '',
      codeforces: student.social?.codeforces || '',
      codechef: student.social?.codechef || '',
      links: Array.isArray(student.social?.links) ? student.social.links : []
    };
    if (Array.isArray(student.social?.links)) {
      for (const item of student.social.links) {
        const p = String(item.platform || '').toLowerCase();
        if (p === 'github' && !socials.github) socials.github = item.url;
        if ((p === 'portfolio' || p === 'website') && !socials.portfolio) socials.portfolio = item.url;
        if (p === 'leetcode' && !socials.leetcode) socials.leetcode = item.url;
        if (p === 'codeforces' && !socials.codeforces) socials.codeforces = item.url;
        if (p === 'codechef' && !socials.codechef) socials.codechef = item.url;
        if (p === 'linkedin' && !socials.linkedin) socials.linkedin = item.url;
      }
    }

    const snapshot = {
      studentId: student.id,
      personal: {
        fullName: student.personal.fullName,
        email: student.personal.email,
        phone: student.personal.phone || '',
        dateOfBirth: student.personal.dateOfBirth || null
      },
      academic: {
        rollNumber: student.academic?.rollNumber || student.rollNumber || '',
        department: student.academic?.department || '',
        batchYear: student.academic?.batchYear || '',
        degreeProgram: student.academic?.degreeProgram || '',
        currentSemester: student.academic?.currentSemester ?? null,
        graduationYear: student.academic?.graduationYear ?? null,
        cgpa: student.academic?.cgpa ?? null,
        tenthPercentage: student.academic?.tenthPercentage ?? null,
        twelfthPercentage: student.academic?.twelfthPercentage ?? null,
        activeBacklogs: student.academic?.activeBacklogs ?? 0,
        historicalBacklogs: student.academic?.historicalBacklogs ?? 0,
        gapYears: student.academic?.gapYears ?? 0
      },
      selectedResume: {
        id: chosenResume.id,
        filename: chosenResume.filename || chosenResume.originalName || 'Resume.pdf',
        url: `/api/resumes/${chosenResume.id}/file`,
        driveLink: chosenResume.driveLink || null,
        isCloud: Boolean(chosenResume.isCloud),
        uploadedAt: chosenResume.uploadedAt
      },
      social: socials,
      // Flat fallbacks for backward compatibility
      fullName: student.personal.fullName,
      email: student.personal.email,
      phone: student.personal.phone || '',
      rollNumber: student.academic?.rollNumber || student.rollNumber || '',
      department: student.academic?.department || '',
      batchYear: student.academic?.batchYear || '',
      cgpa: student.academic?.cgpa ?? null,
      tenthPercentage: student.academic?.tenthPercentage ?? null,
      twelfthPercentage: student.academic?.twelfthPercentage ?? null,
      activeBacklogs: student.academic?.activeBacklogs ?? 0,
      appliedAt: new Date().toISOString()
    };

    return store.saveApplication({
      jobPostId,
      studentId,
      resumeId: chosenResume.id,
      selectedResume: snapshot.selectedResume,
      profileSnapshot: snapshot,
      answers: safeAnswers,
      status: 'applied'
    });
  }
}

module.exports = new AdminContentService();
module.exports.checkEligibility = checkEligibility;
