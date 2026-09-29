/**
 * Centralized role / authorization helpers.
 *
 * Authentication ("who is the user?") lives in AuthProvider; these helpers
 * answer authorization questions ("what may this user access?") so that
 * portal checks are not duplicated across pages and guards.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECRUITER: 'recruiter',
  STUDENT: 'student'
});

export const roleOf = student => {
  if (!student) return null;
  if (student.isAdmin) return ROLES.ADMIN;
  if (student.isRecruiter) return ROLES.RECRUITER;
  return ROLES.STUDENT;
};

export const isAdmin = student => roleOf(student) === ROLES.ADMIN;
export const isRecruiter = student => roleOf(student) === ROLES.RECRUITER || isAdmin(student);
export const isStudent = student => Boolean(student);

/** Portals a given user may enter, used by the portal switcher and guards. */
export const allowedPortals = student => {
  const portals = ['student'];
  if (isRecruiter(student)) portals.push('recruiter');
  if (isAdmin(student)) portals.push('admin');
  return portals;
};

/** Where a signed-in user should land after authentication. */
export const homeFor = student => {
  if (isAdmin(student)) return '/admin';
  if (isRecruiter(student)) return '/recruiter';
  return student?.onboarding?.completed ? '/dashboard' : '/onboarding';
};
