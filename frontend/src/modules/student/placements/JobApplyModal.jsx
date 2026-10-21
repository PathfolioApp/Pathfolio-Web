import React, { useState, useEffect, useId, useRef } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  ShieldCheck, 
  Eye, 
  Upload, 
  Send 
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { resumeApi } from '../resume/resumeApi';
import { opportunitiesApi } from './opportunitiesApi';
import './JobApplyModal.css';
import { isClosed } from './placementModel.mjs';

export function JobApplyModal({ isOpen, onClose, job, onApplied }) {
  const formId = useId();
  const formRef = useRef(null);
  const submitLock = useRef(false);
  const successTitleRef = useRef(null);
  const [answers, setAnswers] = useState({});
  const [resumeVersion, setResumeVersion] = useState(0);
  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => { if (isOpen) { setSuccessData(null); setAnswers({}); } }, [isOpen, job?.id]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setError(''); setSelectedResumeId(null); setResumes([]); setLoadingResumes(true);
    resumeApi.list().then(data => {
      if (!alive) return;
      const list = Array.isArray(data) ? data : (data.resumes || []);
      setResumes(list); setSelectedResumeId((list.find(r => r.isDefault) || list[0])?.id || null);
    }).catch(() => { if (alive) setError('Could not load your saved resumes. Please try again.'); })
      .finally(() => { if (alive) setLoadingResumes(false); });
    return () => { alive = false; };
  }, [isOpen, job?.id, resumeVersion]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    const dialog = formRef.current?.closest('[role="dialog"]');
    if (!dialog) return;
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length);
    focusable()[0]?.focus();
    const trapFocus = event => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0]; const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', trapFocus);
    return () => { dialog.removeEventListener('keydown', trapFocus); if (opener?.isConnected) opener.focus(); };
  }, [isOpen]);

  useEffect(() => { if (successData) successTitleRef.current?.focus(); }, [successData]);

  const handleConfirmApply = async () => {
    if (submitLock.current || !formRef.current?.reportValidity()) return;
    if (isClosed(job)) { setError('Applications for this role have closed.'); return; }
    if (!selectedResumeId) {
      setError('Please select a resume to attach to this application.');
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await opportunitiesApi.apply(job.id, {
        resumeId: selectedResumeId,
        answers
      });

      const selectedResumeObj = resumes.find(r => r.id === selectedResumeId);
      setSuccessData({
        application: res.application,
        resume: selectedResumeObj
      });

      if (onApplied) {
        onApplied(res.application);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit application.');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  const eligibilityIssues = job.eligibility?.issues || [];
  const isEligible = eligibilityIssues.length === 0 && !isClosed(job);

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      className="pf-placement-apply-dialog"
      onClose={isSubmitting ? () => {} : onClose}
      title={successData ? 'Application submitted' : 'Make your next move'}
      maxWidth="580px"
      footer={
        successData ? (
          <Button variant="primary" onClick={onClose}>
            View application journey
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Send}
              loading={isSubmitting}
              disabled={isSubmitting || loadingResumes || !isEligible || !selectedResumeId || resumes.length === 0}
              onClick={handleConfirmApply}
            >
              Submit Application
            </Button>
          </>
        )
      }
    >
      <form id={formId} ref={formRef} className="pf-apply-modal-content" onSubmit={e => { e.preventDefault(); handleConfirmApply(); }}>
        {/* Success View */}
        {successData ? (
          <div className="pf-apply-success-view">
            <div className="pf-apply-success-icon-wrap">
              <CheckCircle2 size={32} />
            </div>
            <h3 ref={successTitleRef} tabIndex={-1}>You’ve taken the next step.</h3>
            <p>
              Your application for <strong>{job.title}</strong> at <strong>{job.companyName}</strong> is saved. Follow its progress in your application journey.
            </p>
            {successData.resume && (
              <div className="pf-apply-success-details">
                <FileText size={16} />
                <span>Attached: <strong>{successData.resume.filename}</strong></span>
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: '#688270', marginTop: '4px' }}>
              A copy of the profile details you submitted is saved with this application.
            </p>
          </div>
        ) : (
          <>
            <ol className="pf-apply-checklist" aria-label="Before you submit"><li className={selectedResumeId ? 'is-complete' : ''}><span>{selectedResumeId ? <CheckCircle2 size={13} /> : '1'}</span>Choose a resume</li>{job.applicationForm?.fields?.length > 0 && <li><span>2</span>Answer questions</li>}<li><span>{job.applicationForm?.fields?.length > 0 ? '3' : '2'}</span>Review & submit</li></ol>
            {/* Job Summary Bar */}
            <div className="pf-apply-job-header">
              <div className="pf-apply-job-header__info">
                <span className="pf-apply-job-header__company">{job.companyName}</span>
                <span className="pf-apply-job-header__title">{job.title}</span>
              </div>
              <span className="pf-apply-job-header__badge">
                {job.employmentType || 'Full-time'}
              </span>
            </div>

            {/* Ineligibility Warning */}
            {!isEligible && (
              <div className="pf-apply-eligibility-warning">
                <AlertTriangle size={18} className="pf-apply-eligibility-warning__icon" />
                <div className="pf-apply-eligibility-warning__body">
                  <div className="pf-apply-eligibility-warning__title">
                    {isClosed(job) ? 'Applications for this role have closed.' : 'Review your eligibility before applying:'}
                  </div>
                  <ul>
                    {eligibilityIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div role="alert" className="pf-apply-eligibility-warning" style={{ background: '#fdf2f2' }}>
                <AlertTriangle size={18} className="pf-apply-eligibility-warning__icon" />
                <div className="pf-apply-eligibility-warning__body">
                  {error}
                </div>
              </div>
            )}

            {/* Select Resume Section */}
            <div>
              <div className="pf-apply-section-title">
                <span>Choose the resume you want to share</span>
                <a
                  href="/resume"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-resume-radio-card__preview-btn"
                  style={{ border: 'none', padding: 0 }}
                >
                  Manage Resumes <ExternalLink size={12} />
                </a>
              </div>

              {loadingResumes ? (
                <p style={{ fontSize: '0.85rem', color: '#55695b', padding: '16px 0' }}>
                  Loading your resumes...
                </p>
              ) : resumes.length === 0 ? (
                <div className="pf-apply-no-resume">
                  <FileText size={32} style={{ color: '#8fa896' }} />
                  <p>No resumes uploaded yet</p>
                  <span>You need at least one PDF resume uploaded to your Pathfolio account before applying.</span>
                  <a
                    href="/resume"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-resume-radio-card__preview-btn"
                    style={{ marginTop: '8px' }}
                  >
                    <Upload size={13} /> Upload a resume now
                  </a>
                </div>
              ) : (
                <div className="pf-apply-resume-list" style={{ marginTop: '10px' }}>
                  {resumes.map(resume => {
                    const isSelected = selectedResumeId === resume.id;
                    const previewUrl = `/api/resumes/${resume.id}/file`;

                    return (
                      <div
                        key={resume.id}
                        className={`pf-resume-radio-card ${isSelected ? 'pf-resume-radio-card--selected' : ''}`}
                        onClick={() => { if (!isSubmitting) setSelectedResumeId(resume.id); }}
                      >
                        <input
                          type="radio"
                          name="selectedResume"
                          className="pf-resume-radio-card__radio"
                          aria-label={resume.filename || "Select resume"}
                          disabled={isSubmitting}
                          checked={isSelected}
                          onChange={() => setSelectedResumeId(resume.id)}
                        />

                        <div className="pf-resume-radio-card__icon">
                          <FileText size={18} />
                        </div>

                        <div className="pf-resume-radio-card__details">
                          <div className="pf-resume-radio-card__name-row">
                            <span className="pf-resume-radio-card__name" title={resume.filename}>
                              {resume.filename}
                            </span>
                            {resume.isDefault && (
                              <span className="pf-resume-radio-card__default-badge">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="pf-resume-radio-card__meta">
                            Uploaded {formatDate(resume.uploadedAt)}
                          </span>
                        </div>

                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pf-resume-radio-card__preview-btn"
                          onClick={e => e.stopPropagation()}
                          title="Open PDF preview in new tab"
                        >
                          <Eye size={13} /> Preview
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button variant="outline" icon={Upload} disabled={loadingResumes} onClick={() => setResumeVersion(v => v + 1)}>Reload resumes</Button>
            {(job.applicationForm?.fields || []).length > 0 && <fieldset className="pf-placement-questions" disabled={isSubmitting}>
              <legend>Questions from the employer</legend>
              {(job.applicationForm.fields || []).map((field, index) => {
                const id = formId + '-question-' + index;
                const props = { id, name: field.id, required: field.required, maxLength: 10000, value: answers[field.id] || '', onChange: e => setAnswers(previous => ({ ...previous, [field.id]: e.target.value })) };
                return <label key={field.id} htmlFor={id}>{field.label} <span>{field.required ? '(required)' : '(optional)'}</span>
                  {field.type === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={field.type === 'url' ? 'url' : 'text'} />}
                </label>;
              })}
            </fieldset>}
            {/* Profile details shared with the employer */}
            <div className="pf-apply-snapshot-banner">
              <ShieldCheck size={18} className="pf-apply-snapshot-banner__icon" />
              <div className="pf-apply-snapshot-banner__text">
                <strong>What you share:</strong> A copy of your current academic details, contact information, social links, and projects is attached to this application. Review your profile before submitting.
                <a
                  href="/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-apply-snapshot-banner__link"
                >
                  Review your profile <ExternalLink size={11} style={{ display: 'inline' }} />
                </a>
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
