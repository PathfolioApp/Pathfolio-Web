import React, { useEffect, useId, useRef } from 'react';
import './JdFitStatsModal.css';
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
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const noteId = useId();
  const tailoredMeta = resume?.extractedData?.tailoredMeta || resume?.analysis?.tailoredMeta;
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen || !tailoredMeta) return;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = focusable(); const first = elements[0]; const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; dialog.removeEventListener('keydown', handleKey); if (opener?.isConnected) opener.focus(); };
  }, [isOpen, resume?.id, Boolean(tailoredMeta)]);
  if (!isOpen || !resume || !tailoredMeta) return null;
  const rawScore = tailoredMeta.matchScore ?? resume.analysis?.score;
  const score = rawScore != null && String(rawScore).trim() !== '' && Number.isFinite(Number(rawScore)) && Number(rawScore) >= 0 && Number(rawScore) <= 100 ? Number(rawScore) : null;
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
    <div className="pf-tailor-modal-overlay pf-jd-insights-overlay" onClick={onClose}>
      <div
        className="pf-tailor-modal-card is-stats-card pf-jd-insights"
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noteId}
      >
        {/* Header */}
        <div className="pf-tailor-modal-header">
          <div className="pf-tailor-modal-header-left">
            <div className="pf-tailor-icon-badge is-indigo">
              <Compass size={20} className="pf-tailor-target-icon" />
            </div>
            <div>
              <span className="pf-jd-insights-eyebrow">Your fit, in focus</span>
              <h2 id={titleId}>JD fit & improvements</h2>
              <div className="pf-stats-meta-row">
                <span><Briefcase size={13} /> {tailoredMeta.jobTitle || 'Target role not specified'}</span>
                <span className="pf-stats-dot">·</span>
                <span><Building2 size={13} /> {tailoredMeta.company || 'Company not specified'}</span>
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
            <div className={`pf-stats-gauge-ring ${score === null ? 'is-unavailable' : getScoreColorClass(score)}`}>
              <svg className="pf-jd-score-dial" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" /><circle className="pf-jd-score-progress" cx="50" cy="50" r="44" pathLength="100" strokeDasharray={`${score ?? 0} 100`} /></svg>
              <span className="pf-stats-gauge-value">{score === null ? 'N/A' : score + '%'}</span>
              <span className="pf-stats-gauge-sub">JD fit</span>
            </div>
            <div className="pf-stats-score-info">
              <div className="pf-stats-rating-tag">
                {score === null ? 'Score not available' : score >= 88 ? 'Strong alignment' : score >= 75 ? 'Moderate alignment' : 'Gaps to explore'}
              </div>
              <p>{tailoredMeta.summary || 'Explore the strengths, skill matches, and areas to develop identified for this job description.'}</p>
            </div>
          </div>

          <p className="pf-jd-score-note" id={noteId}>JD fit reflects the saved assessment for this role. It is separate from document readiness and doesn’t guarantee eligibility or selection.</p>
          {/* Section 1: Matched Strengths */}
          {matchedStrengths.length > 0 && (
            <div className="pf-stats-section">
              <h3 className="pf-stats-section-heading">
                <Award size={15} /> Strengths for this role
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
              <Layers size={15} /> How your skills align
            </h3>
            <div className="pf-stats-skills-split">
              {/* Verified Matches */}
              <div className="pf-stats-skill-col is-matched-col">
                <div className="pf-stats-skill-col-header">
                  <Check size={14} />
                  <span>Matched skills <span className="pf-jd-insight-count">{matchedSkills.length}</span></span>
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
                  <span>Areas to develop <span className="pf-jd-insight-count">{missingSkills.length}</span></span>
                </div>
                <div className="pf-stats-skill-tags">
                  {missingSkills.length > 0 ? (
                    missingSkills.map((sk, i) => (
                      <span key={i} className="pf-stats-pill is-gap">{sk}</span>
                    ))
                  ) : (
                    <span className="pf-stats-empty-note">No skill gaps recorded in this assessment.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Improvement roadmap */}
          {roadmap.length > 0 && (
            <div className="pf-stats-section">
              <h3 className="pf-stats-section-heading">
                <TrendingUp size={15} /> Your improvement roadmap
              </h3>
              <p className="pf-stats-section-sub">
                Use these suggestions to strengthen relevant experience and describe it clearly. Only add skills and achievements you can support.
              </p>
              <ol className="pf-stats-roadmap-list">
                {roadmap.map((stepItem, i) => (
                  <li key={i} className="pf-stats-roadmap-card">
                    <div className="pf-stats-roadmap-num">#{stepItem.step || i + 1}</div>
                    <div className="pf-stats-roadmap-content">
                      {stepItem.category && (
                        <span className="pf-stats-roadmap-cat">{stepItem.category}</span>
                      )}
                      <p>{stepItem.action}</p>
                    </div>
                  </li>
                ))}
              </ol>
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
