import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, BookOpen, Briefcase, Settings, LogOut, ArrowLeft, ShieldCheck, Building2, Home } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { SignOutButton } from './SignOutButton';
import { useAuth } from '../context/AuthContext';
import './AppLayout.css';

const nav = [
  [LayoutDashboard, 'Dashboard', '/dashboard'], 
  [User, 'My Profile', '/profile'], 
  [BookOpen, 'Story', '/story'],
  [Briefcase, 'Placement Portal', '/placement'], 
  [Settings, 'Settings', '/settings']
];

export function AppLayout({ children }) {
  const { student } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState('');
  
  if (!student) return null;
  
  const name = student.personal?.fullName || '';
  const initials = name.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase();
  
  const isDashboard = location.pathname === '/dashboard';

  return (
    <div className="pf-dashboard">
      <aside className="pf-dashboard-side">
        <Link to="/" className="pf-brand pf-dashboard-brand" aria-label="PathfolioApp home">
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
        <nav>
          {nav.map(([Icon, label, path]) => {
            const isActive = path && (location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path)));
            return (
              <button 
                key={label} 
                className={isActive ? 'active' : ''} 
                onClick={() => navigate(path)}
              >
                <Icon size={18}/>
                {label}
              </button>
            );
          })}
        </nav>
        <div className="pf-portal-links" aria-label="Portal access">
          <span>Portals</span>
          <button onClick={() => navigate('/')}><Home size={16} /> Public home</button>
          {(student.isRecruiter || student.isAdmin) && <button onClick={() => navigate('/recruiter')}><Building2 size={16} /> Recruiter</button>}
          {student.isAdmin && <button onClick={() => navigate('/admin')}><ShieldCheck size={16} /> Admin</button>}
        </div>
        <SignOutButton className="pf-side-signout">
          <LogOut size={18}/>Sign out
        </SignOutButton>
      </aside>
      
      <main className="pf-dashboard-main">
        <header className="pf-dashboard-top">
          <div className="pf-mobile-top-left">
            {!isDashboard && (
              <button className="pf-mobile-back" onClick={() => navigate(-1)} aria-label="Go back">
                <ArrowLeft size={20} />
              </button>
            )}
            <Link to="/" className="pf-brand pf-mobile-dashboard-brand" aria-label="PathfolioApp home">
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
          </div>
          <div>
            <NotificationPanel/>
            <button className="pf-avatar" onClick={() => navigate('/settings')} aria-label="Account settings">{initials}</button>
          </div>
        </header>
        
        {notice && (
          <div className="pf-dashboard-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')}>Dismiss</button>
          </div>
        )}
        
        {children}
      </main>
    </div>
  );
}
