import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import './Footer.css';

export function Footer() {
  const [activeModal, setActiveModal] = useState(null);

  return (
    <>
      <footer className="pf-footer">
        <div className="container pf-footer__inner">
          <div className="pf-footer__brand">
            <div className="pf-footer__logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
              <span>PathfolioApp</span>
            </div>
            <p className="pf-footer__desc">
              Every student leaves college not just with a degree, but with a living record of who they became — and a clear, evidence-based view of where that record can take them next.
            </p>
          </div>

          <div className="pf-footer__links-col">
            <h4 className="pf-footer__heading">Platform</h4>
            <ul className="pf-footer__list">
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#your-journey">Your journey preview</a></li>
              <li><a href="#privacy">Privacy principles</a></li>
            </ul>
          </div>

          <div className="pf-footer__links-col">
            <h4 className="pf-footer__heading">Governance</h4>
            <ul className="pf-footer__list">
              <li>
                <button type="button" onClick={() => setActiveModal('privacy')} className="pf-footer__btn-link">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActiveModal('terms')} className="pf-footer__btn-link">
                  Terms of Service
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActiveModal('contact')} className="pf-footer__btn-link">
                  Contact Support
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="container pf-footer__bottom">
          <p>© {new Date().getFullYear()} PathfolioApp. Student Lifecycle & Career Portal. All rights reserved.</p>
          <p className="pf-footer__disclaimer">Current Release: Admission Onboarding & Record Genesis.</p>
        </div>
      </footer>

      {/* Governance Modals */}
      <Modal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        title="Privacy & Data Governance Policy"
        footer={<Button variant="primary" size="sm" onClick={() => setActiveModal(null)}>Close</Button>}
      >
        <p style={{ marginBottom: '12px' }}>
          PathfolioApp adheres strictly to user consent requirements. Sensitive family details, background context, and achievements require explicit, section-level consent.
        </p>
        <p style={{ marginBottom: '12px' }}>
          We do not sell student data, nor do we collect unnecessary sensitive identity credentials such as bank details, government ID numbers, or passwords during onboarding.
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Students retain complete sovereignty over their data and can skip optional sections at any point.
        </p>
      </Modal>

      <Modal
        isOpen={activeModal === 'terms'}
        onClose={() => setActiveModal(null)}
        title="Terms of Service"
        footer={<Button variant="primary" size="sm" onClick={() => setActiveModal(null)}>Close</Button>}
      >
        <p style={{ marginBottom: '12px' }}>
          PathfolioApp is provided for student growth tracking, institutional enrollment verification, and verified achievement documentation.
        </p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          By creating an onboarding profile, you acknowledge that your institutional roll number and academic department will be linked with your authorized college identity.
        </p>
      </Modal>

      <Modal
        isOpen={activeModal === 'contact'}
        onClose={() => setActiveModal(null)}
        title="Contact Academic Support"
        footer={<Button variant="primary" size="sm" onClick={() => setActiveModal(null)}>Close</Button>}
      >
        <p style={{ marginBottom: '12px' }}>
          Have questions regarding your institutional roll number verification or onboarding process?
        </p>
        <p style={{ fontWeight: 500, color: 'var(--color-primary)' }}>
          support@pathfolioapp.internal
        </p>
      </Modal>
    </>
  );
}
