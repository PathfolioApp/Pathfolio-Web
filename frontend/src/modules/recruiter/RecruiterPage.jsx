import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, LayoutDashboard, Search } from 'lucide-react';
import { recruiterApi } from './recruiterApi';
import { OverviewCards } from '../../components/ui/StatCard';
import { TalentSearch } from './components/TalentSearch';
import { JobPostList } from './components/JobPostList';
import { JobPostComposer } from './components/JobPostComposer';
import './RecruiterPage.css';

const RECRUITER_TABS = ['overview', 'discover', 'jobs'];
const RECRUITER_TAB_LABELS = { overview: 'Overview', discover: 'Talent search', jobs: 'My job posts' };
const TAB_ICONS = { overview: LayoutDashboard, discover: Search, jobs: BriefcaseBusiness };

/**
 * RecruiterPage — recruiter portal container.
 * Route sections are reflected in the URL hash (/recruiter#discover, #jobs).
 */
export function RecruiterPage() {
  const sectionFromUrl = () => (RECRUITER_TABS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview');
  const [tab, setTab] = useState(sectionFromUrl);
  const [keywords, setKeywords] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState('');
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

  const search = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setSearchError('');
    try { setStudents(await recruiterApi.searchStudents({ keywords, jobDescription })); }
    catch (err) { setSearchError(err.message); }
    finally { setLoading(false); }
  };

  const loadJobs = useCallback(async () => {
    setJobsLoading(true); setJobError('');
    try { const data = await recruiterApi.myJobs(); setJobs(data.jobPosts); }
    catch (err) { setJobError(err.message); }
    finally { setJobsLoading(false); }
  }, []);

  useEffect(() => { search(); loadOverview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onHashChange = () => setTab(sectionFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { if (tab === 'jobs') { loadJobs(); loadOverview(); } }, [tab, loadJobs, loadOverview]);
  useEffect(() => { if (tab === 'jobs' && companies.length === 0) recruiterApi.companies().then(data => setCompanies(data.companies)).catch(() => setCompanies([])); }, [tab, companies.length]);

  const clear = () => { setKeywords(''); setJobDescription(''); setTimeout(() => search(), 0); };

  const openComposer = (job = null) => { setJobError(''); setJobMessage(''); setEditingJob(job); setComposerOpen(true); };

  const saveJob = async (payload, isEditing) => {
    setSavingJob(true); setJobError('');
    try {
      const data = isEditing
        ? await recruiterApi.updateJob(editingJob.id, payload)
        : await recruiterApi.createJob(payload);
      setJobMessage(payload.publish
        ? `${data.jobPost.title} ${isEditing ? 'published.' : 'is live for students.'}`
        : `${data.jobPost.title} saved as draft.`);
      setComposerOpen(false); setEditingJob(null); await loadJobs();
    } catch (err) { setJobError(err.message); }
    finally { setSavingJob(false); }
  };

  const setPublish = async (job, publish) => {
    setJobError(''); setJobMessage('');
    try {
      const data = publish ? await recruiterApi.publishJob(job.id) : await recruiterApi.unpublishJob(job.id);
      setJobMessage(`${data.jobPost.title} ${publish ? 'is live for students' : 'moved back to drafts'}.`);
      await loadJobs();
    } catch (err) { setJobError(err.message); }
  };

  return (
    <main className="pf-recruiter-page">
      <header className="pf-recruiter-header pf-recruiter-header--compact">
        <div>
          <p className="pf-recruiter-eyebrow">Pathfolio talent desk</p>
          <h1>{tab === 'overview' ? 'Your hiring dashboard.' : tab === 'jobs' ? 'Your job posts.' : 'Find the people behind the potential.'}</h1>
        </div>
      </header>

      {tab === 'overview' && overview && (
        <>
          <p className="pf-recruiter-overview-note">Your pipeline at a glance — post roles, search talent, and track applications from one place.</p>
          <OverviewCards cards={[
            { label: 'Job posts', value: overview.totalJobs, hint: `${overview.published} published · ${overview.drafts} drafts` },
            { label: 'Applications', value: overview.totalApplications, hint: `${overview.last7Days} in the last 7 days` },
            { label: 'In review', value: (overview.statusCounts?.shortlisted || 0) + (overview.statusCounts?.interview || 0), hint: `${overview.statusCounts?.selected || 0} selected overall` },
            { label: 'New this week', value: overview.last7Days, hint: 'Applications received' }
          ]} />
          <div className="pf-recruiter-quick-links">
            <button onClick={() => { window.location.hash = 'jobs'; }}><BriefcaseBusiness size={16} /><span>Create or manage job posts</span></button>
            <button onClick={() => { window.location.hash = 'discover'; }}><Search size={16} /><span>Search student talent</span></button>
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

      {tab === 'discover' && (
        <TalentSearch
          keywords={keywords} setKeywords={setKeywords}
          jobDescription={jobDescription} setJobDescription={setJobDescription}
          onSearch={search} onClear={clear}
          loading={loading} students={students} error={searchError}
        />
      )}

      {tab === 'jobs' && (
        <JobPostList
          jobs={jobs} jobsLoading={jobsLoading} companies={companies}
          onOpenComposer={openComposer}
          onEdit={openComposer}
          onPublishToggle={setPublish}
        />
      )}

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
