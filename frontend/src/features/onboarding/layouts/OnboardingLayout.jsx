import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOnboarding } from '../context/OnboardingContext';
import { StageRenderer } from '../components/StageRenderer';
import { StepNavigation } from '../components/StepNavigation';
import { Footer } from '../../../components/Footer';
import { Shield, Sparkles } from 'lucide-react';
import './OnboardingLayout.css';

export function OnboardingLayout() {
  const {
    currentStage,
    currentStepIndex,
    totalStages,
    nextStep,
    prevStep,
    skipStep,
    isSubmitting,
    submitError
  } = useOnboarding();

  const progressPercent = Math.round(((currentStepIndex + 1) / totalStages) * 100);

  // Keyboard shortcut navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is inside a textarea or adding custom tag
      if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text' && e.key === 'Enter')) {
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="pf-onboarding-shell">
      {/* Top Onboarding Header */}
      <header className="pf-onboarding-header">
        <div className="container pf-onboarding-header__inner">
          <Link to="/" className="pf-brand" aria-label="Exit onboarding to Home">
            <div className="pf-brand__logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <span className="pf-brand__name">Pathfolio<span className="pf-brand__sub">App</span></span>
          </Link>

          <div className="pf-onboarding-progress-meta">
            <span className="pf-onboarding-step-counter">
              Step {currentStepIndex + 1} of {totalStages}
            </span>
            <div className="pf-onboarding-bar-track">
              <div
                className="pf-onboarding-bar-fill"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Onboarding Stage Arena */}
      <main className="pf-onboarding-main">
        <div className="container-narrow pf-onboarding-content-container">
          {submitError && (
            <div className="pf-onboarding-alert-error animate-fade-in" role="alert">
              <strong>Registration issue:</strong> {submitError}
            </div>
          )}

          <div className="pf-onboarding-card-frame">
            <StageRenderer />

            <StepNavigation
              onNext={nextStep}
              onPrev={prevStep}
              onSkip={skipStep}
              isSkippable={currentStage.isSkippable}
              isSubmitting={isSubmitting}
              nextLabel={
                currentStage.id === 'welcome'
                  ? "Let's begin"
                  : currentStage.id === 'review'
                  ? 'Complete onboarding'
                  : 'Continue'
              }
              prevLabel={currentStepIndex === 0 ? 'Exit' : 'Back'}
              skipLabel={currentStage.id === 'familyContext' ? 'Skip this section' : 'Skip for now'}
              isFinalStep={currentStage.id === 'review'}
            />
          </div>
        </div>
      </main>

      {/* Bottom Subtle Trust Note */}
      <footer className="pf-onboarding-footer">
        <div className="container-narrow pf-onboarding-footer__inner">
          <div className="pf-onboarding-trust-badge">
            <Shield size={14} />
            <span>Admitted Student Onboarding • End-to-End Consent Protected</span>
          </div>
        </div>
      </footer>
      <Footer compact />
    </div>
  );
}
