import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { isAdmin, isRecruiter, homeFor } from '../config/roles';

export function LoadingScreen() {
  return (
    <div className="pf-auth-shell">
      <main className="pf-auth-page">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading your Pathfolio…</p>
      </main>
    </div>
  );
}

/**
 * RequireAuth — authentication + onboarding gate.
 * Wraps any route that needs a signed-in, onboarded student account.
 */
export function RequireAuth({ children }) {
  const { student, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!student) return <Navigate to="/signin" replace state={{ from: location }} />;
  return student.onboarding?.completed ? children : <Navigate to="/onboarding" replace />;
}

/**
 * RequireRole — portal authorization gate. Role checks live here (and in the
 * role helpers) instead of being duplicated inside individual pages.
 */
export function RequireRole({ role, children }) {
  const { student, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!student) {
    const portalParam = role === 'admin' || role === 'recruiter' ? `?portal=${role}` : '';
    return <Navigate to={`/signin${portalParam}`} replace state={{ from: location }} />;
  }
  const allowed = role === 'admin' ? isAdmin(student) : role === 'recruiter' ? isRecruiter(student) : true;
  return allowed ? children : <Navigate to={homeFor(student)} replace />;
}

/**
 * GuestRoute — keeps authenticated users out of auth forms, redirecting them
 * to their workspace while still allowing intentional portal switching
 * (e.g. ?portal=admin on /signin).
 */
export function GuestRoute({ children }) {
  const { student, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const portal = searchParams.get('portal');
  if (loading) return <LoadingScreen />;

  if (student) {
    if (isAdmin(student)) return <Navigate to="/admin" replace />;
    // Allow logged-in users to open the admin/recruiter sign-in form to switch accounts.
    if (portal === 'admin' || portal === 'recruiter') return children;
    if (isRecruiter(student)) return <Navigate to="/recruiter" replace />;
    return student.onboarding?.completed ? <Navigate to="/dashboard" replace /> : <Navigate to="/onboarding" replace />;
  }
  return children;
}

/** OnboardingRoute — blocks re-showing the registration form to existing users. */
export function OnboardingRoute({ children }) {
  const { student, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (student) {
    if (isAdmin(student)) return <Navigate to="/admin" replace />;
    if (isRecruiter(student)) return <Navigate to="/recruiter" replace />;
    if (student.onboarding?.completed) return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/** OnboardingCompleteRoute — guards the onboarding completion summary page. */
export function OnboardingCompleteRoute({ children }) {
  const { student, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!student) {
    const hasSessionData = typeof window !== 'undefined' && sessionStorage.getItem('pathfolio_completed_student');
    if (!hasSessionData) return <Navigate to="/signin" replace />;
  }
  if (isAdmin(student)) return <Navigate to="/admin" replace />;
  if (isRecruiter(student)) return <Navigate to="/recruiter" replace />;
  return children;
}
