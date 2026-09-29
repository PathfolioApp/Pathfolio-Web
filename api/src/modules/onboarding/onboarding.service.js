const config = require('../../config');
const emailService = require('../../shared/email.service');
const studentStore = require('../students/studentStore');

// Institutional email format: rollnumber@kiit.ac.in e.g. 2024CS101@kiit.ac.in
const INSTITUTIONAL_EMAIL_PATTERN = /^([a-z0-9]+)@kiit\.ac\.in$/i;
const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const FAMILIARITY_LEVELS = ['exploring', 'beginner', 'intermediate', 'advanced'];

const normalizeEmail = email => String(email || '').trim().toLowerCase();
const clean = value => String(value || '').trim();

/** Extract the roll number from an institutional email. `2024CS101@kiit.ac.in` -> `2024CS101`. */
function extractRollNumber(email) {
  const match = normalizeEmail(email).match(INSTITUTIONAL_EMAIL_PATTERN);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Validate and normalize a single structured interest entry
 * ({ name, proficiency, reason }). Unknown proficiency values fall back to
 * the lowest tier; the optional reason is length-capped, never required.
 */
function normalizeInterestDetail(entry, allowedLevels, kindLabel, index) {
  const name = clean(typeof entry === 'string' ? entry : entry?.name);
  if (!name) return null;
  const proficiencyRaw = clean(typeof entry === 'string' ? '' : entry?.proficiency).toLowerCase();
  const proficiency = allowedLevels.includes(proficiencyRaw) ? proficiencyRaw : allowedLevels[0];
  const reason = clean(typeof entry === 'string' ? '' : entry?.reason).slice(0, 300);
  return { name, proficiency, reason, kind: kindLabel, order: index };
}

function normalizeInterestList(list, allowedLevels, kindLabel) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const normalized = [];
  list.forEach((entry, index) => {
    const item = normalizeInterestDetail(entry, allowedLevels, kindLabel, index);
    if (!item) return;
    const key = item.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(item);
  });
  return normalized.slice(0, 20);
}

/**
 * Validate a date-of-birth string (YYYY-MM-DD). Rejects future dates and
 * ages outside the plausible student band. Returns { dob, age }.
 */
function validateDateOfBirth(input) {
  const raw = clean(input);
  if (!raw) throw new Error('Please provide your date of birth.');
  const value = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date of birth must be a valid date.');
  const dob = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== value) throw new Error('Date of birth must be a valid date.');
  const today = new Date();
  if (dob > today) throw new Error('Date of birth cannot be in the future.');
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  if (age < 15 || age > 100) throw new Error('Please provide a realistic date of birth (age 15-100).');
  return { dob: value, age };
}

class OnboardingService {
  /** Early duplicate detection, before the student invests time in onboarding. */
  async checkEmail(emailInput) {
    const email = normalizeEmail(emailInput);
    if (!email) return { available: false, message: 'Institutional email is required.' };
    const match = email.match(INSTITUTIONAL_EMAIL_PATTERN);
    if (!match) {
      return { available: false, message: 'Please use your KIIT institutional email in the format rollnumber@kiit.ac.in (e.g. 2024CS101@kiit.ac.in).' };
    }
    const rollNumber = match[1].toUpperCase();
    if (await studentStore.getStudentByEmail(email)) {
      return { available: false, accountExists: true, identifier: 'email', message: 'An account already exists for this email. Please sign in instead.' };
    }
    if (await studentStore.getStudentByRollNumber(rollNumber)) {
      return { available: false, accountExists: true, identifier: 'rollNumber', message: `An account already exists for roll number ${rollNumber}. Please sign in instead.` };
    }
    return { available: true, rollNumber, email, message: `Email verified. Your roll number is ${rollNumber}.` };
  }

  async verifyRollNumber(rollNumber) {
    const roll = clean(rollNumber).toUpperCase();
    if (!roll) return { valid: false, message: 'Roll number is required.' };
    if (await studentStore.getStudentByRollNumber(roll)) {
      return { valid: false, accountExists: true, message: `An account already exists for roll number ${roll}. Please sign in instead.` };
    }
    return { valid: true, enrolled: true, department: null, batchYear: null, message: 'Roll number format verified.' };
  }

  async registerStudent(onboardingData) {
    const { personal, academic, interests, achievements, familyContext, credentials } = onboardingData || {};

    const email = normalizeEmail(personal?.email);
    if (!email || !INSTITUTIONAL_EMAIL_PATTERN.test(email)) {
      throw new Error('Please use your KIIT institutional email in the format rollnumber@kiit.ac.in.');
    }
    const rollNumber = extractRollNumber(email);
    if (!academic?.rollNumber || clean(academic.rollNumber).toUpperCase() !== rollNumber) {
      throw new Error('The roll number must match the one derived from your institutional email.');
    }

    if (!personal?.fullName || clean(personal.fullName).length < 2) {
      throw new Error('Full name is required (minimum 2 characters).');
    }

    if (!personal?.dateOfBirth) throw new Error('Date of birth is required.');
    const { dob } = validateDateOfBirth(personal.dateOfBirth);

    if (await studentStore.getStudentByEmail(email)) {
      throw new Error('An account already exists for this email. Please sign in instead.');
    }
    if (await studentStore.getStudentByRollNumber(rollNumber)) {
      throw new Error(`An account already exists for roll number ${rollNumber}. Please sign in instead.`);
    }

    if (!credentials?.password || credentials.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    if (credentials.password !== credentials.confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    if (!academic?.department) throw new Error('Department is required.');
    if (!academic?.batchYear) throw new Error('Batch year is required.');

    // PRIVACY & CONSENT ENFORCEMENT (SRS Requirement):
    // If sensitive family context details are provided, explicit consent must be present.
    let sanitizedFamilyContext = { details: '', consentGiven: false };
    if (familyContext?.details && clean(familyContext.details).length > 0) {
      if (!familyContext.consentGiven) {
        throw new Error('Explicit consent is required to record personal/family context.');
      }
      sanitizedFamilyContext = { details: clean(familyContext.details), consentGiven: true };
    }

    const sanitizedAchievements = Array.isArray(achievements)
      ? achievements
          .filter(a => a && a.title && clean(a.title).length > 0)
          .map((a, index) => ({
            id: a.id || `ach_${Date.now()}_${index}`,
            title: clean(a.title),
            category: a.category || 'General',
            description: clean(a.description),
            year: clean(a.year)
          }))
      : [];

    const record = {
      personal: {
        fullName: clean(personal.fullName),
        dateOfBirth: dob,
        email,
        phone: clean(personal.phone)
      },
      academic: {
        rollNumber,
        department: clean(academic.department),
        batchYear: clean(academic.batchYear)
      },
      // Structured interest details: { name, proficiency, reason } per selection.
      interests: {
        hobbies: normalizeInterestList(interests?.hobbies, PROFICIENCY_LEVELS, 'hobby'),
        passions: normalizeInterestList(interests?.passions, FAMILIARITY_LEVELS, 'passion')
      },
      achievements: sanitizedAchievements,
      internships: [],
      familyContext: sanitizedFamilyContext,
      profileSettings: { visibility: 'private', fieldVisibility: { personal: 'student', academic: 'student', interests: 'shareable', achievements: 'shareable', familyContext: 'student' } },
      passwordHash: await require('../auth/auth.service').hashPassword(credentials.password),
      isAdmin: false,
      isRecruiter: false,
      onboarding: { completed: true, completedAt: new Date().toISOString() },
      status: 'active_onboarded',
      createdAt: new Date().toISOString()
    };

    if (config.strictEmailVerification) {
      // Strict mode: hold the registration as a pending verification token.
      // The account is only materialized once the emailed link is consumed.
      if (!emailService.isConfigured(config)) {
        const error = new Error('Email verification is required but email delivery is not configured on the server. Contact the administrator.');
        error.statusCode = 503;
        throw error;
      }
      const token = await studentStore.saveEmailVerification(email, rollNumber, { registration: record }, config.emailVerificationTokenTtlMinutes);
      await emailService.sendVerificationEmail(config, { to: email, rollNumber, token });
      return {
        pendingVerification: true,
        email,
        rollNumber,
        message: `A verification link was sent to ${email}. Confirm it within ${config.emailVerificationTokenTtlMinutes} minutes to finish creating your account.`
      };
    }

    // Development-friendly flow: validate format, create the account immediately.
    const savedRecord = await studentStore.saveStudent(record);
    await studentStore.createNotification(savedRecord.id, { title: 'Account created', message: 'Your PathfolioApp account is ready.', type: 'account' });

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

  /** Consume a time-limited verification token and create the held account. */
  async verifyEmailToken(token) {
    const result = await studentStore.consumeEmailVerification(token);
    if (!result) return { success: false, message: 'This verification link is invalid.' };
    if (result.expired) return { success: false, expired: true, message: 'This verification link has expired. Please start registration again.' };
    if (result.used) return { success: false, used: true, message: 'This verification link was already used.' };

    const { registration } = result.payload || {};
    if (!registration) return { success: false, message: 'Verification record is incomplete. Please register again.' };
    if (await studentStore.getStudentByEmail(result.email)) {
      return { success: false, used: true, message: 'An account for this email already exists. Please sign in.' };
    }

    const savedRecord = await studentStore.saveStudent(registration);
    await studentStore.createNotification(savedRecord.id, { title: 'Email verified', message: 'Your PathfolioApp account is verified and ready.', type: 'account' });
    return {
      success: true,
      message: 'Email verified. Your PathfolioApp account is ready.',
      student: {
        id: savedRecord.id,
        personal: savedRecord.personal,
        academic: savedRecord.academic,
        interests: savedRecord.interests,
        status: savedRecord.status,
        createdAt: savedRecord.createdAt
      }
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
        rollNumber: student.academic.rollNumber,
        department: student.academic.department,
        batchYear: student.academic.batchYear,
        completedAt: student.completedAt
      }
    };
  }

  validateEmail(email) {
    return INSTITUTIONAL_EMAIL_PATTERN.test(String(email).trim());
  }
}

module.exports = new OnboardingService();
module.exports.extractRollNumber = extractRollNumber;
module.exports.validateDateOfBirth = validateDateOfBirth;
module.exports.PROFICIENCY_LEVELS = PROFICIENCY_LEVELS;
module.exports.FAMILIARITY_LEVELS = FAMILIARITY_LEVELS;
