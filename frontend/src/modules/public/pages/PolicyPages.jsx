import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Header } from '../../../components/layout/Header';
import { Footer } from '../../../components/layout/Footer';
import './PolicyPages.css';

const policyContent = {
  privacy: {
    eyebrow: 'Your information',
    title: 'Privacy policy',
    intro: 'PathfolioApp helps you keep a clear record of your academic journey. This policy explains the information we collect, why we use it, and the choices you have.',
    sections: [
      ['What we collect', 'We collect the profile, academic, interest, achievement, and account information you choose to provide. We also process session and notification information needed to keep the service secure and useful.'],
      ['How we use it', 'We use your information to provide onboarding, profile, story, placement, notification, and account features. We do not use optional personal context beyond the consent you provide.'],
      ['Your choices', 'You can update your profile, manage sharing controls, and request changes to your information through the application. Contact the PathfolioApp team if you need help accessing or deleting your record.']
    ]
  },
  terms: {
    eyebrow: 'Using PathfolioApp',
    title: 'Terms of service',
    intro: 'By using PathfolioApp, you agree to use the service responsibly and provide information that you are authorized to share.',
    sections: [
      ['Your account', 'Keep your credentials private and tell us promptly if you believe your account has been accessed without permission. You are responsible for activity carried out through your account.'],
      ['Your content', 'You retain responsibility for the accuracy and appropriateness of information you add. Do not upload content that infringes another person’s rights or violates institutional rules.'],
      ['Service changes', 'PathfolioApp may evolve as new academic and career workflows are introduced. We will aim to preserve your record and communicate material changes through the service.']
    ]
  },
  cookies: {
    eyebrow: 'Responsible technology',
    title: 'Cookie and data policy',
    intro: 'PathfolioApp uses only the storage needed to operate authenticated sessions and remember the state of the application.',
    sections: [
      ['Essential session storage', 'An HTTP-only session cookie is used to keep you signed in securely. It is required for authenticated profile, dashboard, placement, and portal features.'],
      ['Local preferences', 'The application may use browser storage for interface preferences where supported. These preferences do not replace your account data or grant access to your record.'],
      ['Managing storage', 'You can clear browser storage through your browser settings. Clearing essential session storage will sign you out and may require you to authenticate again.']
    ]
  }
};

function PolicyPage({ type }) {
  const content = policyContent[type];
  return <div className="pf-policy-shell"><Header /><main className="pf-policy-page"><div className="container-narrow"><Link className="pf-policy-back" to="/"><ArrowLeft size={16} /> Back to PathfolioApp</Link><div className="pf-policy-heading"><span className="editorial-eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p></div><div className="pf-policy-notice"><ShieldCheck size={18} /><span>This product policy is a working public summary and should receive jurisdiction-specific legal review before production publication.</span></div><div className="pf-policy-sections">{content.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div><p className="pf-policy-contact">Questions about your information? <Link to="/signin">Sign in to manage your record</Link> or contact your PathfolioApp administrator.</p></div></main><Footer /></div>;
}

export const PrivacyPolicyPage = () => <PolicyPage type="privacy" />;
export const TermsPage = () => <PolicyPage type="terms" />;
export const CookiePolicyPage = () => <PolicyPage type="cookies" />;
