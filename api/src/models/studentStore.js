/**
 * In-memory persistence layer for student onboarding profiles.
 * Designed with repository interfaces for seamless future PostgreSQL / database migration.
 */

class StudentStore {
  constructor() {
    this.students = new Map();
    this.emails = new Map();
    this.sessions = new Map();
    this.usernames = new Set([
      'admin',
      'pathfolio',
      'student_demo',
      'alex_rivera',
      'system',
      'superuser',
      'moderator'
    ]);
    this.rollNumbers = new Map([
      ['2024CS101', { department: 'Computer Science & Engineering', batchYear: '2024-2028', registered: false }],
      ['2024ECE204', { department: 'Electronics & Communication', batchYear: '2024-2028', registered: false }],
      ['2024ME312', { department: 'Mechanical Engineering', batchYear: '2024-2028', registered: false }],
      ['2024DS108', { department: 'Data Science & AI', batchYear: '2024-2028', registered: false }],
      ['2024DES05', { department: 'Design & Human-Computer Interaction', batchYear: '2024-2028', registered: false }]
    ]);

    // Add a demo student to test state
    this.saveStudent({
      id: 'usr_demo_101',
      personal: {
        fullName: 'Alex Rivera',
        age: 19,
        email: 'alex.rivera@university.edu',
        username: 'alex_rivera'
      },
      academic: {
        rollNumber: '2024CS101',
        department: 'Computer Science & Engineering',
        batchYear: '2024-2028'
      },
      interests: {
        hobbies: ['Photography', 'Reading', 'Cycling'],
        passions: ['Artificial Intelligence', 'Human-Centered Design', 'Open Source']
      },
      achievements: [
        {
          id: 'ach_1',
          title: 'National Science Olympiad Silver Medalist',
          category: 'Competition',
          description: 'Secured national top 1% rank in physical computing track.',
          year: '2023'
        }
      ],
      familyContext: {
        details: 'First-generation college student.',
        consentGiven: true
      },
      createdAt: new Date().toISOString(),
      status: 'completed'
    });
  }

  async isUsernameTaken(username) {
    if (!username) return false;
    const normalized = username.toLowerCase().trim();
    return this.usernames.has(normalized);
  }

  async verifyRollNumber(rollNumber) {
    if (!rollNumber) return { valid: false, message: 'Roll number is required.' };
    const normalized = rollNumber.toUpperCase().trim();

    // Check pre-enrolled registry
    if (this.rollNumbers.has(normalized)) {
      const record = this.rollNumbers.get(normalized);
      return {
        valid: true,
        enrolled: true,
        department: record.department,
        batchYear: record.batchYear,
        message: 'Student roll number verified in institutional registry.'
      };
    }

    // Heuristic format check for general institutional roll numbers (e.g. 2024CS123 or general alphanumeric)
    const rollPattern = /^[A-Z0-9-]{4,16}$/i;
    if (rollPattern.test(normalized)) {
      return {
        valid: true,
        enrolled: true,
        department: null,
        batchYear: null,
        message: 'Format verified for institutional enrollment.'
      };
    }

    return {
      valid: false,
      enrolled: false,
      message: 'Roll number format does not match college enrollment pattern (4-16 alphanumeric characters).'
    };
  }

  async saveStudent(studentData) {
    const id = studentData.id || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const studentRecord = {
      ...studentData,
      id,
      updatedAt: new Date().toISOString()
    };

    if (studentRecord.personal?.username) {
      this.usernames.add(studentRecord.personal.username.toLowerCase().trim());
    }
    if (studentRecord.personal?.email) this.emails.set(studentRecord.personal.email.toLowerCase().trim(), id);

    this.students.set(id, studentRecord);
    return studentRecord;
  }

  async getStudentById(id) {
    return this.students.get(id) || null;
  }

  async getStudentByUsername(username) {
    const normalized = username.toLowerCase().trim();
    for (const student of this.students.values()) {
      if (student.personal?.username?.toLowerCase() === normalized) {
        return student;
      }
    }
    return null;
  }

  async getStudentByEmail(email) {
    const id = this.emails.get((email || '').toLowerCase().trim());
    return id ? this.getStudentById(id) : null;
  }

  async createSession(studentId) {
    const token = require('crypto').randomBytes(32).toString('hex');
    this.sessions.set(token, { studentId, createdAt: Date.now() });
    return token;
  }

  async getSession(token) { return this.sessions.get(token) || null; }
  async deleteSession(token) { this.sessions.delete(token); }
}

module.exports = new StudentStore();
