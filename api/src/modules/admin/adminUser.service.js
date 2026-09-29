const studentStore = require('../students/studentStore');
const onboarding = require('../onboarding/onboarding.service');
const auth = require('../auth/auth.service');

const clean = value => String(value || '').trim();
const publicUser = student => ({ id: student.id, fullName: student.personal?.fullName || '', email: student.personal?.email || '', phone: student.personal?.phone || '', dateOfBirth: student.personal?.dateOfBirth || '', avatarUrl: student.personal?.avatarUrl || '', department: student.academic?.department || '', batchYear: student.academic?.batchYear || '', rollNumber: student.academic?.rollNumber || '', role: student.isAdmin ? 'admin' : student.isRecruiter ? 'recruiter' : 'student', status: student.status || 'active', blocked: Boolean(student.blocked), achievementsCount: (student.achievements || []).length, internshipsCount: (student.internships || []).length, interestsCount: ((student.interests?.hobbies || []).length + (student.interests?.passions || []).length), createdAt: student.createdAt, onboarding: student.onboarding || {} });

class AdminUserService {
  async list() { return (await studentStore.listStudents()).map(publicUser).sort((a, b) => a.fullName.localeCompare(b.fullName)); }

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

  async setBlocked(id, blocked, adminId) {
    const student = await studentStore.getStudentById(id);
    if (!student) { const error = new Error('User not found.'); error.statusCode = 404; throw error; }
    if (student.isAdmin) throw new Error('Administrators cannot be blocked.');
    if (student.id === adminId) throw new Error('You cannot block your own account.');
    student.blocked = Boolean(blocked);
    if (student.blocked) await studentStore.deleteSessionsForUser(student.id);
    await studentStore.saveStudent(student);
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
