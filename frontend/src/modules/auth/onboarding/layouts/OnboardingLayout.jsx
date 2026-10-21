import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useOnboarding } from '../context/OnboardingContext';
import { StageRenderer } from '../components/StageRenderer';
import { StepNavigation } from '../components/StepNavigation';
import { Footer } from '../../../../components/layout/Footer';
import { Shield } from 'lucide-react';
import './OnboardingLayout.css';

export function OnboardingLayout() {
  const {
    currentStage,
    formData,
    currentStepIndex,
    totalStages,
    nextStep,
    prevStep,
    skipStep,
    isSubmitting,
    submitError
  } = useOnboarding();

  const progressPercent = Math.round(((currentStepIndex + 1) / totalStages) * 100);

  const stageFrameRef = useRef(null);
  const milestoneManagerRef = useRef(null);
  const isFinalStep = currentStepIndex === totalStages - 1;
  const isMilestoneStep = currentStage.id === 'achievements';
  const hasMilestones = formData.achievements.length > 0;
  const navigateFromStep = (action) => {
    if (isMilestoneStep && milestoneManagerRef.current) {
      milestoneManagerRef.current.requestNavigation(action);
    } else {
      action();
    }
  };

  // Keep the start of the new step in view after leaving a longer form.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (!stageFrameRef.current?.contains(document.activeElement)) {
        stageFrameRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [currentStage.id]);

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
                aria-label="Onboarding progress"
                aria-valuetext={`Step ${currentStepIndex + 1} of ${totalStages}: ${currentStage.title}`}
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

          <div className="pf-onboarding-card-frame" ref={stageFrameRef} tabIndex={-1} role="region" aria-label={currentStage.title}>
            <StageRenderer milestoneManagerRef={milestoneManagerRef} />

            <StepNavigation
              onNext={() => navigateFromStep(nextStep)}
              onPrev={() => navigateFromStep(prevStep)}
              onSkip={() => navigateFromStep(skipStep)}
              isSkippable={isMilestoneStep ? !hasMilestones : currentStage.isSkippable}
              showNext={!isMilestoneStep || hasMilestones}
              isSubmitting={isSubmitting}
              nextLabel={
                currentStage.id === 'welcome'
                  ? "Let's begin"
                  : isFinalStep
                  ? 'Complete onboarding'
                  : 'Continue'
              }
              prevLabel={currentStepIndex === 0 ? 'Exit' : 'Back'}
              skipLabel={currentStage.id === 'familyContext' ? 'Skip this section' : 'Skip for now'}
              isFinalStep={isFinalStep}
            />
          </div>
        </div>
      </main>

      {/* Bottom Subtle Trust Note */}
      <footer className="pf-onboarding-footer">
        <div className="container-narrow pf-onboarding-footer__inner">
          <div className="pf-onboarding-trust-badge">
            <Shield size={14} />
            <span>Your college story, built one step at a time.</span>
          </div>
        </div>
      </footer>
      <Footer minimal />
    </div>
  );
}
