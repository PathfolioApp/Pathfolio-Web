const studentStore = require('../models/studentStore');
const onboarding = require('./onboarding.service');
const auth = require('./auth.service');

const clean = value => String(value || '').trim();
const publicUser = student => ({ id: student.id, fullName: student.personal?.fullName || '', email: student.personal?.email || '', username: student.personal?.username || '', department: student.academic?.department || '', batchYear: student.academic?.batchYear || '', role: student.isAdmin ? 'admin' : student.isRecruiter ? 'recruiter' : 'student', status: student.status || '', createdAt: student.createdAt, onboarding: student.onboarding || {} });
const validUsername = username => /^[a-z0-9_-]{3,20}$/.test(username);

class AdminUserService {
  async list() { return (await studentStore.listStudents()).map(publicUser).sort((a, b) => a.fullName.localeCompare(b.fullName)); }

  async create(input, { allowAdmin = false } = {}) {
    const fullName = clean(input.fullName || input.name);
    const email = clean(input.email).toLowerCase();
    const username = clean(input.username).toLowerCase();
    const password = String(input.password || '');
    if (fullName.length < 2) throw new Error('Full name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email is required.');
    if (!validUsername(username)) throw new Error('Username must be 3-20 characters using letters, numbers, underscores, or hyphens.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (await studentStore.getStudentByEmail(email)) throw new Error(`An account already exists for ${email}.`);
    if (await studentStore.isUsernameTaken(username)) throw new Error(`Username "${username}" is already taken.`);
    const role = clean(input.role).toLowerCase() || 'student';
    if (!['student', 'recruiter', 'admin'].includes(role)) throw new Error('Role must be student or recruiter.');
    if (role === 'admin' && !allowAdmin) throw new Error('Admin accounts can only be created through the bootstrap configuration.');
    const now = new Date().toISOString();
    const record = await studentStore.saveStudent({
      personal: { fullName, age: Number(input.age) || 18, email, username },
      academic: { rollNumber: clean(input.rollNumber) || `ADMIN-${Date.now()}`, department: clean(input.department) || 'Not specified', batchYear: clean(input.batchYear) || 'Not specified' },
      interests: { hobbies: [], passions: [] }, achievements: [], familyContext: { details: '', consentGiven: false },
      profileSettings: { visibility: 'private', fieldVisibility: { personal: 'student', academic: 'student', interests: 'shareable', achievements: 'shareable', familyContext: 'student' } },
      passwordHash: await auth.hashPassword(password), isAdmin: role === 'admin', isRecruiter: role === 'recruiter',
      onboarding: { completed: true, completedAt: now }, status: 'active_onboarded', createdAt: now
    });
    await studentStore.createNotification(record.id, { title: 'Account created', message: 'Your PathfolioApp account is ready.', type: 'account' });
    return publicUser(record);
  }

  async setRole(id, role) {
    const nextRole = clean(role).toLowerCase();
    if (!['student', 'recruiter'].includes(nextRole)) throw new Error('Role must be student or recruiter.');
    const student = await studentStore.getStudentById(id);
    if (!student) { const error = new Error('User not found.'); error.statusCode = 404; throw error; }
    if (student.isAdmin) throw new Error('The bootstrap admin cannot be changed here.');
    student.isRecruiter = nextRole === 'recruiter';
    await studentStore.saveStudent(student);
    return publicUser(student);
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
    return this.create({ fullName: config.bootstrapAdminName || 'Pathfolio Administrator', email: config.bootstrapAdminEmail, username: config.bootstrapAdminUsername || 'pathfolio-admin', password: config.bootstrapAdminPassword, role: 'admin', department: 'Administration', batchYear: 'Operations' }, { allowAdmin: true });
  }
}

module.exports = new AdminUserService();
