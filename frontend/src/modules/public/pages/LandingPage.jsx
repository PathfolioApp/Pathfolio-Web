import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../../../components/layout/Header';
import { Footer } from '../../../components/layout/Footer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
  Sparkles,
  ArrowRight,
  Compass,
  Award,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Flame,
  UserCheck,
  BriefcaseBusiness,
  Users,
  FileSearch,
  Building2
} from 'lucide-react';
import './LandingPage.css';

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Honour deep links such as /#how-it-works from the header, footer, or portal pages.
  useEffect(() => {
    if (!location.hash) return undefined;
    const id = location.hash.slice(1);
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(timer);
  }, [location.hash]);

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
                Your potential. <span>A story worth building.</span>
              </h1>
              <p className="pf-hero__sub">
                Bring your interests, projects, and achievements together in a living portfolio. Start at admission. Grow with every semester.
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
                  <span>Made for your college journey</span>
                </div>
                <div className="pf-hero-badge-item">
                  <ShieldCheck size={16} />
                  <span>Privacy by choice</span>
                </div>
              </div>
            </div>

            {/* PRODUCT PREVIEW / VISUAL SECTION */}
            <div id="your-journey" className="pf-hero__visual-container animate-fade-in delay-200">
              <div className="pf-preview-card">
                <div className="pf-preview-card__toolbar">
                  <span><span className="pf-preview-live-dot" /> Your living record</span>
                  <span>Example profile</span>
                </div>
                {/* Visual Card Header */}
                <div className="pf-preview-card__top">
                  <div className="pf-preview-card__avatar">
                    <img src="/images/ananya-sharma.jpg" alt="Portrait of Ananya Sharma, a fictional student" width="56" height="56" decoding="async" />
                  </div>
                  <div className="pf-preview-card__meta">
                    <h3 className="pf-preview-card__name">Ananya Sharma</h3>
                    <p className="pf-preview-card__enrollment">
                      Computer Science • Class of 2028
                    </p>
                  </div>
                  <Badge variant="sage" size="sm">Journey started</Badge>
                </div>

                {/* Example interests and milestone */}
                <div className="pf-preview-card__body">
                  <div className="pf-preview-section">
                    <span className="pf-preview-label">Interests & ambitions</span>
                    <div className="pf-preview-tags">
                      <span className="pf-preview-tag pf-preview-tag--green">
                        <Sparkles size={12} /> Artificial Intelligence
                      </span>
                      <span className="pf-preview-tag">Human-Computer Interaction</span>
                      <span className="pf-preview-tag">Open Source</span>
                    </div>
                  </div>

                  <div className="pf-preview-section">
                    <span className="pf-preview-label">A milestone to remember</span>
                    <div className="pf-preview-milestone">
                      <div className="pf-preview-milestone__icon">
                        <Award size={16} />
                      </div>
                      <div>
                        <p className="pf-preview-milestone__title">Inter-college hackathon finalist</p>
                        <span className="pf-preview-milestone__sub">Smart campus project • 2026</span>
                      </div>
                    </div>
                  </div>

                  <div className="pf-preview-timeline-hint">
                    <div className="pf-preview-timeline-dot" />
                    <span>Year 1 • Your next chapter is taking shape</span>
                  </div>
                </div>
              </div>

              <p className="pf-preview-caption">A little curiosity. A new experience. A story that keeps growing.</p>
            </div>
          </div>
        </section>

        {/* MORE THAN A REGISTRATION SECTION */}
        <section className="pf-section pf-features-section">
          <div className="container">
            <div className="pf-section-header">
              <span className="editorial-eyebrow">More than a resume</span>
              <h2 className="pf-section-title">Start with what makes you, you.</h2>
              <p className="pf-section-subtitle">
                Your interests, experiences, and ambitions deserve more than a single line on a form. PathfolioApp gives them a place to grow.
              </p>
            </div>

            <div className="pf-features-grid">
              <div className="pf-feature-card animate-fade-in delay-100">
                <div className="pf-feature-card__icon pf-feature-card__icon--forest">
                  <Compass size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your interests</h3>
                <p className="pf-feature-card__desc">
                  Capture the passions, creative crafts, and curiosities you explore beyond lecture halls and exams.
                </p>
              </div>

              <div className="pf-feature-card animate-fade-in delay-200">
                <div className="pf-feature-card__icon pf-feature-card__icon--sage">
                  <Award size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your experiences</h3>
                <p className="pf-feature-card__desc">
                  Log your early achievements, hackathons, volunteer work, and projects from day one of enrollment.
                </p>
              </div>

              <div className="pf-feature-card animate-fade-in delay-300">
                <div className="pf-feature-card__icon pf-feature-card__icon--amber">
                  <Flame size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your ambitions</h3>
                <p className="pf-feature-card__desc">
                  Record the areas you want to explore, from research to entrepreneurship.
                </p>
              </div>

              <div className="pf-feature-card animate-fade-in delay-400">
                <div className="pf-feature-card__icon pf-feature-card__icon--primary">
                  <Layers size={22} />
                </div>
                <h3 className="pf-feature-card__title">Your living record</h3>
                <p className="pf-feature-card__desc">
                  Connect the dots between what you learn, what you do, and where you want to go.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="pf-section pf-how-it-works">
          <div className="container">
            <div className="pf-section-header">
              <span className="editorial-eyebrow">How it works</span>
              <h2 className="pf-section-title">Start small. Keep growing.</h2>
              <p className="pf-section-subtitle">
                Pathfolio begins at admission and evolves with you through graduation.
              </p>
            </div>

            <div className="pf-steps-grid">
              {/* Step 1 - ACTIVE */}
              <div className="pf-step-card pf-step-card--active animate-fade-in delay-100">
                <div className="pf-step-card__top">
                  <span className="pf-step-num">01</span>
                  <Badge variant="sage" size="sm">Available Now</Badge>
                </div>
                <h3 className="pf-step-card__title">Begin</h3>
                <p className="pf-step-card__desc">
                  Set up your student profile with a few details about your course, interests, and early achievements.
                </p>
                <div className="pf-step-card__status">
                  <CheckCircle2 size={16} />
                  <span>Guided student onboarding</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="pf-step-card pf-step-card--active animate-fade-in delay-200">
                <div className="pf-step-card__top">
                  <span className="pf-step-num">02</span>
                  <Badge variant="sage" size="sm">Available Now</Badge>
                </div>
                <h3 className="pf-step-card__title">Build</h3>
                <p className="pf-step-card__desc">
                  Add projects, internships, achievements, and experiences. See your college journey come together in Story Mode.
                </p>
                <div className="pf-step-card__status">
                  <span>Profile builder & Story Mode</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="pf-step-card pf-step-card--active animate-fade-in delay-300">
                <div className="pf-step-card__top">
                  <span className="pf-step-num">03</span>
                  <Badge variant="sage" size="sm">Available Now</Badge>
                </div>
                <h3 className="pf-step-card__title">Grow</h3>
                <p className="pf-step-card__desc">
                  Build your resume and explore opportunities shared by your placement team, with your experiences ready to show.
                </p>
                <div className="pf-step-card__status">
                  <span>Resumes & placement opportunities</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOR RECRUITERS & PLACEMENT TEAMS */}
        <section className="pf-section pf-recruiter-section">
          <div className="container">
            <div className="pf-section-header">
              <span className="editorial-eyebrow">For recruiters & placement teams</span>
              <h2 className="pf-section-title">See the person behind the profile.</h2>
              <p className="pf-section-subtitle">
                Share opportunities. Receive relevant referrals. Discover student potential through records curated by the placement team.
              </p>
            </div>

            <div className="pf-recruiter-grid">
              <div className="pf-recruiter-feature animate-fade-in delay-100">
                <div className="pf-recruiter-feature__icon"><BriefcaseBusiness size={20} /></div>
                <h3>Post opportunities</h3>
                <p>Submit roles with salary, work mode, and eligibility criteria. The placement team reviews and publishes them to matched students.</p>
              </div>
              <div className="pf-recruiter-feature animate-fade-in delay-200">
                <div className="pf-recruiter-feature__icon"><Users size={20} /></div>
                <h3>Receive curated candidates</h3>
                <p>Receive student profiles matched and shared by the placement team, with the context you need to review them.</p>
              </div>
              <div className="pf-recruiter-feature animate-fade-in delay-300">
                <div className="pf-recruiter-feature__icon"><FileSearch size={20} /></div>
                <h3>Review living records</h3>
                <p>Explore the projects, interests, achievements, and experience behind each candidate’s resume.</p>
              </div>
              <div className="pf-recruiter-feature animate-fade-in delay-400">
                <div className="pf-recruiter-feature__icon"><Building2 size={20} /></div>
                <h3>Track your pipeline</h3>
                <p>Review applications to your published roles, share feedback on referrals, and keep the placement team in sync.</p>
              </div>
            </div>

            <div className="pf-recruiter-cta">
              <Button variant="primary" size="md" icon={ArrowRight} iconPosition="right" onClick={() => navigate('/signin?portal=recruiter')}>
                Enter the recruiter portal
              </Button>
              <span>For company recruiters and institutional placement teams.</span>
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
                Your story belongs to you. Clear choices help you decide what to include.
              </p>

              <div className="pf-privacy-points">
                <div className="pf-privacy-point">
                  <div className="pf-privacy-point__check"><CheckCircle2 size={16} /></div>
                  <div>
                    <strong>Students decide what to share:</strong> Personal background details are optional. Share only what you feel comfortable including.
                  </div>
                </div>

                <div className="pf-privacy-point">
                  <div className="pf-privacy-point__check"><CheckCircle2 size={16} /></div>
                  <div>
                    <strong>Explicit consent required:</strong> Choose whether to include sensitive personal and family details before they are saved.
                  </div>
                </div>

                <div className="pf-privacy-point">
                  <div className="pf-privacy-point__check"><CheckCircle2 size={16} /></div>
                  <div>
                    <strong>No unnecessary identity collection:</strong> Your profile does not need Aadhaar, PAN, or financial card details.
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
              Make room for who you’re becoming.
            </h2>
            <p className="pf-final-cta__sub">
              Start with what you know about yourself. Build the rest as you go.
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
