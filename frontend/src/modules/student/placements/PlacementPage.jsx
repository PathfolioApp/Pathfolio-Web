import { useSearchParams } from 'react-router-dom';
import { ApplicationJourney, placementDate } from './ApplicationJourney';
import { PlacementOverview } from './PlacementOverview';
import { PlacementBrowse } from './PlacementBrowse';
import { opportunityState, isClosed, academicComparisons, applicationLabels, compensationLabel } from './placementModel.mjs';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Info, ArrowLeft, MapPin, Clock, ExternalLink, Send, Calendar, Wallet, GraduationCap, CheckCircle2, AlertTriangle, FileText, GitCommit, RefreshCw } from 'lucide-react';
import { opportunitiesApi } from './opportunitiesApi';
import { Button } from '../../../components/ui/Button';
import { EditedBadge } from '../../../components/ui/EditedBadge';
import { useAuth } from '../../../app/providers/AuthProvider';
import { JobApplyModal } from './JobApplyModal';
import './PlacementPage.css';
import './PlacementExperience.css';
import './PlacementViews.css';
import './PlacementResponsive.css';


const formatISTDate = dateString => {
  if (!dateString || !Number.isFinite(new Date(dateString).getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
};

const formatISTTime = dateString => {
  if (!dateString || !Number.isFinite(new Date(dateString).getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
};

export function PlacementPage() {
  const { student } = useAuth();
  const loadVersion = useRef(0);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const selectedJob = jobs.find(job => job.id === params.get('job')) || null;
  const selectJob = job => setParams(previous => { const next = new URLSearchParams(previous); if (job) { next.set('job', job.id); next.set('tab', 'jd'); } else { next.delete('job'); next.delete('tab'); } return next; });

  const loadOpportunities = useCallback(async (loadedData = null) => {
    const version = ++loadVersion.current;
    setLoading(true); setError('');
    try {
      const data = Array.isArray(loadedData?.jobPosts) ? loadedData : await opportunitiesApi.getOpportunities(student.id);
      if (loadVersion.current !== version) return;
      setJobs(data.jobPosts || []);
    } catch (err) {
      if (loadVersion.current === version) setError(err.message);
    } finally {
      if (loadVersion.current === version) setLoading(false);
    }
  }, [student.id]);

  useEffect(() => {
    setJobs([]);
    loadOpportunities();
    return () => { loadVersion.current++; };
  }, [loadOpportunities]);

  if (selectedJob) {
    return <JobProfile key={selectedJob.id} job={selectedJob} onBack={() => selectJob(null)} onApplied={loadOpportunities} params={params} setParams={setParams} />;
  }
  return <PlacementBrowse student={student} jobs={jobs} loading={loading} error={error}
    onRefresh={loadOpportunities} onSelect={selectJob} params={params} setParams={setParams} />;
}

function JobProfile({ job, onBack, onApplied, params, setParams }) {
  const { student } = useAuth();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [job.id]);
  const [currentApp, setCurrentApp] = useState(job.application || null);
  const [applied, setApplied] = useState(Boolean(job.hasApplied || job.application));
  const activeTab = ['jd', 'flow', 'eligibility'].includes(params.get('tab')) ? params.get('tab') : 'jd';
  const setActiveTab = tab => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', tab); return next; });
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const journeyTitleRef = useRef(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(new Date());

  useEffect(() => { if (!isApplyModalOpen && applied && activeTab === 'flow') journeyTitleRef.current?.focus(); }, [isApplyModalOpen, activeTab, applied]);

  const [syncError, setSyncError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);
  const eligibilityIssues = job.eligibility?.issues || [];
  const deadlinePassed = isClosed(job, now);
  const state = opportunityState({ ...job, hasApplied: applied, application: currentApp }, student, now);
  const appStatus = currentApp?.status || (applied ? 'applied' : null);

  useEffect(() => {
    if (job?.application) {
      setCurrentApp(job.application);
      setApplied(true);
    }
  }, [job]);

  const handleSyncStatus = useCallback(async () => {
    setIsSyncing(true); setSyncError('');
    try {
      const data = await opportunitiesApi.getOpportunities(student.id);
      const updated = (data.jobPosts || []).find(j => j.id === job.id);
      if (updated) {
        if (updated.application) {
          setCurrentApp(updated.application);
          setApplied(true);
        }
      }
      setLastSyncedTime(new Date());
      onApplied?.(data);
    } catch (err) {
      setSyncError(err.message || 'Could not refresh your status. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [student.id, job.id, onApplied]);

  useEffect(() => {
    if (activeTab === 'flow' && applied) {
      handleSyncStatus();
    }
  }, [activeTab, applied, handleSyncStatus]);

  const comparisons = academicComparisons(student, job.eligibility);

  const handleApplySuccess = (newApp) => {
    setCurrentApp(newApp);
    setApplied(true);
    setActiveTab('flow');
    onApplied?.(newApp);
  };

  return (
    <main className="pf-placement-page pf-placement-detail">
      <div className="pf-opp-detail-wrapper">
        <button className="pf-placement-back" onClick={onBack}>
          <ArrowLeft size={16} /> {params.get('view') === 'applications' ? 'Back to my applications' : 'Back to opportunities'}
        </button>

        {syncError && <p role="alert" className="pf-placement-notice">{syncError}</p>}
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
                  <EditedBadge createdAt={job.createdAt} updatedAt={job.updatedAt} labels={{ edited: 'Edited', created: 'Posted' }} />
                </div>
              </div>
            </div>

            <div className="pf-opp-badges-cluster">
              <span className={`pf-job-status-badge pf-job-status-badge--${state.tone}`}>{state.label}</span>
            </div>
          </div>

          <div className="pf-opp-facts-row">
            <span><Wallet size={15} /> <strong>{compensationLabel(job) || 'Compensation not specified'}</strong></span>
            <span><MapPin size={15} /> {job.location || 'Location not specified'}{job.workMode ? ` (${job.workMode})` : ''}</span>
            <span><Clock size={15} /> {job.employmentType || 'Role type not specified'}</span>
            {job.applicationDeadline && (
              <span style={deadlinePassed ? { color: '#dc2626', fontWeight: 600 } : {}}>
                <Calendar size={15} /> {deadlinePassed ? `Closed on ${formatISTDate(job.applicationDeadline)}` : `Apply by ${formatISTDate(job.applicationDeadline)}`}
              </span>
            )}
            {job.eligibility?.minCgpa != null && <span><GraduationCap size={15} /> CGPA {job.eligibility.minCgpa}+</span>}
          </div>
        </section>

        {/* 3 Modern Navigation Tabs */}
        <nav className="pf-opp-tabs-bar" aria-label="Role details">
          <button
            aria-pressed={activeTab === 'jd'}
            className={`pf-opp-tab-btn ${activeTab === 'jd' ? 'active' : ''}`}
            onClick={() => setActiveTab('jd')}
          >
            <FileText size={16} />
            <span>Overview</span>
          </button>

          <button
            aria-pressed={activeTab === 'flow'}
            className={`pf-opp-tab-btn ${activeTab === 'flow' ? 'active' : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            <GitCommit size={16} />
            <span>Journey</span>
            {applied && (
              <span className={`pf-opp-tab-pill pf-opp-tab-pill--${appStatus || 'applied'}`}>
                {appStatus === 'selected' ? 'Selected' : appStatus === 'interview' ? 'Interview' : appStatus === 'shortlisted' ? 'Shortlisted' : appStatus === 'rejected' ? 'Concluded' : 'Applied'}
              </span>
            )}
          </button>

          <button
            aria-pressed={activeTab === 'eligibility'}
            className={`pf-opp-tab-btn ${activeTab === 'eligibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('eligibility')}
          >
            <GraduationCap size={16} />
            <span>Eligibility</span>
            {applied ? (
              <span className="pf-opp-tab-pill">Applied</span>
            ) : deadlinePassed ? (
              <span className="pf-opp-tab-pill">Closed</span>
            ) : eligibilityIssues.length === 0 ? (
              <span className="pf-opp-tab-pill" style={{ color: '#047857', background: '#ecfdf5' }}>Eligible</span>
            ) : (
              <span className="pf-opp-tab-pill" style={{ color: '#b45309', background: '#fef3c7' }}>{eligibilityIssues.length} alerts</span>
            )}
          </button>
        </nav>

        {activeTab === 'jd' && <PlacementOverview job={job} student={student} applied={applied} deadlinePassed={deadlinePassed} state={state}
          onJourney={() => setActiveTab('flow')} onEligibility={() => setActiveTab('eligibility')} onApply={() => setIsApplyModalOpen(true)} />}

        {activeTab === 'flow' && <section className="pf-opp-tab-panel pf-hiring-workspace" aria-label="Hiring flow">
          {applied ? <>
            <div className="pf-hiring-status-bar"><div><span className="pf-placement-eyebrow">Your journey with {job.companyName}</span><p>{isSyncing ? 'Checking for updates…' : lastSyncedTime ? 'Last checked at ' + formatISTTime(lastSyncedTime) + ' IST' : 'Your latest recorded status'}</p></div><Button variant="outline" icon={RefreshCw} disabled={isSyncing} onClick={handleSyncStatus}>{isSyncing ? 'Checking…' : 'Refresh status'}</Button></div>
            <div className="pf-hiring-grid"><section className="pf-hiring-main"><ApplicationJourney headingRef={journeyTitleRef} application={{ ...currentApp, status: appStatus }} /></section>
              <aside className="pf-hiring-record"><span className="pf-placement-eyebrow">Your submission</span><h3>The details you sent.</h3><dl><div><dt>Submitted</dt><dd>{placementDate(currentApp?.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{placementDate(currentApp?.updatedAt || currentApp?.createdAt)}</dd></div><div><dt>Attached resume</dt><dd>{currentApp?.selectedResume?.filename || 'Resume details unavailable'}</dd></div><div><dt>Role</dt><dd>{job.title}</dd></div></dl><p className="pf-placement-notice">Your submitted profile is saved with this application. Later profile edits don’t change that saved copy.</p></aside>
            </div>
          </> : <div className="pf-placement-empty pf-application-empty"><span className="pf-application-empty-icon"><GitCommit size={27} /></span><p className="pf-placement-eyebrow">Your journey starts here</p><h3>{job.applicationUrl ? 'Applying on the company website?' : 'Your next move is waiting.'}</h3><p>{job.applicationUrl ? 'Applications for this role are managed externally. Track their progress with the company.' : 'Once you submit a campus application, its latest status and recorded updates appear here.'}</p><Button onClick={() => setActiveTab('eligibility')}>Review eligibility</Button></div>}
        </section>}

        {/* Tab 3: Eligibility & Apply */}
        {activeTab === 'eligibility' && (
          <section className="pf-opp-tab-panel pf-elig-container">
            <div className="pf-elig-scorecard">
              <p className="pf-placement-eyebrow">Before your next move</p><h3>A clear look at your fit.</h3>
              <p className="pf-elig-subtitle">
                Compare your saved academic details with the requirements set by {job.companyName}. Eligibility is checked again when you submit. These comparisons reflect your current profile and do not change an application already submitted.
              </p>

              <div className="pf-elig-grid">
                {comparisons.map(criterion => <div key={criterion.id} className={`pf-elig-cell is-${criterion.state}`}>
                  <div className="pf-elig-cell-icon">{criterion.state === 'met' ? <CheckCircle2 size={18} /> : ['missing', 'unmet'].includes(criterion.state) ? <AlertTriangle size={18} /> : <Info size={18} />}</div>
                  <div className="pf-elig-cell-info"><span className="pf-elig-cell-label">{criterion.label}</span><span className="pf-elig-cell-req">{criterion.requirement}</span><span className="pf-elig-cell-actual">Your record: <strong>{criterion.actual}</strong></span><span className="pf-elig-cell-verdict">{{ met: 'Requirement met', unmet: 'Doesn’t meet requirement', missing: 'Add this detail to check eligibility', unrestricted: 'Not required for this role' }[criterion.state]}</span></div>
                </div>)}
              </div>

              {comparisons.some(criterion => criterion.state === 'missing') && <a className="pf-placement-card-link" href="/profile/edit">Update profile details &rarr;</a>}
              {eligibilityIssues.length > 0 && (
                <div className="pf-job-eligibility">
                  <AlertTriangle size={16} />
                  <div>
                    <b>Eligibility details to review:</b>
                    <ul>
                      {eligibilityIssues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {job.applicationUrl && !applied && <p className="pf-placement-notice">Applications on the company website are handled externally and do not appear in My applications.</p>}
            {/* Application Action Card */}
            <div className="pf-elig-action-card">
              <div className="pf-elig-action-content">
                {applied ? (
                  <>
                    <h4 style={{ color: '#15803d' }}>Application Already Submitted</h4>
                    <p>
                      Submission date: {placementDate(currentApp?.createdAt || currentApp?.appliedAt)}. Current status: <strong>{applicationLabels[appStatus] || appStatus}</strong>.
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
                    <h4 style={{ color: '#8b6043' }}>{state.label}</h4>
                    <p>
                      Review the criteria above. If details are missing, add them to your profile before applying.
                    </p>
                  </>
                ) : (
                  <>
                    <h4>Ready to Apply</h4>
                    <p>
                      You meet all academic criteria for this role. Choose a resume and complete any employer questions before submitting.
                    </p>
                  </>
                )}
              </div>

              <div className="pf-elig-action-btn">
                {applied ? (
                  <Button variant="primary" onClick={() => setActiveTab('flow')}>
                    View application journey &rarr;
                  </Button>
                ) : deadlinePassed ? (
                  <Button variant="outline" disabled>
                    Applications Closed
                  </Button>
                ) : eligibilityIssues.length > 0 ? (
                  <Button variant="outline" disabled icon={AlertTriangle}>
                    {state.label}
                  </Button>
                ) : job.applicationUrl && job.applicationUrl.trim() !== '' ? (
                  <Button
                    type="button"
                    variant="primary"
                    icon={ExternalLink}
                    onClick={() => window.open(job.applicationUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Apply on Company Site
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    icon={Send}
                    onClick={() => setIsApplyModalOpen(true)}
                  >
                    Apply for this role
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
