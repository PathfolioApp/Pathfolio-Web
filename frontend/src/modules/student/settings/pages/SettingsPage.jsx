import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../app/providers/AuthProvider';
import { profileApi } from '../../profile/services/profileApi';
import { SignOutButton } from '../../../../components/ui/SignOutButton';
import { AvatarEditor } from '../../../../components/ui/AvatarEditor';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import '../../../../modules/student/profile/styles/ProfilePages.css';

export function SettingsPage() {
  const { student, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const deleteAccount = async () => {
    if (confirmText !== 'DELETE') return setDeleteError('Type DELETE to confirm.');
    setDeleting(true);
    setDeleteError('');
    try {
      await profileApi.deleteAccount();
      await logout();
      navigate('/?deleted=1');
    } catch (e) {
      setDeleteError(e.message);
      setDeleting(false);
    }
  };

  return (
    <div className="pf-profile-page">
      <p className="editorial-eyebrow">Account settings</p>
      <h1>Settings</h1>
      <section className="pf-edit-section">
        <h2>Profile picture</h2>
        <p className="pf-empty" style={{ marginTop: 0, marginBottom: '14px' }}>Your picture appears on your profile, portals, and applications.</p>
        <AvatarEditor name={student.personal.fullName} currentUrl={student.personal.avatarUrl || ''} onSaved={refresh} />
      </section>
      <section className="pf-edit-section">
        <h2>Account</h2>
        <dl>
          <dt>Account email</dt><dd>{student.personal.email}</dd>
          <dt>Roll number</dt><dd>{student.academic.rollNumber}</dd>
          <dt>Status</dt><dd>Active student account</dd>
        </dl>
        <div className="pf-settings-links">
          <Link to="/settings/security">Security & password</Link>
          <Link to="/settings/privacy">Privacy settings</Link>
          <Link to="/profile/settings">Profile settings</Link>
        </div>
        <SignOutButton className="pf-save">Sign out</SignOutButton>
      </section>
      <section className="pf-edit-section pf-danger-zone">
        <h2>Danger zone</h2>
        <p className="pf-empty" style={{ marginTop: 0 }}>Permanently delete your account, profile, achievements, and applications. This cannot be undone.</p>
        <button className="pf-danger-button" onClick={() => { setConfirming(true); setConfirmText(''); setDeleteError(''); }}>Delete my account</button>
      </section>
      <Modal isOpen={confirming} onClose={() => !deleting && setConfirming(false)} title="Delete your account?" footer={<>
        <Button variant="secondary" disabled={deleting} onClick={() => setConfirming(false)}>Cancel</Button>
        <Button variant="danger" loading={deleting} onClick={deleteAccount}>Delete permanently</Button>
      </>}>
        <p>This will permanently erase your PathfolioApp record, profile, achievements, applications, and settings. There is no way to recover it.</p>
        <p>Type <b>DELETE</b> to confirm.</p>
        <input className="pf-danger-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE" autoFocus />
        {deleteError && <p className="pf-error">{deleteError}</p>}
      </Modal>
    </div>
  );
}
