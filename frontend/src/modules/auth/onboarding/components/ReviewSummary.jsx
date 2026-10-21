import React from 'react';
import { Edit2, User, GraduationCap, Compass, Award, ShieldCheck, CheckCircle, Phone } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import './ReviewSummary.css';

const levelLabel = value => {
  const labels = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert', exploring: 'Exploring' };
  return labels[value] || value;
};

const formatDate = value => {
  if (!value) return 'Not provided';
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return value;
  }
};

export function ReviewSummary({ formData, onEditSection }) {
  const { personal, academic, interests, achievements, familyContext } = formData;

  return (
    <div className="pf-review-summary animate-fade-in">
      {/* 1. Personal details Section */}
      <div className="pf-review-card">
        <div className="pf-review-card__header">
          <div className="pf-review-card__title-group">
            <User size={18} className="pf-review-card__icon" />
            <h3 className="pf-review-card__title">Personal details</h3>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('identity')}
            aria-label="Edit personal details"
            className="pf-review-card__edit-btn"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>

        <div className="pf-review-grid">
          <div className="pf-review-item">
            <span className="pf-review-item__label">Full Name</span>
            <span className="pf-review-item__value">{personal.fullName || 'Not provided'}</span>
          </div>
          <div className="pf-review-item">
            <span className="pf-review-item__label">Institutional Email</span>
            <span className="pf-review-item__value">{personal.email || 'Not provided'}</span>
          </div>
          <div className="pf-review-item">
            <span className="pf-review-item__label">Roll Number</span>
            <span className="pf-review-item__value"><code>{academic.rollNumber || 'Not provided'}</code></span>
          </div>
          <div className="pf-review-item">
            <span className="pf-review-item__label">Date of Birth</span>
            <span className="pf-review-item__value">{formatDate(personal.dateOfBirth)}</span>
          </div>
        </div>
      </div>

      <div className="pf-review-card">
        <div className="pf-review-card__header">
          <div className="pf-review-card__title-group">
            <Phone size={18} className="pf-review-card__icon" />
            <h3 className="pf-review-card__title">Contact details</h3>
          </div>
          <button type="button" onClick={() => onEditSection('phone')} aria-label="Edit contact details" className="pf-review-card__edit-btn">
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>
        <div className="pf-review-item">
          <span className="pf-review-item__label">Phone number (optional)</span>
          <span className="pf-review-item__value">{personal.phone?.trim() || 'Not provided'}</span>
        </div>
      </div>

      {/* 2. Academic details Section */}
      <div className="pf-review-card">
        <div className="pf-review-card__header">
          <div className="pf-review-card__title-group">
            <GraduationCap size={18} className="pf-review-card__icon" />
            <h3 className="pf-review-card__title">Academic details</h3>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('academic')}
            aria-label="Edit academic details"
            className="pf-review-card__edit-btn"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>

        <div className="pf-review-grid">
          <div className="pf-review-item">
            <span className="pf-review-item__label">Department</span>
            <span className="pf-review-item__value">{academic.department || 'Not provided'}</span>
          </div>
          <div className="pf-review-item">
            <span className="pf-review-item__label">Batch</span>
            <span className="pf-review-item__value">{academic.batchYear || 'Not provided'}</span>
          </div>
        </div>
      </div>

      {/* 3. Interests & passions Section */}
      <div className="pf-review-card">
        <div className="pf-review-card__header">
          <div className="pf-review-card__title-group">
            <Compass size={18} className="pf-review-card__icon" />
            <h3 className="pf-review-card__title">Interests & passions</h3>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('hobbies')}
            aria-label="Edit interests and passions"
            className="pf-review-card__edit-btn"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>

        <div className="pf-review-tags-block">
          <div className="pf-review-subitem">
            <span className="pf-review-item__label">Hobbies & interests</span>
            <div className="pf-review-chips">
              {interests.hobbies?.length > 0 ? (
                interests.hobbies.map(h => (
                  <span key={h.name} className="pf-review-chip" title={h.reason || undefined}>
                    {h.name}{h.proficiency ? ` · ${levelLabel(h.proficiency)}` : ''}
                  </span>
                ))
              ) : (
                <span className="pf-review-empty">None selected</span>
              )}
            </div>
          </div>

          <div className="pf-review-subitem" style={{ marginTop: '12px' }}>
            <span className="pf-review-item__label">Passions & curiosities</span>
            <div className="pf-review-chips">
              {interests.passions?.length > 0 ? (
                interests.passions.map(p => (
                  <span key={p.name} className="pf-review-chip pf-review-chip--sage" title={p.reason || undefined}>
                    {p.name}{p.proficiency ? ` · ${levelLabel(p.proficiency)}` : ''}
                  </span>
                ))
              ) : (
                <span className="pf-review-empty">None selected</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Milestones section */}
      <div className="pf-review-card">
        <div className="pf-review-card__header">
          <div className="pf-review-card__title-group">
            <Award size={18} className="pf-review-card__icon" />
            <h3 className="pf-review-card__title">Milestones ({achievements?.length || 0})</h3>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('achievements')}
            aria-label="Edit milestones"
            className="pf-review-card__edit-btn"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>

        {achievements?.length > 0 ? (
          <div className="pf-review-achievements-list">
            {achievements.map((item) => (
              <div key={item.id} className="pf-review-ach-item">
                <div className="pf-review-ach-item__title-row">
                  <span className="pf-review-ach-item__title">{item.title}</span>
                  <Badge variant="sage" size="sm">{item.category}</Badge>
                </div>
                {item.description && (
                  <p className="pf-review-ach-item__desc">{item.description}</p>
                )}
                {item.year && (
                  <span className="pf-review-ach-item__year">{item.year}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="pf-review-empty">No milestones added yet. You can add them to your profile later.</p>
        )}
      </div>

      {/* 5. Personal & Family Context (Sensitive data with consent status) */}
      <div className="pf-review-card pf-review-card--sensitive">
        <div className="pf-review-card__header">
          <div className="pf-review-card__title-group">
            <ShieldCheck size={18} className="pf-review-card__icon pf-review-card__icon--sensitive" />
            <h3 className="pf-review-card__title">Personal background</h3>
          </div>
          <button
            type="button"
            onClick={() => onEditSection('familyContext')}
            aria-label="Edit personal background"
            className="pf-review-card__edit-btn"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>

        <div className="pf-review-card__notice"><Badge variant="neutral" size="sm">Sensitive · Optional</Badge></div>

        {familyContext?.details ? (
          <div className="pf-review-sensitive-content">
            <p className="pf-review-sensitive-text">{familyContext.details}</p>
            <div className="pf-review-consent-pill">
              <CheckCircle size={14} />
              <span>Consent confirmed</span>
            </div>
          </div>
        ) : (
          <p className="pf-review-empty">You chose not to add personal background details.</p>
        )}
      </div>
    </div>
  );
}
