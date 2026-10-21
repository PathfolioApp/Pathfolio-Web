import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, BriefcaseBusiness, ArrowRight, Mail, ShieldCheck, Lock } from 'lucide-react';
import { Footer } from '../../../components/layout/Footer';
import { OnboardingProvider } from '../onboarding/context/OnboardingContext';
import { OnboardingLayout } from '../onboarding/layouts/OnboardingLayout';
import './OnboardingEntryPage.css';

/**
 * Onboarding entry: a clear choice between the two join paths.
 * Selecting the student path hands over to the existing guided journey;
 * recruiter onboarding is invite-only and shows an informational state
 * instead of starting a registration form.
 */
export function OnboardingPage() {
  // null = entry selection screen; 'student' = hand over to the guided journey.
  const [choice, setChoice] = useState(null);

  if (choice === 'student') {
    return (
      <OnboardingProvider>
        <OnboardingLayout />
      </OnboardingProvider>
    );
  }

  return (
    <div className="pf-onboarding-entry">
      <header className="pf-onboarding-entry__header">
        <Link to="/" className="pf-brand" aria-label="PathfolioApp home">
          <div className="pf-brand__logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
          </div>
          <span className="pf-brand__name">Pathfolio<span className="pf-brand__sub">App</span></span>
        </Link>
        <Link to="/signin" className="pf-onboarding-entry__signin"><span className="pf-onboarding-entry__signin-hint">Already registered?</span><span>Sign in</span></Link>
      </header>

      <main className="pf-onboarding-entry__main">
        {choice === null && (
          <section className="pf-onboarding-choice animate-fade-in" aria-label="Choose how to join Pathfolio">
            <span className="editorial-eyebrow">Join Pathfolio</span>
            <h1>How would you like to join?</h1>
            <p className="pf-onboarding-choice__sub">
              Your next chapter starts here. Choose the path that fits you.
            </p>

            <div className="pf-onboarding-choice__cards">
              <button
                type="button"
                className="pf-onboarding-choice-card"
                onClick={() => setChoice('student')}
              >
                <div className="pf-onboarding-choice-card__icon pf-onboarding-choice-card__icon--student">
                  <GraduationCap size={26} />
                </div>
                <h2>I’m a student</h2>
                <p>Bring your interests, achievements, and college experiences together in one living record.</p>
                <span className="pf-onboarding-choice-card__cta">Begin onboarding <ArrowRight size={15} /></span>
              </button>

              <button
                type="button"
                className="pf-onboarding-choice-card pf-onboarding-choice-card--recruiter"
                onClick={() => setChoice('recruiter')}
              >
                <div className="pf-onboarding-choice-card__icon pf-onboarding-choice-card__icon--recruiter">
                  <BriefcaseBusiness size={26} />
                </div>
                <h2>I’m a recruiter</h2>
                <p>Connect with student talent through your institution’s placement team.</p>
                <span className="pf-onboarding-choice-card__cta">Explore recruiter access <ArrowRight size={15} /></span>
              </button>
            </div>
          </section>
        )}

        {choice === 'recruiter' && (
          <section className="pf-recruiter-invite animate-fade-in" aria-label="Recruiter onboarding is invite-only">
            <div className="pf-recruiter-invite__card">
              <div className="pf-recruiter-invite__badge"><Lock size={22} /></div>
              <span className="editorial-eyebrow">Recruiter access • By invitation</span>
              <h1>Great connections start here.</h1>
              <p className="pf-recruiter-invite__desc">
                Recruiter onboarding is currently invite-only. Please contact
                <a href="mailto:placement@kiit.ac.in"><b> placement@kiit.ac.in</b></a> to get onboarded.
              </p>
              <div className="pf-recruiter-invite__points">
                <div className="pf-recruiter-invite__point">
                  <ShieldCheck size={16} />
                  <span>Accounts are provisioned by the Training &amp; Placement cell after verification.</span>
                </div>
                <div className="pf-recruiter-invite__point">
                  <Mail size={16} />
                  <span>Already invited? Sign in through the recruiter portal with the credentials you received.</span>
                </div>
              </div>
              <div className="pf-recruiter-invite__actions">
                <button type="button" className="pf-recruiter-invite__back" onClick={() => setChoice(null)}>
                  Back to onboarding options
                </button>
                <Link to="/signin?portal=recruiter" className="pf-recruiter-invite__signin">
                  Recruiter sign-in
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer minimal />
    </div>
  );
}
