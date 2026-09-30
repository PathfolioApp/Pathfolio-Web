const crypto = require('crypto');
const store = require('./studentStore');
const auth = require('../auth/auth.service');
const r2Service = require('../resumes/r2.service');
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
const academicFields = [
  'department', 'batchYear', 'degreeProgram', 'graduationYear', 'currentSemester',
  'cgpa', 'tenthPercentage', 'twelfthPercentage', 'activeBacklogs', 'historicalBacklogs', 'gapYears',
  'tenthBoard', 'tenthSchool', 'tenthYear',
  'twelfthBoard', 'twelfthSchool', 'twelfthYear', 'twelfthStream'
];
const numericRules = {
  graduationYear: [1900, 2200, 'Graduation year'],
  currentSemester: [1, 20, 'Current semester'],
  cgpa: [0, 10, 'CGPA'],
  tenthPercentage: [0, 100, '10th percentage'],
  twelfthPercentage: [0, 100, '12th percentage'],
  activeBacklogs: [0, 100, 'Active backlogs'],
  historicalBacklogs: [0, 100, 'Historical backlogs'],
  gapYears: [0, 20, 'Gap years'],
  tenthYear: [1950, 2100, '10th passing year'],
  twelfthYear: [1950, 2100, '12th passing year'],
};

const validatePdfBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    const error = new Error('Uploaded file must be a valid PDF document.');
    error.statusCode = 400;
    throw error;
  }
};

const sanitizeDocFilename = (filename, defaultName = 'document.pdf') => {
  const value = String(filename || '').trim();
  if (!value) return defaultName;
  const base = value.replace(/[/\\]/g, '').replace(/[\u0000<>:"|?*]/g, '').trim();
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
};
const normalizeAcademicValue = (field, value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  if (numericRules[field]) {
    const number = Number(value);
    const [minimum, maximum, label] = numericRules[field];
    if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
    return number;
  }
  return String(value).trim();
};

const sortInternships = (internships) => {
  if (!Array.isArray(internships)) return [];
  return [...internships].sort((a, b) => {
    if (a.currentlyWorking && !b.currentlyWorking) return -1;
    if (!a.currentlyWorking && b.currentlyWorking) return 1;

    if (a.currentlyWorking && b.currentlyWorking) {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    } else {
      const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0;
      const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0;
      if (aEnd !== bEnd) return bEnd - aEnd;

      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    }

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated && bCreated && aCreated !== bCreated) {
      return aCreated - bCreated;
    }
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
};

const sortProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return [...projects].sort((a, b) => {
    const aFeat = Boolean(a.featured);
    const bFeat = Boolean(b.featured);
    if (aFeat && !bFeat) return -1;
    if (!aFeat && bFeat) return 1;

    if (a.currentlyWorking && !b.currentlyWorking) return -1;
    if (!a.currentlyWorking && b.currentlyWorking) return 1;

    if (a.currentlyWorking && b.currentlyWorking) {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    } else {
      const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0;
      const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0;
      if (aEnd !== bEnd) return bEnd - aEnd;

      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    }

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated && bCreated && aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
};
class ProfileService {
  async current(id) { return auth.getStudentForSession((await store.createSession(id))); }
  async get(id) { return this.safe(await store.getStudentById(id)); }
  safe(student) { return auth.publicStudent ? auth.publicStudent(student) : student; }
  async update(id, section, values) {
    const student = await store.getStudentById(id); if (!student) throw new Error('Student not found.');
    if (section === 'personal') {
      if (values.fullName !== undefined && values.fullName.trim().length < 2) throw new Error('Full name must be at least 2 characters.');
      if (values.dateOfBirth !== undefined && values.dateOfBirth !== '') {
        const onboarding = require('../onboarding/onboarding.service');
        const { dob } = onboarding.validateDateOfBirth(values.dateOfBirth);
        values.dateOfBirth = dob;
      }
      if (values.phone !== undefined && String(values.phone).trim()) {
        const cleanedPhone = String(values.phone).trim();
        if (!/^[+]?[\d\s\-()]{7,20}$/.test(cleanedPhone)) throw new Error('Please provide a valid phone number.');
      }
      // email and rollNumber are institutional identifiers and cannot be self-edited.
      const allowed = ['fullName', 'dateOfBirth', 'phone'];
      const updates = Object.fromEntries(
        Object.entries(values)
          .filter(([k]) => allowed.includes(k))
          .map(([k, v]) => [k, k === 'phone' ? String(v || '').trim() : v])
      );
      student.personal = { ...student.personal, ...updates };
    } else if (section === 'academic') {
      if (values.department !== undefined && !String(values.department).trim()) throw new Error('Department is required.');
      if (values.batchYear !== undefined && !String(values.batchYear).trim()) throw new Error('Batch year is required.');
      const academicUpdates = Object.fromEntries(Object.entries(values).filter(([field]) => academicFields.includes(field)).map(([field, value]) => [field, normalizeAcademicValue(field, value)]).filter(([, value]) => value !== undefined));
      student.academic = { ...student.academic, ...academicUpdates };
    }
    else if (section === 'interests') {
      const onboarding = require('../onboarding/onboarding.service');
      // Accept both legacy plain-string tags and structured { name, proficiency, reason }.
      const tidyStructured = (list, levels) => Array.isArray(list)
        ? onboarding[levels === 'familiarity' ? 'FAMILIARITY_LEVELS' : 'PROFICIENCY_LEVELS'] && list
            .map(entry => {
              if (typeof entry === 'string') return { name: entry.trim(), proficiency: levels === 'familiarity' ? 'exploring' : 'beginner', reason: '' };
              const name = String(entry?.name || '').trim();
              if (!name) return null;
              const proficiencyRaw = String(entry?.proficiency || '').trim().toLowerCase();
              const allowed = levels === 'familiarity' ? onboarding.FAMILIARITY_LEVELS : onboarding.PROFICIENCY_LEVELS;
              const proficiency = allowed.includes(proficiencyRaw) ? proficiencyRaw : allowed[0];
              return { name, proficiency, reason: String(entry?.reason || '').trim().slice(0, 300) };
            })
            .filter(Boolean)
            .filter((item, index, arr) => arr.findIndex(other => other.name.toLowerCase() === item.name.toLowerCase()) === index)
            .slice(0, 30)
        : undefined;
      const hobbies = values.hobbies !== undefined ? tidyStructured(values.hobbies, 'proficiency') : undefined;
      const passions = values.passions !== undefined ? tidyStructured(values.passions, 'familiarity') : undefined;
      student.interests = {
        ...student.interests,
        ...(hobbies !== undefined ? { hobbies } : {}),
        ...(passions !== undefined ? { passions } : {})
      };
    }
    else if (section === 'familyContext') { const details = String(values.details || '').trim(); if (details && !values.consentGiven) throw new Error('Explicit consent is required before saving sensitive context.'); student.familyContext = details ? { details, consentGiven: true } : { details: '', consentGiven: false }; }
    else if (section === 'profileSettings') student.profileSettings = { ...this.defaultSettings(), ...(student.profileSettings || {}), ...values, fieldVisibility: { ...(student.profileSettings?.fieldVisibility || {}), ...(values.fieldVisibility || {}) } };
    await store.saveStudent(student); return this.safe(student);
  }
  defaultSettings() { return { visibility: 'private', fieldVisibility: { personal: 'student', academic: 'student', interests: 'shareable', achievements: 'shareable', familyContext: 'student' } }; }
  async achievement(id, achievement, achievementId) { const student = await store.getStudentById(id); const tidy = { title: String(achievement.title || '').trim(), category: String(achievement.category || 'General').trim(), description: String(achievement.description || '').trim(), year: String(achievement.year || '').trim() }; if (!tidy.title) throw new Error('Achievement title is required.'); if (achievementId) { const index = student.achievements.findIndex(a => a.id === achievementId); if (index < 0) throw new Error('Achievement not found.'); student.achievements[index] = { ...student.achievements[index], ...tidy }; } else student.achievements.push({ id: `ach_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, ...tidy }); await store.saveStudent(student); return this.safe(student); }
  async deleteAchievement(id, achievementId) {
    const student = await store.getStudentById(id);
    const exists = student.achievements.some(a => a.id === achievementId);
    if (!exists) {
      const error = new Error('Achievement not found.');
      error.statusCode = 404;
      throw error;
    }
    student.achievements = student.achievements.filter(a => a.id !== achievementId);
    await store.saveStudent(student);
    return this.safe(student);
  }
  async changePassword(id, currentPassword, newPassword) { const student = await store.getStudentById(id); if (!currentPassword || !newPassword) throw new Error('Current and new passwords are required.'); if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.'); if (!await auth.verifyPassword(currentPassword, student.passwordHash)) throw new Error('Your current password is incorrect.'); student.passwordHash = await auth.hashPassword(newPassword); await store.saveStudent(student); }
  async setAvatar(id, avatarUrl) {
    const student = await store.getStudentById(id); if (!student) throw new Error('Student not found.');
    const url = String(avatarUrl || '').trim();
    if (url && !/^https:\/\//.test(url)) throw new Error('Avatar must be a secure URL.');
    student.personal = { ...student.personal, avatarUrl: url };
    await store.saveStudent(student); return this.safe(student);
  }
  safe(student) { return auth.publicStudent ? auth.publicStudent(student) : student; }
  async deleteAccount(id) {
    const student = await store.getStudentById(id); if (!student) throw new Error('Student not found.');
    if (student.isAdmin) throw new Error('The administrator account cannot be deleted here.');
    await store.deleteUser(id);
  }

  async uploadAcademicDocument(id, { type, semester, file }) {
    if (!file) {
      const error = new Error('No file was uploaded.');
      error.statusCode = 400;
      throw error;
    }
    validatePdfBuffer(file.buffer);

    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.academic = student.academic || {};
    const sanitizedName = sanitizeDocFilename(file.originalname);
    const fileId = `doc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    if (type === 'tenth_marksheet') {
      const oldKey = student.academic.tenthMarksheet?.key;
      const key = `students/${id}/academic/10th_marksheet_${Date.now()}.pdf`;
      await r2Service.uploadFile(file.buffer, key, 'application/pdf');
      if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});
      student.academic.tenthMarksheet = {
        fileId,
        key,
        filename: sanitizedName,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    } else if (type === 'twelfth_marksheet') {
      const oldKey = student.academic.twelfthMarksheet?.key;
      const key = `students/${id}/academic/12th_marksheet_${Date.now()}.pdf`;
      await r2Service.uploadFile(file.buffer, key, 'application/pdf');
      if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});
      student.academic.twelfthMarksheet = {
        fileId,
        key,
        filename: sanitizedName,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    } else if (type === 'semester_transcript') {
      const semNum = Number(semester);
      if (!Number.isInteger(semNum) || semNum < 1 || semNum > 20) {
        const error = new Error('A valid semester number (1-20) is required.');
        error.statusCode = 400;
        throw error;
      }
      const semesters = Array.isArray(student.academic.semesters) ? [...student.academic.semesters] : [];
      let semIndex = semesters.findIndex(s => Number(s.semester) === semNum);
      const semId = semIndex >= 0 ? semesters[semIndex].id : `sem_${semNum}_${Date.now()}`;
      const oldKey = semIndex >= 0 ? semesters[semIndex].transcript?.key : null;
      const key = `students/${id}/academic/sem_${semNum}_transcript_${Date.now()}.pdf`;

      await r2Service.uploadFile(file.buffer, key, 'application/pdf');
      if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});

      const transcriptMeta = {
        fileId,
        key,
        filename: sanitizedName,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      if (semIndex >= 0) {
        semesters[semIndex] = { ...semesters[semIndex], transcript: transcriptMeta };
      } else {
        semesters.push({
          id: semId,
          semester: semNum,
          sgpa: null,
          cgpa: null,
          academicYear: '',
          transcript: transcriptMeta,
        });
      }
      semesters.sort((a, b) => Number(a.semester) - Number(b.semester));
      student.academic.semesters = semesters;
    } else {
      const error = new Error('Invalid academic document type. Expected tenth_marksheet, twelfth_marksheet, or semester_transcript.');
      error.statusCode = 400;
      throw error;
    }

    await store.saveStudent(student);
    return this.get(id);
  }

  async deleteAcademicDocument(id, { type, semesterId, semester }) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }
    student.academic = student.academic || {};

    if (type === 'tenth_marksheet') {
      const oldKey = student.academic.tenthMarksheet?.key;
      if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});
      delete student.academic.tenthMarksheet;
    } else if (type === 'twelfth_marksheet') {
      const oldKey = student.academic.twelfthMarksheet?.key;
      if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});
      delete student.academic.twelfthMarksheet;
    } else if (type === 'semester_transcript') {
      const semesters = Array.isArray(student.academic.semesters) ? [...student.academic.semesters] : [];
      const semIndex = semesters.findIndex(s => s.id === semesterId || Number(s.semester) === Number(semester));
      if (semIndex >= 0 && semesters[semIndex].transcript?.key) {
        await r2Service.deleteFile(semesters[semIndex].transcript.key).catch(() => {});
        semesters[semIndex] = { ...semesters[semIndex], transcript: null };
        student.academic.semesters = semesters;
      }
    } else {
      const error = new Error('Invalid document type.');
      error.statusCode = 400;
      throw error;
    }

    await store.saveStudent(student);
    return this.get(id);
  }

  async getAcademicDocument(id, { type, semesterId, semester }) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    let doc = null;
    if (type === 'tenth_marksheet') {
      doc = student.academic?.tenthMarksheet;
    } else if (type === 'twelfth_marksheet') {
      doc = student.academic?.twelfthMarksheet;
    } else if (type === 'semester_transcript') {
      const semesters = student.academic?.semesters || [];
      const sem = semesters.find(s => s.id === semesterId || (semester && Number(s.semester) === Number(semester)));
      doc = sem?.transcript;
    }

    if (!doc || !doc.key) {
      const error = new Error('Academic document not found.');
      error.statusCode = 404;
      throw error;
    }

    const object = await r2Service.getFile(doc.key);
    if (!object.Body) {
      const error = new Error('Document file is unavailable in storage.');
      error.statusCode = 404;
      throw error;
    }

    return {
      body: object.Body,
      contentType: object.ContentType || 'application/pdf',
      contentLength: object.ContentLength,
      filename: doc.filename || `${type}.pdf`,
    };
  }

  async saveSemester(id, { semester, sgpa, cgpa, academicYear }) {
    const semNum = Number(semester);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 20) {
      const error = new Error('A valid semester number between 1 and 20 is required.');
      error.statusCode = 400;
      throw error;
    }

    const parseScore = (val, label) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0 || num > 10) {
        const error = new Error(`${label} must be a number between 0 and 10.`);
        error.statusCode = 400;
        throw error;
      }
      return Math.round(num * 100) / 100;
    };

    const cleanSgpa = parseScore(sgpa, 'SGPA');
    const cleanCgpa = parseScore(cgpa, 'CGPA');
    const cleanYear = academicYear ? String(academicYear).trim().slice(0, 30) : '';

    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.academic = student.academic || {};
    const semesters = Array.isArray(student.academic.semesters) ? [...student.academic.semesters] : [];
    const semIndex = semesters.findIndex(s => Number(s.semester) === semNum);

    if (semIndex >= 0) {
      semesters[semIndex] = {
        ...semesters[semIndex],
        semester: semNum,
        sgpa: cleanSgpa,
        cgpa: cleanCgpa,
        academicYear: cleanYear,
      };
    } else {
      semesters.push({
        id: `sem_${semNum}_${Date.now()}`,
        semester: semNum,
        sgpa: cleanSgpa,
        cgpa: cleanCgpa,
        academicYear: cleanYear,
        transcript: null,
      });
    }

    semesters.sort((a, b) => Number(a.semester) - Number(b.semester));
    student.academic.semesters = semesters;

    await store.saveStudent(student);
    return this.get(id);
  }

  async deleteSemester(id, semesterId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.academic = student.academic || {};
    const semesters = Array.isArray(student.academic.semesters) ? [...student.academic.semesters] : [];
    const semIndex = semesters.findIndex(s => s.id === semesterId || String(s.semester) === String(semesterId));

    if (semIndex < 0) {
      const error = new Error('Semester record not found.');
      error.statusCode = 404;
      throw error;
    }

    const [removed] = semesters.splice(semIndex, 1);
    if (removed?.transcript?.key) {
      await r2Service.deleteFile(removed.transcript.key).catch(() => {});
    }

    student.academic.semesters = semesters;
    await store.saveStudent(student);
    return this.get(id);
  }

  validateInternship(data, isUpdate = false) {
    const companyName = String(data.companyName || '').trim();
    const role = String(data.role || '').trim();
    const startDate = String(data.startDate || '').trim();
    const currentlyWorking = Boolean(data.currentlyWorking);
    const endDate = currentlyWorking ? '' : String(data.endDate || '').trim();

    if (!isUpdate || data.companyName !== undefined) {
      if (!companyName) {
        const err = new Error('Company name is required.');
        err.statusCode = 400;
        throw err;
      }
    }

    if (!isUpdate || data.role !== undefined) {
      if (!role) {
        const err = new Error('Role / position is required.');
        err.statusCode = 400;
        throw err;
      }
    }

    if (!isUpdate || data.startDate !== undefined) {
      if (!startDate) {
        const err = new Error('Start date is required.');
        err.statusCode = 400;
        throw err;
      }
    }

    if (!currentlyWorking && (!isUpdate || data.endDate !== undefined)) {
      if (!endDate) {
        const err = new Error('End date is required unless currently working.');
        err.statusCode = 400;
        throw err;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate && startDate > todayStr) {
      const err = new Error('Start date cannot be in the future.');
      err.statusCode = 400;
      throw err;
    }

    if (!currentlyWorking && endDate && endDate > todayStr) {
      const err = new Error('End date cannot be in the future for completed internships.');
      err.statusCode = 400;
      throw err;
    }

    if (startDate && endDate && !currentlyWorking) {
      if (new Date(startDate) > new Date(endDate)) {
        const err = new Error('Start date cannot be later than end date.');
        err.statusCode = 400;
        throw err;
      }
    }

    const validModes = ['Remote', 'Hybrid', 'On-site'];
    let workMode = String(data.workMode || 'On-site').trim();
    const matchedMode = validModes.find(m => m.toLowerCase() === workMode.toLowerCase());
    workMode = matchedMode || 'On-site';

    let responsibilities = [];
    if (Array.isArray(data.responsibilities)) {
      responsibilities = data.responsibilities.map(r => String(r || '').trim()).filter(Boolean);
    } else if (typeof data.responsibilities === 'string') {
      responsibilities = data.responsibilities.split('\n').map(r => r.trim()).filter(Boolean);
    }

    let skills = [];
    if (Array.isArray(data.skills)) {
      skills = [...new Set(data.skills.map(s => String(s || '').trim()).filter(Boolean))];
    } else if (typeof data.skills === 'string') {
      skills = [...new Set(data.skills.split(',').map(s => s.trim()).filter(Boolean))];
    }

    const projects = data.projects && typeof data.projects === 'object' ? {
      projectName: String(data.projects.projectName || '').trim(),
      projectDescription: String(data.projects.projectDescription || '').trim(),
      projectUrl: String(data.projects.projectUrl || '').trim(),
    } : {
      projectName: '',
      projectDescription: '',
      projectUrl: String(data.projectUrl || '').trim(),
    };

    return {
      companyName,
      companyLogo: String(data.companyLogo || '').trim(),
      role,
      startDate,
      endDate,
      currentlyWorking,
      internshipType: String(data.internshipType || '').trim(),
      workMode,
      location: String(data.location || '').trim(),
      description: String(data.description || '').trim(),
      responsibilities,
      skills,
      projects,
      companyWebsite: String(data.companyWebsite || '').trim(),
      projectUrl: String(data.projectUrl || projects.projectUrl || '').trim(),
    };
  }

  async addInternship(id, data) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    const validated = this.validateInternship(data, false);
    const internshipId = `intern_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const newInternship = {
      id: internshipId,
      ...validated,
      certificate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    student.internships = Array.isArray(student.internships) ? [...student.internships] : [];
    student.internships = sortInternships([...student.internships, newInternship]);

    await store.saveStudent(student);
    return this.get(id);
  }

  async editInternship(id, internshipId, data) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.internships = Array.isArray(student.internships) ? [...student.internships] : [];
    const index = student.internships.findIndex(i => i.id === internshipId);
    if (index < 0) {
      const error = new Error('Internship not found.');
      error.statusCode = 404;
      throw error;
    }

    const current = student.internships[index];
    const validated = this.validateInternship({ ...current, ...data }, true);
    student.internships[index] = {
      ...current,
      ...validated,
      id: current.id,
      certificate: current.certificate || null,
      updatedAt: new Date().toISOString(),
    };
    student.internships = sortInternships(student.internships);

    await store.saveStudent(student);
    return this.get(id);
  }

  async deleteInternship(id, internshipId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.internships = Array.isArray(student.internships) ? [...student.internships] : [];
    const index = student.internships.findIndex(i => i.id === internshipId);
    if (index < 0) {
      const error = new Error('Internship not found.');
      error.statusCode = 404;
      throw error;
    }

    const [removed] = student.internships.splice(index, 1);
    if (removed?.certificate?.key) {
      await r2Service.deleteFile(removed.certificate.key).catch(() => {});
    }

    await store.saveStudent(student);
    return this.get(id);
  }

  async uploadInternshipCertificate(id, internshipId, file) {
    if (!file || !file.buffer) {
      const error = new Error('Please select a certificate file to upload.');
      error.statusCode = 400;
      throw error;
    }

    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) {
      const error = new Error('Only PDF documents are allowed for internship certificates.');
      error.statusCode = 400;
      throw error;
    }
    validatePdfBuffer(file.buffer);

    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.internships = Array.isArray(student.internships) ? [...student.internships] : [];
    const index = student.internships.findIndex(i => i.id === internshipId);
    if (index < 0) {
      const error = new Error('Internship not found.');
      error.statusCode = 404;
      throw error;
    }

    const current = student.internships[index];
    const oldKey = current.certificate?.key;
    const ext = 'pdf';
    const sanitizedName = sanitizeDocFilename(file.originalname, `certificate_${internshipId}.pdf`);
    const fileId = `cert_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const key = `students/${id}/internships/cert_${internshipId}_${Date.now()}.pdf`;

    await r2Service.uploadFile(file.buffer, key, 'application/pdf');
    if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});

    student.internships[index] = {
      ...current,
      certificate: {
        fileId,
        key,
        filename: sanitizedName,
        size: file.size,
        contentType: file.mimetype || 'application/pdf',
        uploadedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await store.saveStudent(student);
    return this.get(id);
  }

  async deleteInternshipCertificate(id, internshipId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.internships = Array.isArray(student.internships) ? [...student.internships] : [];
    const index = student.internships.findIndex(i => i.id === internshipId);
    if (index < 0) {
      const error = new Error('Internship not found.');
      error.statusCode = 404;
      throw error;
    }

    const current = student.internships[index];
    if (current.certificate?.key) {
      await r2Service.deleteFile(current.certificate.key).catch(() => {});
    }

    student.internships[index] = {
      ...current,
      certificate: null,
      updatedAt: new Date().toISOString(),
    };

    await store.saveStudent(student);
    return this.get(id);
  }

  async getInternshipCertificate(id, internshipId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    const internships = Array.isArray(student.internships) ? student.internships : [];
    const internship = internships.find(i => i.id === internshipId);
    const cert = internship?.certificate;

    if (!cert || !cert.key) {
      const error = new Error('Internship certificate not found.');
      error.statusCode = 404;
      throw error;
    }

    const object = await r2Service.getFile(cert.key);
    if (!object.Body) {
      const error = new Error('Certificate file is unavailable in storage.');
      error.statusCode = 404;
      throw error;
    }

    return {
      body: object.Body,
      contentType: object.ContentType || cert.contentType || 'application/pdf',
      contentLength: object.ContentLength,
      filename: cert.filename || 'certificate.pdf',
    };
  }

  validateProject(data, isUpdate = false) {
    const projectName = String(data.projectName || '').trim();
    if (!isUpdate || data.projectName !== undefined) {
      if (!projectName) {
        const err = new Error('Project name is required.');
        err.statusCode = 400;
        throw err;
      }
    }

    const currentlyWorking = Boolean(data.currentlyWorking);
    const startDate = data.startDate ? String(data.startDate).trim().slice(0, 10) : '';
    let endDate = data.endDate ? String(data.endDate).trim().slice(0, 10) : '';

    if (currentlyWorking) {
      endDate = '';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate && startDate > todayStr) {
      const err = new Error('Start date cannot be in the future.');
      err.statusCode = 400;
      throw err;
    }

    if (!currentlyWorking && endDate && endDate > todayStr) {
      const err = new Error('End date cannot be in the future for completed projects.');
      err.statusCode = 400;
      throw err;
    }

    if (startDate && endDate && !currentlyWorking) {
      if (new Date(startDate) > new Date(endDate)) {
        const err = new Error('Start date cannot be later than end date.');
        err.statusCode = 400;
        throw err;
      }
    }

    let contributions = [];
    if (Array.isArray(data.contributions)) {
      contributions = data.contributions.map(c => String(c || '').trim()).filter(Boolean);
    } else if (typeof data.contributions === 'string') {
      contributions = data.contributions.split('\n').map(c => c.trim()).filter(Boolean);
    }

    let technologies = [];
    if (Array.isArray(data.technologies)) {
      technologies = [...new Set(data.technologies.map(t => String(t || '').trim()).filter(Boolean))];
    } else if (typeof data.technologies === 'string') {
      technologies = [...new Set(data.technologies.split(',').map(t => t.trim()).filter(Boolean))];
    }

    return {
      projectName,
      projectType: String(data.projectType || 'Personal').trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      currentlyWorking,
      description: String(data.description || '').trim(),
      contributions,
      technologies,
      projectUrl: String(data.projectUrl || '').trim(),
      repoUrl: String(data.repoUrl || '').trim(),
      thumbnail: String(data.thumbnail || '').trim(),
      featured: Boolean(data.featured),
    };
  }

  async addProject(id, data) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    const validated = this.validateProject(data, false);
    const projectId = `proj_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const newProject = {
      id: projectId,
      ...validated,
      document: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    student.projects = Array.isArray(student.projects) ? [...student.projects] : [];
    student.projects = sortProjects([...student.projects, newProject]);

    await store.saveStudent(student);
    return this.get(id);
  }

  async editProject(id, projectId, data) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.projects = Array.isArray(student.projects) ? [...student.projects] : [];
    const index = student.projects.findIndex(p => p.id === projectId);
    if (index < 0) {
      const error = new Error('Project not found.');
      error.statusCode = 404;
      throw error;
    }

    const current = student.projects[index];
    const validated = this.validateProject({ ...current, ...data }, true);
    student.projects[index] = {
      ...current,
      ...validated,
      id: current.id,
      document: current.document || null,
      updatedAt: new Date().toISOString(),
    };
    student.projects = sortProjects(student.projects);

    await store.saveStudent(student);
    return this.get(id);
  }

  async deleteProject(id, projectId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.projects = Array.isArray(student.projects) ? [...student.projects] : [];
    const index = student.projects.findIndex(p => p.id === projectId);
    if (index < 0) {
      const error = new Error('Project not found.');
      error.statusCode = 404;
      throw error;
    }

    const [removed] = student.projects.splice(index, 1);
    if (removed?.document?.key) {
      await r2Service.deleteFile(removed.document.key).catch(() => {});
    }

    await store.saveStudent(student);
    return this.get(id);
  }

  async uploadProjectDocument(id, projectId, file) {
    if (!file || !file.buffer) {
      const error = new Error('Please select a document file to upload.');
      error.statusCode = 400;
      throw error;
    }

    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) {
      const error = new Error('Only PDF documents are allowed for project attachments.');
      error.statusCode = 400;
      throw error;
    }
    validatePdfBuffer(file.buffer);

    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.projects = Array.isArray(student.projects) ? [...student.projects] : [];
    const index = student.projects.findIndex(p => p.id === projectId);
    if (index < 0) {
      const error = new Error('Project not found.');
      error.statusCode = 404;
      throw error;
    }

    const current = student.projects[index];
    const oldKey = current.document?.key;
    const sanitizedName = sanitizeDocFilename(file.originalname, `project_${projectId}.pdf`);
    const fileId = `projdoc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const key = `students/${id}/projects/doc_${projectId}_${Date.now()}.pdf`;

    await r2Service.uploadFile(file.buffer, key, 'application/pdf');
    if (oldKey) await r2Service.deleteFile(oldKey).catch(() => {});

    student.projects[index] = {
      ...current,
      document: {
        fileId,
        key,
        filename: sanitizedName,
        size: file.size,
        contentType: file.mimetype || 'application/pdf',
        uploadedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await store.saveStudent(student);
    return this.get(id);
  }

  async deleteProjectDocument(id, projectId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    student.projects = Array.isArray(student.projects) ? [...student.projects] : [];
    const index = student.projects.findIndex(p => p.id === projectId);
    if (index < 0) {
      const error = new Error('Project not found.');
      error.statusCode = 404;
      throw error;
    }

    const current = student.projects[index];
    if (current.document?.key) {
      await r2Service.deleteFile(current.document.key).catch(() => {});
    }

    student.projects[index] = {
      ...current,
      document: null,
      updatedAt: new Date().toISOString(),
    };

    await store.saveStudent(student);
    return this.get(id);
  }

  async getProjectDocument(id, projectId) {
    const student = await store.getStudentById(id);
    if (!student) {
      const error = new Error('Student not found.');
      error.statusCode = 404;
      throw error;
    }

    const projects = Array.isArray(student.projects) ? student.projects : [];
    const project = projects.find(p => p.id === projectId);
    const doc = project?.document;

    if (!doc || !doc.key) {
      const error = new Error('Project document not found.');
      error.statusCode = 404;
      throw error;
    }

    const object = await r2Service.getFile(doc.key);
    if (!object.Body) {
      const error = new Error('Project document file is unavailable in storage.');
      error.statusCode = 404;
      throw error;
    }

    return {
      body: object.Body,
      contentType: object.ContentType || doc.contentType || 'application/pdf',
      contentLength: object.ContentLength,
      filename: doc.filename || 'project_document.pdf',
    };
  }
}
module.exports = new ProfileService();
