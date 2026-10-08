import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Building2, FileSearch, LayoutDashboard, UserPlus, Users, Search, Share2, History, Plus, Upload, ShieldCheck, Target } from 'lucide-react';
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
import { RecruitmentWorkspace } from './components/RecruitmentWorkspace';
import { CompanyRelationshipPage } from './components/CompanyRelationshipPage';
import './AdminPage.css';

const emptyCompany = { name: '', website: '', description: '', logoUrl: '', logoPublicId: '' };
const emptyJob = {
  companyName: '', title: '', description: '', location: '', employmentType: 'Full-time', applicationUrl: '',
  salaryMin: '', salaryMax: '', salaryCurrency: 'INR',
  minCgpa: '', minTenthPercentage: '', minTwelfthPercentage: '', maxActiveBacklogs: '',
  allowedBatches: '', allowedDepartments: '', applicationDeadline: ''
};

const SECTION_META = {
  overview: { icon: LayoutDashboard, label: 'Overview' },
  jobs: { icon: BriefcaseBusiness, label: 'Job posts' },
  students: { icon: Search, label: 'Student search' },
  shares: { icon: Share2, label: 'Candidate shares' },
  companies: { icon: Building2, label: 'Companies' },
  applications: { icon: Users, label: 'Applications' },
  recruitment: { icon: Target, label: 'Recruitment' },
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
  const location = useLocation();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();

  // Use the parameter from the URL, default to overview if it doesn't match
  const tab = TAB_IDS.includes(tabParam) ? tabParam : 'overview';
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyForm, setCompanyForm] = useState(emptyCompany); const [logoFile, setLogoFile] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJob); const [namedAttachments, setNamedAttachments] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null); const [editingJob, setEditingJob] = useState(null);
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [userImportOpen, setUserImportOpen] = useState(false);
  const [companyImportOpen, setCompanyImportOpen] = useState(false);
  const [jobFilter, setJobFilter] = useState(''); const [applicationFilter, setApplicationFilter] = useState(''); const [applicationJobFilter, setApplicationJobFilter] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');

  const update = (setter, field) => event => setter(value => ({ ...value, [field]: event.target.value }));

  // Company relationship page lives under the recruitment tab via ?company=<id>.
  const relationshipCompanyId = new URLSearchParams(location.search).get('company') || '';

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
    try {
      const data = await adminApi.overview();
      const base = data.overview || {};
      setOverview({
        ...base,
        jobs: data.jobs || base.jobs || [],
        companies: data.companies || base.companies || [],
        applications: data.applications || base.applications || []
      });
    } catch { /* non-critical */ }
  };

  useEffect(() => { loadBase(); }, [jobFilter]);
  useEffect(() => {
    if (tab === 'applications') {
      loadApplications();
      setApplicationJobFilter('');
    }
  }, [tab]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);
  useEffect(() => {
    if (!location.hash) return;
    const rawHash = location.hash.replace(/^#/, '');
    if (rawHash.startsWith('recruitment/company/')) {
      // Deep link: /admin/recruitment?company=<id>#recruitment/company/<id>
      navigate(`/admin/recruitment?company=${encodeURIComponent(rawHash.split('/')[2] || '')}`, { replace: true });
    } else if (TAB_IDS.includes(rawHash)) {
      navigate(`/admin/${rawHash}`, { replace: true });
    } else {
      navigate('/admin/overview', { replace: true });
    }
  }, [location.hash, navigate]);
  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { if (tab === 'overview' || tab === 'applications') loadOverview(); }, [tab]);

  const resetCompany = () => { setCompanyForm({ ...emptyCompany }); setLogoFile(null); setEditingCompany(null); };
  const resetJob = () => { setJobForm({ ...emptyJob, companyId: companies[0]?.id || '' }); setNamedAttachments([]); setEditingJob(null); };

  const openNewCompany = () => { resetCompany(); setCompanyDrawerOpen(true); };
  const editCompany = company => { setEditingCompany(company.id); setCompanyForm({ name: company.name, website: company.website, description: company.description, logoUrl: company.logoUrl || '', logoPublicId: company.logoPublicId || '' }); setLogoFile(null); setCompanyDrawerOpen(true); };

  const openNewJob = () => { resetJob(); setJobDrawerOpen(true); };
  const editJob = job => {
    setEditingJob(job.id);
    setJobForm({
      companyName: job.companyName || '', title: job.title || '', description: job.description || '', location: job.location || '', employmentType: job.employmentType || 'Full-time', applicationUrl: job.applicationUrl || '',
      salaryMin: job.salaryMin ?? '', salaryMax: job.salaryMax ?? '', salaryCurrency: job.salaryCurrency || 'INR',
      minCgpa: job.eligibility?.minCgpa ?? '', minTenthPercentage: job.eligibility?.minTenthPercentage ?? '', minTwelfthPercentage: job.eligibility?.minTwelfthPercentage ?? '', maxActiveBacklogs: job.eligibility?.maxActiveBacklogs ?? '',
      allowedBatches: (job.eligibility?.allowedBatches || []).join(', '), allowedDepartments: (job.eligibility?.allowedDepartments || []).join(', '),
      applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().slice(0, 16) : ''
    });
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



  const saveJob = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const attachments = await Promise.all(namedAttachments.map(async item => {
        if (item.file) { const uploaded = await uploadToCloudinary(item.file); return { name: item.name || uploaded.name, url: uploaded.url, publicId: uploaded.publicId, type: uploaded.type }; }
        return { name: item.name, url: item.url, type: item.type || 'link' };
      }));
      const payload = { 
        ...jobForm, 
        attachments,
        salaryMin: jobForm.salaryMin !== '' ? Number(jobForm.salaryMin) : null,
        salaryMax: jobForm.salaryMax !== '' ? Number(jobForm.salaryMax) : null,
        applicationDeadline: jobForm.applicationDeadline ? new Date(jobForm.applicationDeadline).toISOString() : null,
        eligibility: {
          minCgpa: jobForm.minCgpa !== '' ? Number(jobForm.minCgpa) : null,
          minTenthPercentage: jobForm.minTenthPercentage !== '' ? Number(jobForm.minTenthPercentage) : null,
          minTwelfthPercentage: jobForm.minTwelfthPercentage !== '' ? Number(jobForm.minTwelfthPercentage) : null,
          maxActiveBacklogs: jobForm.maxActiveBacklogs !== '' ? Number(jobForm.maxActiveBacklogs) : null,
          allowedBatches: jobForm.allowedBatches.split(',').map(s => s.trim()).filter(Boolean),
          allowedDepartments: jobForm.allowedDepartments.split(',').map(s => s.trim()).filter(Boolean)
        },
        applicationForm: { fields: [] }
      };
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
            <button onClick={() => navigate('/admin/recruitment')}><Target size={17} /><span>Recruitment intelligence - plan outreach</span></button>
            <button onClick={() => navigate('/admin/jobs')}><BriefcaseBusiness size={17} /><span>Review & publish job posts</span></button>
            <button onClick={() => navigate('/admin/students')}><Search size={17} /><span>Search & share students</span></button>
            <button onClick={() => navigate('/admin/applications')}><Users size={17} /><span>Review applications</span></button>
            <button onClick={() => navigate('/admin/policy')}><ShieldCheck size={17} /><span>Placement upgrade policy</span></button>
            <button onClick={() => navigate('/admin/users')}><UserPlus size={17} /><span>Add or manage users</span></button>
            <button onClick={() => navigate('/admin/jd')}><FileSearch size={17} /><span>Analyse a job description</span></button>
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
      {tab === 'recruitment' && (
        relationshipCompanyId
          ? <CompanyRelationshipPage companyId={relationshipCompanyId} onBack={() => navigate('/admin/recruitment')} />
          : <RecruitmentWorkspace companies={companies} />
      )}
      {tab === 'recruitment-settings' && <PlacementPolicyWorkspace />}
      {tab === 'applications' && (
        <ApplicationWorkspace
          companies={companies}
          jobs={jobs}
          applicationJobFilter={applicationJobFilter}
          setApplicationJobFilter={setApplicationJobFilter}
          applications={applications}
          loading={loading}
          updateApplication={updateApplication}
          saving={saving}
        />
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
