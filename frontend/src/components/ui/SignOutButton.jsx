import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { Modal } from './Modal';
import { Button } from './Button';

export function SignOutButton({ className, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await logout();
      navigate('/');
    } catch (err) {
      // The session may already be gone server-side; surface the failure
      // instead of silently leaving the user on a half-signed-out state.
      console.error(err);
      setSignOutError('Sign out failed on the server. Please try again.');
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <button className={className} onClick={() => setIsOpen(true)}>
        {children}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => !isSigningOut && setIsOpen(false)}
        title="Sign out of Pathfolio?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={isSigningOut}>
              Cancel
            </Button>
            <Button onClick={confirmSignOut} disabled={isSigningOut}>
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </Button>
          </>
        }
      >
        <p>You will need to sign in again to access your academic record and journey.</p>
        {signOutError && <p role="alert" style={{ color: 'var(--danger, #a33)', marginTop: 8 }}>{signOutError}</p>}
      </Modal>
    </>
  );
}
