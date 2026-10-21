import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { Modal } from './Modal';
import { Button } from './Button';
import './SignOutButton.css';

export function SignOutButton({ className, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);
  const closeDialog = useCallback(() => {
    if (!isSigningOut) setIsOpen(false);
  }, [isSigningOut]);

  // The confirmation is portalled outside the navigation drawer. Move focus
  // into it, contain Tab there, then return focus to its original trigger.
  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = triggerRef.current;
    const dialog = cancelRef.current?.closest('[role="dialog"]');
    cancelRef.current?.focus();
    const handleTab = event => {
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href]')];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && event.target === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && event.target === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener('keydown', handleTab);
    return () => {
      dialog?.removeEventListener('keydown', handleTab);
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [isOpen]);

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await logout();
      navigate('/', { replace: true });
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
      <button ref={triggerRef} type="button" className={className} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => { setSignOutError(''); setIsOpen(true); }}>
        {children}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={closeDialog}
        className="pf-signout-modal"
        title="Sign out of Pathfolio?"
        footer={
          <>
            <Button buttonRef={cancelRef} variant="secondary" onClick={closeDialog} disabled={isSigningOut}>
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
