import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, Shield, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../services/profileApi';
import { SignOutButton } from '../components/SignOutButton';
import { AvatarEditor } from '../components/AvatarEditor';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import './ProfilePages.css';

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

export function SettingsPage(){const {student,refresh,logout}=useAuth();const navigate=useNavigate();const [confirming,setConfirming]=useState(false);const [confirmText,setConfirmText]=useState('');const [deleting,setDeleting]=useState(false);const [deleteError,setDeleteError]=useState('');
 const deleteAccount=async()=>{if(confirmText!=='DELETE')return setDeleteError('Type DELETE to confirm.');setDeleting(true);setDeleteError('');try{await profileApi.deleteAccount();await logout();navigate('/?deleted=1');}catch(e){setDeleteError(e.message);setDeleting(false);}};
 return <div className="pf-profile-page"><p className="editorial-eyebrow">Account settings</p><h1>Settings</h1><section className="pf-edit-section"><h2>Profile picture</h2><p className="pf-empty" style={{marginTop:0,marginBottom:'14px'}}>Your picture appears on your profile, portals, and applications.</p><AvatarEditor name={student.personal.fullName} currentUrl={student.personal.avatarUrl||''} onSaved={refresh}/></section><section className="pf-edit-section"><h2>Account</h2><dl><dt>Account email</dt><dd>{student.personal.email}</dd><dt>Username</dt><dd>@{student.personal.username}</dd><dt>Status</dt><dd>Active student account</dd></dl><div className="pf-settings-links"><Link to="/settings/security">Security & password</Link><Link to="/settings/privacy">Privacy settings</Link><Link to="/profile/settings">Profile settings</Link></div><SignOutButton className="pf-save">Sign out</SignOutButton></section><section className="pf-edit-section pf-danger-zone"><h2>Danger zone</h2><p className="pf-empty" style={{marginTop:0}}>Permanently delete your account, profile, achievements, and applications. This cannot be undone.</p><button className="pf-danger-button" onClick={()=>{setConfirming(true);setConfirmText('');setDeleteError('');}}>Delete my account</button></section><Modal isOpen={confirming} onClose={()=>!deleting&&setConfirming(false)} title="Delete your account?" footer={<><Button variant="secondary" disabled={deleting} onClick={()=>setConfirming(false)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={deleteAccount}>Delete permanently</Button></>}>
 <p>This will permanently erase your PathfolioApp record — profile, achievements, applications, and settings. There is no way to recover it.</p><p>Type <b>DELETE</b> to confirm.</p><input className="pf-danger-input" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="DELETE" autoFocus/>
 {deleteError&&<p className="pf-error">{deleteError}</p>}</Modal></div>}

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
              <option value="private">🔒 Private — Only you and authorized college administrators</option>
              <option value="shareable">🌐 Shareable — Accessible to recruiters based on section rules below</option>
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
export function SecurityPage(){const {logout}=useAuth();const nav=useNavigate();const [data,setData]=useState({currentPassword:'',newPassword:'',confirm:''});const [msg,setMsg]=useState('');const [err,setErr]=useState('');const save=async()=>{if(data.newPassword!==data.confirm)return setErr('New passwords do not match.');try{await profileApi.password(data);setMsg('Password updated securely.');setErr('');setData({currentPassword:'',newPassword:'',confirm:''})}catch(e){setErr(e.message)}};return <div className="pf-profile-page"><p className="editorial-eyebrow">Security</p><h1>Keep your account secure.</h1><section className="pf-edit-section"><h2>Change password</h2>{err&&<p className="pf-error">{err}</p>}{msg&&<p className="pf-success">{msg}</p>}<div className="pf-edit-fields"><label>Current password<input type="password" value={data.currentPassword} onChange={e=>setData({...data,currentPassword:e.target.value})}/></label><label>New password<input type="password" value={data.newPassword} onChange={e=>setData({...data,newPassword:e.target.value})}/></label><label>Confirm new password<input type="password" value={data.confirm} onChange={e=>setData({...data,confirm:e.target.value})}/></label></div><button className="pf-save" onClick={save}>Update password</button><SignOutButton className="pf-secondary">Sign out</SignOutButton></section></div>}
export function PrivacyPage(){return <ProfileSettingsPage/>}
