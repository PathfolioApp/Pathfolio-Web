import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ONBOARDING_STAGES } from '../types/config';
import { onboardingApi } from '../../../services/onboardingApi';

const STORAGE_KEY = 'pathfolio_onboarding_state';

const initialFormData = {
  personal: {
    fullName: '',
    age: '',
    email: '',
    username: ''
  },
  academic: {
    rollNumber: '',
    department: '',
    batchYear: ''
  },
  credentials: { password: '', confirmPassword: '' },
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

  // Load from sessionStorage if available
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return initialFormData;
      // Existing drafts can predate newly added onboarding fields. Merge every
      // nested group so resuming an older draft never crashes a new stage.
      const parsed = JSON.parse(saved);
      return {
        ...initialFormData,
        ...parsed,
        personal: { ...initialFormData.personal, ...(parsed.personal || {}) },
        academic: { ...initialFormData.academic, ...(parsed.academic || {}) },
        credentials: { ...initialFormData.credentials, ...(parsed.credentials || {}) },
        interests: { ...initialFormData.interests, ...(parsed.interests || {}) },
        familyContext: { ...initialFormData.familyContext, ...(parsed.familyContext || {}) }
      };
    } catch {
      return initialFormData;
    }
  });

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [completedStudent, setCompletedStudent] = useState(null);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {
      console.warn('Failed to save onboarding state to sessionStorage', e);
    }
  }, [formData]);

  const currentStage = ONBOARDING_STAGES[currentStepIndex] || ONBOARDING_STAGES[0];
  const totalStages = ONBOARDING_STAGES.length;

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

      case 'name':
        if (!formData.personal.fullName || formData.personal.fullName.trim().length < 2) {
          newErrors.fullName = 'Please enter your full name (minimum 2 characters).';
        }
        break;

      case 'age': {
        const ageNum = parseInt(formData.personal.age, 10);
        if (!formData.personal.age || isNaN(ageNum) || ageNum < 15 || ageNum > 99) {
          newErrors.age = 'Please enter a valid age between 15 and 99.';
        }
        break;
      }

      case 'email': {
        const email = (formData.personal.email || '').trim();
        const emailRegex = /^[^\s@]+@kiit\.ac\.in$/i;
        if (!email) {
          newErrors.email = 'Institutional email is required.';
        } else if (!emailRegex.test(email)) {
          newErrors.email = 'Please use your KIIT institutional email ending in @kiit.ac.in.';
        }
        break;
      }

      case 'username': {
        const username = (formData.personal.username || '').trim();
        if (!username) {
          newErrors.username = 'Please choose a username.';
        } else if (username.length < 3 || username.length > 20) {
          newErrors.username = 'Username must be between 3 and 20 characters.';
        } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          newErrors.username = 'Username can only contain letters, numbers, hyphens, and underscores.';
        } else {
          // Verify with backend
          const res = await onboardingApi.checkUsername(username);
          if (!res.available) {
            newErrors.username = res.message || 'This username is already taken.';
          }
        }
        break;
      }

      case 'rollNumber': {
        const roll = (formData.academic.rollNumber || '').trim();
        if (!roll) {
          newErrors.rollNumber = 'College roll number is required.';
        } else if (!/^\d+$/.test(roll)) {
          newErrors.rollNumber = 'Roll number must contain numbers only.';
        } else {
          const res = await onboardingApi.verifyRollNumber(roll);
          if (!res.valid) {
            newErrors.rollNumber = res.message || 'Invalid roll number format.';
          } else if (res.department && !formData.academic.department) {
            // Auto-populate academic fields if pre-enrolled record exists
            updateAcademic('department', res.department);
            if (res.batchYear && !formData.academic.batchYear) {
              updateAcademic('batchYear', res.batchYear);
            }
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

      case 'hobbies':
        if (!formData.interests.hobbies || formData.interests.hobbies.length === 0) {
          newErrors.hobbies = 'Please select or add at least one hobby or interest.';
        }
        break;

      case 'passions':
        if (!formData.interests.passions || formData.interests.passions.length === 0) {
          newErrors.passions = 'Please select or add at least one topic or curiosity.';
        }
        break;

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
      const regResponse = await onboardingApi.register(formData);
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
      sessionStorage.removeItem(STORAGE_KEY);
      navigate('/dashboard');
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
    sessionStorage.removeItem(STORAGE_KEY);
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
