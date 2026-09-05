const studentStore = require('../models/studentStore');

class OnboardingService {
  async checkUsernameAvailability(username) {
    if (!username || typeof username !== 'string') {
      return {
        available: false,
        message: 'A valid username is required.'
      };
    }

    const trimmed = username.trim().toLowerCase();

    // Validation rules: 3-20 chars, alphanumeric or underscores/hyphens only
    const validPattern = /^[a-z0-9_-]{3,20}$/;
    if (!validPattern.test(trimmed)) {
      return {
        available: false,
        message: 'Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.'
      };
    }

    const isTaken = await studentStore.isUsernameTaken(trimmed);
    if (isTaken) {
      return {
        available: false,
        message: `Username "${trimmed}" is already taken. Please choose another.`
      };
    }

    return {
      available: true,
      message: `Username "${trimmed}" is available.`
    };
  }

  async verifyRollNumber(rollNumber) {
    return await studentStore.verifyRollNumber(rollNumber);
  }

  async registerStudent(onboardingData) {
    const { personal, academic, interests, achievements, familyContext, credentials } = onboardingData;

    // Validate required fields
    if (!personal?.fullName || personal.fullName.trim().length < 2) {
      throw new Error('Full name is required (minimum 2 characters).');
    }

    if (!personal?.age || personal.age < 15 || personal.age > 100) {
      throw new Error('Please provide a valid age (15-100).');
    }

    if (!personal?.email || !this.validateEmail(personal.email)) {
      throw new Error('Please use your KIIT institutional email ending in @kiit.ac.in.');
    }

    if (!personal?.username) {
      throw new Error('Username is required.');
    }

    if (!credentials?.password || credentials.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    if (credentials.password !== credentials.confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (await studentStore.getStudentByEmail(personal.email)) {
      throw new Error('An account already exists for this email.');
    }

    const usernameCheck = await this.checkUsernameAvailability(personal.username);
    if (!usernameCheck.available) {
      throw new Error(usernameCheck.message);
    }

    if (!academic?.rollNumber || !/^\d+$/.test(String(academic.rollNumber).trim())) {
      throw new Error('Roll number must contain numbers only.');
    }

    if (!academic?.department) {
      throw new Error('Department is required.');
    }

    if (!academic?.batchYear) {
      throw new Error('Batch year is required.');
    }

    // PRIVACY & CONSENT ENFORCEMENT (SRS Requirement):
    // If sensitive family context details are provided, explicit consent must be present.
    let sanitizedFamilyContext = { details: '', consentGiven: false };
    if (familyContext?.details && familyContext.details.trim().length > 0) {
      if (!familyContext.consentGiven) {
        throw new Error('Explicit consent is required to record personal/family context.');
      }
      sanitizedFamilyContext = {
        details: familyContext.details.trim(),
        consentGiven: true
      };
    }

    // Format achievements
    const sanitizedAchievements = Array.isArray(achievements)
      ? achievements
          .filter(a => a && a.title && a.title.trim().length > 0)
          .map((a, index) => ({
            id: a.id || `ach_${Date.now()}_${index}`,
            title: a.title.trim(),
            category: a.category || 'General',
            description: (a.description || '').trim(),
            year: (a.year || '').trim()
          }))
      : [];

    const record = {
      personal: {
        fullName: personal.fullName.trim(),
        age: Number(personal.age),
        email: personal.email.trim().toLowerCase(),
        username: personal.username.trim().toLowerCase()
      },
      academic: {
        rollNumber: academic.rollNumber.trim(),
        department: academic.department.trim(),
        batchYear: academic.batchYear.trim()
      },
      interests: {
        hobbies: Array.isArray(interests?.hobbies) ? interests.hobbies : [],
        passions: Array.isArray(interests?.passions) ? interests.passions : []
      },
      achievements: sanitizedAchievements,
      familyContext: sanitizedFamilyContext,
      profileSettings: { visibility: 'private', fieldVisibility: { personal: 'student', academic: 'student', interests: 'shareable', achievements: 'shareable', familyContext: 'student' } },
      passwordHash: await require('./auth.service').hashPassword(credentials.password),
      onboarding: { completed: true, completedAt: new Date().toISOString() },
      status: 'active_onboarded',
      createdAt: new Date().toISOString()
    };

    const savedRecord = await studentStore.saveStudent(record);
    await studentStore.createNotification(savedRecord.id, { title: 'Account created', message: 'Your PathfolioApp account is ready.', type: 'account' });

    // Return student record without exposing internal raw flags in sensitive ways
    return {
      id: savedRecord.id,
      personal: savedRecord.personal,
      academic: savedRecord.academic,
      interests: savedRecord.interests,
      achievementsCount: savedRecord.achievements.length,
      hasFamilyContext: Boolean(savedRecord.familyContext?.details),
      status: savedRecord.status,
      createdAt: savedRecord.createdAt
    };
  }

  async completeOnboarding(studentId) {
    if (!studentId) {
      throw new Error('Student ID is required to complete onboarding.');
    }

    const student = await studentStore.getStudentById(studentId);
    if (!student) {
      throw new Error('Student record not found.');
    }

    student.completedAt = new Date().toISOString();
    student.status = 'onboarding_completed';
    await studentStore.saveStudent(student);

    return {
      success: true,
      message: 'Onboarding completed successfully. Journey initialized.',
      student: {
        id: student.id,
        fullName: student.personal.fullName,
        username: student.personal.username,
        department: student.academic.department,
        batchYear: student.academic.batchYear,
        completedAt: student.completedAt
      }
    };
  }

  validateEmail(email) {
    return /^[^\s@]+@kiit\.ac\.in$/i.test(String(email).trim());
  }
}

module.exports = new OnboardingService();
