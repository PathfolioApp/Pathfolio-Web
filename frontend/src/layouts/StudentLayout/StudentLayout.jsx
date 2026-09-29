import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, BookOpen, Briefcase, Settings, GraduationCap, Building2, ShieldCheck } from 'lucide-react';
import { PortalShell } from '../PortalShell';
import { useAuth } from '../../app/providers/AuthProvider';

/**
 * StudentLayout — navigation and chrome for the student portal.
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
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new Event('hashchange'));
    }
  };

  const showSwitcher = student?.isRecruiter || student?.isAdmin;
  const inRecruiter = location.pathname.startsWith('/recruiter');
  const inAdmin = location.pathname.startsWith('/admin');

  return showSwitcher ? (
    <div className="pf-portal-links" aria-label="Portal access">
      <span>Portals</span>
      <button onClick={() => go('/dashboard')} className={!inRecruiter && !inAdmin ? 'active' : ''}>
        <GraduationCap size={16} /> Student
      </button>
      <button onClick={() => go('/recruiter')} className={inRecruiter ? 'active' : ''}>
        <Building2 size={16} /> Recruiter
      </button>
      {student?.isAdmin && (
        <button onClick={() => go('/admin')} className={inAdmin ? 'active' : ''}>
          <ShieldCheck size={16} /> Admin
        </button>
      )}
    </div>
  ) : null;
}
