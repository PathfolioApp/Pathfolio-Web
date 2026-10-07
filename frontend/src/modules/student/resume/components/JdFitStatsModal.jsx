import React from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Check, 
  TrendingUp, 
  Compass, 
  Briefcase, 
  Building2, 
  Award,
  Layers
} from 'lucide-react';

export default function JdFitStatsModal({ isOpen, onClose, resume, onOpenStudio }) {
  if (!isOpen || !resume) return null;

  const tailoredMeta = resume.extractedData?.tailoredMeta || resume.analysis?.tailoredMeta;
  if (!tailoredMeta) return null;

  const score = Number(tailoredMeta.matchScore || resume.analysis?.score || 80);
  const matchedSkills = Array.isArray(tailoredMeta.matchedSkills) ? tailoredMeta.matchedSkills : [];
  const missingSkills = Array.isArray(tailoredMeta.missingOrWeakSkills) ? tailoredMeta.missingOrWeakSkills : [];
  const matchedStrengths = Array.isArray(tailoredMeta.matchedStrengths) ? tailoredMeta.matchedStrengths : [];
  const roadmap = Array.isArray(tailoredMeta.roadmapTo100) ? tailoredMeta.roadmapTo100 : [];

  const getScoreColorClass = (s) => {
    if (s >= 88) return 'is-high';
    if (s >= 75) return 'is-medium';
    return 'is-low';
  };

  return createPortal(
    <div className="pf-tailor-modal-overlay" onClick={onClose}>
      <div 
        className="pf-tailor-modal-card is-stats-card" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-stats-modal-title"
      >
        {/* Header */}
        <div className="pf-tailor-modal-header">
          <div className="pf-tailor-modal-header-left">
            <div className="pf-tailor-icon-badge is-indigo">
              <Compass size={20} className="pf-tailor-target-icon" />
            </div>
            <div>
              <h2 id="pf-stats-modal-title">JD Fit & Improvement Roadmap</h2>
              <div className="pf-stats-meta-row">
                <span><Briefcase size={13} /> {tailoredMeta.jobTitle || 'Role'}</span>
                <span className="pf-stats-dot">·</span>
                <span><Building2 size={13} /> {tailoredMeta.company || 'Company'}</span>
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="pf-tailor-modal-close" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="pf-tailor-modal-body is-scrollable">
          {/* Executive Score Card */}
          <div className="pf-stats-score-banner">
            <div className={`pf-stats-gauge-ring ${getScoreColorClass(score)}`}>
              <span className="pf-stats-gauge-value">{score}%</span>
              <span className="pf-stats-gauge-sub">ATS Match</span>
            </div>
            <div className="pf-stats-score-info">
              <div className="pf-stats-rating-tag">
                {score >= 88 ? 'Strong Candidate Fit' : score >= 75 ? 'Moderate Alignment' : 'Gap Identified'}
              </div>
              <p>{tailoredMeta.summary || 'Your verified profile has been aligned with this job posting. Review your verified strengths and actionable steps below to reach 100% eligibility.'}</p>
            </div>
          </div>

          {/* Section 1: Matched Strengths */}
          {matchedStrengths.length > 0 && (
            <div className="pf-stats-section">
              <h3 className="pf-stats-section-heading">
                <Award size={15} /> Competitive Advantages for this Role
              </h3>
              <div className="pf-stats-strengths-grid">
                {matchedStrengths.map((str, i) => (
                  <div key={i} className="pf-stats-strength-card">
                    <CheckCircle2 size={15} className="pf-stats-check-icon" />
                    <span>{str}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Skills Comparison Grid */}
          <div className="pf-stats-section">
            <h3 className="pf-stats-section-heading">
              <Layers size={15} /> Keyword & Competency Alignment
            </h3>
            <div className="pf-stats-skills-split">
              {/* Verified Matches */}
              <div className="pf-stats-skill-col is-matched-col">
                <div className="pf-stats-skill-col-header">
                  <Check size={14} />
                  <span>Verified Profile Matches ({matchedSkills.length})</span>
                </div>
                <div className="pf-stats-skill-tags">
                  {matchedSkills.length > 0 ? (
                    matchedSkills.map((sk, i) => (
                      <span key={i} className="pf-stats-pill is-matched">{sk}</span>
                    ))
                  ) : (
                    <span className="pf-stats-empty-note">No direct keyword overlap recorded.</span>
                  )}
                </div>
              </div>

              {/* Gaps / Employer Desired */}
              <div className="pf-stats-skill-col is-gap-col">
                <div className="pf-stats-skill-col-header">
                  <AlertCircle size={14} />
                  <span>Employer Requested Gaps ({missingSkills.length})</span>
                </div>
                <div className="pf-stats-skill-tags">
                  {missingSkills.length > 0 ? (
                    missingSkills.map((sk, i) => (
                      <span key={i} className="pf-stats-pill is-gap">{sk}</span>
                    ))
                  ) : (
                    <span className="pf-stats-empty-note">No major technical gaps detected!</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Roadmap to 100% Fit */}
          {roadmap.length > 0 && (
            <div className="pf-stats-section">
              <h3 className="pf-stats-section-heading">
                <TrendingUp size={15} /> Roadmap to Bridge the Gap to 100% Fit
              </h3>
              <p className="pf-stats-section-sub">
                Actionable steps to enhance your verified profile so you become an irresistible 100% fit for this role.
              </p>
              <div className="pf-stats-roadmap-list">
                {roadmap.map((stepItem, i) => (
                  <div key={i} className="pf-stats-roadmap-card">
                    <div className="pf-stats-roadmap-num">#{stepItem.step || i + 1}</div>
                    <div className="pf-stats-roadmap-content">
                      {stepItem.category && (
                        <span className="pf-stats-roadmap-cat">{stepItem.category}</span>
                      )}
                      <p>{stepItem.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pf-tailor-modal-footer">
          <button
            type="button"
            className="pf-btn-tailor-cancel"
            onClick={onClose}
          >
            Close
          </button>
          {onOpenStudio && (
            <button
              type="button"
              className="pf-btn-tailor-submit"
              onClick={() => {
                onClose();
                onOpenStudio(resume.id);
              }}
            >
              Open in Studio <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
