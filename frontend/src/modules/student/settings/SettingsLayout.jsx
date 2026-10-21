import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { UserRound, ShieldCheck, Eye } from 'lucide-react';
import './Settings.css';

export function SettingsLayout({ title, description, children, className = '' }) {
  const { pathname } = useLocation();
  return <div className={`pf-settings-page ${className}`}>
    <header className="pf-settings-heading">
      <p className="editorial-eyebrow">YOUR PREFERENCES</p><h1>{title}</h1><p>{description}</p>
    </header>
    <nav className="pf-settings-nav" aria-label="Account settings">
      {[['/settings', UserRound, 'Account'], ['/settings/security', ShieldCheck, 'Security'], ['/settings/privacy', Eye, 'Privacy & sharing']].map(([to, Icon, label]) =>
        <NavLink key={to} to={to} end className={({ isActive }) => isActive || (to === '/settings/privacy' && pathname === '/profile/settings') ? 'is-active' : ''}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
        </NavLink>)}
    </nav>
    {children}
  </div>;
}

export function SettingsCardHeading({ icon: Icon, title, description }) {
  return <div className="pf-settings-card-header">
    <div className="pf-settings-icon-wrapper"><Icon size={20} aria-hidden="true" /></div>
    <div><h2>{title}</h2>{description && <p className="pf-settings-card-subtitle">{description}</p>}</div>
  </div>;
}
