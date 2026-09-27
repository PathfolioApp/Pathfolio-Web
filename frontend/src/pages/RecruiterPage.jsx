import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, Building2, FileText, LogOut, Plus, Search, SlidersHorizontal, Undo2, Upload, UserRound, Send, MapPin, Clock, Calendar, Wallet, GraduationCap, CheckCircle2, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { recruiterApi } from '../services/recruiterApi';
import { Footer } from '../components/Footer';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { OverviewCards } from '../components/StatCard';
import './RecruiterPage.css';

const emptyJob = {
  companyId: '', title: '', description: '', location: '', employmentType: 'Full-time', workMode: 'On-site',
  applicationUrl: '', salaryMin: '', salaryMax: '', requiredSkills: '',
  minCgpa: '', maxActiveBacklogs: '', allowedDepartments: '', allowedBatches: '', applicationDeadline: '', publish: true
};
const salaryLabel = job => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const currency = job.salaryCurrency || 'INR';
  const format = value => value >= 100000 ? `${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value;
  if (job.salaryMin && job.salaryMax) return `${currency} ${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return `${currency} ${format(job.salaryMin || job.salaryMax)}`;
};
const deadlineLabel = job => job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function RecruiterPage() {
  const initialTab = ['discover', 'jobs'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'discover';
  const [tab, setTab] = useState(initialTab);
  const [keywords, setKeywords] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [jobError, setJobError] = useState('');
  const [jobMessage, setJobMessage] = useState('');
  const [companies, setCompanies] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [editingJob, setEditingJob] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  const search = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try { setStudents(await recruiterApi.searchStudents({ keywords, jobDescription })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadJobs = useCallback(async () => {
    setJobsLoading(true); setJobError('');
    try { const data = await recruiterApi.myJobs(); setJobs(data.jobPosts); }
    catch (err) { setJobError(err.message); }
    finally { setJobsLoading(false); }
  }, []);

  useEffect(() => { search(); recruiterApi.overview().then(data => setOverview(data.overview)).catch(() => {}); }, []);
  useEffect(() => {
    const onHashChange = () => { const next = window.location.hash.slice(1); if (['discover', 'jobs'].includes(next)) setTab(next); else if (!window.location.hash) setTab('discover'); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { if (tab === 'jobs') { loadJobs(); recruiterApi.overview().then(data => setOverview(data.overview)).catch(() => {}); } }, [tab, loadJobs]);
  useEffect(() => { if (tab === 'jobs' && companies.length === 0) recruiterApi.companies().then(data => setCompanies(data.companies)).catch(() => setCompanies([])); }, [tab, companies.length]);

  const clear = () => { setKeywords(''); setJobDescription(''); setTimeout(() => search(), 0); };
  const loadJobDescription = event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setJobDescription(String(reader.result || '')); reader.readAsText(file); event.target.value = ''; };

  const openComposer = job => {
    setJobError(''); setJobMessage('');
    if (job) {
      setEditingJob(job);
      setJobForm({
        companyId: job.companyId, title: job.title, description: job.description, location: job.location, employmentType: job.employmentType || 'Full-time',
        workMode: job.workMode || 'On-site', applicationUrl: job.applicationUrl, salaryMin: job.salaryMin ?? '', salaryMax: job.salaryMax ?? '',
        requiredSkills: (job.requiredSkills || []).join(', '), minCgpa: job.eligibility?.minCgpa ?? '', maxActiveBacklogs: job.eligibility?.maxActiveBacklogs ?? '',
        allowedDepartments: (job.eligibility?.allowedDepartments || []).join(', '), allowedBatches: (job.eligibility?.allowedBatches || []).join(', '),
        applicationDeadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : '', publish: false
      });
    } else {
      setEditingJob(null);
      setJobForm({ ...emptyJob, companyId: companies[0]?.id || '' });
    }
    setComposerOpen(true);
  };

  const saveJob = async event => {
    event.preventDefault();
    setSavingJob(true); setJobError('');
    try {
      const payload = {
        ...jobForm,
        requiredSkills: jobForm.requiredSkills.split(',').map(item => item.trim()).filter(Boolean),
        eligibility: {
          minCgpa: jobForm.minCgpa === '' ? null : Number(jobForm.minCgpa),
          maxActiveBacklogs: jobForm.maxActiveBacklogs === '' ? null : Number(jobForm.maxActiveBacklogs),
          allowedDepartments: jobForm.allowedDepartments.split(',').map(item => item.trim()).filter(Boolean),
          allowedBatches: jobForm.allowedBatches.split(',').map(item => item.trim()).filter(Boolean)
        }
      };
      if (editingJob) { const data = await recruiterApi.updateJob(editingJob.id, payload); setJobMessage(payload.publish ? `${data.jobPost.title} published.` : `${data.jobPost.title} saved as draft.`); }
      else { const data = await recruiterApi.createJob(payload); setJobMessage(payload.publish ? `${data.jobPost.title} is live for students.` : `${data.jobPost.title} saved as draft.`); }
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

  const update = field => event => setJobForm(prev => ({ ...prev, [field]: event.target.value }));
  const deadlinePassed = job => job.applicationDeadline && new Date(job.applicationDeadline) < new Date();

  return <div className="pf-recruiter-shell">
    <main className="pf-recruiter-page">
      <header className="pf-recruiter-header pf-recruiter-header--compact">
        <div><p className="pf-recruiter-eyebrow">Pathfolio talent desk</p><h1>{tab === 'jobs' ? 'Your job posts.' : 'Find the people behind the potential.'}</h1></div>
      </header>

      {overview && <OverviewCards cards={[
        { label: 'Job posts', value: overview.totalJobs, hint: `${overview.published} published · ${overview.drafts} drafts` },
        { label: 'Applications', value: overview.totalApplications, hint: `${overview.last7Days} in the last 7 days` },
        { label: 'In review', value: (overview.statusCounts?.shortlisted || 0) + (overview.statusCounts?.interview || 0), hint: `${overview.statusCounts?.selected || 0} selected overall` },
        { label: 'New this week', value: overview.last7Days, hint: 'Applications received' }
      ]} />}

      <nav className="pf-recruiter-tabs" aria-label="Recruiter sections">
        <button className={tab === 'discover' ? 'is-active' : ''} onClick={() => setTab('discover')}><Search size={16} />Talent search</button>
        <button className={tab === 'jobs' ? 'is-active' : ''} onClick={() => setTab('jobs')}><BriefcaseBusiness size={16} />My job posts <span>{jobs.length || ''}</span></button>
      </nav>

      {jobError && <div className="pf-recruiter-error" role="alert">{jobError}</div>}
      {jobMessage && <div className="pf-recruiter-success" role="status">{jobMessage}</div>}

      {tab === 'discover' && <>
        <form className="pf-recruiter-search" onSubmit={search}>
          <div className="pf-recruiter-search-heading"><div><p className="pf-recruiter-eyebrow">Candidate discovery</p><h2>Describe who you need</h2></div><button className="pf-recruiter-clear" type="button" onClick={clear}>Clear search</button></div>
          <label className="pf-recruiter-keywords"><Search size={18} /><input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="Keywords: React, Python, analytics, CSE..." /></label>
          <label className="pf-recruiter-jd"><FileText size={18} /><textarea value={jobDescription} onChange={event => setJobDescription(event.target.value)} rows="5" placeholder="Paste a job description here. We will match its meaningful terms against student profiles." /><span className="pf-recruiter-upload"><Upload size={14} />Upload .txt or .md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={loadJobDescription} /></span></label>
          <div className="pf-recruiter-search-footer"><span><SlidersHorizontal size={15} />Matches are ranked by profile overlap</span><button className="pf-recruiter-submit" type="submit" disabled={loading}><Search size={16} />{loading ? 'Searching...' : 'Find candidates'}</button></div>
        </form>
        <section className="pf-recruiter-results"><div className="pf-recruiter-results-heading"><div><p className="pf-recruiter-eyebrow">Search results</p><h2>{loading ? 'Finding candidates...' : `${students.length} candidate${students.length === 1 ? '' : 's'} surfaced`}</h2></div><BriefcaseBusiness size={22} /></div>
          {!loading && students.length === 0 && <div className="pf-recruiter-empty"><h3>No matching profiles yet.</h3><p>Try a broader skill, department, or job description.</p></div>}
          <div className="pf-recruiter-grid">{students.map(candidate => <article className="pf-candidate-card" key={candidate.id}><div className="pf-candidate-top"><div><span className="pf-candidate-score">{candidate.score}% match</span><h3>{candidate.name}</h3><p>{candidate.academic?.department || 'Department not listed'} · Batch {candidate.academic?.batchYear || 'N/A'}</p></div><UserRound size={22} /></div><div className="pf-candidate-section"><span>Matched signals</span><div className="pf-candidate-tags">{candidate.matchedTerms.length ? candidate.matchedTerms.map(term => <b key={term}>{term}</b>) : <small>Browse result</small>}</div></div><div className="pf-candidate-section"><span>Interests</span><p>{[...(candidate.interests?.passions || []), ...(candidate.interests?.hobbies || [])].join(', ') || 'Not listed'}</p></div>{candidate.achievements?.length > 0 && <div className="pf-candidate-section"><span>Latest achievement</span><p>{candidate.achievements[0].title}</p></div>}{candidate.email && <a className="pf-candidate-contact" href={`mailto:${candidate.email}`}>Contact candidate</a>}</article>)}</div>
        </section>
      </>}

      {tab === 'jobs' && <section className="pf-recruiter-results">
        <div className="pf-recruiter-results-heading">
          <div><p className="pf-recruiter-eyebrow">Opportunities</p><h2>My job posts</h2></div>
          <Button icon={Plus} onClick={() => openComposer(null)} disabled={companies.length === 0}>New job post</Button>
        </div>
        {companies.length === 0 && <div className="pf-recruiter-empty"><h3>No companies yet.</h3><p>Ask the placement team to add your company before posting a job.</p></div>}
        {jobsLoading && <p className="pf-recruiter-loading">Loading your job posts…</p>}
        {!jobsLoading && jobs.length === 0 && <div className="pf-recruiter-empty"><h3>No job posts yet.</h3><p>Create your first opportunity — students see it the moment you publish.</p></div>}
        <div className="pf-recruiter-jobs">{jobs.map(job => <article className={`pf-recruiter-job ${job.status === 'published' ? 'is-live' : ''}`} key={job.id}>
          <div className="pf-recruiter-job-top">
            <div><div className="pf-recruiter-job-badges"><span className={`pf-recruiter-job-status is-${job.status}`}>{job.status}</span>{deadlinePassed(job) && <span className="pf-recruiter-job-status is-expired">deadline passed</span>}</div>
              <h3>{job.title}</h3>
              <p className="pf-recruiter-job-company"><Building2 size={14} />{job.companyName}{job.location ? <> · <MapPin size={14} />{job.location} ({job.workMode || 'On-site'})</> : null}</p>
            </div>
          </div>
          <p className="pf-recruiter-job-desc">{job.description.length > 180 ? `${job.description.slice(0, 180)}…` : job.description}</p>
          <div className="pf-recruiter-job-facts">
            {job.employmentType && <span><Clock size={13} />{job.employmentType}</span>}
            {salaryLabel(job) && <span><Wallet size={13} />{salaryLabel(job)}</span>}
            {deadlineLabel(job) && <span><Calendar size={13} />Apply by {deadlineLabel(job)}</span>}
            {job.eligibility?.minCgpa && <span><GraduationCap size={13} />CGPA {job.eligibility.minCgpa}+</span>}
          </div>
          {(job.requiredSkills || []).length > 0 && <div className="pf-recruiter-job-skills">{job.requiredSkills.slice(0, 8).map(skill => <b key={skill}>{skill}</b>)}</div>}
          <div className="pf-recruiter-job-actions">
            <span className="pf-recruiter-job-meta">Manage this opportunity</span>
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openComposer(job)} disabled={job.status === 'published'}>Edit</Button>
            {job.status === 'published'
              ? <Button variant="outline" size="sm" icon={Undo2} onClick={() => setPublish(job, false)}>Unpublish</Button>
              : <Button size="sm" icon={Send} onClick={() => setPublish(job, true)}>Publish</Button>}
          </div>
        </article>)}</div>
      </section>}
    </main>
    <Footer compact />

    <Modal isOpen={composerOpen} onClose={() => !savingJob && setComposerOpen(false)} title={editingJob ? `Edit ${editingJob.title}` : 'Create a job post'}>
      <form className="pf-recruiter-job-form" onSubmit={saveJob}>
        <label>Company *<select required value={jobForm.companyId} onChange={update('companyId')}><option value="">Choose a company</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Job title *<input required value={jobForm.title} onChange={update('title')} placeholder="e.g. Frontend Engineer" /></label>
        <label>Job description *<textarea required rows="5" value={jobForm.description} onChange={update('description')} placeholder="Responsibilities, culture, interview process…" /></label>
        <div className="pf-recruiter-job-grid">
          <label>Location<input value={jobForm.location} onChange={update('location')} placeholder="Bengaluru" /></label>
          <label>Work mode<select value={jobForm.workMode} onChange={update('workMode')}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
          <label>Employment type<select value={jobForm.employmentType} onChange={update('employmentType')}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select></label>
          <label>Application deadline<input type="date" value={jobForm.applicationDeadline} onChange={update('applicationDeadline')} /></label>
          <label>Salary min (annual)<input type="number" min="0" value={jobForm.salaryMin} onChange={update('salaryMin')} placeholder="600000" /></label>
          <label>Salary max (annual)<input type="number" min="0" value={jobForm.salaryMax} onChange={update('salaryMax')} placeholder="900000" /></label>
        </div>
        <label>Required skills<input value={jobForm.requiredSkills} onChange={update('requiredSkills')} placeholder="React, TypeScript, REST APIs (comma separated)" /></label>
        <fieldset><legend>Eligibility criteria (optional)</legend>
          <div className="pf-recruiter-job-grid">
            <label>Minimum CGPA<input type="number" step="0.01" min="0" max="10" value={jobForm.minCgpa} onChange={update('minCgpa')} placeholder="7.0" /></label>
            <label>Max active backlogs<input type="number" min="0" value={jobForm.maxActiveBacklogs} onChange={update('maxActiveBacklogs')} placeholder="0" /></label>
          </div>
          <label>Allowed departments<input value={jobForm.allowedDepartments} onChange={update('allowedDepartments')} placeholder="Computer Science, Information Technology" /></label>
          <label>Allowed batches<input value={jobForm.allowedBatches} onChange={update('allowedBatches')} placeholder="2024 - 2028" /></label>
        </fieldset>
        <label className="pf-recruiter-job-url">External application URL<input type="url" value={jobForm.applicationUrl} onChange={update('applicationUrl')} placeholder="https://careers.company.com/role" /></label>
        <label className="pf-recruiter-job-publish"><input type="checkbox" checked={jobForm.publish} onChange={event => setJobForm(prev => ({ ...prev, publish: event.target.checked }))} />Publish immediately{editingJob ? ' (re-publishes this post)' : ' — students can apply right away'}</label>
        <div className="pf-recruiter-job-form-actions">
          <Button type="button" variant="secondary" onClick={() => setComposerOpen(false)} disabled={savingJob}>Cancel</Button>
          <Button type="submit" loading={savingJob} icon={editingJob ? CheckCircle2 : Send}>{editingJob ? 'Save changes' : 'Create job post'}</Button>
        </div>
      </form>
    </Modal>
  </div>;
}
