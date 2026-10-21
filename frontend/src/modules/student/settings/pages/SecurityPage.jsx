import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Eye, EyeOff, LogOut } from 'lucide-react';
import { profileApi } from '../../profile/services/profileApi';
import { SignOutButton } from '../../../../components/ui/SignOutButton';
import { Button } from '../../../../components/ui/Button';
import { SettingsLayout, SettingsCardHeading } from '../SettingsLayout';
import { ProfileSettingsPage } from './ProfileSettingsPage';

export function SecurityPage() {
  const [data, setData] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState({});
  const save = async event => {
    event.preventDefault(); if (saving) return;
    setMsg(''); setErr('');
    if (data.newPassword !== data.confirm) return setErr('New passwords do not match.');
    try {
      setSaving(true);
      await profileApi.password({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      setMsg('Your password has been updated.'); setData({ currentPassword: '', newPassword: '', confirm: '' }); setVisible({});
    } catch (e) { setErr(e.message || 'Unable to update your password.'); }
    finally { setSaving(false); }
  };
  return <SettingsLayout title="Security & password" description="Keep your account protected and your next chapter yours.">
    <div className="pf-settings-grid pf-settings-security-grid">
      <section className="pf-settings-card">
        <SettingsCardHeading icon={KeyRound} title="Change password" description="Choose a unique password you don’t use for other accounts." />
        <form onSubmit={save} className="pf-settings-form">
          {[
            ['currentPassword', 'Current password', 'current-password'], ['newPassword', 'New password', 'new-password'], ['confirm', 'Confirm new password', 'new-password'],
          ].map(([key, label, autoComplete]) => <div className="pf-settings-field" key={key}>
            <label htmlFor={`settings-${key}`}>{label}</label>
            <div className="pf-settings-password">
              <input id={`settings-${key}`} type={visible[key] ? 'text' : 'password'} required minLength={key === 'currentPassword' ? undefined : 8} autoComplete={autoComplete} value={data[key]} disabled={saving}
                aria-describedby={key === 'newPassword' ? 'password-hint' : undefined} onChange={e => { setData({ ...data, [key]: e.target.value }); setMsg(''); setErr(''); }} />
              <button type="button" onClick={() => setVisible({ ...visible, [key]: !visible[key] })} aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={!!visible[key]} disabled={saving}>{visible[key] ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {key === 'newPassword' && <small id="password-hint">Use at least 8 characters.</small>}
          </div>)}
          {err && <p className="pf-settings-feedback is-error" role="alert">{err}</p>}
          {msg && <p className="pf-settings-feedback is-success" role="status">{msg}</p>}
          <div className="pf-settings-actions"><Button type="submit" icon={ShieldCheck} loading={saving}>Update password</Button></div>
        </form>
      </section>
      <aside className="pf-settings-card pf-settings-security-note">
        <SettingsCardHeading icon={LogOut} title="Using a shared device?" description="Sign out when you’re finished to keep your profile and personal information protected." />
        <SignOutButton className="pf-settings-signout">Sign out of this device</SignOutButton>
      </aside>
    </div>
  </SettingsLayout>;
}

export function PrivacyPage() { return <ProfileSettingsPage />; }
