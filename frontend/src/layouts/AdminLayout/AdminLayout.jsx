import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BriefcaseBusiness, Building2, Users, UserRound, FileSearch, GraduationCap, ShieldCheck, Search, Share2, History } from 'lucide-react';
import { PortalShell } from '../PortalShell';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * AdminLayout, navigation and chrome for the TnP admin portal.
 * Route access is enforced by RequireRole in the central route table.
 */
export function AdminLayout({ children }) {
  const { student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    [LayoutDashboard, 'Overview', '/admin', 'overview'],
    [BriefcaseBusiness, 'Job posts', '/admin', 'jobs'],
    [Search, 'Student search', '/admin', 'students'],
    [Share2, 'Shares', '/admin', 'shares'],
    [Building2, 'Companies', '/admin', 'companies'],
    [Users, 'Applications', '/admin', 'applications'],
    [ShieldCheck, 'Placement policy', '/admin', 'policy'],
    [UserRound, 'Users', '/admin', 'users'],
    [History, 'Logs', '/admin', 'logs'],
    [FileSearch, 'JD analyser', '/admin', 'jd']
  ];

  const go = path => {
    navigate(path);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new Event('hashchange'));
    }
  };

  const inRecruiter = location.pathname.startsWith('/recruiter');
  const inAdmin = !inRecruiter;

  const portalLinks = (
    <div className="pf-portal-links" aria-label="Portal access">
      <span>Portals</span>
      <button onClick={() => go('/dashboard')}>
        <GraduationCap size={16} /> Student
      </button>
      <button onClick={() => go('/recruiter')} className={inRecruiter ? 'active' : ''}>
        <Building2 size={16} /> Recruiter
      </button>
      <button onClick={() => go('/admin')} className={inAdmin ? 'active' : ''}>
        <ShieldCheck size={16} /> Admin
      </button>
    </div>
  );

  return (
    <PortalShell navItems={navItems} portalLinks={portalLinks} showBackButton={false}>
      {children}
    </PortalShell>
  );
}
