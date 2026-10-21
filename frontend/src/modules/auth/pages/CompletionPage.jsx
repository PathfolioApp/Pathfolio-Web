import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Footer } from '../../../components/layout/Footer';
import {
  CheckCircle,
  Sparkles,
  Award,
  ArrowRight,
  Compass
} from 'lucide-react';
import './CompletionPage.css';

export function CompletionPage() {
  const navigate = useNavigate();
  const [showNextModal, setShowNextModal] = useState(false);
  const [student, setStudent] = useState(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pathfolio_completed_student');
      if (saved) {
        setStudent(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not read completed student record', e);
    }
  }, []);

  const name = student?.personal?.fullName || 'Student';
  const department = student?.academic?.department || 'Academic Department';
  const batchYear = student?.academic?.batchYear || 'Batch not provided';
  const rollNumber = student?.academic?.rollNumber || 'Scholar';
  const hobbiesCount = student?.interests?.hobbies?.length || 0;
  const passionsCount = student?.interests?.passions?.length || 0;
  const achievementsCount = student?.achievements?.length || 0;

  return (
    <div className="pf-completion-page">
      {/* Minimal Header */}
      <header className="pf-completion-header">
        <div className="container pf-completion-header__inner">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container-narrow pf-completion-main animate-fade-in">
        <div className="pf-completion-card">
          <div className="pf-completion-badge-wrap">
            <div className="pf-completion-check-bubble">
              <CheckCircle size={32} />
            </div>
          </div>

          <span className="editorial-eyebrow">Onboarding complete</span>
          <h1 className="pf-completion-title">Your journey has begun.</h1>
          <p className="pf-completion-sub">
            Your profile is ready. Keep adding interests, experiences, and milestones as your college journey unfolds.
          </p>

          {/* Student profile summary */}
          <div className="pf-completion-profile-card">
            <div className="pf-completion-profile-top">
              <div className="pf-completion-avatar">
                <span>{name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="pf-completion-meta">
                <h2 className="pf-completion-name">{name}</h2>
                <p className="pf-completion-dept">
                  {department}
                </p>
                <p className="pf-completion-batch">{batchYear}</p>
                <span className="pf-completion-handle">Roll No. {rollNumber}</span>
              </div>
              <Badge variant="sage" size="md">Profile created</Badge>
            </div>

            <div className="pf-completion-stats-grid">
              <div className="pf-completion-stat-box">
                <Compass size={18} className="pf-completion-stat-icon" />
                <div className="pf-completion-stat-info">
                  <span className="pf-completion-stat-num">{hobbiesCount}</span>
                  <span className="pf-completion-stat-label">Hobbies</span>
                </div>
              </div>

              <div className="pf-completion-stat-box">
                <Sparkles size={18} className="pf-completion-stat-icon pf-completion-stat-icon--gold" />
                <div className="pf-completion-stat-info">
                  <span className="pf-completion-stat-num">{passionsCount}</span>
                  <span className="pf-completion-stat-label">Interests</span>
                </div>
              </div>

              <div className="pf-completion-stat-box">
                <Award size={18} className="pf-completion-stat-icon" />
                <div className="pf-completion-stat-info">
                  <span className="pf-completion-stat-num">{achievementsCount}</span>
                  <span className="pf-completion-stat-label">Milestones</span>
                </div>
              </div>
            </div>

            <p className="pf-completion-start-note">Your starting point. Keep building your story from here.</p>
          </div>

          {/* Call to action controls */}
          <div className="pf-completion-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/dashboard')}
              icon={ArrowRight}
              iconPosition="right"
            >
              Continue to dashboard
            </Button>
            
            <button
              type="button"
              onClick={() => setShowNextModal(true)}
              className="pf-completion-next-btn"
            >
              Explore your next steps
            </button>

          </div>
        </div>
      </main>

      {/* Next steps after onboarding */}
      <Modal
        isOpen={showNextModal}
        onClose={() => setShowNextModal(false)}
        title="Your next steps"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShowNextModal(false)}>
            Back to overview
          </Button>
        }
      >
        <div className="pf-coming-next-modal-content">
          <Badge variant="sage">Keep building your profile</Badge>
          <p style={{ marginTop: '12px', marginBottom: '14px', fontSize: '0.9375rem' }}>
            Your profile is ready. Here are a few ways to keep building your college story:
          </p>

          <ul className="pf-coming-next-list">
            <li>
              <strong>Profile &amp; resumes:</strong> Add your projects, achievements, and experience, then build your resume.
            </li>
            <li>
              <strong>Story Mode:</strong> Explore the interests, experiences, and milestones that shape your journey.
            </li>
            <li>
              <strong>Your living record:</strong> Keep your profile up to date as you learn and take on new experiences.
            </li>
            <li>
              <strong>Placement opportunities:</strong> Explore opportunities shared by your placement team.
            </li>
          </ul>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '14px' }}>
            You can return to your profile and add more whenever you are ready.
          </p>
        </div>
      </Modal>
      <Footer minimal />
    </div>
  );
}
