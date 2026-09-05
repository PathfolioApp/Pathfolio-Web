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

function Protected({ children }) { const { student, loading } = useAuth(); if (loading) return <main className="pf-auth-page">Loading your Pathfolio…</main>; return student?.onboarding?.completed ? children : <Navigate to={student ? '/onboarding' : '/signin'} replace />; }

export default function App() {
  return (
    <BrowserRouter><AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/complete" element={<CompletionPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
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
