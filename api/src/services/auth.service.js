const crypto = require('crypto');
const studentStore = require('../models/studentStore');

const publicStudent = (student) => {
  if (!student) return null;
  const { passwordHash, ...safe } = student;
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
