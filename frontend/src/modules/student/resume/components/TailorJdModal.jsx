import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Target, 
  Briefcase, 
  Building2, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2,
  Check,
  Zap,
  TrendingUp
} from 'lucide-react';
import { resumeApi } from '../resumeApi';

const PROGRESS_STAGES = [
  { step: 1, text: 'Extracting role requirements & technical keywords...' },
  { step: 2, text: 'Aligning verified profile projects & impact metrics...' },
  { step: 3, text: 'Synthesizing tailored ATS bullets & scoring profile fit...' }
];

export default function TailorJdModal({ isOpen, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [tailorResult, setTailorResult] = useState(null);

  // Progressive status timer while waiting for AI
  useEffect(() => {
    let timer;
    if (isSubmitting) {
      timer = setInterval(() => {
        setStageIndex(prev => (prev < PROGRESS_STAGES.length - 1 ? prev + 1 : prev));
      }, 3500);
    } else {
      setStageIndex(0);
    }
    return () => clearInterval(timer);
  }, [isSubmitting]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return; // prevent closing midway
    setError(null);
    setTailorResult(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobDescription || jobDescription.trim().length < 40) {
      setError('Please provide a detailed job description (minimum 40 characters) so the AI can analyze role requirements.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setStageIndex(0);

    try {
      const response = await resumeApi.tailor({
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        jobDescription: jobDescription.trim()
      });

      setTailorResult(response);
      if (onSuccess) onSuccess(response);
    } catch (err) {
      setError(err.message || 'Failed to tailor resume. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStudio = () => {
    if (tailorResult?.id) {
      navigate(`/resume/${tailorResult.id}/studio`);
    }
  };

  return createPortal(
    <div className="pf-tailor-modal-overlay" onClick={handleClose}>
      <div 
        className="pf-tailor-modal-card" 
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-tailor-modal-title"
      >
        {/* Header */}
        <div className="pf-tailor-modal-header">
          <div className="pf-tailor-modal-header-left">
            <div className="pf-tailor-icon-badge">
              <Target size={18} className="pf-tailor-target-icon" />
            </div>
            <div>
              <h2 id="pf-tailor-modal-title">Tailor Resume for Job Description</h2>
              <p>Synthesizes verified profile data directly to match employer requirements.</p>
            </div>
          </div>
          <button 
            type="button" 
            className="pf-tailor-modal-close" 
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div className="pf-tailor-modal-body">
          {error && (
            <div className="pf-tailor-error-banner" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* STATE 1: SUCCESS PREVIEW */}
          {tailorResult ? (
            <div className="pf-tailor-success-view">
              <div className="pf-tailor-success-top">
                <div className="pf-tailor-score-ring">
                  <span className="pf-tailor-score-num">{tailorResult.tailoredMeta?.matchScore || 85}%</span>
                  <span className="pf-tailor-score-label">ATS Fit</span>
                </div>
                <div className="pf-tailor-success-details">
                  <div className="pf-tailor-success-badge">
                    <CheckCircle2 size={13} /> Tailored Resume Created
                  </div>
                  <h3>{tailorResult.tailoredMeta?.jobTitle || 'Role'} @ {tailorResult.tailoredMeta?.company || 'Company'}</h3>
                  <p>{tailorResult.tailoredMeta?.summary || 'Your profile has been tuned to highlight relevant technologies and project accomplishments.'}</p>
                </div>
              </div>

              {/* Matched skills showcase */}
              {tailorResult.tailoredMeta?.matchedSkills?.length > 0 && (
                <div className="pf-tailor-skills-section">
                  <span className="pf-tailor-skills-title">
                    <Check size={13} /> Verified Competencies Matched ({tailorResult.tailoredMeta.matchedSkills.length})
                  </span>
                  <div className="pf-tailor-skill-chips">
                    {tailorResult.tailoredMeta.matchedSkills.slice(0, 8).map((skill, i) => (
                      <span key={i} className="pf-tailor-chip is-matched">{skill}</span>
                    ))}
                    {tailorResult.tailoredMeta.matchedSkills.length > 8 && (
                      <span className="pf-tailor-chip is-more">+{tailorResult.tailoredMeta.matchedSkills.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Missing skills preview */}
              {tailorResult.tailoredMeta?.missingOrWeakSkills?.length > 0 && (
                <div className="pf-tailor-skills-section">
                  <span className="pf-tailor-skills-title is-gap">
                    <TrendingUp size={13} /> Target JD Keywords ({tailorResult.tailoredMeta.missingOrWeakSkills.length})
                  </span>
                  <div className="pf-tailor-skill-chips">
                    {tailorResult.tailoredMeta.missingOrWeakSkills.slice(0, 5).map((skill, i) => (
                      <span key={i} className="pf-tailor-chip is-gap">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pf-tailor-success-actions">
                <button
                  type="button"
                  className="pf-btn-tailor-studio"
                  onClick={handleOpenStudio}
                >
                  Open in Resume Studio <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  className="pf-btn-tailor-secondary"
                  onClick={handleClose}
                >
                  Return to Resumes
                </button>
              </div>
            </div>
          ) : isSubmitting ? (
            /* STATE 2: LOADING PROGRESS */
            <div className="pf-tailor-loading-view">
              <div className="pf-tailor-spinner-box">
                <Loader2 size={32} className="pf-tailor-spin-icon" />
              </div>
              <div className="pf-tailor-loading-text">
                <h3>Tailoring Your Resume...</h3>
                <p>Cross-referencing verified projects & skills against job requirements.</p>
              </div>
              <div className="pf-tailor-progress-steps">
                {PROGRESS_STAGES.map((st, i) => {
                  const isDone = i < stageIndex;
                  const isCurrent = i === stageIndex;
                  return (
                    <div 
                      key={st.step} 
                      className={`pf-tailor-stage-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-active' : ''}`}
                    >
                      <div className="pf-tailor-stage-dot">
                        {isDone ? <Check size={11} /> : <span>{st.step}</span>}
                      </div>
                      <span className="pf-tailor-stage-label">{st.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STATE 3: INPUT FORM - COMPACT & NO SCROLL NEEDED */
            <form onSubmit={handleSubmit} className="pf-tailor-form">
              <div className="pf-tailor-notice-callout">
                <Zap size={14} className="pf-tailor-notice-icon" />
                <span>
                  <strong>Single Source of Truth:</strong> Sourced 100% from verified profile data without hallucination.
                </span>
              </div>

              <div className="pf-tailor-row-inputs">
                <div className="pf-tailor-field">
                  <label htmlFor="pf-tailor-role">
                    <Briefcase size={13} /> Target Job Title
                  </label>
                  <input
                    id="pf-tailor-role"
                    type="text"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    placeholder="e.g. Frontend Engineer"
                    maxLength={100}
                  />
                </div>

                <div className="pf-tailor-field">
                  <label htmlFor="pf-tailor-company">
                    <Building2 size={13} /> Company
                  </label>
                  <input
                    id="pf-tailor-company"
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="e.g. Stripe, Google"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="pf-tailor-field is-last-field">
                <div className="pf-tailor-label-split">
                  <label htmlFor="pf-tailor-jd">
                    <FileText size={13} /> Paste Job Description *
                  </label>
                  <span className={`pf-tailor-char-count ${jobDescription.length >= 40 ? 'is-valid' : ''}`}>
                    {jobDescription.length} chars {jobDescription.length < 40 && '(min. 40)'}
                  </span>
                </div>
                <textarea
                  id="pf-tailor-jd"
                  rows={3}
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste requirements, responsibilities, or role description here..."
                  required
                />
              </div>

              <div className="pf-tailor-modal-footer">
                <button
                  type="button"
                  className="pf-btn-tailor-cancel"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pf-btn-tailor-submit"
                  disabled={!jobDescription.trim() || jobDescription.trim().length < 40}
                >
                  <Target size={14} /> Tailor Resume with AI
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
