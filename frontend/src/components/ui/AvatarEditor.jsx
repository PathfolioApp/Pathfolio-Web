import React, { useRef, useState } from 'react';
import { Camera, Trash2, UserRound } from 'lucide-react';
import { profileApi, uploadAvatarImage } from '../../modules/student/profile/services/profileApi';
import './AvatarEditor.css';

/**
 * Profile-picture editor. Uploads to Cloudinary via a signed request, then
 * persists the URL on the signed-in account (works for students, recruiters,
 * and admins alike).
 */
export function AvatarEditor({ name = '', currentUrl = '', size = 88, onSaved }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const chooseFile = () => fileInput.current?.click();

  const handleFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file (PNG or JPG).');
    if (file.size > 5 * 1024 * 1024) return setError('Images must be smaller than 5 MB.');
    setBusy(true); setError(''); setMessage('');
    try {
      const url = await uploadAvatarImage(file);
      await profileApi.setAvatar(url);
      setMessage('Profile picture updated.');
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await profileApi.setAvatar('');
      setMessage('Profile picture removed.');
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const initials = name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="pf-avatar-editor" style={{ '--avatar-size': `${size}px` }}>
      <div className="pf-avatar-editor__frame">
        {currentUrl
          ? <img className="pf-avatar-editor__img" src={currentUrl} alt={`${name || 'User'} profile picture`} />
          : <span className="pf-avatar-editor__fallback" aria-hidden="true">{initials || <UserRound size={Math.round(size / 2.4)} />}</span>}
        <button type="button" className="pf-avatar-editor__camera" onClick={chooseFile} disabled={busy} aria-label="Change profile picture">
          <Camera size={15} />
        </button>
      </div>
      <div className="pf-avatar-editor__meta">
        <div className="pf-avatar-editor__actions">
          <button type="button" className="pf-avatar-editor__btn" onClick={chooseFile} disabled={busy}>{busy ? 'Uploading…' : currentUrl ? 'Change photo' : 'Upload photo'}</button>
          {currentUrl && <button type="button" className="pf-avatar-editor__btn pf-avatar-editor__btn--danger" onClick={remove} disabled={busy}><Trash2 size={13} />Remove</button>}
        </div>
        <p className="pf-avatar-editor__hint">PNG or JPG, up to 5 MB.</p>
        {message && <p className="pf-avatar-editor__ok" role="status">{message}</p>}
        {error && <p className="pf-avatar-editor__err" role="alert">{error}</p>}
      </div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} hidden />
    </div>
  );
}
