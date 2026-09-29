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
  BookOpen,
  ArrowRight,
  Compass,
  Layers,
  GraduationCap,
  Calendar,
  RotateCcw
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
  const batchYear = student?.academic?.batchYear || 'Class Cohort';
  const rollNumber = student?.academic?.rollNumber || 'Scholar';
  const hobbiesCount = student?.interests?.hobbies?.length || 0;
  const passionsCount = student?.interests?.passions?.length || 0;
  const achievementsCount = student?.achievements?.length || 0;

  return (
    <div className="pf-completion-page">
      {/* Minimal Header */}
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

      {/* Main Content */}
      <main className="container-narrow pf-completion-main animate-fade-in">
        <div className="pf-completion-card">
          <div className="pf-completion-badge-wrap">
            <div className="pf-completion-check-bubble">
              <CheckCircle size={32} />
            </div>
          </div>

          <span className="editorial-eyebrow">Genesis Stage Complete</span>
          <h1 className="pf-completion-title">Your journey has begun.</h1>
          <p className="pf-completion-sub">
            You've taken the first step toward building a record of your college journey. Your initial identity, curiosities, and milestones are officially recorded.
          </p>

          {/* Student Genesis Summary Card */}
          <div className="pf-completion-profile-card">
            <div className="pf-completion-profile-top">
              <div className="pf-completion-avatar">
                <span>{name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="pf-completion-meta">
                <h3 className="pf-completion-name">{name}</h3>
                <p className="pf-completion-dept">
                  {department} • {batchYear}
                </p>
                <span className="pf-completion-handle">Roll No. {rollNumber}</span>
              </div>
              <Badge variant="sage" size="md">Admitted & Initialized</Badge>
            </div>

            <div className="pf-completion-stats-grid">
              <div className="pf-completion-stat-box">
                <Compass size={18} className="pf-completion-stat-icon" />
                <div className="pf-completion-stat-info">
                  <span className="pf-completion-stat-num">{hobbiesCount}</span>
                  <span className="pf-completion-stat-label">Hobbies Logged</span>
                </div>
              </div>

              <div className="pf-completion-stat-box">
                <Sparkles size={18} className="pf-completion-stat-icon pf-completion-stat-icon--gold" />
                <div className="pf-completion-stat-info">
                  <span className="pf-completion-stat-num">{passionsCount}</span>
                  <span className="pf-completion-stat-label">Passions & Tracks</span>
                </div>
              </div>

              <div className="pf-completion-stat-box">
                <Award size={18} className="pf-completion-stat-icon" />
                <div className="pf-completion-stat-info">
                  <span className="pf-completion-stat-num">{achievementsCount}</span>
                  <span className="pf-completion-stat-label">Initial Milestones</span>
                </div>
              </div>
            </div>

            <div className="pf-completion-growth-bar">
              <div className="pf-completion-growth-info">
                <span>Four-Year Lifecycle Track</span>
                <strong>Genesis Complete (Year 1, Term 1)</strong>
              </div>
              <div className="pf-completion-growth-track">
                <div className="pf-completion-growth-fill" />
              </div>
            </div>
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
              <Layers size={16} /> Preview what's next
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="pf-completion-return-btn"
            >
              Return to Landing Page
            </button>
          </div>
        </div>
      </main>

      {/* "Coming Next" Preview Modal strictly demarcating post-onboarding modules */}
      <Modal
        isOpen={showNextModal}
        onClose={() => setShowNextModal(false)}
        title="PathfolioApp future modules"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShowNextModal(false)}>
            Back to Overview
          </Button>
        }
      >
        <div className="pf-coming-next-modal-content">
          <Badge variant="coming-soon">Upcoming in Future Releases</Badge>
          <p style={{ marginTop: '12px', marginBottom: '14px', fontSize: '0.9375rem' }}>
            Congratulations! The <strong>Admitted Student Onboarding Experience</strong> is complete. The following post-onboarding modules will unlock in subsequent releases:
          </p>

          <ul className="pf-coming-next-list">
            <li>
              <strong>Profile Builder:</strong> Dynamic resume generation and skill taxonomy mapping.
            </li>
            <li>
              <strong>Story Mode:</strong> Narrative-driven semester reflections and faculty mentorship notes.
            </li>
            <li>
              <strong>Living Timeline:</strong> Chronological visual evidence of projects, papers, and clubs.
            </li>
            <li>
              <strong>Career Prediction & Placement Portal:</strong> Evidence-based career pathway recommendations.
            </li>
          </ul>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '14px' }}>
            Your onboarding record has been saved and is ready to seed these modules upon release.
          </p>
        </div>
      </Modal>
      <Footer compact />
    </div>
  );
}
