import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, UserRound, ShieldCheck, Eye, ArrowUpRight, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../../app/providers/AuthProvider';
import { profileApi } from '../../profile/services/profileApi';
import { SignOutButton } from '../../../../components/ui/SignOutButton';
import { AvatarEditor } from '../../../../components/ui/AvatarEditor';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { SettingsLayout, SettingsCardHeading } from '../SettingsLayout';

export function SettingsPage() {
  const { student, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteAccount = async () => {
    if (deleting || confirmText !== 'DELETE') return;
    setDeleting(true); setDeleteError('');
    try { await profileApi.deleteAccount(); await logout(); navigate('/?deleted=1', { replace: true }); }
    catch (e) { setDeleteError(e.message || 'Unable to delete your account.'); setDeleting(false); }
  };
  return <SettingsLayout title="Account settings" description="A few personal touches. Everything important, in your control.">
    <div className="pf-settings-grid">
      <section className="pf-settings-card pf-settings-photo">
        <SettingsCardHeading icon={Camera} title="Profile picture" description="Put a face to your story. Your photo appears across your profile and portals." />
        <AvatarEditor name={student?.personal?.fullName || ''} currentUrl={student?.personal?.avatarUrl || ''} onSaved={refresh} />
      </section>
      <section className="pf-settings-card">
        <SettingsCardHeading icon={UserRound} title="Your account" description="The details that identify your campus account." />
        <dl className="pf-settings-details">
          <div><dt>Account email</dt><dd>{student?.personal?.email || 'Not provided'}</dd></div>
          <div><dt>Roll number</dt><dd>{student?.academic?.rollNumber || 'Not provided'}</dd></div>
          <div><dt>Account status</dt><dd><span className="pf-settings-status"><CheckCircle2 size={14} />Active account</span></dd></div>
        </dl>
        <div className="pf-settings-card-footer"><p>Finished for now?</p><SignOutButton className="pf-settings-signout">Sign out</SignOutButton></div>
      </section>
    </div>
    <section className="pf-settings-shortcuts" aria-label="More account settings">
      {[['/settings/security', ShieldCheck, 'Security & password', 'Manage your password and account access.'], ['/settings/privacy', Eye, 'Privacy & sharing', 'Choose your visibility and manage your public link.']].map(([to, Icon, title, text]) =>
        <Link key={to} to={to}><span className="pf-settings-icon-wrapper"><Icon size={20} /></span><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}
    </section>
    <section className="pf-settings-card pf-settings-danger">
      <SettingsCardHeading icon={Trash2} title="Delete account" description="Permanently remove your account and associated records. This cannot be undone." />
      <Button variant="danger" onClick={() => { setConfirming(true); setConfirmText(''); setDeleteError(''); }}>Delete my account</Button>
    </section>
    <Modal className="pf-settings-dialog" isOpen={confirming} onClose={() => !deleting && setConfirming(false)} title="Delete your account?" footer={<>
      <Button variant="secondary" disabled={deleting} onClick={() => setConfirming(false)}>Keep my account</Button>
      <Button variant="danger" loading={deleting} disabled={confirmText !== 'DELETE'} onClick={deleteAccount}>Delete permanently</Button>
    </>}>
      <p>This permanently erases your profile, achievements, applications, and settings. You cannot recover these records.</p>
      <label className="pf-settings-confirm-label" htmlFor="delete-account-confirm">Type <b>DELETE</b> to confirm</label>
      <input id="delete-account-confirm" className="pf-settings-confirm-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} disabled={deleting} autoComplete="off" spellCheck={false} autoFocus />
      {deleteError && <p className="pf-settings-feedback is-error" role="alert">{deleteError}</p>}
    </Modal>
  </SettingsLayout>;
}
