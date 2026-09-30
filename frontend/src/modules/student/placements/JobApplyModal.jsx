import React, { useState, useEffect } from 'react';
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

export function JobApplyModal({ isOpen, onClose, job, onApplied }) {
  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessData(null);
      loadResumes();
    }
  }, [isOpen]);

  const loadResumes = async () => {
    setLoadingResumes(true);
    try {
      const data = await resumeApi.list();
      const list = Array.isArray(data) ? data : (data.resumes || []);
      setResumes(list);

      // Pre-select default resume or first available
      const def = list.find(r => r.isDefault) || list[0];
      if (def) {
        setSelectedResumeId(def.id);
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
      setError('Could not load your saved resumes.');
    } finally {
      setLoadingResumes(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!selectedResumeId) {
      setError('Please select a resume to attach to this application.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await opportunitiesApi.apply(job.id, {
        resumeId: selectedResumeId
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
      setIsSubmitting(false);
    }
  };

  if (!job) return null;

  const eligibilityIssues = job.eligibility?.issues || [];
  const isEligible = eligibilityIssues.length === 0;

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
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
      onClose={isSubmitting ? undefined : onClose}
      title={successData ? 'Application Confirmed' : 'Apply for Opportunity'}
      maxWidth="580px"
      footer={
        successData ? (
          <Button variant="primary" onClick={onClose}>
            Done
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
              disabled={isSubmitting || !isEligible || !selectedResumeId || resumes.length === 0}
              onClick={handleConfirmApply}
            >
              Submit Application
            </Button>
          </>
        )
      }
    >
      <div className="pf-apply-modal-content">
        {/* Success View */}
        {successData ? (
          <div className="pf-apply-success-view">
            <div className="pf-apply-success-icon-wrap">
              <CheckCircle2 size={32} />
            </div>
            <h3>Application Submitted!</h3>
            <p>
              Your application has been delivered to <strong>{job.companyName}</strong> for the position of <strong>{job.title}</strong>.
            </p>
            {successData.resume && (
              <div className="pf-apply-success-details">
                <FileText size={16} />
                <span>Attached: <strong>{successData.resume.filename}</strong></span>
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: '#688270', marginTop: '4px' }}>
              A frozen snapshot of your profile credentials was securely recorded.
            </p>
          </div>
        ) : (
          <>
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
                    You do not meet the criteria for this role:
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
              <div className="pf-apply-eligibility-warning" style={{ background: '#fdf2f2' }}>
                <AlertTriangle size={18} className="pf-apply-eligibility-warning__icon" />
                <div className="pf-apply-eligibility-warning__body">
                  {error}
                </div>
              </div>
            )}

            {/* Select Resume Section */}
            <div>
              <div className="pf-apply-section-title">
                <span>Select Resume to Attach</span>
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
                        onClick={() => setSelectedResumeId(resume.id)}
                      >
                        <input
                          type="radio"
                          name="selectedResume"
                          className="pf-resume-radio-card__radio"
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

            {/* Profile Snapshot Guarantee Callout */}
            <div className="pf-apply-snapshot-banner">
              <ShieldCheck size={18} className="pf-apply-snapshot-banner__icon" />
              <div className="pf-apply-snapshot-banner__text">
                <strong>Immutable Profile Snapshot:</strong> Your verified academic performance, contact info, social links, and top projects will be frozen and securely attached to this application.
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
      </div>
    </Modal>
  );
}
