import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, Building2, FileSearch, LayoutDashboard, UserPlus, Users, Search, Share2, History } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { OverviewCards } from '../../components/ui/StatCard';
import { adminApi } from './adminApi';
import { parseCsv, downloadCsvFile, uploadToCloudinary } from './utils/adminHelpers';
import { CompanyWorkspace, CompanyImport } from './components/CompanyWorkspace';
import { JobWorkspace } from './components/JobWorkspace';
import { ApplicationWorkspace } from './components/ApplicationWorkspace';
import { UserWorkspace } from './components/UserWorkspace';
import { JDWorkspace } from './components/JDWorkspace';
import { StudentSearchWorkspace } from './components/StudentSearchWorkspace';
import { SharesWorkspace } from './components/SharesWorkspace';
import { LogsWorkspace } from './components/LogsWorkspace';
import './AdminPage.css';

const emptyCompany = { name: '', website: '', description: '', logoUrl: '', logoPublicId: '' };
const emptyJob = { companyName: '', title: '', description: '', location: '', employmentType: 'Full-time', applicationUrl: '' };
const TAB_IDS = ['overview', 'jobs', 'students', 'shares', 'companies', 'applications', 'users', 'logs', 'jd'];
const TAB_LABELS = { overview: 'Overview', jobs: 'Job posts', students: 'Student search', shares: 'Shares', companies: 'Companies', applications: 'Applications', users: 'Users', logs: 'Logs', jd: 'JD analyser' };
const TAB_ICONS = { overview: LayoutDashboard, jobs: BriefcaseBusiness, students: Search, shares: Share2, companies: Building2, applications: Users, users: UserPlus, logs: History, jd: FileSearch };

/**
 * AdminPage, TnP admin portal container.
 * Sections are reflected in the URL hash (/admin#jobs, #companies, ...).
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
  const [importRows, setImportRows] = useState([]); const [importErrors, setImportErrors] = useState([]); const [importSummary, setImportSummary] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany); const [logoFile, setLogoFile] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJob); const [selectedFields, setSelectedFields] = useState([]); const [namedAttachments, setNamedAttachments] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null); const [editingJob, setEditingJob] = useState(null);
  const [jobFilter, setJobFilter] = useState(''); const [applicationFilter, setApplicationFilter] = useState(''); const [applicationJobFilter, setApplicationJobFilter] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [userImportRows, setUserImportRows] = useState([]); const [userImportErrors, setUserImportErrors] = useState([]); const [userImportSummary, setUserImportSummary] = useState(null);

  const update = (setter, field) => event => setter(value => ({ ...value, [field]: event.target.value }));

  const loadBase = async () => {
    setLoading(true); setError('');
    try {
      const [companyData, jobData] = await Promise.all([adminApi.companies(), adminApi.jobPosts(jobFilter)]);
      setCompanies(companyData.companies); setJobs(jobData.jobPosts);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const loadApplications = async () => {
    setLoading(true);
    try { const data = await adminApi.applications(applicationJobFilter); setApplications(data.applications); }
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
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, applicationJobFilter]);
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

  const saveCompany = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...companyForm };
      if (logoFile) { const uploaded = await uploadToCloudinary(logoFile); payload.logoUrl = uploaded.url; payload.logoPublicId = uploaded.publicId; }
      if (editingCompany) await adminApi.updateCompany(editingCompany, payload); else await adminApi.createCompany(payload);
      resetCompany(); await loadBase();
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
      resetJob(); await loadBase();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const editCompany = company => { window.location.hash = 'companies'; setEditingCompany(company.id); setCompanyForm({ name: company.name, website: company.website, description: company.description, logoUrl: company.logoUrl || '', logoPublicId: company.logoPublicId || '' }); setLogoFile(null); };
  const editJob = job => {
    window.location.hash = 'jobs'; setEditingJob(job.id);
    setJobForm({ companyName: job.companyName || '', title: job.title, description: job.description, location: job.location, employmentType: job.employmentType, applicationUrl: job.applicationUrl });
    setSelectedFields((job.applicationForm?.fields || []).map(field => field.id));
    setNamedAttachments((job.attachments || []).map((item, i) => ({ id: `existing_${i}`, name: item.name, url: item.url, type: item.type, file: null })));
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

  const readImport = event => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ''));
        const errors = rows.flatMap((row, index) => (row.name ? [] : [{ row: index + 2, message: 'Company name is required.' }]));
        setImportRows(rows); setImportErrors(errors); setImportSummary(null);
      } catch (err) { setImportRows([]); setImportErrors([{ row: 0, message: err.message }]); }
    };
    reader.readAsText(file);
  };
  const importCompanies = async () => {
    if (!importRows.length || importErrors.length) return;
    setSaving(true); setError('');
    try { const result = await adminApi.importCompanies(importRows); setImportSummary(result.summary); setImportRows([]); await loadBase(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const downloadCompanyTemplate = () => downloadCsvFile('pathfolio-companies-template.csv', 'name,website,description,logo_url\nAcme Systems,https://acme.example,Technology company,https://logo.example/acme.png\n');

  const readUserImport = event => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ''));
      const errors = rows.flatMap((row, index) => (!row.fullname || !row.email || !row.password ? [{ row: index + 2, message: 'fullName, email, and password are required.' }] : []));
      setUserImportRows(rows); setUserImportErrors(errors); setUserImportSummary(null);
    };
    reader.readAsText(file);
  };
  const importUsers = async () => {
    if (!userImportRows.length || userImportErrors.length) return;
    setSaving(true); setError('');
    try { const result = await adminApi.importUsers(userImportRows); setUserImportSummary(result.summary); setUserImportRows([]); await loadUsers(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const promoteUser = async user => {
    setSaving(true); setError('');
    try { await adminApi.setUserRole(user.id, user.role === 'recruiter' ? 'student' : 'recruiter'); await loadUsers(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const visibleApplications = applications.filter(application => !applicationFilter || application.status === applicationFilter);

  return (
    <main className="pf-admin-page">
      <header className="pf-admin-header pf-admin-header--compact">
        <div>
          <p className="pf-admin-eyebrow">TnP operations workspace</p>
          <h1>{tab === 'overview' ? `Good to see you, ${student?.personal?.fullName?.split(' ')[0] || 'Admin'}.` : TAB_LABELS[tab]}</h1>
        </div>
      </header>
      {tab === 'overview' && overview && (
        <>
          <p className="pf-admin-overview-note">Everything happening across the placement workspace at a glance. Pick a section below to dive in.</p>
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
            <button onClick={() => { window.location.hash = 'users'; }}><UserPlus size={17} /><span>Add or manage users</span></button>
            <button onClick={() => { window.location.hash = 'jd'; }}><FileSearch size={17} /><span>Analyse a job description</span></button>
          </div>
        </>
      )}
      {tab !== 'overview' && error && <div className="pf-admin-error" role="alert">{error}</div>}
      <nav className="pf-admin-tabs">
        {TAB_IDS.map(id => {
          const Icon = TAB_ICONS[id];
          return <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => { window.location.hash = id; }}><Icon size={17} />{TAB_LABELS[id]}</button>;
        })}
      </nav>
      {tab === 'companies' && (
        <>
          <CompanyWorkspace companies={companies} companyForm={companyForm} setCompanyForm={setCompanyForm} editingCompany={editingCompany} resetCompany={resetCompany} saveCompany={saveCompany} loading={loading} editCompany={editCompany} archive={archive} saving={saving} update={update} logoFile={logoFile} setLogoFile={setLogoFile} />
          <CompanyImport importRows={importRows} importErrors={importErrors} importSummary={importSummary} readImport={readImport} importCompanies={importCompanies} downloadTemplate={downloadCompanyTemplate} saving={saving} />
        </>
      )}
      {tab === 'jobs' && (
        <JobWorkspace companies={companies} jobs={jobs} jobForm={jobForm} setJobForm={setJobForm} editingJob={editingJob} resetJob={resetJob} saveJob={saveJob} loading={loading} editJob={editJob} jobFilter={jobFilter} setJobFilter={setJobFilter} publish={publish} reviewJob={reviewJob} reopenJob={reopenJob} saving={saving} selectedFields={selectedFields} setSelectedFields={setSelectedFields} namedAttachments={namedAttachments} setNamedAttachments={setNamedAttachments} update={update} />
      )}
      {tab === 'students' && <StudentSearchWorkspace jobs={jobs} />}
      {tab === 'shares' && <SharesWorkspace />}
      {tab === 'logs' && <LogsWorkspace />}
      {tab === 'applications' && (
        <ApplicationWorkspace jobs={jobs} applicationJobFilter={applicationJobFilter} setApplicationJobFilter={setApplicationJobFilter} applications={visibleApplications} loading={loading} applicationFilter={applicationFilter} setApplicationFilter={setApplicationFilter} updateApplication={updateApplication} saving={saving} />
      )}
      {tab === 'users' && (
        <UserWorkspace users={users} userImportRows={userImportRows} userImportErrors={userImportErrors} userImportSummary={userImportSummary} readUserImport={readUserImport} importUsers={importUsers} promoteUser={promoteUser} saving={saving} loading={loading} reload={loadUsers} adminId={student?.id} />
      )}
      {tab === 'jd' && <JDWorkspace />}
    </main>
  );
}
