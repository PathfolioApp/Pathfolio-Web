import React, { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { RequireAuth, RequireRole, GuestRoute, OnboardingRoute, OnboardingCompleteRoute } from './guards';

import { LandingPage } from '../../modules/public/pages/LandingPage';
import { PrivacyPolicyPage, TermsPage, CookiePolicyPage } from '../../modules/public/pages/PolicyPages';
import { NotFoundPage } from '../../modules/public/pages/NotFoundPage';

import { SignInPage } from '../../modules/auth/pages/SignInPage';
import { ForgotPasswordPage } from '../../modules/auth/pages/ForgotPasswordPage';
import { OnboardingPage } from '../../modules/auth/pages/OnboardingPage';
import { CompletionPage } from '../../modules/auth/pages/CompletionPage';
import { PendingVerificationPage } from '../../modules/auth/pages/PendingVerificationPage';

import { StudentLayout } from '../../layouts/StudentLayout/StudentLayout';
import { DashboardPage } from '../../modules/student/dashboard/DashboardPage';
import { StoryPage } from '../../modules/student/story/StoryPage';
import { ProfilePage } from '../../modules/student/profile/pages/ProfilePage';
import { ProfileEditPage } from '../../modules/student/profile/pages/ProfileEditPage';
import { ProfileSettingsPage } from '../../modules/student/settings/pages/ProfileSettingsPage';
import { SettingsPage } from '../../modules/student/settings/pages/SettingsPage';
import { SecurityPage, PrivacyPage } from '../../modules/student/settings/pages/SecurityPage';
import { PlacementPage } from '../../modules/student/placements/PlacementPage';
import { ResumePage } from '../../modules/student/resume/ResumePage';

import { RecruiterLayout } from '../../layouts/RecruiterLayout/RecruiterLayout';
import { AdminLayout } from '../../layouts/AdminLayout/AdminLayout';
import { RecruiterPage } from '../../modules/recruiter/RecruiterPage';
import { AdminPage } from '../../modules/admin/AdminPage';
import { AuthLayout } from '../../layouts/AuthLayout/AuthLayout';

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

export function AppRoutes() {
  const { loading } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiePolicyPage />} />

      {/* Authentication & onboarding */}
      <Route path="/signin" element={<GuestRoute><AuthLayout><SignInPage /></AuthLayout></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><AuthLayout><ForgotPasswordPage /></AuthLayout></GuestRoute>} />
      <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
      <Route path="/onboarding/pending-verification" element={<PendingVerificationPage />} />
      <Route path="/onboarding/complete" element={<OnboardingCompleteRoute><CompletionPage /></OnboardingCompleteRoute>} />

      {/* Student portal (role: any signed-in user) */}
      <Route element={<RequireAuth><StudentLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/story" element={<StoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/profile/settings" element={<ProfileSettingsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/security" element={<SecurityPage />} />
        <Route path="/settings/privacy" element={<PrivacyPage />} />
        <Route path="/placement" element={<PlacementPage />} />
        <Route path="/resume" element={<ResumePage />} />
      </Route>

      {/* Recruiter portal (role: recruiter or admin) */}
      <Route path="/recruiter" element={<RequireRole role="recruiter"><RecruiterLayout><RecruiterPage /></RecruiterLayout></RequireRole>} />

      {/* Admin portal (role: admin only) */}
      <Route path="/admin" element={<RequireRole role="admin"><AdminLayout><AdminPage /></AdminLayout></RequireRole>} />

      <Route path="*" element={loading ? null : <NotFoundPage />} />
    </Routes>
  );
}
