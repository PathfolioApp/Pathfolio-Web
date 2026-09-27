import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { PrivacyPolicyPage, TermsPage, CookiePolicyPage } from './pages/PolicyPages';

function Protected({ children }) { const { student, loading } = useAuth(); if (loading) return <main className="pf-auth-page">Loading your Pathfolio…</main>; return student?.onboarding?.completed ? <AppLayout>{children}</AppLayout> : <Navigate to={student ? '/onboarding' : '/signin'} replace />; }
function AdminProtected({ children }) { const { student, loading } = useAuth(); if (loading) return <main className="pf-auth-page">Loading your Pathfolio…</main>; if (!student) return <Navigate to="/signin?portal=admin" replace />; return student.isAdmin ? children : <Navigate to="/dashboard" replace />; }
function RecruiterProtected({ children }) { const { student, loading } = useAuth(); if (loading) return <main className="pf-auth-page">Loading your Pathfolio…</main>; if (!student) return <Navigate to="/signin?portal=recruiter" replace />; return student.isRecruiter || student.isAdmin ? children : <Navigate to="/dashboard" replace />; }

export default function App() {
  return (
    <BrowserRouter><AuthProvider>
      <ConsentBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/complete" element={<CompletionPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiePolicyPage />} />
        <Route path="/admin" element={<AdminProtected><AppLayout><AdminPage /></AppLayout></AdminProtected>} />
        <Route path="/recruiter" element={<RecruiterProtected><AppLayout><RecruiterPage /></AppLayout></RecruiterProtected>} />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/story" element={<Protected><StoryPage /></Protected>} />
        <Route path="/placement" element={<Protected><PlacementPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
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
