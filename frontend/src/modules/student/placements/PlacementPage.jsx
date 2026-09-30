import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, Building2, MapPin, Clock, ExternalLink, Paperclip, Send, 
  Calendar, Wallet, GraduationCap, CheckCircle2, AlertTriangle, 
  BriefcaseBusiness, Sparkles, XCircle, FileText, GitCommit, ShieldCheck, 
  Award, Info, ChevronRight, Check, RefreshCw
} from 'lucide-react';
import { opportunitiesApi } from './opportunitiesApi';
import { Button } from '../../../components/ui/Button';
import { EditedBadge } from '../../../components/ui/EditedBadge';
import { useAuth } from '../../../app/providers/AuthProvider';
import { JobApplyModal } from './JobApplyModal';
import './PlacementPage.css';

const formatISTDate = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
};

const formatISTTime = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
};

const salaryLabel = job => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const currency = job.salaryCurrency || 'INR';
  const format = value => value >= 100000 ? `${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value;
  if (job.salaryMin && job.salaryMax) return `${currency} ${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return `${currency} ${format(job.salaryMin || job.salaryMax)}`;
};

export function PlacementPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const data = await opportunitiesApi.getOpportunities();
      setJobs(data.jobPosts || []);
      // If a job is currently selected, update its reference in state as well
      if (selectedJob) {
        const updated = (data.jobPosts || []).find(j => j.id === selectedJob.id);
        if (updated) setSelectedJob(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCardBadge = job => {
    if (job.hasApplied && job.application) {
      const status = job.application.status;
      if (status === 'selected') {
        return <span className="pf-job-status-badge pf-job-status-badge--selected"><Sparkles size={13} /> Selected</span>;
      }
      if (status === 'interview') {
        return <span className="pf-job-status-badge pf-job-status-badge--interview"><Calendar size={13} /> Interview</span>;
      }
      if (status === 'shortlisted') {
        return <span className="pf-job-status-badge pf-job-status-badge--shortlisted"><CheckCircle2 size={13} /> Shortlisted</span>;
      }
      if (status === 'rejected') {
        return <span className="pf-job-status-badge pf-job-status-badge--rejected"><XCircle size={13} /> Not Selected</span>;
      }
      return <span className="pf-job-status-badge pf-job-status-badge--applied"><CheckCircle2 size={13} /> Applied</span>;
    }
    if (!job.eligibility?.meetsAll) {
      return <span className="pf-job-status-badge pf-job-status-badge--warning"><AlertTriangle size={13} /> Check eligibility</span>;
    }
    return null;
  };

  if (selectedJob) {
    return <JobProfile job={selectedJob} onBack={() => setSelectedJob(null)} onApplied={loadOpportunities} />;
  }

  return (
    <main className="pf-placement-page">
      <header className="pf-placement-header">
        <p className="pf-placement-eyebrow">Placement Portal</p>
        <h1>Opportunities</h1>
        <p className="pf-placement-intro">Explore active job postings from hiring partners and track your application status & eligibility.</p>
      </header>
      
      {error && <div className="pf-admin-error">{error}</div>}
      
      <section className="pf-placement-container">
        <div className="pf-placement-list">
          {loading ? (
            <p className="pf-placement-loading">Loading opportunities…</p>
          ) : jobs.length === 0 ? (
            <div className="pf-placement-empty">
              <BriefcaseBusiness size={22} />
              <h3>No active opportunities right now.</h3>
              <p>Check back soon, new roles from hiring partners appear here the moment they are published.</p>
            </div>
          ) : (
            jobs.map(job => (
              <button key={job.id} className="pf-job-card" onClick={() => setSelectedJob(job)}>
                <div className="pf-job-card-header">
                  <div className="pf-job-card-company">
                    {job.companyLogoUrl ? (
                      <img className="pf-job-company-logo" src={job.companyLogoUrl} alt={`${job.companyName} logo`} />
                    ) : (
                      <div className="pf-job-company-logo" style={{ display: 'grid', placeItems: 'center', background: '#f0f3ee', color: '#9aa79a' }}>
                        <Building2 size={20} />
                      </div>
                    )}
                    <div className="pf-job-card-meta">
                      <strong>{job.companyName}</strong>
                      <EditedBadge createdAt={job.createdAt} updatedAt={job.updatedAt} labels={{ edited: 'Edited', created: 'Posted' }} />
                    </div>
                  </div>
                  {renderCardBadge(job)}
                </div>
                <h2>{job.title}</h2>
                <div className="pf-job-card-facts">
                  <span><MapPin size={14} /> {job.location || 'Flexible'}{job.workMode ? ` · ${job.workMode}` : ''}</span>
                  <span><Clock size={14} /> {job.employmentType || 'Full-time'}</span>
                  {salaryLabel(job) && <span><Wallet size={14} /> {salaryLabel(job)}</span>}
                  {job.applicationDeadline && <span><Calendar size={14} /> Apply by {formatISTDate(job.applicationDeadline)}</span>}
                  {job.eligibility?.minCgpa && <span><GraduationCap size={14} /> CGPA {job.eligibility.minCgpa}+</span>}
                </div>
                <div className="pf-job-card-footer" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(job.requiredSkills || []).slice(0, 4).map(skill => <span key={skill} className="pf-job-skill-chip">{skill}</span>)}
                  </div>
                  <span style={{ color: '#557550', fontWeight: 700 }}>View details &rarr;</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function JobProfile({ job, onBack, onApplied }) {
  const { student } = useAuth();
  const [currentApp, setCurrentApp] = useState(job.application || null);
  const [applied, setApplied] = useState(Boolean(job.hasApplied || job.application));
  const [activeTab, setActiveTab] = useState(job.hasApplied ? 'flow' : 'jd');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(new Date());

  const eligibilityIssues = job.eligibility?.issues || [];
  const deadlinePassed = Boolean(job.deadlinePassed);
  const appStatus = currentApp?.status || (applied ? 'applied' : null);

  useEffect(() => {
    if (job?.application) {
      setCurrentApp(job.application);
      setApplied(true);
    }
  }, [job]);

  const handleSyncStatus = async () => {
    setIsSyncing(true);
    try {
      const data = await opportunitiesApi.getOpportunities();
      const updated = (data.jobPosts || []).find(j => j.id === job.id);
      if (updated) {
        if (updated.application) {
          setCurrentApp(updated.application);
          setApplied(true);
        }
      }
      setLastSyncedTime(new Date());
      onApplied?.();
    } catch (err) {
      console.error('Failed to sync status from admin portal:', err);
    } finally {
      setTimeout(() => setIsSyncing(false), 450);
    }
  };

  useEffect(() => {
    if (activeTab === 'flow' && applied) {
      handleSyncStatus();
    }
  }, [activeTab]);

  // Academic values from student record
  const studentCgpa = student?.academic?.cgpa !== undefined && student?.academic?.cgpa !== null && student?.academic?.cgpa !== '' ? Number(student.academic.cgpa) : null;
  const studentTenth = student?.academic?.tenthPercentage !== undefined && student?.academic?.tenthPercentage !== null && student?.academic?.tenthPercentage !== '' ? Number(student.academic.tenthPercentage) : null;
  const studentTwelfth = student?.academic?.twelfthPercentage !== undefined && student?.academic?.twelfthPercentage !== null && student?.academic?.twelfthPercentage !== '' ? Number(student.academic.twelfthPercentage) : null;
  const studentBacklogs = student?.academic?.activeBacklogs !== undefined && student?.academic?.activeBacklogs !== null && student?.academic?.activeBacklogs !== '' ? Number(student.academic.activeBacklogs) : 0;
  const studentDept = student?.academic?.department || student?.department || '';
  const studentBatch = student?.academic?.batchYear || student?.academic?.graduationYear || '';

  // Requirement comparisons
  const meetsCgpa = job.eligibility?.minCgpa === null || job.eligibility?.minCgpa === undefined || (studentCgpa !== null && studentCgpa >= job.eligibility.minCgpa);
  const meetsTenth = job.eligibility?.minTenthPercentage === null || job.eligibility?.minTenthPercentage === undefined || (studentTenth !== null && studentTenth >= job.eligibility.minTenthPercentage);
  const meetsTwelfth = job.eligibility?.minTwelfthPercentage === null || job.eligibility?.minTwelfthPercentage === undefined || (studentTwelfth !== null && studentTwelfth >= job.eligibility.minTwelfthPercentage);
  const meetsBacklogs = job.eligibility?.maxActiveBacklogs === null || job.eligibility?.maxActiveBacklogs === undefined || (studentBacklogs <= job.eligibility.maxActiveBacklogs);
  const meetsDept = !job.eligibility?.allowedDepartments || job.eligibility.allowedDepartments.length === 0 || (studentDept && job.eligibility.allowedDepartments.some(d => d.toLowerCase().includes(studentDept.toLowerCase()) || studentDept.toLowerCase().includes(d.toLowerCase())));
  const meetsBatch = !job.eligibility?.allowedBatches || job.eligibility.allowedBatches.length === 0 || (studentBatch && job.eligibility.allowedBatches.includes(String(studentBatch)));

  const handleApplySuccess = (newApp) => {
    setCurrentApp(newApp);
    setApplied(true);
    setActiveTab('flow');
    onApplied?.(newApp);
  };

  return (
    <main className="pf-placement-page">
      <div className="pf-opp-detail-wrapper">
        <button className="pf-placement-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back to opportunities
        </button>

        {/* Hero Header */}
        <section className="pf-opp-hero">
          <div className="pf-opp-hero-top">
            <div className="pf-opp-company-brand">
              {job.companyLogoUrl ? (
                <img src={job.companyLogoUrl} alt={job.companyName} className="pf-opp-company-logo" />
              ) : (
                <div className="pf-opp-company-logo-fallback">
                  {job.companyName?.slice(0, 2).toUpperCase() || 'CO'}
                </div>
              )}
              <div className="pf-opp-title-area">
                <h1>{job.title}</h1>
                <div className="pf-opp-company-meta">
                  <strong>{job.companyName}</strong>
                  <span>·</span>
                  <span>{job.location || 'Location flexible'}{job.workMode ? ` · ${job.workMode}` : ''}</span>
                  <span>·</span>
                  <span>{job.employmentType || 'Full-time'}</span>
                  <span>·</span>
                  <EditedBadge createdAt={job.createdAt} updatedAt={job.updatedAt} labels={{ edited: 'Edited', created: 'Posted' }} />
                </div>
              </div>
            </div>

            <div className="pf-opp-badges-cluster">
              {applied ? (
                appStatus === 'selected' ? (
                  <span className="pf-job-status-badge pf-job-status-badge--selected"><Sparkles size={14} /> Selected / Offered</span>
                ) : appStatus === 'interview' ? (
                  <span className="pf-job-status-badge pf-job-status-badge--interview"><Calendar size={14} /> Interview</span>
                ) : appStatus === 'shortlisted' ? (
                  <span className="pf-job-status-badge pf-job-status-badge--shortlisted"><CheckCircle2 size={14} /> Shortlisted</span>
                ) : appStatus === 'rejected' ? (
                  <span className="pf-job-status-badge pf-job-status-badge--rejected"><XCircle size={14} /> Not Selected</span>
                ) : (
                  <span className="pf-job-status-badge pf-job-status-badge--applied"><Clock size={14} /> Applied & In Review</span>
                )
              ) : eligibilityIssues.length > 0 ? (
                <span className="pf-job-status-badge pf-job-status-badge--warning"><AlertTriangle size={14} /> Criteria Check Needed</span>
              ) : (
                <span className="pf-job-status-badge pf-job-status-badge--eligible"><CheckCircle2 size={14} /> Eligible to Apply</span>
              )}
            </div>
          </div>

          <div className="pf-opp-facts-row">
            {salaryLabel(job) && <span><Wallet size={15} /> <strong>{salaryLabel(job)}</strong></span>}
            <span><MapPin size={15} /> {job.location || 'Flexible'}{job.workMode ? ` (${job.workMode})` : ''}</span>
            <span><Clock size={15} /> {job.employmentType || 'Full-time'}</span>
            {job.applicationDeadline && (
              <span style={deadlinePassed ? { color: '#dc2626', fontWeight: 600 } : {}}>
                <Calendar size={15} /> {deadlinePassed ? `Closed on ${formatISTDate(job.applicationDeadline)}` : `Apply by ${formatISTDate(job.applicationDeadline)}`}
              </span>
            )}
            {job.eligibility?.minCgpa && <span><GraduationCap size={15} /> CGPA {job.eligibility.minCgpa}+</span>}
          </div>
        </section>

        {/* 3 Modern Navigation Tabs */}
        <nav className="pf-opp-tabs-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'jd'}
            className={`pf-opp-tab-btn ${activeTab === 'jd' ? 'active' : ''}`}
            onClick={() => setActiveTab('jd')}
          >
            <FileText size={16} />
            <span>Job Description</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'flow'}
            className={`pf-opp-tab-btn ${activeTab === 'flow' ? 'active' : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            <GitCommit size={16} />
            <span>Hiring Flow</span>
            {applied && (
              <span className={`pf-opp-tab-pill pf-opp-tab-pill--${appStatus || 'applied'}`}>
                {appStatus === 'selected' ? 'Selected' : appStatus === 'interview' ? 'Interview' : appStatus === 'shortlisted' ? 'Shortlisted' : appStatus === 'rejected' ? 'Concluded' : 'Applied'}
              </span>
            )}
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'eligibility'}
            className={`pf-opp-tab-btn ${activeTab === 'eligibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('eligibility')}
          >
            <GraduationCap size={16} />
            <span>Eligibility & Apply</span>
            {applied ? (
              <span className="pf-opp-tab-pill">Applied</span>
            ) : eligibilityIssues.length === 0 ? (
              <span className="pf-opp-tab-pill" style={{ color: '#047857', background: '#ecfdf5' }}>Eligible</span>
            ) : (
              <span className="pf-opp-tab-pill" style={{ color: '#b45309', background: '#fef3c7' }}>{eligibilityIssues.length} alerts</span>
            )}
          </button>
        </nav>

        {/* Tab 1: Job Description */}
        {activeTab === 'jd' && (
          <section className="pf-opp-tab-panel pf-jd-grid">
            <div className="pf-jd-main-card">
              <h3 className="pf-jd-section-title">
                <FileText size={18} /> Role Overview & Responsibilities
              </h3>
              <div className="pf-jd-body">
                {job.description}
              </div>

              {job.attachments && job.attachments.length > 0 && (
                <div className="pf-job-attachments">
                  <h3>Official Documents & Attachments</h3>
                  <div className="pf-job-attach-list">
                    {job.attachments.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer" className="pf-job-attach-link">
                        {att.type === 'link' ? <ExternalLink size={16} /> : <Paperclip size={16} />}
                        {att.name || 'Attachment'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pf-jd-side-column">
              <div className="pf-jd-side-card">
                <h4>Role Specifications</h4>
                <div className="pf-jd-info-list">
                  <div className="pf-jd-info-item">
                    <Wallet size={16} />
                    <div>
                      <strong>Compensation</strong>
                      <span>{salaryLabel(job) || 'Competitive / As per industry standards'}</span>
                    </div>
                  </div>
                  <div className="pf-jd-info-item">
                    <Building2 size={16} />
                    <div>
                      <strong>Work Mode</strong>
                      <span>{job.workMode || 'On-site'}</span>
                    </div>
                  </div>
                  <div className="pf-jd-info-item">
                    <Clock size={16} />
                    <div>
                      <strong>Employment Type</strong>
                      <span>{job.employmentType || 'Full-time'}</span>
                    </div>
                  </div>
                  <div className="pf-jd-info-item">
                    <Calendar size={16} />
                    <div>
                      <strong>Application Deadline</strong>
                      <span>{job.applicationDeadline ? formatISTDate(job.applicationDeadline) : 'Rolling hiring'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {(job.requiredSkills || []).length > 0 && (
                <div className="pf-jd-side-card">
                  <h4>Required Skills</h4>
                  <div className="pf-job-skills">
                    {job.requiredSkills.map(skill => (
                      <span key={skill} className="pf-job-skill-chip">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pf-jd-side-card" style={{ background: '#fcfdfa', border: '1.5px solid #dbe5d8' }}>
                <h4>Next Step</h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#4a5e51', lineHeight: 1.5 }}>
                  {applied 
                    ? 'You have already applied for this role. Check your real-time recruitment progression.' 
                    : 'Check your academic eligibility status and submit your credentials.'}
                </p>
                {applied ? (
                  <Button variant="primary" size="sm" onClick={() => setActiveTab('flow')}>
                    Track Hiring Flow &rarr;
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => setActiveTab('eligibility')}>
                    Check Eligibility & Apply &rarr;
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Hiring Flow */}
        {activeTab === 'flow' && (
          <section className="pf-opp-tab-panel pf-min-flow-container">
            {applied ? (
              <>
                {/* Minimal Status & Admin Sync Card */}
                <div className="pf-min-status-card">
                  <div className="pf-min-status-top">
                    <div className="pf-min-sync-indicator">
                      <span className={`pf-min-sync-dot ${isSyncing ? 'is-syncing' : ''}`} />
                      <span>Admin Portal: <strong>Live Synced</strong></span>
                      {lastSyncedTime && (
                        <span style={{ color: '#94a3b8' }}>· {formatISTTime(lastSyncedTime)} IST</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`pf-min-refresh-btn ${isSyncing ? 'is-spinning' : ''}`}
                      onClick={handleSyncStatus}
                      disabled={isSyncing}
                      title="Fetch latest updates directly from the admin portal"
                    >
                      <RefreshCw size={13} />
                      <span>{isSyncing ? 'Checking Portal...' : 'Sync Status'}</span>
                    </button>
                  </div>

                  <div className="pf-min-status-message">
                    {appStatus === 'selected' && (
                      <>
                        <h3><Sparkles size={20} style={{ color: '#16a34a' }} /> Selected for Offer</h3>
                        <p>
                          Congratulations! You have been selected for this position by {job.companyName}. The university placement cell will coordinate official onboarding and formal offer roll-out.
                        </p>
                      </>
                    )}
                    {appStatus === 'rejected' && (
                      <>
                        <h3><XCircle size={20} style={{ color: '#dc2626' }} /> Application Concluded</h3>
                        <p>
                          Thank you for participating in this drive. The recruitment process for this position has concluded and you were not selected. Your profile remains active for all other campus opportunities.
                        </p>
                      </>
                    )}
                    {appStatus === 'interview' && (
                      <>
                        <h3><Calendar size={20} style={{ color: '#2563eb' }} /> Interview Round Active</h3>
                        <p>
                          You have cleared shortlisting and are currently in the interview round. Please check your registered email and notifications for scheduled slots and assessment links.
                        </p>
                      </>
                    )}
                    {appStatus === 'shortlisted' && (
                      <>
                        <h3><CheckCircle2 size={20} style={{ color: '#16a34a' }} /> Shortlisted by Recruiter</h3>
                        <p>
                          Great news! Your profile and credentials cleared initial screening. You have been shortlisted for upcoming interview evaluation rounds.
                        </p>
                      </>
                    )}
                    {appStatus === 'applied' && (
                      <>
                        <h3><Clock size={20} style={{ color: '#64748b' }} /> Application Under Review</h3>
                        <p>
                          Your application and resume have been submitted to the placement coordinators. The recruitment team is actively screening candidate profiles.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Minimal 4-Stage Stepper: Applied -> Shortlisted -> Interview -> Selected / Rejected */}
                <div className="pf-min-pipeline-card">
                  <div className="pf-min-pipeline-header">
                    <span>Recruitment Stages</span>
                  </div>

                  <div className="pf-min-pipeline-steps">
                    {/* Stage 1: Applied */}
                    <div className="pf-min-step is-done">
                      <div className="pf-min-step-node">
                        <Check size={15} />
                      </div>
                      <div className="pf-min-step-info">
                        <span className="pf-min-step-title">Applied</span>
                        <span className="pf-min-step-status">Submitted</span>
                        <span className="pf-min-step-sub">
                          {formatISTDate(currentApp?.createdAt || job.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Stage 2: Shortlisted */}
                    <div className={`pf-min-step ${
                      ['shortlisted', 'interview', 'selected'].includes(appStatus)
                        ? 'is-done'
                        : appStatus === 'rejected'
                          ? 'is-rejected'
                          : 'is-active'
                    }`}>
                      <div className="pf-min-step-node">
                        {['shortlisted', 'interview', 'selected'].includes(appStatus) ? (
                          <Check size={15} />
                        ) : appStatus === 'rejected' ? (
                          <XCircle size={15} />
                        ) : (
                          <Clock size={15} />
                        )}
                      </div>
                      <div className="pf-min-step-info">
                        <span className="pf-min-step-title">Shortlisted</span>
                        <span className="pf-min-step-status">
                          {['shortlisted', 'interview', 'selected'].includes(appStatus)
                            ? 'Shortlisted'
                            : appStatus === 'rejected'
                              ? 'Not Shortlisted'
                              : 'In Review'}
                        </span>
                        <span className="pf-min-step-sub">
                          {['shortlisted', 'interview', 'selected'].includes(appStatus)
                            ? 'Screening cleared'
                            : appStatus === 'rejected'
                              ? 'Review concluded'
                              : 'Placement cell screening'}
                        </span>
                      </div>
                    </div>

                    {/* Stage 3: Interview */}
                    <div className={`pf-min-step ${
                      appStatus === 'selected'
                        ? 'is-done'
                        : appStatus === 'interview'
                          ? 'is-active'
                          : appStatus === 'rejected'
                            ? 'is-rejected'
                            : appStatus === 'shortlisted'
                              ? 'is-active'
                              : ''
                    }`}>
                      <div className="pf-min-step-node">
                        {appStatus === 'selected' ? (
                          <Check size={15} />
                        ) : appStatus === 'interview' ? (
                          <Calendar size={15} />
                        ) : appStatus === 'rejected' ? (
                          <XCircle size={15} />
                        ) : (
                          <span>3</span>
                        )}
                      </div>
                      <div className="pf-min-step-info">
                        <span className="pf-min-step-title">Interview</span>
                        <span className="pf-min-step-status">
                          {appStatus === 'selected'
                            ? 'Completed'
                            : appStatus === 'interview'
                              ? 'In Progress'
                              : appStatus === 'shortlisted'
                                ? 'Scheduled Soon'
                                : appStatus === 'rejected'
                                  ? 'Concluded'
                                  : 'Pending'}
                        </span>
                        <span className="pf-min-step-sub">
                          {appStatus === 'selected'
                            ? 'Rounds cleared'
                            : appStatus === 'interview'
                              ? 'Rounds underway'
                              : appStatus === 'shortlisted'
                                ? 'Awaiting slot release'
                                : appStatus === 'rejected'
                                  ? 'Process ended'
                                  : 'Upcoming evaluation'}
                        </span>
                      </div>
                    </div>

                    {/* Stage 4: Selected / Rejected */}
                    <div className={`pf-min-step ${
                      appStatus === 'selected'
                        ? 'is-done'
                        : appStatus === 'rejected'
                          ? 'is-rejected'
                          : ''
                    }`}>
                      <div className="pf-min-step-node">
                        {appStatus === 'selected' ? (
                          <Sparkles size={15} />
                        ) : appStatus === 'rejected' ? (
                          <XCircle size={15} />
                        ) : (
                          <span>4</span>
                        )}
                      </div>
                      <div className="pf-min-step-info">
                        <span className="pf-min-step-title">
                          {appStatus === 'selected' ? 'Selected' : appStatus === 'rejected' ? 'Rejected' : 'Selected / Rejected'}
                        </span>
                        <span className="pf-min-step-status">
                          {appStatus === 'selected'
                            ? 'Selected & Offered'
                            : appStatus === 'rejected'
                              ? 'Not Selected'
                              : 'Decision Pending'}
                        </span>
                        <span className="pf-min-step-sub">
                          {appStatus === 'selected'
                            ? 'Offer confirmed'
                            : appStatus === 'rejected'
                              ? 'Selection closed'
                              : 'Final stage decision'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Minimal Application Record */}
                <div className="pf-flow-submission-card">
                  <h4>Application Record</h4>
                  <div className="pf-flow-submission-grid">
                    <div className="pf-flow-sub-item">
                      <span className="pf-flow-sub-label">Application Status</span>
                      <span className="pf-flow-sub-val" style={{ textTransform: 'capitalize' }}>
                        {appStatus === 'selected' ? 'Selected' : appStatus === 'interview' ? 'Interview' : appStatus === 'shortlisted' ? 'Shortlisted' : appStatus === 'rejected' ? 'Rejected' : 'Applied'}
                      </span>
                    </div>
                    <div className="pf-flow-sub-item">
                      <span className="pf-flow-sub-label">Applied On</span>
                      <span className="pf-flow-sub-val">
                        {formatISTDate(currentApp?.createdAt || job.createdAt)} IST
                      </span>
                    </div>
                    <div className="pf-flow-sub-item">
                      <span className="pf-flow-sub-label">Selected Resume</span>
                      <span className="pf-flow-sub-val">
                        {currentApp?.selectedResume?.filename || 'Primary Resume'}
                      </span>
                    </div>
                    <div className="pf-flow-sub-item">
                      <span className="pf-flow-sub-label">Target Role</span>
                      <span className="pf-flow-sub-val">{job.title}</span>
                    </div>
                  </div>

                  {currentApp?.internalNote && (
                    <div className="pf-min-flow-note">
                      <Info size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong>Placement Cell Note</strong>
                        <p>{currentApp.internalNote}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="pf-flow-not-applied-card">
                <GitCommit size={38} color="#557550" />
                <h3>You Haven't Applied Yet</h3>
                <p>
                  Once you apply, this tab turns into your real-time recruitment tracker showing whether your profile is in review, shortlisted, or selected.
                </p>
                <Button variant="primary" onClick={() => setActiveTab('eligibility')}>
                  Check Eligibility & Apply Now &rarr;
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Eligibility & Apply */}
        {activeTab === 'eligibility' && (
          <section className="pf-opp-tab-panel pf-elig-container">
            <div className="pf-elig-scorecard">
              <h3>Academic Eligibility Evaluation</h3>
              <p className="pf-elig-subtitle">
                Pathfolio validates your live university academic record against the criteria set by {job.companyName}.
              </p>

              <div className="pf-elig-grid">
                {/* CGPA */}
                <div className={`pf-elig-cell ${meetsCgpa ? 'is-met' : 'is-unmet'}`}>
                  <div className="pf-elig-cell-icon">
                    {meetsCgpa ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="pf-elig-cell-info">
                    <span className="pf-elig-cell-label">CGPA Benchmark</span>
                    <span className="pf-elig-cell-req">
                      {job.eligibility?.minCgpa ? `${job.eligibility.minCgpa} Minimum` : 'No CGPA Cutoff'}
                    </span>
                    <span className="pf-elig-cell-actual">
                      Your CGPA: <strong>{studentCgpa !== null ? studentCgpa : 'Not recorded'}</strong>
                    </span>
                  </div>
                </div>

                {/* 10th % */}
                <div className={`pf-elig-cell ${meetsTenth ? 'is-met' : 'is-unmet'}`}>
                  <div className="pf-elig-cell-icon">
                    {meetsTenth ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="pf-elig-cell-info">
                    <span className="pf-elig-cell-label">Class 10th Score</span>
                    <span className="pf-elig-cell-req">
                      {job.eligibility?.minTenthPercentage ? `${job.eligibility.minTenthPercentage}% Minimum` : 'No Cutoff'}
                    </span>
                    <span className="pf-elig-cell-actual">
                      Your Score: <strong>{studentTenth !== null ? `${studentTenth}%` : 'Not recorded'}</strong>
                    </span>
                  </div>
                </div>

                {/* 12th % */}
                <div className={`pf-elig-cell ${meetsTwelfth ? 'is-met' : 'is-unmet'}`}>
                  <div className="pf-elig-cell-icon">
                    {meetsTwelfth ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="pf-elig-cell-info">
                    <span className="pf-elig-cell-label">Class 12th / Diploma</span>
                    <span className="pf-elig-cell-req">
                      {job.eligibility?.minTwelfthPercentage ? `${job.eligibility.minTwelfthPercentage}% Minimum` : 'No Cutoff'}
                    </span>
                    <span className="pf-elig-cell-actual">
                      Your Score: <strong>{studentTwelfth !== null ? `${studentTwelfth}%` : 'Not recorded'}</strong>
                    </span>
                  </div>
                </div>

                {/* Active Backlogs */}
                <div className={`pf-elig-cell ${meetsBacklogs ? 'is-met' : 'is-unmet'}`}>
                  <div className="pf-elig-cell-icon">
                    {meetsBacklogs ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="pf-elig-cell-info">
                    <span className="pf-elig-cell-label">Active Backlogs</span>
                    <span className="pf-elig-cell-req">
                      {job.eligibility?.maxActiveBacklogs !== null && job.eligibility?.maxActiveBacklogs !== undefined 
                        ? `Max ${job.eligibility.maxActiveBacklogs} Allowed` 
                        : 'No Backlog Limit'}
                    </span>
                    <span className="pf-elig-cell-actual">
                      Active: <strong>{studentBacklogs}</strong>
                    </span>
                  </div>
                </div>

                {/* Department / Branch */}
                <div className={`pf-elig-cell ${meetsDept ? 'is-met' : 'is-unmet'}`}>
                  <div className="pf-elig-cell-icon">
                    {meetsDept ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="pf-elig-cell-info">
                    <span className="pf-elig-cell-label">Eligible Branches</span>
                    <span className="pf-elig-cell-req">
                      {(job.eligibility?.allowedDepartments || []).length > 0 
                        ? job.eligibility.allowedDepartments.join(', ') 
                        : 'All Disciplines'}
                    </span>
                    <span className="pf-elig-cell-actual">
                      Your Branch: <strong>{studentDept || 'Not recorded'}</strong>
                    </span>
                  </div>
                </div>

                {/* Batch */}
                <div className={`pf-elig-cell ${meetsBatch ? 'is-met' : 'is-unmet'}`}>
                  <div className="pf-elig-cell-icon">
                    {meetsBatch ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="pf-elig-cell-info">
                    <span className="pf-elig-cell-label">Eligible Batches</span>
                    <span className="pf-elig-cell-req">
                      {(job.eligibility?.allowedBatches || []).length > 0 
                        ? job.eligibility.allowedBatches.join(', ') 
                        : 'All Batches'}
                    </span>
                    <span className="pf-elig-cell-actual">
                      Your Batch: <strong>{studentBatch || 'Not recorded'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {eligibilityIssues.length > 0 && (
                <div className="pf-job-eligibility">
                  <AlertTriangle size={16} />
                  <div>
                    <b>Criteria you don't currently meet:</b>
                    <ul>
                      {eligibilityIssues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Application Action Card */}
            <div className="pf-elig-action-card">
              <div className="pf-elig-action-content">
                {applied ? (
                  <>
                    <h4 style={{ color: '#15803d' }}>Application Already Submitted</h4>
                    <p>
                      You submitted your application on {formatISTDate(currentApp?.createdAt || job.createdAt)} IST. Current recruitment status: <strong>{appStatus}</strong>.
                    </p>
                  </>
                ) : deadlinePassed ? (
                  <>
                    <h4 style={{ color: '#b45309' }}>Applications Closed</h4>
                    <p>
                      The application deadline for this role passed on {formatISTDate(job.applicationDeadline)}. No further submissions are accepted.
                    </p>
                  </>
                ) : eligibilityIssues.length > 0 ? (
                  <>
                    <h4 style={{ color: '#b91c1c' }}>Eligibility Criteria Not Satisfied</h4>
                    <p>
                      You do not meet one or more academic cutoffs set for this position. If your records are incomplete, update your profile academic settings.
                    </p>
                  </>
                ) : (
                  <>
                    <h4>Ready to Apply</h4>
                    <p>
                      You meet all academic criteria for this role. Submit your verified profile snapshot with 1-click application.
                    </p>
                  </>
                )}
              </div>

              <div className="pf-elig-action-btn">
                {applied ? (
                  <Button variant="primary" onClick={() => setActiveTab('flow')}>
                    Track Hiring Flow &rarr;
                  </Button>
                ) : deadlinePassed ? (
                  <Button variant="outline" disabled>
                    Applications Closed
                  </Button>
                ) : job.applicationUrl && job.applicationUrl.trim() !== '' ? (
                  <Button
                    type="button"
                    variant="primary"
                    icon={ExternalLink}
                    onClick={() => window.open(job.applicationUrl, '_blank')}
                  >
                    Apply on Company Site
                  </Button>
                ) : eligibilityIssues.length > 0 ? (
                  <Button variant="outline" disabled icon={AlertTriangle}>
                    Ineligible to Apply
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    icon={Send}
                    onClick={() => setIsApplyModalOpen(true)}
                  >
                    Apply Now (1-Click)
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <JobApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        job={job}
        onApplied={handleApplySuccess}
      />
    </main>
  );
}
