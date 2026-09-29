import React, { useState } from 'react';
import { useOnboarding } from '../context/OnboardingContext';
import { StepHeader } from './StepHeader';
import { TagSelector } from './TagSelector';
import { AchievementManager } from './AchievementManager';
import { ConsentBox } from './ConsentBox';
import { ReviewSummary } from './ReviewSummary';
import { InterestDetailList } from './InterestDetailList';
import {
  SUGGESTED_HOBBIES,
  SUGGESTED_PASSIONS,
  DEPARTMENTS,
  BATCH_YEARS,
  extractRollNumber
} from '../types/config';
import { Lock, Eye, EyeOff, Mail } from 'lucide-react';
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
    rollNumber,
    jumpToStage
  } = useOnboarding();

  const [showPassword, setShowPassword] = useState(false);

  switch (currentStage.id) {
    // STAGE 1: Welcome
    case 'welcome':
      return (
        <div className="pf-stage-welcome animate-fade-in">
          <div className="pf-welcome-card">
            <div className="pf-welcome-card__visual">
              <div className="pf-welcome-card__icon-stack">
                <div className="pf-welcome-icon-bubble pf-welcome-icon-bubble--1"><Mail size={20} /></div>
                <div className="pf-welcome-icon-bubble pf-welcome-icon-bubble--2"><Lock size={20} /></div>
                <div className="pf-welcome-icon-bubble pf-welcome-icon-bubble--3"><Mail size={20} /></div>
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

    // STAGE 2: Institutional Email (first piece of information collected)
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
              placeholder="2024CS101@kiit.ac.in"
              className={`pf-stage-hero-input ${errors.email ? 'is-error' : ''}`}
              maxLength={64}
            />
            {errors.email && <p className="pf-stage-error">{errors.email}</p>}
            <p className="pf-stage-hint">
              Use your institutional email in the format <b>rollnumber@kiit.ac.in</b>, your roll number is taken directly from it, so you don't need to enter it separately.
            </p>
          </div>
        </div>
      );

    // STAGE 3: Locked roll number + name
    case 'identity':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <div className="pf-stage-input-group">
              <label htmlFor="roll-locked" className="pf-form-label">Institutional Email</label>
              <input
                id="email-locked"
                type="email"
                value={formData.personal.email}
                readOnly
                disabled
                className="pf-stage-hero-input pf-stage-hero-input--locked"
              />
            </div>
            <div className="pf-stage-input-group">
              <label htmlFor="roll-locked" className="pf-form-label">
                Roll Number <span className="pf-locked-badge"><Lock size={12} /> Locked</span>
              </label>
              <input
                id="roll-locked"
                type="text"
                value={rollNumber}
                readOnly
                disabled
                className="pf-stage-hero-input pf-stage-hero-input--locked"
              />
              {errors.rollNumber && <p className="pf-stage-error">{errors.rollNumber}</p>}
              <p className="pf-stage-hint">Derived from your institutional email and locked to your account.</p>
            </div>
            <div className="pf-stage-input-group">
              <label htmlFor="fullName-input" className="pf-form-label">Full Name</label>
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
        </div>
      );

    // STAGE 4: Date of Birth
    case 'dob':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="dob-input" className="sr-only">Date of Birth</label>
            <input
              id="dob-input"
              type="date"
              autoFocus
              max={new Date().toISOString().slice(0, 10)}
              min={`${new Date().getFullYear() - 100}-01-01`}
              value={formData.personal.dateOfBirth || ''}
              onChange={(e) => updatePersonal('dateOfBirth', e.target.value)}
              className={`pf-stage-hero-input pf-stage-hero-input--date ${errors.dateOfBirth ? 'is-error' : ''}`}
            />
            {errors.dateOfBirth && <p className="pf-stage-error">{errors.dateOfBirth}</p>}
            <p className="pf-stage-hint">You must be between 15 and 100 years old. We store your date of birth and calculate your age from it.</p>
          </div>
        </div>
      );

    // STAGE 5: Academic Context
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

    // STAGE 6: Password
    case 'password': {
      const credentials = formData.credentials || { password: '', confirmPassword: '' };
      return (
      <div className="pf-stage-content animate-fade-in"><StepHeader eyebrow={currentStage.eyebrow} title={currentStage.title} description={currentStage.description} />
        <div className="pf-stage-input-wrapper"><label htmlFor="password-input" className="pf-form-label">Password</label><div className="pf-username-input-container"><input id="password-input" autoFocus type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={credentials.password} onChange={e => updateCredentials('password', e.target.value)} className={`pf-stage-hero-input ${errors.password ? 'is-error' : ''}`} /><button type="button" className="pf-username-status" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <p className="pf-stage-error">{errors.password}</p>}<label htmlFor="confirm-password-input" className="pf-form-label" style={{ marginTop: '18px' }}>Confirm password</label><input id="confirm-password-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={credentials.confirmPassword} onChange={e => updateCredentials('confirmPassword', e.target.value)} className={`pf-stage-hero-input ${errors.confirmPassword ? 'is-error' : ''}`} />{errors.confirmPassword && <p className="pf-stage-error">{errors.confirmPassword}</p>}<p className="pf-stage-hint">At least 8 characters. We never display or store your password in plain text.</p></div></div>);
    }

    // STAGE 7: Hobbies with per-interest detail
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
          {formData.interests.hobbies.length > 0 && (
            <InterestDetailList
              items={formData.interests.hobbies}
              onChange={(items) => updateInterests('hobbies', items)}
              variant="hobby"
              error={errors.hobbies}
            />
          )}
          {errors.hobbies && !formData.interests.hobbies.some(item => !item?.proficiency) && <p className="pf-stage-error">{errors.hobbies}</p>}
        </div>
      );

    // STAGE 8: Curiosities & Ambitions with per-interest detail
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
          {formData.interests.passions.length > 0 && (
            <InterestDetailList
              items={formData.interests.passions}
              onChange={(items) => updateInterests('passions', items)}
              variant="passion"
              error={errors.passions}
            />
          )}
          {errors.passions && !formData.interests.passions.some(item => !item?.proficiency) && <p className="pf-stage-error">{errors.passions}</p>}
        </div>
      );

    // STAGE 9: Initial Achievements
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

    // STAGE 10: Family Context / Personal Background
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

    // STAGE 11: Review
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

    // STAGE 12: Phone (optional)
    case 'phone':
      return (
        <div className="pf-stage-content animate-fade-in">
          <StepHeader
            eyebrow={currentStage.eyebrow}
            title={currentStage.title}
            description={currentStage.description}
          />
          <div className="pf-stage-input-wrapper">
            <label htmlFor="phone-input" className="sr-only">Phone number</label>
            <input
              id="phone-input"
              type="tel"
              autoFocus
              value={formData.personal.phone || ''}
              onChange={(e) => updatePersonal('phone', e.target.value)}
              placeholder="+91 98765 43210"
              className="pf-stage-hero-input"
              maxLength={20}
            />
            <p className="pf-stage-hint">Optional, the placement team can also reach you through notifications.</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}
