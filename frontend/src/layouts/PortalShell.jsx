import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ArrowLeft, Menu, X } from 'lucide-react';
import { NotificationPanel } from '../components/ui/NotificationPanel';
import { SignOutButton } from '../components/ui/SignOutButton';
import { useAuth } from '../app/providers/AuthProvider';
import { Footer } from '../components/layout/Footer';
import './PortalShell.css';

function Brand({ className }) {
  return (
    <Link to="/" className={`pf-brand ${className || ''}`} aria-label="PathfolioApp home">
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
  );
}

/**
 * PortalShell, the shared workspace chrome (sidebar, top bar, notifications,
 * footer) used by the Student, Recruiter and Admin layouts. Each portal layout
 * supplies its own navigation items and portal switcher; the shell keeps
 * behavior and visuals identical across portals.
 */
export function PortalShell({ navItems = [], portalLinks, showBackButton = true, children }) {
  const { student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Close the mobile drawer when the route changes.
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  if (!student) return null;

  const name = student.personal?.fullName || '';
  const initials = name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const avatarUrl = student.personal?.avatarUrl || '';

  const navigateFromNav = (path) => {
    setMobileNavOpen(false);
    navigate(path);
  };

  const sidebarNav = (onItemClick) => (
    <nav aria-label="Portal navigation">
      {navItems.map((item) => {
        if (item.section) {
          return (
            <div key={item.section} className="pf-nav-group-header">
              {item.section}
            </div>
          );
        }
        const [Icon, label, path] = item;
        // Highlight active section based on path matching.
        const isActive = location.pathname === path || (path.endsWith('/overview') && (location.pathname === '/admin' || location.pathname === '/recruiter'));
        return (
          <button
            key={label}
            className={isActive ? 'active' : ''}
            onClick={() => onItemClick(path)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={18} />
            {label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="pf-dashboard">
      <aside className="pf-dashboard-side">
        <Brand className="pf-dashboard-brand" />
        {sidebarNav(navigateFromNav)}
        {portalLinks}
        <SignOutButton className="pf-side-signout">
          <LogOut size={18} />Sign out
        </SignOutButton>
      </aside>

      {/* Mobile navigation drawer */}
      {mobileNavOpen && (
        <div className="pf-mobile-nav">
          <div className="pf-mobile-nav__backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <aside className="pf-mobile-nav__panel" role="dialog" aria-modal="true" aria-label="Portal navigation">
            <div className="pf-mobile-nav__head">
              <Brand className="pf-mobile-nav__brand" />
              <button className="pf-mobile-nav__close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
                <X size={20} />
              </button>
            </div>
            {sidebarNav(navigateFromNav)}
            {portalLinks}
            <SignOutButton className="pf-side-signout">
              <LogOut size={18} />Sign out
            </SignOutButton>
          </aside>
        </div>
      )}

      <main className="pf-dashboard-main">
        <header className="pf-dashboard-top">
          <div className="pf-mobile-top-left">
            {showBackButton && location.pathname !== '/dashboard' && (
              <button className="pf-mobile-back" onClick={() => navigate(-1)} aria-label="Go back">
                <ArrowLeft size={20} />
              </button>
            )}
            <button className="pf-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-expanded={mobileNavOpen}>
              <Menu size={20} />
            </button>
            <Brand className="pf-mobile-dashboard-brand" />
          </div>
          <div>
            <NotificationPanel />
            <button className="pf-avatar pf-avatar--image" onClick={() => navigate('/settings')} aria-label="Account settings">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
            </button>
          </div>
        </header>

        {notice && (
          <div className="pf-dashboard-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')}>Dismiss</button>
          </div>
        )}

        {children}
        <Footer compact />
      </main>
    </div>
  );
}
