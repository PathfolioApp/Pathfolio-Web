import React from 'react';
import { BriefcaseBusiness, Building2, FileSearch, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AdminPage.css';

const comingSoonItems = [
  { icon: Building2, title: 'Companies', description: 'Manage company profiles and hiring partners.' },
  { icon: BriefcaseBusiness, title: 'Job posts', description: 'Create, publish, and manage opportunities.' },
  { icon: FileSearch, title: 'JD matching', description: 'Find eligible students from a pasted job description.' }
];

export function AdminPage() {
  const { student, logout } = useAuth();

  return (
    <main className="pf-admin-page">
      <header className="pf-admin-header">
        <div>
          <p className="pf-admin-eyebrow">Pathfolio administration</p>
          <h1>Good to see you, {student?.personal?.fullName || 'Admin'}.</h1>
          <p className="pf-admin-intro">Your workspace for building the next generation of student opportunities.</p>
        </div>
        <button className="pf-admin-signout" type="button" onClick={logout}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </header>

      <section className="pf-admin-status" aria-label="Admin portal status">
        <span className="pf-admin-status-dot" aria-hidden="true" />
        <div><strong>Admin access active</strong><span>Core workspace is ready for setup.</span></div>
      </section>

      <section className="pf-admin-section">
        <div className="pf-admin-section-heading"><p className="pf-admin-eyebrow">Workspace roadmap</p><h2>What is coming next</h2></div>
        <div className="pf-admin-feature-grid">
          {comingSoonItems.map(({ icon: Icon, title, description }) => <article className="pf-admin-feature" key={title}><div className="pf-admin-feature-icon"><Icon size={20} aria-hidden="true" /></div><div><span className="pf-admin-badge">Coming soon</span><h3>{title}</h3><p>{description}</p></div></article>)}
        </div>
      </section>
    </main>
  );
}