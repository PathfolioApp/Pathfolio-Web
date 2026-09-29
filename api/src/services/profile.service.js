const crypto = require('crypto');
const store = require('../models/studentStore');
const auth = require('./auth.service');
const r2Service = require('./r2.service');
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
class ProfileService {
  async current(id) { return auth.getStudentForSession((await store.createSession(id))); }
  async get(id) { return auth.publicStudent ? auth.publicStudent(await store.getStudentById(id)) : this.safe(await store.getStudentById(id)); }
  safe(student) { const { passwordHash, ...safe } = student; return safe; }
  async update(id, section, values) {
    const student = await store.getStudentById(id); if (!student) throw new Error('Student not found.');
    if (section === 'personal') {
      if (values.fullName !== undefined && values.fullName.trim().length < 2) throw new Error('Full name must be at least 2 characters.');
      if (values.age !== undefined && (!Number.isInteger(Number(values.age)) || values.age < 15 || values.age > 100)) throw new Error('Please provide a valid age.');
      if (values.phone !== undefined && String(values.phone).trim()) {
        const cleanedPhone = String(values.phone).trim();
        if (!/^[+]?[\d\s\-()]{7,20}$/.test(cleanedPhone)) throw new Error('Please provide a valid phone number.');
      }
      if (values.username && values.username !== student.personal.username) { if (!/^[a-z0-9_-]{3,20}$/i.test(values.username)) throw new Error('Username must be 3-20 valid characters.'); if (await store.isUsernameTaken(values.username)) throw new Error('That username is already taken.'); }
      const allowed = ['fullName', 'age', 'username', 'phone'];
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
    else if (section === 'interests') { const tidy = list => Array.isArray(list) ? [...new Set(list.map(x => String(x).trim()).filter(Boolean))].slice(0, 30) : undefined; student.interests = { ...student.interests, ...(values.hobbies !== undefined ? { hobbies: tidy(values.hobbies) } : {}), ...(values.passions !== undefined ? { passions: tidy(values.passions) } : {}) }; }
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
}
module.exports = new ProfileService();
