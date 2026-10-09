import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ONBOARDING_STAGES, extractRollNumber, INSTITUTIONAL_EMAIL_PATTERN } from '../types/config';
import { onboardingApi } from '../services/onboardingApi';

const STORAGE_KEY = 'pathfolio_onboarding_state';

const initialFormData = {
  personal: {
    fullName: '',
    dateOfBirth: '',
    phone: '',
    email: ''
  },
  academic: {
    rollNumber: '',
    department: '',
    batchYear: ''
  },
  credentials: { password: '', confirmPassword: '' },
  // Structured interests: [{ name, proficiency, reason }]
  interests: {
    hobbies: [],
    passions: []
  },
  achievements: [],
  familyContext: {
    details: '',
    consentGiven: false
  }
};

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const navigate = useNavigate();

  // Load from localStorage if available. The onboarding draft survives tab
  // closes (sessionStorage lost it), so an interrupted signup can resume.
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialFormData;
      // Existing drafts can predate newly added onboarding fields. Merge every
      // nested group so resuming an older draft never crashes a new stage.
      const parsed = JSON.parse(saved);
      const merged = {
        ...initialFormData,
        ...parsed,
        personal: { ...initialFormData.personal, ...(parsed.personal || {}) },
        academic: { ...initialFormData.academic, ...(parsed.academic || {}) },
        credentials: { ...initialFormData.credentials, ...(parsed.credentials || {}) },
        interests: { ...initialFormData.interests, ...(parsed.interests || {}) },
        familyContext: { ...initialFormData.familyContext, ...(parsed.familyContext || {}) }
      };
      // Migration: drop retired fields (age/username) from older drafts.
      delete merged.personal.age;
      delete merged.personal.username;
      return merged;
    } catch {
      return initialFormData;
    }
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [completedStudent, setCompletedStudent] = useState(null);
  // Result of the early email/roll-number duplicate check (step 2).
  const [emailCheck, setEmailCheck] = useState(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {
      console.warn('Failed to save onboarding state to localStorage', e);
    }
  }, [formData]);

  const currentStage = ONBOARDING_STAGES[currentStepIndex] || ONBOARDING_STAGES[0];
  const totalStages = ONBOARDING_STAGES.length;

  // The roll number is derived from the institutional email and locked.
  const rollNumber = extractRollNumber(formData.personal.email) || formData.academic.rollNumber || '';

  // Keep the derived roll number in sync with the email.
  useEffect(() => {
    const derived = extractRollNumber(formData.personal.email);
    if (derived && derived !== formData.academic.rollNumber) {
      setFormData(prev => ({ ...prev, academic: { ...prev.academic, rollNumber: derived } }));
    }
  }, [formData.personal.email, formData.academic.rollNumber]);

  // Field updates
  const updatePersonal = (field, value) => {
    setFormData(prev => ({
      ...prev,
      personal: { ...prev.personal, [field]: value }
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const updateAcademic = (field, value) => {
    setFormData(prev => ({
      ...prev,
      academic: { ...prev.academic, [field]: value }
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };
  const updateCredentials = (field, value) => {
    setFormData(prev => ({ ...prev, credentials: { ...prev.credentials, [field]: value } }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const updateInterests = (field, list) => {
    setFormData(prev => ({
      ...prev,
      interests: { ...prev.interests, [field]: list }
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const setAchievements = (achievementsList) => {
    setFormData(prev => ({
      ...prev,
      achievements: achievementsList
    }));
  };

  const updateFamilyContext = (field, value) => {
    setFormData(prev => ({
      ...prev,
      familyContext: { ...prev.familyContext, [field]: value }
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Validation per step
  const validateCurrentStep = async () => {
    const newErrors = {};

    switch (currentStage.id) {
      case 'welcome':
        return true;

      case 'email': {
        const email = (formData.personal.email || '').trim();
        if (!email) {
          newErrors.email = 'Institutional email is required.';
          break;
        }
        if (!INSTITUTIONAL_EMAIL_PATTERN.test(email)) {
          newErrors.email = 'Please use your KIIT institutional email in the format rollnumber@kiit.ac.in (e.g. 2024CS101@kiit.ac.in).';
          break;
        }
        // Early duplicate detection: ask the server before the student invests
        // time in the rest of onboarding.
        try {
          const res = await onboardingApi.checkEmail(email);
          setEmailCheck(res);
          if (!res.available) {
            newErrors.email = res.message || 'This email cannot be used.';
          }
        } catch (err) {
          newErrors.email = err.message || 'Unable to verify the email right now.';
        }
        break;
      }

      case 'identity': {
        if (!rollNumber) {
          newErrors.rollNumber = 'Your roll number could not be derived from the email. Please go back and re-enter it.';
        }
        if (!formData.personal.fullName || formData.personal.fullName.trim().length < 2) {
          newErrors.fullName = 'Please enter your full name (minimum 2 characters).';
        }
        break;
      }

      case 'dob': {
        const dob = formData.personal.dateOfBirth;
        if (!dob) {
          newErrors.dateOfBirth = 'Please provide your date of birth.';
          break;
        }
        const value = new Date(`${dob}T00:00:00`);
        const today = new Date();
        if (Number.isNaN(value.getTime())) {
          newErrors.dateOfBirth = 'Please provide a valid date.';
        } else if (value > today) {
          newErrors.dateOfBirth = 'Your date of birth cannot be in the future.';
        } else {
          let age = today.getFullYear() - value.getFullYear();
          const beforeBirthday = today.getMonth() < value.getMonth() || (today.getMonth() === value.getMonth() && today.getDate() < value.getDate());
          if (beforeBirthday) age -= 1;
          if (age < 15 || age > 100) {
            newErrors.dateOfBirth = 'Please provide a realistic date of birth (age 15-100).';
          }
        }
        break;
      }

      case 'academic':
        if (!formData.academic.department) {
          newErrors.department = 'Please select your department.';
        }
        if (!formData.academic.batchYear) {
          newErrors.batchYear = 'Please select your batch year cohort.';
        }
        break;

      case 'password':
        if (!formData.credentials?.password || formData.credentials.password.length < 8) newErrors.password = 'Use at least 8 characters.';
        if (formData.credentials?.password !== formData.credentials?.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
        break;

      case 'hobbies': {
        const hobbies = formData.interests.hobbies || [];
        if (hobbies.length === 0) {
          newErrors.hobbies = 'Please select or add at least one hobby or interest.';
        } else if (hobbies.some(item => !item?.proficiency)) {
          newErrors.hobbies = 'Tell us how good you are at each selected interest.';
        }
        break;
      }

      case 'passions': {
        const passions = formData.interests.passions || [];
        if (passions.length === 0) {
          newErrors.passions = 'Please select or add at least one topic or curiosity.';
        } else if (passions.some(item => !item?.proficiency)) {
          newErrors.passions = 'Tell us how familiar you are with each selected field.';
        }
        break;
      }

      case 'achievements':
        // Optional milestone step
        return true;

      case 'familyContext':
        // If user typed family context notes, explicit consent checkbox MUST be checked
        if (formData.familyContext.details && formData.familyContext.details.trim().length > 0) {
          if (!formData.familyContext.consentGiven) {
            newErrors.consentGiven = 'Consent is required before storing personal/family background context.';
          }
        }
        break;

      case 'review':
        return true;

      case 'phone':
        // Optional contact step
        return true;

      default:
        return true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step transitions
  const nextStep = async () => {
    setSubmitError(null);
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    if (currentStepIndex < totalStages - 1) {
      setCurrentStepIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Complete review & submit
      await handleCompleteRegistration();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setErrors({});
      setSubmitError(null);
      setCurrentStepIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  const skipStep = () => {
    if (currentStage.isSkippable && currentStepIndex < totalStages - 1) {
      setErrors({});
      setSubmitError(null);
      setCurrentStepIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const jumpToStage = (stageId) => {
    const targetIdx = ONBOARDING_STAGES.findIndex(s => s.id === stageId);
    if (targetIdx !== -1) {
      setErrors({});
      setCurrentStepIndex(targetIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Final submission to API
  const handleCompleteRegistration = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        ...formData,
        academic: { ...formData.academic, rollNumber }
      };
      const regResponse = await onboardingApi.register(payload);

      // Strict mode: registration is held until the emailed link is opened.
      if (regResponse.pendingVerification) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.setItem('pathfolio_verification_email', regResponse.email || payload.personal.email);
        window.location.href = '/onboarding/pending-verification';
        return;
      }

      if (!regResponse.success && !regResponse.data) {
        throw new Error(regResponse.message || 'Registration failed.');
      }

      const studentId = regResponse.data?.id;

      const completedData = {
        ...formData,
        id: studentId,
        completedAt: regResponse.data?.onboarding?.completedAt || new Date().toISOString()
      };

      setCompletedStudent(completedData);
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem('pathfolio_completed_student', JSON.stringify(completedData));

      // Update auth context by triggering a full page reload to /onboarding/complete
      // which will ensure the AuthContext fetches the new session on load.
      window.location.href = '/onboarding/complete';
    } catch (err) {
      console.error('Registration failed:', err);
      setSubmitError(err.message || 'Unable to complete registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetOnboarding = () => {
    setFormData(initialFormData);
    setCurrentStepIndex(0);
    setErrors({});
    setSubmitError(null);
    setCompletedStudent(null);
    setEmailCheck(null);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('pathfolio_completed_student');
  };

  return (
    <OnboardingContext.Provider
      value={{
        formData,
        currentStage,
        currentStepIndex,
        totalStages,
        errors,
        isSubmitting,
        submitError,
        completedStudent,
        rollNumber,
        emailCheck,
        updatePersonal,
        updateAcademic,
        updateCredentials,
        updateInterests,
        setAchievements,
        updateFamilyContext,
        nextStep,
        prevStep,
        skipStep,
        jumpToStage,
        resetOnboarding
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
