import React, { useState, useEffect } from 'react';
import { useOnboarding } from '../context/OnboardingContext';
import { useDebounce } from '../../../../hooks/useDebounce';
import { onboardingApi } from '../services/onboardingApi';
import { StepHeader } from './StepHeader';
import { TagSelector } from './TagSelector';
import { AchievementManager } from './AchievementManager';
import { ConsentBox } from './ConsentBox';
import { ReviewSummary } from './ReviewSummary';
import { SUGGESTED_HOBBIES, SUGGESTED_PASSIONS, DEPARTMENTS, BATCH_YEARS } from '../types/config';
import { Check, X, Loader2, Sparkles, BookOpen, Compass, Award, Eye, EyeOff } from 'lucide-react';
import './StageRenderer.css';

export function StageRenderer() {
  const {
    currentStage,
    formData,
    errors,
    updatePersonal,
    updateAcademic,
    updateCredentials,
    updateInterests,
    setAchievements,
    updateFamilyContext,
    jumpToStage
  } = useOnboarding();

  // Username live availability checking
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, message: '', available: null });
  const debouncedUsername = useDebounce(formData.personal.username, 350);

  useEffect(() => {
    if (currentStage.id !== 'username') return;

    const trimmed = (debouncedUsername || '').trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus({ checking: false, message: '', available: null });
      return;
    }

    let isMounted = true;
    setUsernameStatus({ checking: true, message: 'Checking availability...', available: null });

    onboardingApi.checkUsername(trimmed).then(res => {
      if (isMounted) {
        setUsernameStatus({
          checking: false,
          message: res.message,
          available: res.available
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedUsername, currentStage.id]);

  // Roll Number live format verification
  const [rollStatus, setRollStatus] = useState({ checking: false, verified: null, message: '' });
  const debouncedRoll = useDebounce(formData.academic.rollNumber, 400);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (currentStage.id !== 'rollNumber') return;

    const trimmed = (debouncedRoll || '').trim();
    if (!trimmed || trimmed.length < 3) {
      setRollStatus({ checking: false, verified: null, message: '' });
      return;
    }

    let isMounted = true;
    setRollStatus({ checking: true, verified: null, message: 'Verifying enrollment...' });

    onboardingApi.verifyRollNumber(trimmed).then(res => {
      if (isMounted) {
        setRollStatus({
          checking: false,
          verified: res.valid,
          message: res.message
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedRoll, currentStage.id]);

  switch (currentStage.id) {
    // STAGE 1: Welcome
    case 'welcome':
      return (
        <div className="pf-stage-welcome animate-fade-in">
          <div className="pf-welcome-card">
            <div className="pf-welcome-card__visual">
              <div className="pf-welcome-card__icon-stack">
                <div className="pf-welcome-icon-bubble pf-welcome-icon-bubble--1"><BookOpen size={20} /></div>
                <div className="pf-welcome-icon-bubble pf-welcome-icon-bubble--2"><Compass size={20} /></div>
                <div className="pf-welcome-icon-bubble pf-welcome-icon-bubble--3"><Award size={20} /></div>
              </div>
            </div>
            
            <div className="pf-welcome-card__content">
              <span className="editorial-eyebrow">Your college journey begins</span>
              <h2 className="pf-welcome-card__title">Let's begin with you.</h2>
              <p className="pf-welcome-card__desc">
                Your college journey starts with a few things that make you who you are. Over the next few minutes, we will establish your foundation on PathfolioApp.
              </p>

              <div className="pf-welcome-highlights">
                <div className="pf-welcome-highlight-item">
                  <span className="pf-welcome-highlight-num">~5 min</span>
                  <span className="pf-welcome-highlight-text">Estimated time</span>
                </div>
                <div className="pf-welcome-highlight-item">
                  <span className="pf-welcome-highlight-num">100%</span>
                  <span className="pf-welcome-highlight-text">Your control & consent</span>
                </div>
                <div className="pf-welcome-highlight-item">
                  <span className="pf-welcome-highlight-num">4 Years</span>
                  <span className="pf-welcome-highlight-text">Record of growth</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    // STAGE 2: Name
    case 'name':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="fullName-input" className="sr-only">Full Name</label>
            <input
              id="fullName-input"
              type="text"
              autoFocus
              value={formData.personal.fullName}
              onChange={(e) => updatePersonal('fullName', e.target.value)}
              placeholder="e.g. Maya Chen"
              className={`pf-stage-hero-input ${errors.fullName ? 'is-error' : ''}`}
              maxLength={80}
            />
            {errors.fullName && <p className="pf-stage-error">{errors.fullName}</p>}
            <p className="pf-stage-hint">Please enter your preferred or legal full name.</p>
          </div>
        </div>
      );

    // STAGE 3: Age
    case 'age':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="age-input" className="sr-only">Age</label>
            <div className="pf-age-selector-container">
              <input
                id="age-input"
                type="number"
                min="15"
                max="99"
                autoFocus
                value={formData.personal.age}
                onChange={(e) => updatePersonal('age', e.target.value)}
                placeholder="18"
                className={`pf-stage-hero-input pf-stage-hero-input--compact ${errors.age ? 'is-error' : ''}`}
              />
              <span className="pf-age-unit">years old</span>
            </div>
            {errors.age && <p className="pf-stage-error">{errors.age}</p>}
            
            {/* Quick selectors for standard university admission ages */}
            <div className="pf-quick-age-pills">
              {[17, 18, 19, 20, 21, 22].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => updatePersonal('age', num.toString())}
                  className={`pf-age-pill ${formData.personal.age == num ? 'is-active' : ''}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    // STAGE 4: Institutional Email
    case 'email':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="email-input" className="sr-only">Institutional Email</label>
            <input
              id="email-input"
              type="email"
              autoFocus
              value={formData.personal.email}
              onChange={(e) => updatePersonal('email', e.target.value)}
              placeholder="name@kiit.ac.in"
              className={`pf-stage-hero-input ${errors.email ? 'is-error' : ''}`}
            />
            {errors.email && <p className="pf-stage-error">{errors.email}</p>}
            <p className="pf-stage-hint">
              We recommend using your official university or department email address to link your record.
            </p>
          </div>
        </div>
      );

    // STAGE 5: Username
    case 'username':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="username-input" className="sr-only">Username</label>
            <div className="pf-username-input-container">
              <span className="pf-username-prefix">@</span>
              <input
                id="username-input"
                type="text"
                autoFocus
                value={formData.personal.username}
                onChange={(e) => updatePersonal('username', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="mayachen"
                className={`pf-stage-hero-input pf-stage-hero-input--prefixed ${errors.username ? 'is-error' : ''}`}
                maxLength={20}
              />
              {usernameStatus.checking && (
                <div className="pf-username-status pf-username-status--checking">
                  <Loader2 size={16} className="pf-spin" />
                </div>
              )}
              {!usernameStatus.checking && usernameStatus.available === true && (
                <div className="pf-username-status pf-username-status--available">
                  <Check size={16} />
                </div>
              )}
              {!usernameStatus.checking && usernameStatus.available === false && (
                <div className="pf-username-status pf-username-status--taken">
                  <X size={16} />
                </div>
              )}
            </div>

            {errors.username && <p className="pf-stage-error">{errors.username}</p>}
            
            {!errors.username && usernameStatus.message && (
              <p className={`pf-username-feedback ${usernameStatus.available ? 'is-available' : 'is-taken'}`}>
                {usernameStatus.message}
              </p>
            )}

            <p className="pf-stage-hint">
              3-20 characters. Letters, numbers, hyphens, and underscores only.
            </p>
          </div>
        </div>
      );

    // STAGE 6: Roll Number
    case 'rollNumber':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="rollNumber-input" className="sr-only">Roll Number</label>
            <input
              id="rollNumber-input"
              type="text"
              autoFocus
              value={formData.academic.rollNumber}
              onChange={(e) => updateAcademic('rollNumber', e.target.value)}
              placeholder="e.g. 2305040"
              className={`pf-stage-hero-input ${errors.rollNumber ? 'is-error' : ''}`}
              maxLength={20}
            />
            {errors.rollNumber && <p className="pf-stage-error">{errors.rollNumber}</p>}

            {rollStatus.message && !errors.rollNumber && (
              <p className="pf-stage-hint pf-stage-hint--verified">
                <Check size={14} /> {rollStatus.message}
              </p>
            )}

            <p className="pf-stage-hint">
              This links your Pathfolio account to your official college enrollment record.
            </p>
          </div>
        </div>
      );

    // STAGE 7: Academic Context
    case 'academic':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-academic-form-grid">
            <div className="pf-form-group">
              <label htmlFor="dept-select" className="pf-form-label">Department / Major *</label>
              <select
                id="dept-select"
                value={formData.academic.department}
                onChange={(e) => updateAcademic('department', e.target.value)}
                className={`pf-select pf-select--lg ${errors.department ? 'is-error' : ''}`}
              >
                <option value="">Select your department...</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {errors.department && <p className="pf-stage-error">{errors.department}</p>}
            </div>

            <div className="pf-form-group">
              <label htmlFor="batch-select" className="pf-form-label">Batch Year Cohort *</label>
              <select
                id="batch-select"
                value={formData.academic.batchYear}
                onChange={(e) => updateAcademic('batchYear', e.target.value)}
                className={`pf-select pf-select--lg ${errors.batchYear ? 'is-error' : ''}`}
              >
                <option value="">Select your graduation batch...</option>
                {BATCH_YEARS.map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
              {errors.batchYear && <p className="pf-stage-error">{errors.batchYear}</p>}
            </div>
          </div>
        </div>
      );

    // STAGE 8: Hobbies
    case 'password': { const credentials = formData.credentials || { password: '', confirmPassword: '' }; return (
      <div className="pf-stage-content animate-fade-in"><StepHeader eyebrow={currentStage.eyebrow} title={currentStage.title} description={currentStage.description} />
        <div className="pf-stage-input-wrapper"><label htmlFor="password-input" className="pf-form-label">Password</label><div className="pf-username-input-container"><input id="password-input" autoFocus type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={credentials.password} onChange={e => updateCredentials('password', e.target.value)} className={`pf-stage-hero-input ${errors.password ? 'is-error' : ''}`} /><button type="button" className="pf-username-status" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <p className="pf-stage-error">{errors.password}</p>}<label htmlFor="confirm-password-input" className="pf-form-label" style={{ marginTop: '18px' }}>Confirm password</label><input id="confirm-password-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={credentials.confirmPassword} onChange={e => updateCredentials('confirmPassword', e.target.value)} className={`pf-stage-hero-input ${errors.confirmPassword ? 'is-error' : ''}`} />{errors.confirmPassword && <p className="pf-stage-error">{errors.confirmPassword}</p>}<p className="pf-stage-hint">At least 8 characters. We never display or store your password in plain text.</p></div></div>); }

    case 'hobbies':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <TagSelector
            suggestedTags={SUGGESTED_HOBBIES}
            selectedTags={formData.interests.hobbies}
            onChange={(tags) => updateInterests('hobbies', tags)}
            placeholder="Add custom hobby (e.g. Calligraphy, Botany)..."
            searchPlaceholder="Filter suggested hobbies..."
          />
          {errors.hobbies && <p className="pf-stage-error">{errors.hobbies}</p>}
        </div>
      );

    // STAGE 9: Passions / Interests
    case 'passions':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <TagSelector
            suggestedTags={SUGGESTED_PASSIONS}
            selectedTags={formData.interests.passions}
            onChange={(tags) => updateInterests('passions', tags)}
            placeholder="Add custom curiosity or field (e.g. Bio-informatics)..."
            searchPlaceholder="Filter passions & fields..."
          />
          {errors.passions && <p className="pf-stage-error">{errors.passions}</p>}
        </div>
      );

    // STAGE 10: Initial Achievements
    case 'achievements':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <AchievementManager
            achievements={formData.achievements}
            onChange={setAchievements}
          />
        </div>
      );

    // STAGE 11: Family Context / Personal Background
    case 'familyContext':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <ConsentBox
            value={formData.familyContext.details}
            onChangeValue={(val) => updateFamilyContext('details', val)}
            consentGiven={formData.familyContext.consentGiven}
            onChangeConsent={(val) => updateFamilyContext('consentGiven', val)}
            error={errors.consentGiven}
          />
        </div>
      );

    // STAGE 12: Review
    case 'review':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <ReviewSummary
            formData={formData}
            onEditSection={jumpToStage}
          />
        </div>
      );

    default:
      return null;
  }
}
