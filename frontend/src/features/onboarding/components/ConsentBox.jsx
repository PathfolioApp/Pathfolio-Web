import React from 'react';
import { Shield, Info, Lock } from 'lucide-react';
import './ConsentBox.css';

export function ConsentBox({
  value = '',
  onChangeValue,
  consentGiven = false,
  onChangeConsent,
  error = null
}) {
  return (
    <div className="pf-consent-box animate-fade-in">
      {/* Informational Guidance Notice */}
      <div className="pf-consent-box__notice">
        <div className="pf-consent-box__notice-icon">
          <Shield size={20} />
        </div>
        <div className="pf-consent-box__notice-text">
          <h4 className="pf-consent-box__notice-title">Your privacy & data dignity come first</h4>
          <p className="pf-consent-box__notice-desc">
            Sharing your background helps your university academic advisors provide tailored mentorship and support. This entire section is completely optional.
          </p>
        </div>
      </div>

      {/* Freeform context input */}
      <div className="pf-form-group">
        <label className="pf-form-label">
          Personal / Family Background Notes (Optional)
        </label>
        <textarea
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          placeholder="e.g. First-generation college student, bilingual background, balancing studies with family responsibilities..."
          rows={4}
          className="pf-textarea"
          maxLength={600}
        />
        <div className="pf-consent-box__meta">
          <span className="pf-consent-box__charcount">{value.length} / 600 characters</span>
          <span className="pf-consent-box__security">
            <Lock size={12} /> Stored securely with strict access control
          </span>
        </div>
      </div>

      {/* Explicit Consent Checkbox (Required ONLY if notes are provided) */}
      {value.trim().length > 0 && (
        <div className={`pf-consent-checkbox-card ${error ? 'is-error' : ''}`}>
          <label className="pf-consent-checkbox-label">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => onChangeConsent(e.target.checked)}
              className="pf-consent-checkbox"
            />
            <span className="pf-consent-checkbox-text">
              <strong>Explicit Consent:</strong> I understand and consent to PathfolioApp storing this background information to personalize my academic advising and support record.
            </span>
          </label>
          {error && <p className="pf-consent-error">{error}</p>}
        </div>
      )}

      {/* Non-collection guarantee */}
      <div className="pf-consent-box__guarantee">
        <Info size={14} />
        <span>
          PathfolioApp will never request government ID numbers (e.g. Aadhaar / PAN), banking details, or sensitive financial credentials during onboarding.
        </span>
      </div>
    </div>
  );
}
