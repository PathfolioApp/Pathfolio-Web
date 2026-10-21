import React, { useEffect, lazy, Suspense } from 'react';
import { Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { RequireAuth, RequireRole, GuestRoute, OnboardingRoute, OnboardingCompleteRoute } from './guards';
import { LoadingScreen } from './guards';

import { LandingPage } from '../../modules/public/pages/LandingPage';
import { PrivacyPolicyPage, TermsPage, CookiePolicyPage } from '../../modules/public/pages/PolicyPages';
import { NotFoundPage } from '../../modules/public/pages/NotFoundPage';
import { PublicProfilePage } from '../../modules/public/pages/PublicProfilePage';

import { SignInPage } from '../../modules/auth/pages/SignInPage';
import { ForgotPasswordPage } from '../../modules/auth/pages/ForgotPasswordPage';
import { OnboardingPage } from '../../modules/auth/pages/OnboardingPage';
import { CompletionPage } from '../../modules/auth/pages/CompletionPage';
import { PendingVerificationPage } from '../../modules/auth/pages/PendingVerificationPage';

import { StudentLayout } from '../../layouts/StudentLayout/StudentLayout';
import { RecruiterLayout } from '../../layouts/RecruiterLayout/RecruiterLayout';
import { AdminLayout } from '../../layouts/AdminLayout/AdminLayout';
import { AuthLayout } from '../../layouts/AuthLayout/AuthLayout';

// Portal pages are code-split: the landing page and sign-in stay instant while
// each workspace's JS loads on first navigation (main bundle ~844KB before).
const DashboardPage = lazy(() => import('../../modules/student/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const StoryPage = lazy(() => import('../../modules/student/story/StoryPage').then(m => ({ default: m.StoryPage })));
const ProfilePage = lazy(() => import('../../modules/student/profile/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ProfileEditPage = lazy(() => import('../../modules/student/profile/pages/ProfileEditPage').then(m => ({ default: m.ProfileEditPage })));
const ProfileSettingsPage = lazy(() => import('../../modules/student/settings/pages/ProfileSettingsPage').then(m => ({ default: m.ProfileSettingsPage })));
const SettingsPage = lazy(() => import('../../modules/student/settings/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SecurityPageLazy = lazy(() => import('../../modules/student/settings/pages/SecurityPage').then(m => ({ default: m.SecurityPage })));
const PrivacyPageLazy = lazy(() => import('../../modules/student/settings/pages/SecurityPage').then(m => ({ default: m.PrivacyPage })));
const PlacementPage = lazy(() => import('../../modules/student/placements/PlacementPage').then(m => ({ default: m.PlacementPage })));
const ResumePage = lazy(() => import('../../modules/student/resume/ResumePage').then(m => ({ default: m.ResumePage })));
const ResumeDetailsPage = lazy(() => import('../../modules/student/resume/ResumeDetailsPage').then(m => ({ default: m.ResumeDetailsPage })));
const ResumeStudioPage = lazy(() => import('../../modules/student/resume/ResumeStudioPage').then(m => ({ default: m.ResumeStudioPage })));
const RecruiterPage = lazy(() => import('../../modules/recruiter/RecruiterPage').then(m => ({ default: m.RecruiterPage })));
const AdminPage = lazy(() => import('../../modules/admin/AdminPage').then(m => ({ default: m.AdminPage })));

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
    <>
      <ScrollToTop />
      <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/p/:token" element={<PublicProfilePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiePolicyPage />} />

      {/* Authentication & onboarding */}
      <Route path="/signin" element={<GuestRoute><AuthLayout><SignInPage /></AuthLayout></GuestRoute>} />
      {/* Legacy/aliased URLs kept working with permanent redirects (deep links
          from old bookmarks, docs and handouts must not dead-end). */}
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/placements" element={<Navigate to="/placement" replace />} />
      <Route path="/forgot-password" element={<GuestRoute><AuthLayout><ForgotPasswordPage /></AuthLayout></GuestRoute>} />
      <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
      <Route path="/onboarding/pending-verification" element={<PendingVerificationPage />} />
      <Route path="/onboarding/complete" element={<OnboardingCompleteRoute><CompletionPage /></OnboardingCompleteRoute>} />

      {/* Student portal (role: any signed-in user) */}
      <Route element={<RequireAuth><StudentLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<Suspense fallback={<LoadingScreen />}><DashboardPage /></Suspense>} />
        <Route path="/story/demo" element={<Navigate to="/story" replace />} />
        <Route path="/story" element={<Suspense fallback={<LoadingScreen />}><StoryPage /></Suspense>} />
        <Route path="/profile" element={<Suspense fallback={<LoadingScreen />}><ProfilePage /></Suspense>} />
        <Route path="/profile/edit" element={<Suspense fallback={<LoadingScreen />}><ProfileEditPage /></Suspense>} />
        <Route path="/profile/settings" element={<Suspense fallback={<LoadingScreen />}><ProfileSettingsPage /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<LoadingScreen />}><SettingsPage /></Suspense>} />
        <Route path="/settings/security" element={<Suspense fallback={<LoadingScreen />}><SecurityPageLazy /></Suspense>} />
        <Route path="/settings/privacy" element={<Suspense fallback={<LoadingScreen />}><PrivacyPageLazy /></Suspense>} />
        <Route path="/placement" element={<Suspense fallback={<LoadingScreen />}><PlacementPage /></Suspense>} />
        <Route path="/resume" element={<Suspense fallback={<LoadingScreen />}><ResumePage /></Suspense>} />
        <Route path="/resumes" element={<Suspense fallback={<LoadingScreen />}><ResumePage /></Suspense>} />
        <Route path="/resume/studio" element={<Suspense fallback={<LoadingScreen />}><ResumeStudioPage /></Suspense>} />
        <Route path="/resume/:resumeId" element={<Suspense fallback={<LoadingScreen />}><ResumeDetailsPage /></Suspense>} />
        <Route path="/resume/:resumeId/studio" element={<Suspense fallback={<LoadingScreen />}><ResumeStudioPage /></Suspense>} />
      </Route>

        {/* Recruiter portal (role: recruiter or admin) */}
        <Route path="/recruiter" element={<RequireRole role="recruiter"><RecruiterLayout /></RequireRole>}>
          <Route index element={<Navigate to="/recruiter/overview" replace />} />
          <Route path=":tab" element={<Suspense fallback={<LoadingScreen />}><RecruiterPage /></Suspense>} />
        </Route>

        {/* Admin portal (role: admin only) */}
        <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path=":tab" element={<Suspense fallback={<LoadingScreen />}><AdminPage /></Suspense>} />
        </Route>

        <Route path="*" element={loading ? null : <NotFoundPage />} />
      </Routes>
    </>
  );
}
