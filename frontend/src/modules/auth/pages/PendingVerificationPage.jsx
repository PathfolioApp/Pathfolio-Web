import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, RotateCcw, ArrowRight } from 'lucide-react';
import { onboardingApi } from '../onboarding/services/onboardingApi';
import { Footer } from '../../../components/layout/Footer';
import './CompletionPage.css';

/**
 * Shown when STRICT_EMAIL_VERIFICATION is enabled and a registration was held
 * pending email confirmation. When the emailed link is opened, this page
 * consumes the token and signs the student in.
 */
export function PendingVerificationPage() {
  const email = (() => {
    try { return sessionStorage.getItem('pathfolio_verification_email') || ''; } catch { return ''; }
  })();
  const [state, setState] = useState({ status: 'waiting', message: '' });

  const consume = async token => {
    if (!token) return;
    setState({ status: 'verifying', message: '' });
    try {
      const result = await onboardingApi.verifyEmail(token);
      if (result.success && result.student) {
        sessionStorage.removeItem('pathfolio_verification_email');
        sessionStorage.setItem('pathfolio_completed_student', JSON.stringify(result.student));
        window.location.href = '/onboarding/complete';
        return;
      }
      setState({ status: result.expired ? 'expired' : 'error', message: result.message });
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  };

  // Token can arrive via ?token=... from the verification email.
  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) consume(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pf-completion-page">
      <header className="pf-completion-header">
        <div className="container pf-completion-header__inner">
          <Link to="/" className="pf-brand">
            <div className="pf-brand__logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <span className="pf-brand__name">Pathfolio<span className="pf-brand__sub">App</span></span>
          </Link>
        </div>
      </header>

      <main className="container-narrow pf-completion-main animate-fade-in">
        <div className="pf-completion-card" style={{ textAlign: 'center' }}>
          <div className="pf-completion-badge-wrap">
            <div className="pf-completion-check-bubble" style={{ background: '#eef4ea', color: 'var(--color-primary)' }}>
              <MailCheck size={30} />
            </div>
          </div>

          <span className="editorial-eyebrow">One more step</span>
          <h1 className="pf-completion-title">Check your email.</h1>
          {state.status === 'verifying' ? (
            <p className="pf-completion-sub">Verifying your email…</p>
          ) : state.status === 'expired' ? (
            <>
              <p className="pf-completion-sub">{state.message}</p>
              <Link to="/onboarding" className="pf-recruiter-invite__signin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={14} /> Start registration again
              </Link>
            </>
          ) : state.status === 'error' ? (
            <>
              <p className="pf-completion-sub" style={{ color: 'var(--color-error)' }}>{state.message}</p>
              <Link to="/onboarding" className="pf-recruiter-invite__signin">Back to onboarding</Link>
            </>
          ) : (
            <p className="pf-completion-sub">
              We sent a verification link{email ? <> to <b>{email}</b></> : ''}. Open it to finish creating your account, the link is time-limited and can be used once.
            </p>
          )}

          <div className="pf-completion-actions" style={{ justifyContent: 'center' }}>
            <Link to="/signin" className="pf-completion-return-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Go to sign-in <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>
      <Footer compact />
    </div>
  );
}
