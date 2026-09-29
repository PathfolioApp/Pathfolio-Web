import React, { useState } from 'react';
import { useAuth } from '../../../../app/providers/AuthProvider';
import { profileApi } from '../../profile/services/profileApi';
import { SignOutButton } from '../../../../components/ui/SignOutButton';
import '../../../../modules/student/profile/styles/ProfilePages.css';

export function SecurityPage() {
  const { logout } = useAuth();
  const [data, setData] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const save = async () => {
    if (data.newPassword !== data.confirm) return setErr('New passwords do not match.');
    try {
      await profileApi.password(data);
      setMsg('Password updated securely.');
      setErr('');
      setData({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div className="pf-profile-page">
      <p className="editorial-eyebrow">Security</p>
      <h1>Keep your account secure.</h1>
      <section className="pf-edit-section">
        <h2>Change password</h2>
        {err && <p className="pf-error">{err}</p>}
        {msg && <p className="pf-success">{msg}</p>}
        <div className="pf-edit-fields">
          <label>Current password<input type="password" value={data.currentPassword} onChange={e => setData({ ...data, currentPassword: e.target.value })} /></label>
          <label>New password<input type="password" value={data.newPassword} onChange={e => setData({ ...data, newPassword: e.target.value })} /></label>
          <label>Confirm new password<input type="password" value={data.confirm} onChange={e => setData({ ...data, confirm: e.target.value })} /></label>
        </div>
        <button className="pf-save" onClick={save}>Update password</button>
        <SignOutButton className="pf-secondary">Sign out</SignOutButton>
      </section>
    </div>
  );
}

export function PrivacyPage() {
  return null;
}
