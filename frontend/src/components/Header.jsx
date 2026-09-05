import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import './Header.css';

export function Header() {
  const navigate = useNavigate();
  const { student, loading } = useAuth();

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="pf-header">
        <div className="container pf-header__inner">
          <Link to="/" className="pf-brand" aria-label="PathfolioApp Home">
            <div className="pf-brand__logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
                <path d="m14 14 2 2 4-4" />
              </svg>
            </div>
            <span className="pf-brand__name">Pathfolio<span className="pf-brand__sub">App</span></span>
          </Link>

          <nav className="pf-nav" aria-label="Main Navigation">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="pf-nav__link">
              How it works
            </a>
            <a href="#your-journey" onClick={(e) => scrollToSection(e, 'your-journey')} className="pf-nav__link">
              Your journey
            </a>
            <a href="#privacy" onClick={(e) => scrollToSection(e, 'privacy')} className="pf-nav__link">
              Privacy
            </a>
          </nav>

          <div className="pf-header__actions">
            {!loading && (student ? <button type="button" onClick={() => navigate(student.onboarding?.completed ? '/dashboard' : '/onboarding')} className="pf-header__signin">{student.onboarding?.completed ? `Hi, ${student.personal.fullName.split(' ')[0]}` : 'Continue onboarding'}</button> : <button type="button" onClick={() => navigate('/signin')} className="pf-header__signin">Sign in</button>)}
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(student?.onboarding?.completed ? '/dashboard' : '/onboarding')}
            >
              {student?.onboarding?.completed ? 'Go to dashboard' : 'Begin your journey'}
            </Button>
          </div>
        </div>
    </header>
  );
}
