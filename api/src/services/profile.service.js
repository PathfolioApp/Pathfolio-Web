const store = require('../models/studentStore');
const auth = require('./auth.service');
const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
class ProfileService {
  async current(id) { return auth.getStudentForSession((await store.createSession(id))); }
  async get(id) { return auth.publicStudent ? auth.publicStudent(await store.getStudentById(id)) : this.safe(await store.getStudentById(id)); }
  safe(student) { const { passwordHash, ...safe } = student; return safe; }
  async update(id, section, values) {
    const student = await store.getStudentById(id); if (!student) throw new Error('Student not found.');
    if (section === 'personal') {
      if (values.fullName !== undefined && values.fullName.trim().length < 2) throw new Error('Full name must be at least 2 characters.');
      if (values.age !== undefined && (!Number.isInteger(Number(values.age)) || values.age < 15 || values.age > 100)) throw new Error('Please provide a valid age.');
      if (values.username && values.username !== student.personal.username) { if (!/^[a-z0-9_-]{3,20}$/i.test(values.username)) throw new Error('Username must be 3-20 valid characters.'); if (await store.isUsernameTaken(values.username)) throw new Error('That username is already taken.'); }
      student.personal = { ...student.personal, ...Object.fromEntries(Object.entries(values).filter(([k]) => ['fullName','age','username'].includes(k))) };
    } else if (section === 'academic') {
      if (values.department !== undefined && !String(values.department).trim()) throw new Error('Department is required.');
      if (values.batchYear !== undefined && !String(values.batchYear).trim()) throw new Error('Batch year is required.');
      student.academic = { ...student.academic, ...Object.fromEntries(Object.entries(values).filter(([k]) => ['department','batchYear'].includes(k)).map(([k, value]) => [k, String(value).trim()])) };
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
}
module.exports = new ProfileService();
