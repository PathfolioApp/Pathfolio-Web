const crypto = require('crypto');
const studentStore = require('../models/studentStore');

const enrichAcademicDocuments = (academic) => {
  if (!academic) return academic;
  const enriched = { ...academic };
  if (enriched.tenthMarksheet?.fileId) {
    enriched.tenthMarksheet = {
      ...enriched.tenthMarksheet,
      fileUrl: '/api/profile/academic/documents/tenth_marksheet/file?mode=view',
      downloadUrl: '/api/profile/academic/documents/tenth_marksheet/file?mode=download'
    };
  }
  if (enriched.twelfthMarksheet?.fileId) {
    enriched.twelfthMarksheet = {
      ...enriched.twelfthMarksheet,
      fileUrl: '/api/profile/academic/documents/twelfth_marksheet/file?mode=view',
      downloadUrl: '/api/profile/academic/documents/twelfth_marksheet/file?mode=download'
    };
  }
  if (Array.isArray(enriched.semesters)) {
    enriched.semesters = enriched.semesters.map(s => {
      if (s.transcript?.fileId) {
        return {
          ...s,
          transcript: {
            ...s.transcript,
            fileUrl: `/api/profile/academic/semesters/${s.id}/file?mode=view`,
            downloadUrl: `/api/profile/academic/semesters/${s.id}/file?mode=download`
          }
        };
      }
      return s;
    });
  }
  return enriched;
};

const publicStudent = (student) => {
  if (!student) return null;
  const { passwordHash, ...safe } = student;
  if (safe.academic) {
    safe.academic = enrichAcademicDocuments(safe.academic);
  }
  return { ...safe, onboarding: safe.onboarding || { completed: safe.status === 'onboarding_completed' || safe.status === 'active_onboarded', completedAt: safe.completedAt || safe.createdAt } };
};

class AuthService {
  hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`));
    });
  }
  verifyPassword(password, stored) {
    return new Promise((resolve, reject) => {
      if (!stored || !stored.includes(':')) return resolve(false);
      const [salt, hash] = stored.split(':');
      crypto.scrypt(password, salt, 64, (err, key) => {
        if (err) return reject(err);
        const expected = Buffer.from(hash, 'hex');
        resolve(expected.length === key.length && crypto.timingSafeEqual(expected, key));
      });
    });
  }
  async login(email, password) {
    if (!email || !password) throw new Error('Email and password are required.');
    const student = await studentStore.getStudentByEmail(email);
    if (!student || !await this.verifyPassword(password, student.passwordHash)) throw new Error('Invalid institutional email or password.');
    if (student.blocked) throw new Error('This account has been blocked by the institution. Please contact your PathfolioApp administrator.');
    return { student: publicStudent(student), token: await studentStore.createSession(student.id) };
  }
  async register(student) { return { student: publicStudent(student), token: await studentStore.createSession(student.id) }; }
  async getStudentForSession(token) {
    const session = await studentStore.getSession(token);
    return session ? publicStudent(await studentStore.getStudentById(session.studentId)) : null;
  }
}
const service = new AuthService();
service.publicStudent = publicStudent;
module.exports = service;
