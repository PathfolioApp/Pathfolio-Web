import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, BookOpen, Briefcase, Settings, GraduationCap, Building2, ShieldCheck } from 'lucide-react';
import { PortalShell } from '../PortalShell';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * StudentLayout, navigation and chrome for the student portal.
 * Used as a layout route; matched pages render through <Outlet />.
 * Recruiters and admins can also reach the student workspace; they get the
 * portal switcher so they can move between workspaces.
 */
export function StudentLayout() {
  const { student } = useAuth();

  const navItems = [
    [LayoutDashboard, 'Dashboard', '/dashboard'],
    [User, 'My Profile', '/profile'],
    [BookOpen, 'Story', '/story'],
    [Briefcase, 'Placement Portal', '/placement'],
    [Settings, 'Settings', '/settings']
  ];

  return (
    <PortalShell navItems={navItems} portalLinks={<PortalSwitcher student={student} />}>
      <Outlet />
    </PortalShell>
  );
}

function PortalSwitcher({ student }) {
  const navigate = useNavigate();
  const location = useLocation();

  const go = path => {
    navigate(path);
  };

  const showSwitcher = student?.isRecruiter || student?.isAdmin;
  const inRecruiter = location.pathname.startsWith('/recruiter');
  const inAdmin = location.pathname.startsWith('/admin');

  return showSwitcher ? (
    <div className="pf-portal-links" aria-label="Portal access">
      <span>Portals</span>
      <div className="pf-portal-links__nav">
        <button type="button" onClick={() => go('/dashboard')} className={!inRecruiter && !inAdmin ? 'active' : ''}>
          <GraduationCap size={13} /> Student
        </button>
        <button type="button" onClick={() => go('/recruiter')} className={inRecruiter ? 'active' : ''}>
          <Building2 size={13} /> Recruiter
        </button>
        {student?.isAdmin && (
          <button type="button" onClick={() => go('/admin')} className={inAdmin ? 'active' : ''}>
            <ShieldCheck size={13} /> Admin
          </button>
        )}
      </div>
    </div>
  ) : null;
}
