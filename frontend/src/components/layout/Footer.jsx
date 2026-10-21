import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import './Footer.css';

export function Footer({ compact = false, minimal = false } = {}) {
  const navigate = useNavigate();
  const { student, loading } = useAuth();

  const onboardingComplete = student?.onboarding?.completed;
  const studentDestination = student ? (onboardingComplete ? '/dashboard' : '/onboarding') : '/signin';
  const studentLabel = student ? (onboardingComplete ? 'Go to dashboard' : 'Continue onboarding') : 'Student sign in';

  if (minimal) {
    return (
      <footer className="pf-footer pf-footer--minimal">
        <div className="container pf-footer__minimal-inner">
          <p>© {new Date().getFullYear()} PathfolioApp. All rights reserved.</p>
          <nav className="pf-footer__legal-links" aria-label="Legal information">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </footer>
    );
  }

  const portals = [
    { label: 'Student portal', action: () => navigate(studentDestination) },
    { label: 'Recruiter portal', action: () => navigate(student?.isRecruiter || student?.isAdmin ? '/recruiter' : '/signin?portal=recruiter') },
    { label: 'Admin portal', action: () => navigate(student?.isAdmin ? '/admin' : '/signin?portal=admin') }
  ];

  return (
    <footer className={`pf-footer${compact ? ' pf-footer--compact' : ''}`}>
      <div className="container pf-footer__inner">
        <div className="pf-footer__brand">
          <Link to="/" className="pf-footer__logo" aria-label="PathfolioApp home">
            <span className="pf-footer__mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
                <path d="m14 14 2 2 4-4" />
              </svg>
            </span>
            <span className="pf-footer__name">Pathfolio<span>App</span></span>
          </Link>
          <p className="pf-footer__desc">
            A living record of your academic profile, interests, achievements, and growth, from admission through graduation.
          </p>
          <p className="pf-footer__note">Student Lifecycle &amp; Career Portal</p>
        </div>

        <nav className="pf-footer__columns" aria-label="Footer navigation">
          <div className="pf-footer__col">
            <h3 className="pf-footer__heading">Product</h3>
            <ul className="pf-footer__list">
              <li><Link to="/#how-it-works">How it works</Link></li>
              <li><Link to="/#your-journey">Your journey</Link></li>
              <li><Link to="/onboarding">Begin your journey</Link></li>
              {!loading && <li><Link to={studentDestination}>{studentLabel}</Link></li>}
            </ul>
          </div>

          <div className="pf-footer__col">
            <h3 className="pf-footer__heading">Portals</h3>
            <ul className="pf-footer__list">
              {portals.map(portal => (
                <li key={portal.label}>
                  <button type="button" className="pf-footer__btn-link" onClick={portal.action}>{portal.label}</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="pf-footer__col">
            <h3 className="pf-footer__heading">Legal</h3>
            <ul className="pf-footer__list">
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms of service</Link></li>
              <li><Link to="/cookies">Cookie policy</Link></li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="container pf-footer__bottom">
        <p>© {new Date().getFullYear()} PathfolioApp. All rights reserved.</p>
        {!loading && !student && (
          <Link to="/signin" className="pf-footer__bottom-link">
            Sign in <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </footer>
  );
}
