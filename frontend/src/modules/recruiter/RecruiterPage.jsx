import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Users, Plus } from 'lucide-react';
import { recruiterApi } from './recruiterApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { OverviewCards } from '../../components/ui/StatCard';
import { SharedCandidates } from './components/SharedCandidates';
import { JobPostList } from './components/JobPostList';
import { JobPostComposer } from './components/JobPostComposer';
import './RecruiterPage.css';

const SECTION_META = { overview: 'Overview', jobs: 'My job posts', candidates: 'Shared candidates' };

/**
 * RecruiterPage, recruiter portal container.
 * Route sections are reflected in the URL hash (/recruiter#jobs, #candidates)
 * and in the sidebar; there is no separate tab bar.
 */
export function RecruiterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();

  const tab = Object.keys(SECTION_META).includes(tabParam) ? tabParam : 'overview';
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
    if (location.hash) {
      const rawHash = location.hash.replace(/^#/, '');
      if (Object.keys(SECTION_META).includes(rawHash)) {
        navigate(`/recruiter/${rawHash}`, { replace: true });
      } else {
        navigate('/recruiter/overview', { replace: true });
      }
    }
  }, [location.hash, navigate]);
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

  return (
    <main className="pf-recruiter-page">
      <PageHeader
        title={tab === 'overview' ? 'Your hiring dashboard' : SECTION_META[tab]}
        count={tab === 'jobs' ? jobs.length : undefined}
        subtitle={tab === 'overview' ? 'Post roles for approval and review the candidates the placement team shares with you.' : undefined}
        action={tab === 'jobs' && (
          <button type="button" className="pf-btn pf-btn--primary pf-btn--md" onClick={() => openComposer()}>
            <Plus size={16} /> New post
          </button>
        )}
      />

      {tab === 'overview' && overview && (
        <>
          <OverviewCards cards={[
            { label: 'Job posts', value: overview.totalJobs, hint: `${overview.published} live · ${overview.pendingApproval || 0} pending approval` },
            { label: 'Applications', value: overview.totalApplications, hint: `${overview.last7Days} in the last 7 days` },
            { label: 'Shared candidates', value: overview.sharedCandidates || 0, hint: 'Lists shared by the placement team' },
            { label: 'New this week', value: overview.last7Days, hint: 'Applications received' }
          ]} />
          <div className="pf-recruiter-quick-links">
            <button onClick={() => navigate('/recruiter/jobs')}><BriefcaseBusiness size={16} /><span>Create or manage job posts</span></button>
            <button onClick={() => navigate('/recruiter/candidates')}><Users size={16} /><span>View shared candidates</span></button>
          </div>
        </>
      )}

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
