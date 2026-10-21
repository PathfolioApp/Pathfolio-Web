import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, BriefcaseBusiness, Users, GraduationCap, Building2, ShieldCheck, CalendarRange } from 'lucide-react';
import { PortalShell } from '../PortalShell';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * RecruiterLayout, navigation and chrome for the recruiter portal.
 * Route access is enforced by RequireRole in the central route table.
 * Note: recruiters have no talent-search navigation, student discovery is
 * mediated by the placement team through shared candidate lists.
 */
export function RecruiterLayout() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    [LayoutDashboard, 'Overview', '/recruiter/overview'],
    [BriefcaseBusiness, 'My job posts', '/recruiter/jobs'],
    [Users, 'Shared candidates', '/recruiter/candidates'],
    [CalendarRange, 'Recruitment', '/recruiter/recruitment']
  ];

  const go = path => {
    navigate(path);
  };

  const inAdmin = location.pathname.startsWith('/admin');

  const portalLinks = (
    <div className="pf-portal-links" aria-label="Portal access">
      <span>Portals</span>
      <div className="pf-portal-links__nav">
        <button type="button" onClick={() => go('/dashboard')}>
          <GraduationCap size={13} /> Student
        </button>
        <button type="button" onClick={() => go('/recruiter')} className={!inAdmin ? 'active' : ''}>
          <Building2 size={13} /> Recruiter
        </button>
        {student?.isAdmin && (
          <button type="button" onClick={() => go('/admin')} className={inAdmin ? 'active' : ''}>
            <ShieldCheck size={13} /> Admin
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="pf-recruiter-shell"><PortalShell navItems={navItems} portalLinks={portalLinks} showBackButton={false}>
      <Outlet />
    </PortalShell></div>
  );
}
