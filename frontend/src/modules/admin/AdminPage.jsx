import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, Building2, FileSearch, LayoutDashboard, UserPlus, Users, Search, Share2, History, Plus, Upload, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { PageHeader } from '../../components/ui/PageHeader';
import { OverviewCards } from '../../components/ui/StatCard';
import { adminApi } from './adminApi';
import { parseCsv, downloadCsvFile, uploadToCloudinary } from './utils/adminHelpers';
import { CompanyWorkspace, CompanyImport, CompanyFormDrawer } from './components/CompanyWorkspace';
import { JobWorkspace, JobFormDrawer } from './components/JobWorkspace';
import { ApplicationWorkspace } from './components/ApplicationWorkspace';
import { PlacementPolicyWorkspace } from './components/PlacementPolicyWorkspace';
import { UserWorkspace, UserImportModal } from './components/UserWorkspace';
import { JDWorkspace } from './components/JDWorkspace';
import { StudentSearchWorkspace } from './components/StudentSearchWorkspace';
import { SharesWorkspace } from './components/SharesWorkspace';
import { LogsWorkspace } from './components/LogsWorkspace';
import './AdminPage.css';

const emptyCompany = { name: '', website: '', description: '', logoUrl: '', logoPublicId: '' };
const emptyJob = { companyName: '', title: '', description: '', location: '', employmentType: 'Full-time', applicationUrl: '' };

const SECTION_META = {
  overview: { icon: LayoutDashboard, label: 'Overview' },
  jobs: { icon: BriefcaseBusiness, label: 'Job posts' },
  students: { icon: Search, label: 'Student search' },
  shares: { icon: Share2, label: 'Shares' },
  companies: { icon: Building2, label: 'Companies' },
  applications: { icon: Users, label: 'Applications' },
  policy: { icon: ShieldCheck, label: 'Placement policy' },
  users: { icon: UserPlus, label: 'Users' },
  logs: { icon: History, label: 'Logs' },
  jd: { icon: FileSearch, label: 'JD analyser' }
};
const TAB_IDS = Object.keys(SECTION_META);

/**
 * AdminPage, TnP admin portal container.
 * Sections are reflected in the URL hash (/admin#jobs, #companies, ...).
 * Forms live in right-side drawers / modals opened from the page header
 * action, so lists get the full width.
 */
export function AdminPage() {
  const { student } = useAuth();
  const sectionFromUrl = () => (TAB_IDS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview');
  const [tab, setTab] = useState(sectionFromUrl);
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyForm, setCompanyForm] = useState(emptyCompany); const [logoFile, setLogoFile] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJob); const [selectedFields, setSelectedFields] = useState([]); const [namedAttachments, setNamedAttachments] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null); const [editingJob, setEditingJob] = useState(null);
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [userImportOpen, setUserImportOpen] = useState(false);
  const [companyImportOpen, setCompanyImportOpen] = useState(false);
  const [jobFilter, setJobFilter] = useState(''); const [applicationFilter, setApplicationFilter] = useState(''); const [applicationJobFilter, setApplicationJobFilter] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');

  const update = (setter, field) => event => setter(value => ({ ...value, [field]: event.target.value }));

  const loadBase = async () => {
    setLoading(true); setError('');
    try {
      const [companyData, jobData] = await Promise.all([adminApi.companies(), adminApi.jobPosts(jobFilter)]);
      setCompanies(companyData.companies); setJobs(jobData.jobPosts);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  // Load all applications once; the workspace filters by the selected job
  // client-side and derives per-post counts from the same payload.
  const loadApplications = async () => {
    setLoading(true);
    try { const data = await adminApi.applications(); setApplications(data.applications); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const loadUsers = async () => {
    setLoading(true);
    try { const data = await adminApi.users(); setUsers(data.users); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const loadOverview = async () => {
    try { setOverview((await adminApi.overview()).overview); } catch { /* non-critical */ }
  };

  useEffect(() => { loadBase(); }, [jobFilter]);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);
  useEffect(() => {
    const onHashChange = () => setTab(sectionFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { if (tab === 'overview' || tab === 'applications') loadOverview(); }, [tab]);

  const resetCompany = () => { setCompanyForm({ ...emptyCompany }); setLogoFile(null); setEditingCompany(null); };
  const resetJob = () => { setJobForm({ ...emptyJob, companyId: companies[0]?.id || '' }); setSelectedFields([]); setNamedAttachments([]); setEditingJob(null); };

  const openNewCompany = () => { resetCompany(); setCompanyDrawerOpen(true); };
  const editCompany = company => { setEditingCompany(company.id); setCompanyForm({ name: company.name, website: company.website, description: company.description, logoUrl: company.logoUrl || '', logoPublicId: company.logoPublicId || '' }); setLogoFile(null); setCompanyDrawerOpen(true); };

  const openNewJob = () => { resetJob(); setJobDrawerOpen(true); };
  const editJob = job => {
    setEditingJob(job.id);
    setJobForm({ companyName: job.companyName || '', title: job.title, description: job.description, location: job.location, employmentType: job.employmentType, applicationUrl: job.applicationUrl });
    setSelectedFields((job.applicationForm?.fields || []).map(field => field.id));
    setNamedAttachments((job.attachments || []).map((item, i) => ({ id: `existing_${i}`, name: item.name, url: item.url, type: item.type, file: null })));
    setJobDrawerOpen(true);
  };

  const saveCompany = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...companyForm };
      if (logoFile) { const uploaded = await uploadToCloudinary(logoFile); payload.logoUrl = uploaded.url; payload.logoPublicId = uploaded.publicId; }
      if (editingCompany) await adminApi.updateCompany(editingCompany, payload); else await adminApi.createCompany(payload);
      setCompanyDrawerOpen(false); resetCompany(); await loadBase();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const formOptions = [['rollNumber', 'Roll number'], ['department', 'Department'], ['batchYear', 'Batch year'], ['resumeUrl', 'Resume link'], ['portfolioUrl', 'Portfolio link'], ['skills', 'Skills'], ['cgpa', 'CGPA']];

  const saveJob = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const attachments = await Promise.all(namedAttachments.map(async item => {
        if (item.file) { const uploaded = await uploadToCloudinary(item.file); return { name: item.name || uploaded.name, url: uploaded.url, publicId: uploaded.publicId, type: uploaded.type }; }
        return { name: item.name, url: item.url, type: item.type || 'link' };
      }));
      const payload = { ...jobForm, attachments, applicationForm: { fields: selectedFields.map(id => ({ id, label: formOptions.find(option => option[0] === id)?.[1], type: id.includes('Url') ? 'url' : 'text', required: false })) } };
      if (editingJob) await adminApi.updateJobPost(editingJob, payload); else await adminApi.createJobPost(payload);
      setJobDrawerOpen(false); resetJob(); await loadBase();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const archive = async id => {
    if (!window.confirm('Archive this company?')) return;
    setSaving(true);
    try { await adminApi.archiveCompany(id); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const publish = async job => {
    setSaving(true); setError('');
    try {
      // Closing a live post; publishing an approved one.
      const action = job.status === 'published' ? adminApi.unpublishJobPost : adminApi.publishJobPost;
      await action(job.id); await loadBase();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const reviewJob = async (job, decision) => {
    let note = null;
    if (decision === 'reject') {
      note = window.prompt('What should the recruiter change before resubmitting?', '');
      if (note === null) return; // cancelled
    }
    setSaving(true); setError('');
    try {
      await adminApi.reviewJobPost(job.id, decision, note || '');
      await loadBase();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const reopenJob = async job => {
    setSaving(true); setError('');
    try { await adminApi.reopenJobPost(job.id); await loadBase(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const updateApplication = async (id, status) => {
    setSaving(true);
    try { await adminApi.updateApplication(id, { status }); await loadApplications(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  // Applications for the selected post only (workspace still gets the full
  // set via `applications`; this keeps the visible list and header in sync).
  const visibleApplications = applications.filter(application =>
    (!applicationJobFilter || application.jobPostId === applicationJobFilter)
    && (!applicationFilter || application.status === applicationFilter));
  const meta = SECTION_META[tab];
  const headerCount = tab === 'jobs' ? jobs.length
    : tab === 'companies' ? companies.length
    : tab === 'users' ? users.length
    : tab === 'applications' ? (applicationJobFilter ? visibleApplications.length : jobs.length)
    : tab === 'overview' ? (overview?.total ?? null)
    : undefined;
  const headerTitle = tab === 'overview' ? `Good to see you, ${student?.personal?.fullName?.split(' ')[0] || 'Admin'}.` : meta.label;
  const headerSubtitle = tab === 'overview' ? 'Everything happening across the placement workspace at a glance.' : undefined;

  return (
    <main className="pf-admin-page">
      <PageHeader
        title={headerTitle}
        count={headerCount}
        subtitle={headerSubtitle}
        action={
          tab === 'jobs' ? <button type="button" className="pf-btn pf-btn--primary pf-btn--md" onClick={openNewJob}><Plus size={16} /> New post</button>
          : tab === 'companies' ? <button type="button" className="pf-btn pf-btn--primary pf-btn--md" onClick={openNewCompany}><Plus size={16} /> Add company</button>
          : tab === 'users' ? <button type="button" className="pf-btn pf-btn--primary pf-btn--md" onClick={() => setUserImportOpen(true)}><Upload size={16} /> Import CSV</button>
          : undefined
        }
      />

      {tab === 'overview' && overview && (
        <>
          <OverviewCards cards={[
            { label: 'Total users', value: overview.total, hint: `${overview.students} students · ${overview.recruiters} recruiters` },
            { label: 'Job posts', value: overview.jobs?.length ?? 0, hint: `${overview.jobs?.filter(j => j.status === 'published').length ?? 0} published` },
            { label: 'Applications', value: overview.applications?.length ?? 0, hint: `${overview.applications?.filter(a => a.status === 'applied').length ?? 0} awaiting review` },
            { label: 'Companies', value: overview.companies?.length ?? 0, hint: `${overview.recentSignups} new users this week` }
          ]} />
          <div className="pf-admin-quick-links">
            <button onClick={() => { window.location.hash = 'jobs'; }}><BriefcaseBusiness size={17} /><span>Review & publish job posts</span></button>
            <button onClick={() => { window.location.hash = 'students'; }}><Search size={17} /><span>Search & share students</span></button>
            <button onClick={() => { window.location.hash = 'applications'; }}><Users size={17} /><span>Review applications</span></button>
            <button onClick={() => { window.location.hash = 'policy'; }}><ShieldCheck size={17} /><span>Placement upgrade policy</span></button>
            <button onClick={() => { window.location.hash = 'users'; }}><UserPlus size={17} /><span>Add or manage users</span></button>
            <button onClick={() => { window.location.hash = 'jd'; }}><FileSearch size={17} /><span>Analyse a job description</span></button>
          </div>
        </>
      )}
      {tab !== 'overview' && error && <div className="pf-admin-error" role="alert">{error}</div>}

      {tab === 'companies' && (
        <>
          <CompanyWorkspace companies={companies} loading={loading} editCompany={editCompany} archive={archive} />
          <CompanyFormDrawer
            open={companyDrawerOpen}
            saving={saving}
            editingCompany={editingCompany}
            companyForm={companyForm}
            setCompanyForm={setCompanyForm}
            logoFile={logoFile}
            setLogoFile={setLogoFile}
            update={update}
            onClose={() => { setCompanyDrawerOpen(false); resetCompany(); }}
            onSubmit={saveCompany}
          />
          <CompanyImport
            open={companyImportOpen}
            saving={saving}
            reload={loadBase}
            onClose={() => setCompanyImportOpen(false)}
          />
        </>
      )}
      {tab === 'jobs' && (
        <>
          <JobWorkspace
            companies={companies} jobs={jobs} loading={loading} jobFilter={jobFilter} setJobFilter={setJobFilter}
            publish={publish} reviewJob={reviewJob} reopenJob={reopenJob} saving={saving} editJob={editJob}
          />
          <JobFormDrawer
            open={jobDrawerOpen}
            saving={saving}
            editingJob={editingJob}
            companies={companies}
            jobForm={jobForm}
            setJobForm={setJobForm}
            selectedFields={selectedFields}
            setSelectedFields={setSelectedFields}
            namedAttachments={namedAttachments}
            setNamedAttachments={setNamedAttachments}
            update={update}
            onClose={() => { setJobDrawerOpen(false); resetJob(); }}
            onSubmit={saveJob}
          />
        </>
      )}
      {tab === 'students' && <StudentSearchWorkspace jobs={jobs} />}
      {tab === 'shares' && <SharesWorkspace />}
      {tab === 'logs' && <LogsWorkspace />}
      {tab === 'applications' && (
        <ApplicationWorkspace jobs={jobs} applicationJobFilter={applicationJobFilter} setApplicationJobFilter={setApplicationJobFilter} applications={applications} loading={loading} updateApplication={updateApplication} saving={saving} />
      )}
      {tab === 'policy' && <PlacementPolicyWorkspace />}
      {tab === 'users' && (
        <>
          <UserWorkspace users={users} saving={saving} loading={loading} reload={loadUsers} adminId={student?.id} />
          <UserImportModal
            open={userImportOpen}
            saving={saving}
            reload={loadUsers}
            onClose={() => setUserImportOpen(false)}
          />
        </>
      )}
      {tab === 'jd' && <JDWorkspace />}
    </main>
  );
}
