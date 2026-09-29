import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, LayoutDashboard, Users } from 'lucide-react';
import { recruiterApi } from './recruiterApi';
import { OverviewCards } from '../../components/ui/StatCard';
import { SharedCandidates } from './components/SharedCandidates';
import { JobPostList } from './components/JobPostList';
import { JobPostComposer } from './components/JobPostComposer';
import './RecruiterPage.css';

const RECRUITER_TABS = ['overview', 'jobs', 'candidates'];
const RECRUITER_TAB_LABELS = { overview: 'Overview', jobs: 'My job posts', candidates: 'Shared candidates' };
const TAB_ICONS = { overview: LayoutDashboard, jobs: BriefcaseBusiness, candidates: Users };

/**
 * RecruiterPage, recruiter portal container.
 * Route sections are reflected in the URL hash (/recruiter#jobs, #candidates).
 * There is no talent-search section: recruiters only see candidates the
 * placement team explicitly shares with them.
 */
export function RecruiterPage() {
  const sectionFromUrl = () => (RECRUITER_TABS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview');
  const [tab, setTab] = useState(sectionFromUrl);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [jobError, setJobError] = useState('');
  const [jobMessage, setJobMessage] = useState('');
  const [companies, setCompanies] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  const loadOverview = useCallback(() => {
    recruiterApi.overview().then(data => setOverview(data.overview)).catch(() => {});
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true); setJobError('');
    try { const data = await recruiterApi.myJobs(); setJobs(data.jobPosts); }
    catch (err) { setJobError(err.message); }
    finally { setJobsLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onHashChange = () => setTab(sectionFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { if (tab === 'jobs') { loadJobs(); loadOverview(); } }, [tab, loadJobs, loadOverview]);
  useEffect(() => { if (tab === 'jobs' && companies.length === 0) recruiterApi.companies().then(data => setCompanies(data.companies)).catch(() => setCompanies([])); }, [tab, companies.length]);

  const openComposer = (job = null) => { setJobError(''); setJobMessage(''); setEditingJob(job); setComposerOpen(true); };

  const saveJob = async (payload, isEditing) => {
    setSavingJob(true); setJobError('');
    try {
      const data = isEditing
        ? await recruiterApi.updateJob(editingJob.id, payload)
        : await recruiterApi.createJob(payload);
      const status = data.jobPost.status;
      setJobMessage(status === 'pending_approval'
        ? `${data.jobPost.title} submitted for placement team approval.`
        : `${data.jobPost.title} saved as draft.`);
      setComposerOpen(false); setEditingJob(null); await loadJobs();
    } catch (err) { setJobError(err.message); }
    finally { setSavingJob(false); }
  };

  const submitJob = async (job) => {
    setJobError(''); setJobMessage('');
    try {
      const data = await recruiterApi.submitJob(job.id);
      setJobMessage(`${data.jobPost.title} submitted for placement team approval.`);
      await loadJobs(); await loadOverview();
    } catch (err) { setJobError(err.message); }
  };

  const headerTitle = tab === 'overview' ? 'Your hiring dashboard.' : tab === 'jobs' ? 'Your job posts.' : 'Candidates shared with your company.';

  return (
    <main className="pf-recruiter-page">
      <header className="pf-recruiter-header pf-recruiter-header--compact">
        <div>
          <p className="pf-recruiter-eyebrow">Recruiter portal</p>
          <h1>{headerTitle}</h1>
        </div>
      </header>

      {tab === 'overview' && overview && (
        <>
          <p className="pf-recruiter-overview-note">Post roles for approval and review the candidates the placement team shares with you.</p>
          <OverviewCards cards={[
            { label: 'Job posts', value: overview.totalJobs, hint: `${overview.published} live · ${overview.pendingApproval || 0} pending approval` },
            { label: 'Applications', value: overview.totalApplications, hint: `${overview.last7Days} in the last 7 days` },
            { label: 'Shared candidates', value: overview.sharedCandidates || 0, hint: 'Lists shared by the placement team' },
            { label: 'New this week', value: overview.last7Days, hint: 'Applications received' }
          ]} />
          <div className="pf-recruiter-quick-links">
            <button onClick={() => { window.location.hash = 'jobs'; }}><BriefcaseBusiness size={16} /><span>Create or manage job posts</span></button>
            <button onClick={() => { window.location.hash = 'candidates'; }}><Users size={16} /><span>View shared candidates</span></button>
          </div>
        </>
      )}

      <nav className="pf-recruiter-tabs" aria-label="Recruiter sections">
        {RECRUITER_TABS.map(id => {
          const Icon = TAB_ICONS[id];
          return (
            <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => { window.location.hash = id; }}>
              <Icon size={16} />{RECRUITER_TAB_LABELS[id]}{id === 'jobs' && <span>{jobs.length || ''}</span>}
            </button>
          );
        })}
      </nav>

      {jobError && <div className="pf-recruiter-error" role="alert">{jobError}</div>}
      {jobMessage && <div className="pf-recruiter-success" role="status">{jobMessage}</div>}

      {tab === 'jobs' && (
        <JobPostList
          jobs={jobs} jobsLoading={jobsLoading} companies={companies}
          onOpenComposer={openComposer}
          onEdit={openComposer}
          onSubmit={submitJob}
        />
      )}

      {tab === 'candidates' && <SharedCandidates />}

      <JobPostComposer
        open={composerOpen}
        job={editingJob}
        companies={companies}
        saving={savingJob}
        onClose={() => setComposerOpen(false)}
        onSubmit={saveJob}
      />
    </main>
  );
}
