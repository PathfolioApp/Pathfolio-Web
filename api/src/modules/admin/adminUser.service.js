const studentStore = require('../students/studentStore');
const onboarding = require('../onboarding/onboarding.service');
const auth = require('../auth/auth.service');
const auditLog = require('../../shared/auditLog.service');

const clean = value => String(value || '').trim();
const publicUser = student => ({ id: student.id, fullName: student.personal?.fullName || '', email: student.personal?.email || '', phone: student.personal?.phone || '', dateOfBirth: student.personal?.dateOfBirth || '', avatarUrl: student.personal?.avatarUrl || '', department: student.academic?.department || '', batchYear: student.academic?.batchYear || '', rollNumber: student.academic?.rollNumber || student.rollNumber || '', cgpa: student.academic?.cgpa ?? null, activeBacklogs: student.academic?.activeBacklogs ?? null, role: student.isAdmin ? 'admin' : student.isRecruiter ? 'recruiter' : 'student', status: student.status || 'active', blocked: Boolean(student.blocked), achievementsCount: (student.achievements || []).length, internshipsCount: (student.internships || []).length, projectsCount: (student.projects || []).length, interestsCount: ((student.interests?.hobbies || []).length + (student.interests?.passions || []).length), createdAt: student.createdAt, updatedAt: student.updatedAt, onboarding: student.onboarding || {} });

class AdminUserService {
  async list() { return (await studentStore.listStudents()).map(publicUser).sort((a, b) => a.fullName.localeCompare(b.fullName)); }

  /**
   * Full per-user dossier for the admin Users workspace: identity, academics,
   * portfolio counts, placement/outcome history, resume library, recruiter
   * linkage, and share/feedback activity. Aggregates existing stores; reads
   * only, no new tables.
   */
  async getDetail(id) {
    const student = await studentStore.getStudentById(id);
    if (!student) { const error = new Error('User not found.'); error.statusCode = 404; throw error; }
    const base = publicUser(student);
    const adminContentStore = require('./adminContentStore');
    const resumeStore = require('../resumes/resumeStore');
    const [applications, resumes, shares] = await Promise.all([
      adminContentStore.listApplications().catch(() => []),
      resumeStore.list(id).catch(() => []),
      require('../recruiters/recruiterShare.service').listShares().catch(() => [])
    ]);
    const myApplications = applications.filter(application => application.studentId === id);
    const jobPosts = await adminContentStore.listJobPosts().catch(() => []);
    const jobById = new Map(jobPosts.map(job => [job.id, job]));

    // Applications with role/company context and outcome per application.
    const applicationHistory = myApplications.map(application => {
      const job = jobById.get(application.jobPostId);
      return {
        id: application.id,
        jobTitle: job?.title || 'Removed post',
        companyName: job?.companyName || '',
        status: application.status,
        appliedAt: application.createdAt,
        updatedBy: application.updatedAt
      };
    });
    const selected = applicationHistory.filter(application => ['selected', 'placed'].includes(application.status));

    // Shares this student appears in (legacy shortlists) with company feedback.
    const recruiterActivity = shares
      .filter(share => share.studentIds?.includes(id))
      .map(share => {
        const feedback = (share.recruiterFeedback || []).find(entry => entry.studentId === id);
        return {
          shareId: share.id,
          jobTitle: share.jobTitle || null,
          status: share.status,
          sharedAt: share.createdAt,
          viewedAt: share.recruiterViewedAt || null,
          feedback: feedback ? { status: feedback.status, note: feedback.feedback, at: feedback.at } : null
        };
      });

    return {
      ...base,
      social: student.social || { linkedin: '', links: [] },
      headline: student.personal?.headline || '',
      location: student.personal?.location || '',
      tenthPercentage: student.academic?.tenthPercentage ?? null,
      twelfthPercentage: student.academic?.twelfthPercentage ?? null,
      historicalBacklogs: student.academic?.historicalBacklogs ?? null,
      gapYears: student.academic?.gapYears ?? null,
      onboardingCompleted: student.onboarding?.completed !== false,
      onboardingCompletedAt: student.onboarding?.completedAt || null,
      publicProfileEnabled: Boolean(student.profileSettings?.publicShare?.tokenHash && !student.profileSettings.publicShare.revoked),
      publicProfileViews: Number(student.profileSettings?.publicShare?.viewCount || 0),
      resumeCount: resumes.length,
      defaultResume: resumes.find(resume => resume.isDefault)?.filename || null,
      resumeCategories: [...new Set(resumes.map(resume => resume.category).filter(Boolean))],
      resumeList: resumes.slice(0, 15).map(resume => ({ id: resume.id, filename: resume.filename, category: resume.category, isDefault: resume.isDefault, tags: (resume.tags || []).slice(0, 6), uploadedAt: resume.uploadedAt, analysisScore: resume.analysis?.score ?? null })),
      applicationsCount: applicationHistory.length,
      selectedCount: selected.length,
      applicationHistory: applicationHistory.slice(0, 20),
      recruiterActivity: recruiterActivity.slice(0, 20),
      // Complete structured record of everything the student entered.
      structuredInterests: {
        passions: (student.interests?.passions || []).map(item => typeof item === 'string' ? { name: item } : { name: item.name, proficiency: item.proficiency || null, reason: item.reason || '' }),
        hobbies: (student.interests?.hobbies || []).map(item => typeof item === 'string' ? { name: item } : { name: item.name, proficiency: item.proficiency || null, reason: item.reason || '' })
      },
      semesterRecords: (student.academic?.semesters || []).map(semester => ({
        id: semester.id, semester: semester.semester, sgpa: semester.sgpa ?? null, cgpa: semester.cgpa ?? null,
        academicYear: semester.academicYear || '', hasTranscript: Boolean(semester.transcript?.filename), transcriptName: semester.transcript?.filename || null
      })),
      documentsOnFile: {
        tenthMarksheet: Boolean(student.academic?.tenthMarksheet?.filename || student.academic?.tenth_marksheet?.filename),
        twelfthMarksheet: Boolean(student.academic?.twelfthMarksheet?.filename || student.academic?.twelfth_marksheet?.filename)
      },
      familyContext: {
        // Consent state is shown to the admin so sensitive data handling stays auditable.
        recorded: Boolean(student.familyContext?.details),
        consentGiven: Boolean(student.familyContext?.consentGiven),
        details: student.familyContext?.details || ''
      },
      profileVisibility: student.profileSettings?.visibility || 'private',
      fieldVisibility: student.profileSettings?.fieldVisibility || {},
      allAchievements: (student.achievements || []).map(achievement => ({ id: achievement.id, title: achievement.title, category: achievement.category, description: achievement.description, year: achievement.year })),
      allProjects: (student.projects || []).map(project => ({
        id: project.id, name: project.projectName, type: project.projectType, description: project.description,
        technologies: project.technologies || [], startDate: project.startDate, endDate: project.endDate,
        currentlyWorking: Boolean(project.currentlyWorking), projectUrl: project.projectUrl, repoUrl: project.repoUrl,
        featured: Boolean(project.featured), hasDocument: Boolean(project.document?.filename || project.documentUrl), contributions: (project.contributions || []).slice(0, 8)
      })),
      allInternships: (student.internships || []).map(internship => ({
        id: internship.id, role: internship.role, company: internship.companyName, description: internship.description,
        skills: internship.skills || [], location: internship.location, workMode: internship.workMode,
        startDate: internship.startDate, endDate: internship.endDate, currentlyWorking: Boolean(internship.currentlyWorking),
        hasCertificate: Boolean(internship.certificate?.filename || internship.certificateUrl), responsibilities: (internship.responsibilities || []).slice(0, 8)
      })),
      recentAchievements: (student.achievements || []).slice(0, 5).map(achievement => ({ title: achievement.title, category: achievement.category, year: achievement.year })),
      recentProjects: (student.projects || []).slice(0, 5).map(project => ({ name: project.projectName, technologies: (project.technologies || []).slice(0, 5) })),
      recentInternships: (student.internships || []).slice(0, 5).map(internship => ({ role: internship.role, company: internship.companyName, currentlyWorking: internship.currentlyWorking })),
      topSkills: [...(student.interests?.passions || []), ...(student.interests?.hobbies || [])]
        .map(item => typeof item === 'string' ? item : item?.name)
        .filter(Boolean)
        .slice(0, 10)
    };
  }

  async overview() {
    const users = await this.list();
    return {
      total: users.length,
      students: users.filter(user => user.role === 'student').length,
      recruiters: users.filter(user => user.role === 'recruiter').length,
      admins: users.filter(user => user.role === 'admin').length,
      blocked: users.filter(user => user.blocked).length,
      onboardingComplete: users.filter(user => user.onboarding?.completed).length,
      recentSignups: users.filter(user => user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * 86400000).length
    };
  }

  async create(input, { allowAdmin = false } = {}) {
    const fullName = clean(input.fullName || input.name);
    const email = clean(input.email).toLowerCase();
    const password = String(input.password || '');
    if (fullName.length < 2) throw new Error('Full name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (await studentStore.getStudentByEmail(email)) throw new Error(`An account already exists for ${email}.`);
    const role = clean(input.role).toLowerCase() || 'student';
    if (!['student', 'recruiter', 'admin'].includes(role)) throw new Error('Role must be student or recruiter.');
    if (role === 'admin' && !allowAdmin) throw new Error('Admin accounts can only be created through the bootstrap configuration.');
    const now = new Date().toISOString();
    const record = await studentStore.saveStudent({
      personal: { fullName, dateOfBirth: clean(input.dateOfBirth) || '', email, phone: clean(input.phone) },
      academic: { rollNumber: clean(input.rollNumber) || `EXT-${Date.now()}`, department: clean(input.department) || 'Not specified', batchYear: clean(input.batchYear) || 'Not specified' },
      interests: { hobbies: [], passions: [] }, achievements: [], internships: [], familyContext: { details: '', consentGiven: false },
      profileSettings: { visibility: 'private', fieldVisibility: { personal: 'student', academic: 'student', interests: 'shareable', achievements: 'shareable', familyContext: 'student' } },
      passwordHash: await auth.hashPassword(password), isAdmin: role === 'admin', isRecruiter: role === 'recruiter',
      onboarding: { completed: true, completedAt: now }, status: 'active_onboarded', createdAt: now
    });
    await studentStore.createNotification(record.id, { title: 'Account created', message: 'Your PathfolioApp account is ready.', type: 'account' });
    return publicUser(record);
  }

  async setRole(id, role, adminId) {
    const nextRole = clean(role).toLowerCase();
    if (!['student', 'recruiter'].includes(nextRole)) throw new Error('Role must be student or recruiter.');
    const student = await studentStore.getStudentById(id);
    if (!student) { const error = new Error('User not found.'); error.statusCode = 404; throw error; }
    if (student.isAdmin) throw new Error('The bootstrap admin cannot be changed here.');
    student.isRecruiter = nextRole === 'recruiter';
    await studentStore.saveStudent(student);
    await auditLog.record({ actorId: adminId, action: 'user.role', entityType: 'user', entityId: student.id, entityLabel: student.personal?.fullName || student.personal?.email, detail: `Role changed to ${nextRole}.` });
    return publicUser(student);
  }

  async setBlocked(id, blocked, adminId) {
    const student = await studentStore.getStudentById(id);
    if (!student) { const error = new Error('User not found.'); error.statusCode = 404; throw error; }
    if (student.isAdmin) throw new Error('Administrators cannot be blocked.');
    if (student.id === adminId) throw new Error('You cannot block your own account.');
    student.blocked = Boolean(blocked);
    if (student.blocked) await studentStore.deleteSessionsForUser(student.id);
    await studentStore.saveStudent(student);
    await auditLog.record({ actorId: adminId, action: blocked ? 'user.block' : 'user.unblock', entityType: 'user', entityId: student.id, entityLabel: student.personal?.fullName || student.personal?.email, detail: blocked ? 'Account access blocked.' : 'Account access restored.' });
    await studentStore.createNotification(student.id, {
      title: student.blocked ? 'Account access blocked' : 'Account access restored',
      message: student.blocked ? 'Your account has been blocked by the institution. Contact your PathfolioApp administrator for help.' : 'Your account has been unblocked. Welcome back!',
      type: 'account'
    });
    return publicUser(student);
  }

  async deleteAccount(id, adminId) {
    const student = await studentStore.getStudentById(id);
    if (!student) { const error = new Error('User not found.'); error.statusCode = 404; throw error; }
    if (student.isAdmin) throw new Error('Administrators cannot be deleted here.');
    if (student.id === adminId) throw new Error('Use account settings to delete your own account.');
    await studentStore.deleteUser(student.id);
    await auditLog.record({ actorId: adminId, action: 'user.delete', entityType: 'user', entityId: student.id, entityLabel: student.personal?.fullName || student.personal?.email, detail: 'Account permanently deleted.' });
    return { id: student.id, fullName: student.personal?.fullName || '' };
  }

  async importRows(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('CSV rows are required.');
    const summary = { imported: 0, errors: [], users: [] };
    for (let index = 0; index < rows.length; index += 1) {
      try { const user = await this.create(rows[index]); summary.imported += 1; summary.users.push(user); }
      catch (error) { summary.errors.push({ row: index + 2, message: error.message }); }
    }
    return summary;
  }

  async ensureBootstrapAdmin(config) {
    if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) return null;
    const existing = await studentStore.getStudentByEmail(config.bootstrapAdminEmail);
    if (existing) {
      if (!existing.isAdmin) { existing.isAdmin = true; await studentStore.saveStudent(existing); }
      return publicUser(existing);
    }
    return this.create({ fullName: config.bootstrapAdminName || 'Pathfolio Administrator', email: config.bootstrapAdminEmail, password: config.bootstrapAdminPassword, role: 'admin', department: 'Administration', batchYear: 'Operations' }, { allowAdmin: true });
  }
}

module.exports = new AdminUserService();
