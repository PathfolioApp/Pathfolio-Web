import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, Shield, Check, Globe, Copy, X, ExternalLink } from 'lucide-react';
import { profileApi } from '../../profile/services/profileApi';
import { useAuth } from '../../../../app/providers/AuthProvider';
import { Button } from '../../../../components/ui/Button';
import '../../../../modules/student/profile/styles/ProfilePages.css';
import { SettingsLayout } from '../SettingsLayout';

import { apiUrl, apiHeaders } from '../../../../app/services/apiClient.js';

async function shareRequest(path, options = {}) {
  const response = await fetch(apiUrl(`/api/public-profile${path}`), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Unable to update your public link.');
  return data;
}

/** Public profile share link manager (LinkedIn-style link). */
function PublicShareCard() {
  const [share, setShare] = useState(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includeResume, setIncludeResume] = useState(false);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true); setError(''); setLoadFailed(false);
    try {
      const data = await shareRequest('/me');
      setShare(data.share || null);
      setIncludeResume(Boolean(data.share?.includeResume));
      setBio(data.share?.bio || '');
    } catch (err) { setError(err.message); setLoadFailed(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await shareRequest('/me', { method: 'POST', body: JSON.stringify({ includeResume, bio }) });
      setShare(data.share);
      setLink(`${window.location.origin}${data.url}`);
      setCopied(false); setMessage('Your public link is ready. Copy it and keep it somewhere safe.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const update = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await shareRequest('/me', { method: 'PATCH', body: JSON.stringify({ includeResume, bio }) });
      setShare(data.share);
      setMessage('Your public page has been updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm('Disable your public link? Anyone with the old link will no longer be able to see your profile.')) return;
    setBusy(true); setError('');
    try {
      await shareRequest('/me', { method: 'DELETE' });
      setShare(null); setLink(''); setMessage('Your public link has been disabled.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setError('Unable to copy automatically. Select the link and copy it manually.'); }
  };

  return (
    <section className="pf-settings-card">
      <div className="pf-settings-card-header">
        <div className="pf-settings-icon-wrapper"><Globe size={20} /></div>
        <div>
          <h2>Public profile link</h2>
          <p className="pf-settings-card-subtitle">
            Let recruiters, mentors, and your network see a curated profile without signing in. Manage this link separately from your profile visibility below.
          </p>
        </div>
      </div>

      {error && <p className="pf-settings-feedback is-error" role="alert">{error}</p>}
      {message && <p className="pf-settings-feedback is-success" role="status">{message}</p>}

      {loading ? <p className="pf-settings-card-subtitle" role="status">Loading your sharing preferences…</p> : loadFailed ? <Button variant="secondary" onClick={load}>Try again</Button> : share ? (
        <>
          {link && (
            <div className="pf-publiclink-box">
              <input readOnly value={link} onFocus={event => event.target.select()} aria-label="Your public profile link" />
              <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
              <a href={link} target="_blank" rel="noreferrer" className="pf-publiclink-open" aria-label="Open public profile"><ExternalLink size={15} /></a>
            </div>
          )}
          {!link && <div className="pf-settings-notice"><ShieldCheck size={18} /><span>Your public link is active. For privacy, the full address is shown only when created. Keep your saved link, or <button type="button" className="pf-settings-text-button" disabled={busy} onClick={() => { if (window.confirm('Replace your public link? The previous link will stop working.')) create(); }}>create a replacement</button>.</span></div>}
          <div className="pf-publiclink-stats">
            <span><b>{share.viewCount ?? 0}</b> views</span>
            <span>Created {share.createdAt ? new Date(share.createdAt).toLocaleDateString() : '-'}</span>
          </div>
          <label className="pf-publiclink-toggle">
            <input type="checkbox" checked={includeResume} disabled={busy} onChange={event => setIncludeResume(event.target.checked)} />
            Feature my default resume on the public page
          </label>
          <label className="pf-settings-label">
            Short bio (shown at the top of your public page)
            <textarea
              rows={2}
              value={bio}
              maxLength={500}
              disabled={busy}
              onChange={event => setBio(event.target.value)}
              placeholder="e.g. Backend-focused engineering student who loves shipping APIs…"
              className="pf-settings-textarea"
            />
          </label>
          <p className="pf-settings-card-subtitle pf-settings-character-count">{bio.length}/500 characters</p>
          <div className="pf-settings-actions">
            <Button variant="primary" size="sm" onClick={update} loading={busy}>Update public page</Button>
            <Button variant="ghost" size="sm" icon={X} onClick={revoke} disabled={busy}>Disable link</Button>
          </div>
        </>
      ) : (
        <div className="pf-settings-actions">
          <Button variant="primary" size="sm" icon={Globe} onClick={create} loading={busy}>Generate my public link</Button>
          <span className="pf-settings-card-subtitle" style={{ alignSelf: 'center' }}>You can revoke it anytime.</span>
        </div>
      )}
    </section>
  );
}

const PRIVACY_SECTIONS = [
  {
    key: 'personal',
    label: 'Personal Information',
    description: 'Name, headline, contact email, phone number, and location'
  },
  {
    key: 'academic',
    label: 'Academic Credentials',
    description: 'Degree program, branch, CGPA, semester SGPA, and 10th/12th schooling records'
  },
  {
    key: 'interests',
    label: 'Interests & Passions',
    description: 'Technical domains, passions, and extracurricular pursuits'
  },
  {
    key: 'achievements',
    label: 'Achievements & Badges',
    description: 'Verified certificates, hackathon honors, awards, and credentials'
  },
  {
    key: 'familyContext',
    label: 'Personal & Family Context',
    description: 'Voluntary background information, financial background, and personal notes'
  }
];

export function ProfileSettingsPage() {
  const { student, refresh } = useAuth();
  const [visibility, setVisibility] = useState(student?.profileSettings?.visibility || 'private');
  const [fields, setFields] = useState(student?.profileSettings?.fieldVisibility || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      setMsg('');
      await profileApi.settings({ visibility, fieldVisibility: fields });
      await refresh();
      setMsg('Privacy preferences saved.');
    } catch (e) {
      setError(e.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout className="pf-privacy-settings-page" title="Privacy & sharing" description="Choose your profile visibility and share your story on your terms.">

      <PublicShareCard />

      <section className="pf-settings-card">
        <div className="pf-settings-card-header">
          <div className="pf-settings-icon-wrapper">
            <Eye size={20} />
          </div>
          <div>
            <h2>Overall profile visibility</h2>
            <p className="pf-settings-card-subtitle">
              Set your profile visibility. Your public link is managed separately above.
            </p>
          </div>
        </div>

        <div className="pf-visibility-control">
          <label htmlFor="overall-visibility" className="pf-settings-label">
            Global Visibility Status
          </label>
          <div className="pf-select-wrapper">
            <select
              id="overall-visibility"
              value={visibility}
              onChange={e => { setVisibility(e.target.value); setMsg(''); setError(''); }}
              className="pf-settings-select"
              disabled={saving}
            >
              <option value="private">Private</option>
              <option value="shareable">Shareable</option>
            </select>
            <p className="pf-settings-card-subtitle">{visibility === 'private' ? 'Visible to you and authorized college administrators.' : 'Shared according to the section permissions below.'}</p>
          </div>
        </div>
      </section>

      <section className="pf-settings-card">
        <div className="pf-settings-card-header">
          <div className="pf-settings-icon-wrapper">
            <Shield size={20} />
          </div>
          <div>
            <h2>Section-level visibility</h2>
            <p className="pf-settings-card-subtitle">
              Granular controls to choose who sees each category in your profile dossier.
            </p>
          </div>
        </div>

        <div className="pf-visibility-list">
          {PRIVACY_SECTIONS.map(({ key, label, description }) => (
            <div key={key} className="pf-visibility-row">
              <div className="pf-visibility-info">
                <span className="pf-visibility-title">{label}</span>
                <span className="pf-visibility-desc">{description}</span>
              </div>
              <div className="pf-visibility-action">
                <select
                  value={fields[key] || 'student'}
                  onChange={e => { setFields({ ...fields, [key]: e.target.value }); setMsg(''); setError(''); }}
                  className="pf-select-pill"
                  aria-label={`${label} visibility`}
                  disabled={saving}
                >
                  <option value="student">Only me</option>
                  <option value="staff">College staff</option>
                  <option value="shareable">Shareable profile</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="pf-settings-notice">
          <ShieldCheck size={18} className="pf-notice-icon" />
          <span>
            Sensitive context (such as personal background and private contact information) remains visible only to you unless you explicitly change it.
          </span>
        </div>

        {error && <p className="pf-settings-feedback is-error" role="alert">{error}</p>}

        <div className="pf-settings-actions">
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            className="pf-save-settings-btn"
          >
            Save privacy settings
          </Button>
          {msg && (
            <div className="pf-settings-saved-badge" role="status">
              <Check size={16} />
              <span>{msg}</span>
            </div>
          )}
        </div>
      </section>
    </SettingsLayout>
  );
}
