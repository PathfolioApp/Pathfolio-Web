import React from 'react';

/**
 * AuthLayout — minimal shell for sign-in and password-recovery screens.
 * The auth pages already provide their own centered card styling
 * (.pf-auth-shell) and footer; this wrapper keeps the route tree explicit.
 */
export function AuthLayout({ children }) {
  return <>{children}</>;
}
