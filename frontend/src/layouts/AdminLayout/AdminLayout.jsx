import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, BriefcaseBusiness, Building2, Users, UserRound, FileSearch, GraduationCap, ShieldCheck, Search, Share2, History } from 'lucide-react';
import { PortalShell } from '../PortalShell';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * AdminLayout, navigation and chrome for the TnP admin portal.
 * Route access is enforced by RequireRole in the central route table.
 */
export function AdminLayout() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    [LayoutDashboard, 'Overview', '/admin/overview'],
    { section: 'Placements & Drives' },
    [Building2, 'Companies', '/admin/companies'],
    [BriefcaseBusiness, 'Job posts', '/admin/jobs'],
    [Users, 'Applications', '/admin/applications'],
    { section: 'Talent & Matching' },
    [Search, 'Student search', '/admin/students'],
    [FileSearch, 'JD analyser', '/admin/jd'],
    [Share2, 'Candidate shares', '/admin/shares'],
    { section: 'Administration' },
    [ShieldCheck, 'Placement policy', '/admin/policy'],
    [UserRound, 'Users', '/admin/users'],
    [History, 'Logs', '/admin/logs']
  ];

  const go = path => {
    navigate(path);
  };

  const inRecruiter = location.pathname.startsWith('/recruiter');
  const inAdmin = !inRecruiter;

  const portalLinks = (
    <div className="pf-portal-links" aria-label="Portal access">
      <span>Portals</span>
      <div className="pf-portal-links__nav">
        <button type="button" onClick={() => go('/dashboard')}>
          <GraduationCap size={13} /> Student
        </button>
        <button type="button" onClick={() => go('/recruiter')} className={inRecruiter ? 'active' : ''}>
          <Building2 size={13} /> Recruiter
        </button>
        <button type="button" onClick={() => go('/admin')} className={inAdmin ? 'active' : ''}>
          <ShieldCheck size={13} /> Admin
        </button>
      </div>
    </div>
  );

  return (
    <PortalShell navItems={navItems} portalLinks={portalLinks} showBackButton={false}>
      <Outlet />
    </PortalShell>
  );
}
