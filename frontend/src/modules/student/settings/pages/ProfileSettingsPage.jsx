import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, Shield, Check, Globe, Copy, X, ExternalLink } from 'lucide-react';
import { profileApi } from '../../profile/services/profileApi';
import { useAuth } from '../../../../app/providers/AuthProvider';
import { Button } from '../../../../components/ui/Button';
import '../../../../modules/student/profile/styles/ProfilePages.css';

async function shareRequest(path, options = {}) {
  const response = await fetch(`/api/public-profile${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
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

  useEffect(() => {
    shareRequest('/me').then(data => setShare(data.share || null)).catch(() => setShare(null));
  }, []);

  const create = async () => {
    setBusy(true); setError('');
    try {
      const data = await shareRequest('/me', { method: 'POST', body: JSON.stringify({ includeResume, bio }) });
      setShare(data.share);
      setLink(`${window.location.origin}${data.url}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const update = async () => {
    setBusy(true); setError('');
    try {
      const data = await shareRequest('/me', { method: 'PATCH', body: JSON.stringify({ includeResume, bio }) });
      setShare(data.share);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm('Disable your public link? Anyone with the old link will no longer be able to see your profile.')) return;
    setBusy(true); setError('');
    try {
      await shareRequest('/me', { method: 'DELETE' });
      setShare(null); setLink('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="pf-settings-card">
      <div className="pf-settings-card-header">
        <div className="pf-settings-icon-wrapper"><Globe size={20} /></div>
        <div>
          <h2>Public profile link</h2>
          <p className="pf-settings-card-subtitle">
            Generate a shareable link (like LinkedIn) that lets anyone - recruiters, mentors, your network - view a curated version of your profile. No sign-in needed.
          </p>
        </div>
      </div>

      {error && <p className="pf-error" style={{ marginBottom: '12px' }}>{error}</p>}

      {share ? (
        <>
          {link && (
            <div className="pf-publiclink-box">
              <input readOnly value={link} onFocus={event => event.target.select()} aria-label="Your public profile link" />
              <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
              <a href={link} target="_blank" rel="noreferrer" className="pf-publiclink-open"><ExternalLink size={15} /></a>
            </div>
          )}
          <div className="pf-publiclink-stats">
            <span><b>{share.viewCount ?? 0}</b> views</span>
            <span>Created {share.createdAt ? new Date(share.createdAt).toLocaleDateString() : '-'}</span>
          </div>
          <label className="pf-publiclink-toggle">
            <input type="checkbox" checked={includeResume} onChange={event => setIncludeResume(event.target.checked)} />
            Feature my default resume on the public page
          </label>
          <label className="pf-settings-label" style={{ display: 'block', marginTop: 10 }}>
            Short bio (shown at the top of your public page)
            <textarea
              rows={2}
              value={bio}
              onChange={event => setBio(event.target.value)}
              placeholder="e.g. Backend-focused engineering student who loves shipping APIs…"
              className="pf-settings-textarea"
              style={{ width: '100%', marginTop: 4, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', font: 'inherit', fontSize: '.86rem' }}
            />
          </label>
          <div className="pf-settings-actions" style={{ marginTop: 12 }}>
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
  const navigate = useNavigate();
  const [visibility, setVisibility] = useState(student.profileSettings?.visibility || 'private');
  const [fields, setFields] = useState(student.profileSettings?.fieldVisibility || {});
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
    <div className="pf-profile-page pf-privacy-settings-page">
      <div className="pf-edit-heading">
        <div>
          <span className="editorial-eyebrow">PROFILE SETTINGS</span>
          <h1>Privacy & Sharing Controls</h1>
          <p className="pf-edit-subtitle">
            Configure how your profile is represented and control access to individual sections.
          </p>
        </div>
        <button
          type="button"
          className="pf-secondary pf-back-button"
          onClick={() => navigate('/profile')}
          aria-label="Back to profile"
        >
          <ArrowLeft size={16} /> Back to profile
        </button>
      </div>

      <PublicShareCard />

      <section className="pf-settings-card">
        <div className="pf-settings-card-header">
          <div className="pf-settings-icon-wrapper">
            <Eye size={20} />
          </div>
          <div>
            <h2>Overall profile visibility</h2>
            <p className="pf-settings-card-subtitle">
              Set the baseline exposure for your profile link and recruiter discovery.
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
              onChange={e => setVisibility(e.target.value)}
              className="pf-settings-select"
            >
              <option value="private">🔒 Private, Only you and authorized college administrators</option>
              <option value="shareable">🌐 Shareable, Accessible to recruiters based on section rules below</option>
            </select>
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
                  onChange={e => setFields({ ...fields, [key]: e.target.value })}
                  className="pf-select-pill"
                  aria-label={`${label} visibility`}
                >
                  <option value="student">Only me</option>
                  <option value="staff">Authorized college staff</option>
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

        {error && <p className="pf-error" style={{ marginBottom: '16px' }}>{error}</p>}

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
            <div className="pf-settings-saved-badge">
              <Check size={16} />
              <span>{msg}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
