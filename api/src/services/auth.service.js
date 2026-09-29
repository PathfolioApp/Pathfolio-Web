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

const enrichInternships = (internships) => {
  if (!Array.isArray(internships)) return [];
  const sorted = sortInternships(internships);
  return sorted.map(item => {
    if (item.certificate?.fileId) {
      return {
        ...item,
        certificate: {
          ...item.certificate,
          fileUrl: `/api/profile/internships/${item.id}/certificate/file?mode=view`,
          downloadUrl: `/api/profile/internships/${item.id}/certificate/file?mode=download`
        }
      };
    }
    return item;
  });
};

const publicStudent = (student) => {
  if (!student) return null;
  const { passwordHash, ...safe } = student;
  if (safe.academic) {
    safe.academic = enrichAcademicDocuments(safe.academic);
  }
  safe.internships = enrichInternships(safe.internships || []);
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
