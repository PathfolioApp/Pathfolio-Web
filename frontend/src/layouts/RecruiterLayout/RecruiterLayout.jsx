import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, BriefcaseBusiness, GraduationCap, Building2, ShieldCheck } from 'lucide-react';
import { PortalShell } from '../PortalShell';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * RecruiterLayout — navigation and chrome for the recruiter portal.
 * Route access is enforced by RequireRole in the central route table.
 */
export function RecruiterLayout({ children }) {
  const { student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    [LayoutDashboard, 'Overview', '/recruiter'],
    [Search, 'Talent search', '/recruiter', 'discover'],
    [BriefcaseBusiness, 'My job posts', '/recruiter', 'jobs']
  ];

  const go = path => {
    navigate(path);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new Event('hashchange'));
    }
  };

  const inAdmin = location.pathname.startsWith('/admin');

  const portalLinks = (
    <div className="pf-portal-links" aria-label="Portal access">
      <span>Portals</span>
      <button onClick={() => go('/dashboard')}>
        <GraduationCap size={16} /> Student
      </button>
      <button onClick={() => go('/recruiter')} className={!inAdmin ? 'active' : ''}>
        <Building2 size={16} /> Recruiter
      </button>
      {student?.isAdmin && (
        <button onClick={() => go('/admin')} className={inAdmin ? 'active' : ''}>
          <ShieldCheck size={16} /> Admin
        </button>
      )}
    </div>
  );

  return (
    <PortalShell navItems={navItems} portalLinks={portalLinks} showBackButton={false}>
      {children}
    </PortalShell>
  );
}
