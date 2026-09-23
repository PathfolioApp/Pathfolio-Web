import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';
import { Button } from './Button';

export function SignOutButton({ className, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error(err);
      setIsSigningOut(false);
      setIsOpen(false);
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
      </Modal>
    </>
  );
}
