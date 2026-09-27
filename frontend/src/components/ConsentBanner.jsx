import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { consentApi } from '../services/consentApi';
import './ConsentBanner.css';

const STORAGE_KEY = 'pathfolio_cookie_consent';

/**
 * First-visit cookie consent.
 * - "Accept all": strictly necessary session cookie + optional UI preference storage.
 * - "Only necessary": session cookie only.
 * The choice is kept in localStorage and synced to the API for the record.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    let decision = null;
    try { decision = window.localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    if (!decision) {
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
    // Inform the API of the stored choice so server-side behaviour matches.
    consentApi.set(decision).catch(() => {});
    return undefined;
  }, []);

  const decide = async choice => {
    setSaving(choice);
    try { window.localStorage.setItem(STORAGE_KEY, choice); } catch { /* storage unavailable */ }
    try { await consentApi.set(choice); } catch { /* non-critical */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pf-cookie" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className="pf-cookie__card">
        <span className="pf-cookie__icon"><ShieldCheck size={20} /></span>
        <div className="pf-cookie__copy">
          <strong>Your privacy choices</strong>
          <p>
            Essential cookies keep you signed in securely. With your permission we also store
            small preference cookies for interface state. Read our <Link to="/cookies">cookie policy</Link>.
          </p>
        </div>
        <div className="pf-cookie__actions">
          <button type="button" className="pf-cookie__btn pf-cookie__btn--ghost" disabled={Boolean(saving)} onClick={() => decide('minimal')}>
            {saving === 'minimal' ? 'Saving…' : 'Only necessary'}
          </button>
          <button type="button" className="pf-cookie__btn pf-cookie__btn--primary" disabled={Boolean(saving)} onClick={() => decide('all')}>
            {saving === 'all' ? 'Saving…' : 'Accept all cookies'}
          </button>
        </div>
      </div>
    </div>
  );
}
