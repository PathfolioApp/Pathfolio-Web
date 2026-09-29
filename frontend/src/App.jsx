import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CompletionPage } from './pages/CompletionPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProfileEditPage } from './pages/ProfileEditPage';
import { SettingsPage, ProfileSettingsPage, SecurityPage, PrivacyPage } from './pages/SettingsPages';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConsentBanner } from './components/ConsentBanner';
import { AppLayout } from './components/AppLayout';
import { AdminPage } from './pages/AdminPage';
import { PlacementPage } from './pages/PlacementPage';
import { RecruiterPage } from './pages/RecruiterPage';
import { StoryPage } from './pages/StoryPage';
import { ResumePage } from './pages/ResumePage';
import { PrivacyPolicyPage, TermsPage, CookiePolicyPage } from './pages/PolicyPages';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [pathname, hash]);
  return null;
}

function LoadingScreen() {
  return (
    <div className="pf-auth-shell">
      <main className="pf-auth-page">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading your Pathfolio…</p>
      </main>
    </div>
  );
}

function Protected({ children }) {
  const { student, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return student?.onboarding?.completed ? (
    <AppLayout>{children}</AppLayout>
  ) : (
    <Navigate to={student ? '/onboarding' : '/signin'} replace />
  );
}

function AdminProtected({ children }) {
  const { student, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!student) return <Navigate to="/signin?portal=admin" replace />;
  return student.isAdmin ? children : <Navigate to="/dashboard" replace />;
}

function RecruiterProtected({ children }) {
  const { student, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!student) return <Navigate to="/signin?portal=recruiter" replace />;
  return student.isRecruiter || student.isAdmin ? children : <Navigate to="/dashboard" replace />;
}

/**
 * GuestRoute: Redirects already-authenticated users to their appropriate workspace,
 * while permitting unauthenticated visitors to view sign-in and password recovery forms.
 * Gracefully respects portal-switch intentions (e.g. ?portal=admin).
 */
function GuestRoute({ children }) {
  const { student, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const portal = searchParams.get('portal');

  if (loading) return <LoadingScreen />;

  if (student) {
    if (student.isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (student.isRecruiter && portal !== 'admin') {
      return <Navigate to="/recruiter" replace />;
    }
    // Allow logged-in student to access the admin/recruiter signin form to switch accounts
    if (portal === 'admin' || portal === 'recruiter') {
      return children;
    }
    return student.onboarding?.completed ? (
      <Navigate to="/dashboard" replace />
    ) : (
      <Navigate to="/onboarding" replace />
    );
  }

  return children;
}

/**
 * OnboardingRoute: Prevents already onboarded students or admins from being shown
 * the blank onboarding registration form. Automatically forwards them to their dashboard.
 */
function OnboardingRoute({ children }) {
  const { student, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (student) {
    if (student.isAdmin) return <Navigate to="/admin" replace />;
    if (student.isRecruiter) return <Navigate to="/recruiter" replace />;
    if (student.onboarding?.completed) return <Navigate to="/dashboard" replace />;
    return children;
  }

  return children;
}

/**
 * OnboardingCompleteRoute: Guards the onboarding completion page.
 */
function OnboardingCompleteRoute({ children }) {
  const { student, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!student) {
    const hasSessionData = typeof window !== 'undefined' && sessionStorage.getItem('pathfolio_completed_student');
    if (!hasSessionData) {
      return <Navigate to="/signin" replace />;
    }
  }

  if (student?.isAdmin) return <Navigate to="/admin" replace />;
  if (student?.isRecruiter) return <Navigate to="/recruiter" replace />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ConsentBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
        <Route path="/onboarding/complete" element={<OnboardingCompleteRoute><CompletionPage /></OnboardingCompleteRoute>} />
        <Route path="/signin" element={<GuestRoute><SignInPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiePolicyPage />} />
        <Route path="/admin" element={<AdminProtected><AppLayout><AdminPage /></AppLayout></AdminProtected>} />
        <Route path="/recruiter" element={<RecruiterProtected><AppLayout><RecruiterPage /></AppLayout></RecruiterProtected>} />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/story" element={<Protected><StoryPage /></Protected>} />
        <Route path="/placement" element={<Protected><PlacementPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
        <Route path="/resume" element={<Protected><ResumePage /></Protected>} />
        <Route path="/profile/edit" element={<Protected><ProfileEditPage /></Protected>} />
        <Route path="/profile/settings" element={<Protected><ProfileSettingsPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/settings/security" element={<Protected><SecurityPage /></Protected>} />
        <Route path="/settings/privacy" element={<Protected><PrivacyPage /></Protected>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider></BrowserRouter>
  );
}
