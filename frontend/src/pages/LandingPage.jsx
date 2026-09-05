import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import {
  Sparkles,
  ArrowRight,
  Compass,
  GraduationCap,
  Award,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  Flame,
  Lightbulb,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import './LandingPage.css';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="pf-landing">
      <Header />

      <main>
        {/* HERO SECTION */}
        <section className="pf-hero">
          <div className="container pf-hero__inner">
            <div className="pf-hero__content animate-fade-in">
              <span className="editorial-eyebrow">Your college journey, documented.</span>
              <h1 className="pf-hero__headline">
                Build a record of who you're becoming.
              </h1>
              <p className="pf-hero__sub">
                PathfolioApp helps you manage the experiences, interests, and achievements that shape your college record.
              </p>

              <div className="pf-hero__actions">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/onboarding')}
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Begin your journey
                </Button>
                <a href="#how-it-works" className="pf-hero__secondary-cta">
                  See how it works
                </a>
              </div>

              <div className="pf-hero__badges">
                <div className="pf-hero-badge-item">
                  <UserCheck size={16} />
                  <span>Admitted Student Onboarding</span>
                </div>
                <div className="pf-hero-badge-item">
                  <ShieldCheck size={16} />
                  <span>Strict Data Consent</span>
                </div>
              </div>
            </div>

            {/* PRODUCT PREVIEW / VISUAL SECTION */}
            <div id="your-journey" className="pf-hero__visual-container animate-fade-in">
              <div className="pf-preview-card">
                {/* Visual Card Header */}
                <div className="pf-preview-card__top">
                  <div className="pf-preview-card__avatar">
                    <span>MC</span>
                  </div>
                  <div className="pf-preview-card__meta">
                    <h3 className="pf-preview-card__name">Maya Chen</h3>
                    <p className="pf-preview-card__enrollment">
                      Computer Science & Engineering • Class of '28
                    </p>
                  </div>
                  <Badge variant="sage" size="sm">Record Initialized</Badge>
                </div>

                {/* Floating Journey Milestone Blocks */}
                <div className="pf-preview-card__body">
                  <div className="pf-preview-section">
                    <span className="pf-preview-label">Curiosity & Ambitions</span>
                    <div className="pf-preview-tags">
                      <span className="pf-preview-tag pf-preview-tag--green">
                        <Sparkles size={12} /> Artificial Intelligence
                      </span>
                      <span className="pf-preview-tag">Human-Computer Interaction</span>
                      <span className="pf-preview-tag">Open Source</span>
                    </div>
                  </div>

                  <div className="pf-preview-section">
                    <span className="pf-preview-label">Initial Milestone</span>
                    <div className="pf-preview-milestone">
                      <div className="pf-preview-milestone__icon">
                        <Award size={16} />
                      </div>
                      <div>
                        <p className="pf-preview-milestone__title">National Science Olympiad Medalist</p>
                        <span className="pf-preview-milestone__sub">Physical Computing • 2023</span>
                      </div>
                    </div>
                  </div>

                  <div className="pf-preview-timeline-hint">
                    <div className="pf-preview-timeline-dot" />
                    <span>Year 1 Genesis • Ready to capture 4 years of growth</span>
                  </div>
                </div>
              </div>

              {/* Decorative subtle floating cards */}
              <div className="pf-floating-chip pf-floating-chip--1">
                <Compass size={14} />
                <span>Interests: Photography & Chess</span>
              </div>
              <div className="pf-floating-chip pf-floating-chip--2">
                <ShieldCheck size={14} />
                <span>Verified College Roll No.</span>
              </div>
            </div>
          </div>
        </section>

        {/* MORE THAN A REGISTRATION SECTION */}
        <section className="pf-section pf-features-section">
          <div className="container">
            <div className="pf-section-header">
              <span className="editorial-eyebrow">Purposeful Genesis</span>
              <h2 className="pf-section-title">Start with what makes you, you.</h2>
              <p className="pf-section-subtitle">
                Your interests, experiences, and ambitions deserve more than a single line on a form. PathfolioApp gives them a place to grow.
              </p>
            </div>

            <div className="pf-features-grid">
              <div className="pf-feature-card">
                <div className="pf-feature-card__icon pf-feature-card__icon--forest">
                  <Compass size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your Interests</h3>
                <p className="pf-feature-card__desc">
                  Capture the passions, creative crafts, and curiosities you explore beyond lecture halls and exams.
                </p>
              </div>

              <div className="pf-feature-card">
                <div className="pf-feature-card__icon pf-feature-card__icon--sage">
                  <Award size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your Experiences</h3>
                <p className="pf-feature-card__desc">
                  Log your early achievements, hackathons, volunteer work, and projects from day one of enrollment.
                </p>
              </div>

              <div className="pf-feature-card">
                <div className="pf-feature-card__icon pf-feature-card__icon--amber">
                  <Flame size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your Ambitions</h3>
                <p className="pf-feature-card__desc">
                  Record the areas you want to explore, from research to entrepreneurship.
                </p>
              </div>

              <div className="pf-feature-card">
                <div className="pf-feature-card__icon pf-feature-card__icon--primary">
                  <Layers size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your Living Record</h3>
                <p className="pf-feature-card__desc">
                  A verifiable timeline of who you become throughout your degree, backed by institutional alignment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="pf-section pf-how-it-works">
          <div className="container">
            <div className="pf-section-header">
              <span className="editorial-eyebrow">The Lifecycle Framework</span>
              <h2 className="pf-section-title">A three-phase evolution.</h2>
              <p className="pf-section-subtitle">
                Pathfolio begins at admission and evolves with you through graduation.
              </p>
            </div>

            <div className="pf-steps-grid">
              {/* Step 1 - ACTIVE */}
              <div className="pf-step-card pf-step-card--active">
                <div className="pf-step-card__top">
                  <span className="pf-step-num">01</span>
                  <Badge variant="sage" size="sm">Available Now</Badge>
                </div>
                <h3 className="pf-step-card__title">Begin</h3>
                <p className="pf-step-card__desc">
                  Tell us a little about yourself, your department enrollment, early milestones, and curiosities in our guided onboarding.
                </p>
                <div className="pf-step-card__status">
                  <CheckCircle2 size={16} />
                  <span>Implemented in this release</span>
                </div>
              </div>

              {/* Step 2 - FUTURE */}
              <div className="pf-step-card pf-step-card--future">
                <div className="pf-step-card__top">
                  <span className="pf-step-num">02</span>
                  <Badge variant="coming-soon" size="sm">Coming Next</Badge>
                </div>
                <h3 className="pf-step-card__title">Build</h3>
                <p className="pf-step-card__desc">
                  Capture the coursework, internships, leadership roles, and research projects that shape your journey each semester.
                </p>
                <div className="pf-step-card__status pf-step-card__status--future">
                  <span>Future module: Profile Builder & Story Mode</span>
                </div>
              </div>

              {/* Step 3 - FUTURE */}
              <div className="pf-step-card pf-step-card--future">
                <div className="pf-step-card__top">
                  <span className="pf-step-num">03</span>
                  <Badge variant="coming-soon" size="sm">Coming Next</Badge>
                </div>
                <h3 className="pf-step-card__title">Grow</h3>
                <p className="pf-step-card__desc">
                  Translate your living evidence record into career opportunities, placement portfolio exports, and verified credentials.
                </p>
                <div className="pf-step-card__status pf-step-card__status--future">
                  <span>Future module: Career Prediction & Placements</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRIVACY & TRUST SECTION */}
        <section id="privacy" className="pf-section pf-privacy-section">
          <div className="container pf-privacy__inner">
            <div className="pf-privacy-card">
              <div className="pf-privacy-card__badge">
                <ShieldCheck size={28} />
              </div>
              <h2 className="pf-privacy-card__title">Your information, your control.</h2>
              <p className="pf-privacy-card__desc">
                PathfolioApp is architected around responsible handling of student data and radical transparency.
              </p>

              <div className="pf-privacy-points">
                <div className="pf-privacy-point">
                  <div className="pf-privacy-point__check"><CheckCircle2 size={16} /></div>
                  <div>
                    <strong>Students decide what to share:</strong> Sensitive background notes are strictly optional and can be skipped with zero penalty.
                  </div>
                </div>

                <div className="pf-privacy-point">
                  <div className="pf-privacy-point__check"><CheckCircle2 size={16} /></div>
                  <div>
                    <strong>Explicit consent required:</strong> Sensitive personal and family context requires non-prechecked, section-level consent before storage.
                  </div>
                </div>

                <div className="pf-privacy-point">
                  <div className="pf-privacy-point__check"><CheckCircle2 size={16} /></div>
                  <div>
                    <strong>No unnecessary identity collection:</strong> We never request sensitive government IDs (Aadhaar/PAN), financial cards, or passwords.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION BANNER */}
        <section className="pf-final-cta">
          <div className="container pf-final-cta__inner">
            <span className="editorial-eyebrow">Ready to begin?</span>
            <h2 className="pf-final-cta__title">
              Your journey starts with a few simple questions.
            </h2>
            <p className="pf-final-cta__sub">
              Complete your student onboarding in under 10 minutes.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/onboarding')}
              icon={ArrowRight}
              iconPosition="right"
            >
              Begin your journey
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
