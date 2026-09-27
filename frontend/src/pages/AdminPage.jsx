import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Archive, Ban, BriefcaseBusiness, Building2, Calendar, CheckCircle2, Clock, FileSearch, FileUp, ImagePlus, LayoutDashboard, ListChecks, LogOut, Mail, Paperclip, Plus, Save, Send, ShieldCheck, Sparkles, Target, Trash2, Upload, Users, UserPlus, UserRound, Undo2, Wand2, X, Eye, EyeOff, Filter, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { OverviewCards } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { adminApi } from '../services/adminApi';
import './AdminPage.css';

const emptyCompany = { name: '', website: '', description: '', logoUrl: '', logoPublicId: '' };
const emptyJob = { companyId: '', title: '', description: '', location: '', employmentType: 'Full-time', applicationUrl: '' };
const formOptions = [['rollNumber', 'Roll number'], ['department', 'Department'], ['batchYear', 'Batch year'], ['resumeUrl', 'Resume link'], ['portfolioUrl', 'Portfolio link'], ['skills', 'Skills'], ['cgpa', 'CGPA']];

function Input({ label, children, full = false }) { return <label className={full ? 'pf-admin-full-field' : ''}>{label}{children}</label>; }
function PanelHeading({ eyebrow, title, action }) { return <div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>; }
function Empty({ text }) { return <p className="pf-admin-empty">{text}</p>; }
function FilePicker({ accept, onFile, children, chosenName, subtle = false }) {
  return <>
    <span className={`pf-file-picker${subtle ? ' pf-file-picker--subtle' : ''}`}>
      <FileUp size={15} />{children}
      <input type="file" accept={accept} onChange={event => { onFile(event); event.target.value = ''; }} />
    </span>
    {chosenName && <span className="pf-admin-import-chosen">{chosenName}</span>}
  </>;
}
async function uploadToCloudinary(file) { const signed = await adminApi.uploadSignature(); const formData = new FormData(); formData.append('file', file); formData.append('api_key', signed.apiKey); formData.append('timestamp', signed.timestamp); formData.append('folder', signed.folder); if (signed.accessMode) formData.append('access_mode', signed.accessMode); formData.append('signature', signed.signature); const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`, { method: 'POST', body: formData }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error?.message || `Unable to upload ${file.name}.`); return { name: file.name, url: data.secure_url, publicId: data.public_id, type: file.type || 'application/octet-stream' }; }
function parseCsv(text) { const rows = []; let row = []; let value = ''; let quoted = false; for (let index = 0; index < text.length; index += 1) { const character = text[index]; const next = text[index + 1]; if (character === '"' && quoted && next === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; } else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') index += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; } else value += character; } row.push(value.trim()); if (row.some(Boolean)) rows.push(row); if (!rows.length) return []; const headers = rows.shift().map(header => header.toLowerCase().replace(/\s+/g, '')); return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))); }

const formatISTDate = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(dateString));
};
const TAB_IDS = ['jobs', 'companies', 'applications', 'users', 'jd'];

export function AdminPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const sectionFromUrl = () => (TAB_IDS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'jobs');
  const [tab, setTab] = useState(sectionFromUrl);
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]); const [jobs, setJobs] = useState([]); const [applications, setApplications] = useState([]); const [users, setUsers] = useState([]);
  const [importRows, setImportRows] = useState([]); const [importErrors, setImportErrors] = useState([]); const [importSummary, setImportSummary] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany); const [logoFile, setLogoFile] = useState(null); const [jobForm, setJobForm] = useState(emptyJob); const [selectedFields, setSelectedFields] = useState([]); const [namedAttachments, setNamedAttachments] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null); const [editingJob, setEditingJob] = useState(null); const [jobFilter, setJobFilter] = useState(''); const [applicationFilter, setApplicationFilter] = useState(''); const [applicationJobFilter, setApplicationJobFilter] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [userImportRows, setUserImportRows] = useState([]); const [userImportErrors, setUserImportErrors] = useState([]); const [userImportSummary, setUserImportSummary] = useState(null);
  const update = (setter, field) => event => setter(value => ({ ...value, [field]: event.target.value }));
  const loadBase = async () => { setLoading(true); setError(''); try { const [companyData, jobData] = await Promise.all([adminApi.companies(), adminApi.jobPosts(jobFilter)]); setCompanies(companyData.companies); setJobs(jobData.jobPosts); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  const loadApplications = async () => { setLoading(true); try { const data = await adminApi.applications(applicationJobFilter); setApplications(data.applications); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  const loadUsers = async () => { setLoading(true); try { const data = await adminApi.users(); setUsers(data.users); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { loadBase(); }, [jobFilter]);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, applicationJobFilter]);
  // Keep the section in sync with the URL hash (sidebar, back/forward, deep links).
  useEffect(() => {
    const onHashChange = () => setTab(sectionFromUrl());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);
  const resetCompany = () => { setCompanyForm({ ...emptyCompany }); setLogoFile(null); setEditingCompany(null); };
  const resetJob = () => { setJobForm({ ...emptyJob, companyId: companies[0]?.id || '' }); setSelectedFields([]); setNamedAttachments([]); setEditingJob(null); };
  const saveCompany = async event => { event.preventDefault(); setSaving(true); setError(''); try { const payload = { ...companyForm }; if (logoFile) { const uploaded = await uploadToCloudinary(logoFile); payload.logoUrl = uploaded.url; payload.logoPublicId = uploaded.publicId; } if (editingCompany) await adminApi.updateCompany(editingCompany, payload); else await adminApi.createCompany(payload); resetCompany(); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const saveJob = async event => { event.preventDefault(); setSaving(true); setError(''); try { const attachments = await Promise.all(namedAttachments.map(async item => { if (item.file) { const uploaded = await uploadToCloudinary(item.file); return { name: item.name || uploaded.name, url: uploaded.url, publicId: uploaded.publicId, type: uploaded.type }; } return { name: item.name, url: item.url, type: item.type || 'link' }; })); const payload = { ...jobForm, attachments, applicationForm: { fields: selectedFields.map(id => ({ id, label: formOptions.find(option => option[0] === id)?.[1], type: id.includes('Url') ? 'url' : 'text', required: false })) } }; if (editingJob) await adminApi.updateJobPost(editingJob, payload); else await adminApi.createJobPost(payload); resetJob(); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const editCompany = company => { window.location.hash = 'companies'; setEditingCompany(company.id); setCompanyForm({ name: company.name, website: company.website, description: company.description, logoUrl: company.logoUrl || '', logoPublicId: company.logoPublicId || '' }); setLogoFile(null); };
  const editJob = job => { window.location.hash = 'jobs'; setEditingJob(job.id); setJobForm({ companyId: job.companyId, title: job.title, description: job.description, location: job.location, employmentType: job.employmentType, applicationUrl: job.applicationUrl }); setSelectedFields((job.applicationForm?.fields || []).map(field => field.id)); setNamedAttachments((job.attachments || []).map((item, i) => ({ id: `existing_${i}`, name: item.name, url: item.url, type: item.type, file: null }))); };
  const archive = async id => { if (!window.confirm('Archive this company?')) return; setSaving(true); try { await adminApi.archiveCompany(id); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const publish = async job => { setSaving(true); setError(''); try { const action = job.status === 'published' ? adminApi.unpublishJobPost : adminApi.publishJobPost; await action(job.id); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const updateApplication = async (id, status) => { setSaving(true); try { await adminApi.updateApplication(id, { status }); await loadApplications(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const readImport = event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const rows = parseCsv(String(reader.result || '')); const errors = rows.flatMap((row, index) => row.name ? [] : [{ row: index + 2, message: 'Company name is required.' }]); setImportRows(rows); setImportErrors(errors); setImportSummary(null); } catch (err) { setImportRows([]); setImportErrors([{ row: 0, message: err.message }]); } }; reader.readAsText(file); };
  const importCompanies = async () => { if (!importRows.length || importErrors.length) return; setSaving(true); setError(''); try { const result = await adminApi.importCompanies(importRows); setImportSummary(result.summary); setImportRows([]); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const readUserImport = event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const rows = parseCsv(String(reader.result || '')); const errors = rows.flatMap((row, index) => !row.fullname || !row.email || !row.username || !row.password ? [{ row: index + 2, message: 'fullName, email, username, and password are required.' }] : []); setUserImportRows(rows); setUserImportErrors(errors); setUserImportSummary(null); }; reader.readAsText(file); };
  const importUsers = async () => { if (!userImportRows.length || userImportErrors.length) return; setSaving(true); setError(''); try { const result = await adminApi.importUsers(userImportRows); setUserImportSummary(result.summary); setUserImportRows([]); await loadUsers(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const promoteUser = async user => { setSaving(true); setError(''); try { await adminApi.setUserRole(user.id, user.role === 'recruiter' ? 'student' : 'recruiter'); await loadUsers(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const reloadUsers = loadUsers;
  const downloadTemplate = () => { const blob = new Blob(['name,website,description,logo_url\nAcme Systems,https://acme.example,Technology company,https://logo.example/acme.png\n'], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pathfolio-companies-template.csv'; link.click(); URL.revokeObjectURL(link.href); };
  const loadOverview = async () => { try { setOverview((await adminApi.overview()).overview); } catch { /* non-critical */ } };
  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { if (tab === 'applications') loadOverview(); }, [tab]);

  const visibleApplications = applications.filter(application => !applicationFilter || application.status === applicationFilter);

  return <main className="pf-admin-page">
    <header className="pf-admin-header pf-admin-header--compact"><div><p className="pf-admin-eyebrow">TnP operations workspace</p><h1>Good to see you, {student?.personal?.fullName?.split(' ')[0] || 'Admin'}.</h1></div></header>
    {overview && <OverviewCards cards={[
      { label: 'Total users', value: overview.total, hint: `${overview.students} students · ${overview.recruiters} recruiters` },
      { label: 'Job posts', value: overview.jobs?.length ?? 0, hint: `${overview.jobs?.filter(j => j.status === 'published').length ?? 0} published` },
      { label: 'Applications', value: overview.applications?.length ?? 0, hint: `${overview.applications?.filter(a => a.status === 'applied').length ?? 0} awaiting review` },
      { label: 'Companies', value: overview.companies?.length ?? 0, hint: `${overview.recentSignups} new users this week` }
    ]} />}
    {error && <div className="pf-admin-error" role="alert">{error}</div>}
    <nav className="pf-admin-tabs">
      {[['jobs', 'Posts', BriefcaseBusiness], ['companies', 'Companies', Building2], ['applications', 'Applications', Users], ['users', 'Users', UserPlus], ['jd', 'JD analyser', FileSearch]].map(([id, label, Icon]) => (
        <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => { window.location.hash = id; }}><Icon size={17} />{label}</button>
      ))}
    </nav>
    {tab === 'companies' && <><CompanyWorkspace companies={companies} companyForm={companyForm} setCompanyForm={setCompanyForm} editingCompany={editingCompany} resetCompany={resetCompany} saveCompany={saveCompany} loading={loading} editCompany={editCompany} archive={archive} saving={saving} update={update} logoFile={logoFile} setLogoFile={setLogoFile} /><CompanyImport importRows={importRows} importErrors={importErrors} importSummary={importSummary} readImport={readImport} importCompanies={importCompanies} downloadTemplate={downloadTemplate} saving={saving} /></>}
    {tab === 'jobs' && <JobWorkspace companies={companies} jobs={jobs} jobForm={jobForm} setJobForm={setJobForm} editingJob={editingJob} resetJob={resetJob} saveJob={saveJob} loading={loading} editJob={editJob} jobFilter={jobFilter} setJobFilter={setJobFilter} publish={publish} saving={saving} selectedFields={selectedFields} setSelectedFields={setSelectedFields} namedAttachments={namedAttachments} setNamedAttachments={setNamedAttachments} update={update} />}
    {tab === 'applications' && <ApplicationWorkspace jobs={jobs} applicationJobFilter={applicationJobFilter} setApplicationJobFilter={setApplicationJobFilter} applications={visibleApplications} loading={loading} applicationFilter={applicationFilter} setApplicationFilter={setApplicationFilter} updateApplication={updateApplication} saving={saving} />}
    {tab === 'users' && <UserWorkspace users={users} userImportRows={userImportRows} userImportErrors={userImportErrors} userImportSummary={userImportSummary} readUserImport={readUserImport} importUsers={importUsers} promoteUser={promoteUser} saving={saving} loading={loading} reload={reloadUsers} adminId={student?.id} />}
    {tab === 'jd' && <JDWorkspace />}
  </main>;
}

function UserWorkspace({ users, userImportRows, userImportErrors, userImportSummary, readUserImport, importUsers, promoteUser, saving, loading, reload, adminId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const [confirmingBlock, setConfirmingBlock] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const filteredUsers = users.filter(user => {
    if (roleFilter && user.role !== roleFilter) return false;
    if (statusFilter === 'blocked' && !user.blocked) return false;
    if (statusFilter === 'active' && user.blocked) return false;
    if (!searchTerm.trim()) return true;
    return `${user.fullName} ${user.email} ${user.username} ${user.department}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const runAction = async action => {
    setActionError(''); setActionMessage('');
    try { await action(); } catch (err) { setActionError(err.message); } finally { setConfirmingBlock(null); setConfirmingDelete(null); setViewingUser(null); }
  };

  const toggleBlock = user => runAction(async () => {
    await adminApi.setUserBlocked(user.id, !user.blocked);
    setActionMessage(user.blocked ? `${user.fullName} can sign in again.` : `${user.fullName} has been blocked from the platform.`);
    await reload();
  });

  const removeUser = user => runAction(async () => {
    await adminApi.deleteUser(user.id);
    setActionMessage(`${user.fullName}'s account has been permanently deleted.`);
    await reload();
  });

  const downloadTemplate = () => { const blob = new Blob(['fullName,email,username,password,role,department,batchYear,rollNumber\nExample Student,student@kiit.ac.in,example-student,change-me-123,student,Computer Science,2028,2024CS101\nExample Recruiter,recruiter@company.com,example-recruiter,change-me-123,recruiter,Recruitment,Operations,\n'], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pathfolio-users-template.csv'; link.click(); URL.revokeObjectURL(link.href); };
  return <>
    {actionError && <div className="pf-admin-error" role="alert">{actionError}</div>}
    {actionMessage && <div className="pf-admin-success" role="status">{actionMessage}</div>}
    <section className="pf-admin-import"><PanelHeading eyebrow="Directory access" title="Bulk add users" /><p className="pf-admin-import-copy">Import student or recruiter accounts in one CSV. Passwords are hashed before storage; users should change temporary passwords after their first sign-in.</p><div className="pf-admin-import-actions"><FilePicker accept=".csv,text/csv" onFile={readUserImport}>Choose CSV file</FilePicker><Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button></div>{userImportRows.length > 0 && <div className="pf-admin-import-preview"><strong>Preview: {userImportRows.length} rows</strong>{userImportRows.slice(0, 5).map((row, index) => <span key={index}>{row.fullname} · {row.email} · {row.role || 'student'}</span>)}</div>}{userImportErrors.length > 0 && <div className="pf-admin-import-errors">{userImportErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}{userImportRows.length > 0 && <Button loading={saving} disabled={userImportErrors.length > 0} icon={UserPlus} onClick={importUsers}>Import {userImportRows.length} users</Button>}{userImportSummary && <div className="pf-admin-import-summary"><b>Imported {userImportSummary.imported}</b><span>{userImportSummary.errors.length} validation errors</span></div>}</section>
    <section className="pf-admin-single pf-admin-user-list"><div className="pf-admin-list">
      <div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">Account directory</p><h2>Users <span>{filteredUsers.length}</span></h2></div>
        <div className="pf-admin-user-filters">
          <input type="search" className="pf-admin-filter" placeholder="Search users..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
          <select className="pf-admin-filter" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="">All roles</option><option value="student">Students</option><option value="recruiter">Recruiters</option><option value="admin">Admins</option></select>
          <select className="pf-admin-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option></select>
        </div>
      </div>
      {loading ? <Empty text="Loading users..." /> : filteredUsers.length === 0 ? <Empty text="No users match this search." /> : filteredUsers.map(user => <article className={`pf-admin-list-item${user.blocked ? ' is-blocked' : ''}`} key={user.id}>
        <div className="pf-admin-user-row">
          {user.avatarUrl ? <img className="pf-admin-user-avatar" src={user.avatarUrl} alt="" /> : <span className="pf-admin-user-avatar pf-admin-user-avatar--fallback"><UserRound size={16} /></span>}
          <div>
            <div className="pf-admin-user-badges"><span className={`pf-admin-status-badge is-${user.role === 'admin' ? 'published' : 'draft'}`}>{user.role}</span>{user.blocked && <span className="pf-admin-status-badge is-blocked">blocked</span>}</div>
            <h3>{user.fullName}</h3>
            <p>{user.email} · @{user.username}{user.department ? ` · ${user.department}` : ''}</p>
          </div>
        </div>
        <div className="pf-admin-item-actions">
          <Button variant="ghost" size="sm" icon={Eye} onClick={() => setViewingUser(user)}>Details</Button>
          {user.role !== 'admin' && <>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => promoteUser(user)}>{user.role === 'recruiter' ? 'Make student' : 'Make recruiter'}</Button>
            <Button variant={user.blocked ? 'outline' : 'ghost'} size="sm" icon={user.blocked ? CheckCircle2 : Ban} onClick={() => setConfirmingBlock(user)}>{user.blocked ? 'Unblock' : 'Block'}</Button>
            <button className="pf-admin-icon-button pf-admin-icon-button--danger" title="Delete user" onClick={() => setConfirmingDelete(user)}><Trash2 size={16} /></button>
          </>}
        </div>
      </article>)}
    </div></section>

    <Modal isOpen={!!viewingUser} onClose={() => setViewingUser(null)} title="User details">
      {viewingUser && <div className="pf-admin-user-details">
        <div className="pf-admin-user-details-head">
          {viewingUser.avatarUrl ? <img className="pf-admin-user-details-avatar" src={viewingUser.avatarUrl} alt="" /> : <span className="pf-admin-user-details-avatar pf-admin-user-details-avatar--fallback"><UserRound size={22} /></span>}
          <div><h3>{viewingUser.fullName}</h3><p className="pf-admin-eyebrow">{viewingUser.role} · joined {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : 'recently'}</p></div>
        </div>
        <dl>
          <dt>Email</dt><dd>{viewingUser.email}</dd>
          <dt>Username</dt><dd>@{viewingUser.username}</dd>
          <dt>Department</dt><dd>{viewingUser.department || 'Not specified'}</dd>
          <dt>Batch</dt><dd>{viewingUser.batchYear || 'Not specified'}</dd>
          <dt>Roll number</dt><dd>{viewingUser.rollNumber || 'Not specified'}</dd>
          <dt>Achievements</dt><dd>{viewingUser.achievementsCount ?? 0}</dd>
          <dt>Interests</dt><dd>{viewingUser.interestsCount ?? 0}</dd>
          <dt>Status</dt><dd>{viewingUser.blocked ? 'Blocked' : 'Active'} · onboarding {viewingUser.onboarding?.completed ? 'completed' : 'in progress'}</dd>
        </dl>
        {viewingUser.email && <a className="pf-admin-user-mail" href={`mailto:${viewingUser.email}`}><Mail size={15} />Email {viewingUser.fullName.split(' ')[0]}</a>}
      </div>}
    </Modal>

    <Modal isOpen={!!confirmingBlock} onClose={() => setConfirmingBlock(null)} title={confirmingBlock?.blocked ? `Unblock ${confirmingBlock?.fullName}?` : `Block ${confirmingBlock?.fullName}?`}
      footer={<><Button variant="secondary" onClick={() => setConfirmingBlock(null)}>Cancel</Button><Button variant={confirmingBlock?.blocked ? 'primary' : 'danger'} loading={saving} onClick={() => toggleBlock(confirmingBlock)}>{confirmingBlock?.blocked ? 'Unblock user' : 'Block user'}</Button></>}>
      <p>{confirmingBlock?.blocked ? 'They will be able to sign in and use the platform again immediately.' : 'They will be signed out and unable to sign in until unblocked. Their profile and applications are preserved.'}</p>
    </Modal>

    <Modal isOpen={!!confirmingDelete} onClose={() => setConfirmingDelete(null)} title={`Delete ${confirmingDelete?.fullName}?`}
      footer={<><Button variant="secondary" onClick={() => setConfirmingDelete(null)}>Cancel</Button><Button variant="danger" loading={saving} onClick={() => removeUser(confirmingDelete)}>Delete permanently</Button></>}>
      <p>This permanently removes {confirmingDelete?.fullName}'s account, profile, achievements, and applications. This action cannot be undone.</p>
    </Modal>
  </>;
}

function LogoDropZone({ logoFile, setLogoFile, companyForm, setCompanyForm }) {
  const [dragging, setDragging] = useState(false);
  const logoPreview = logoFile ? URL.createObjectURL(logoFile) : companyForm.logoUrl || null;
  const accept = file => { if (file && file.type.startsWith('image/')) setLogoFile(file); };
  const onDrop = e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files?.[0]); };
  const onDragOver = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  if (logoPreview) return <div className="pf-admin-logo-preview"><img src={logoPreview} alt="Logo preview" /><button type="button" className="pf-admin-logo-remove" onClick={() => { setLogoFile(null); setCompanyForm(v => ({ ...v, logoUrl: '', logoPublicId: '' })); }}><X size={14} /></button></div>;
  return <label className={`pf-admin-logo-upload${dragging ? ' is-dragging' : ''}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
    <ImagePlus size={20} />
    <span className="pf-admin-logo-upload__text">{dragging ? 'Drop image here' : 'Drag & drop or click to choose'}</span>
    <span className="pf-file-picker pf-file-picker--subtle">Choose file<input type="file" accept="image/*" onChange={e => accept(e.target.files?.[0])} /></span>
  </label>;
}

function CompanyWorkspace({ companies, companyForm, setCompanyForm, editingCompany, resetCompany, saveCompany, loading, editCompany, archive, saving, update, logoFile, setLogoFile }) { const [searchTerm, setSearchTerm] = useState(''); const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())); return <section className="pf-admin-workspace"><div className="pf-admin-panel"><PanelHeading eyebrow="Hiring partners" title={editingCompany ? 'Edit company' : 'Add a company'} action={editingCompany && <Button variant="ghost" size="sm" onClick={resetCompany}>Cancel</Button>} /><form className="pf-admin-form" onSubmit={saveCompany}><Input label="Company name"><input required value={companyForm.name} onChange={update(setCompanyForm, 'name')} /></Input><Input label="Website"><input type="url" value={companyForm.website} onChange={update(setCompanyForm, 'website')} placeholder="https://company.com" /></Input><Input label="Description" full><textarea rows="4" value={companyForm.description} onChange={update(setCompanyForm, 'description')} /></Input><Input label="Company logo" full><LogoDropZone logoFile={logoFile} setLogoFile={setLogoFile} companyForm={companyForm} setCompanyForm={setCompanyForm} /></Input><Button type="submit" loading={saving} icon={editingCompany ? Save : Plus}>{editingCompany ? 'Save changes' : 'Add company'}</Button></form></div><div className="pf-admin-list"><div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">Hiring partners</p><h2>Companies <span>{filteredCompanies.length}</span></h2></div><input type="search" className="pf-admin-filter" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>{loading ? <Empty text="Loading companies..." /> : filteredCompanies.length === 0 ? <Empty text={searchTerm ? 'No companies found matching search.' : 'No companies yet. Add your first hiring partner.'} /> : filteredCompanies.map(company => <article className="pf-admin-list-item" key={company.id}><div className="pf-admin-company-info">{company.logoUrl ? <img className="pf-admin-company-logo" src={company.logoUrl} alt={`${company.name} logo`} /> : <span className="pf-admin-company-logo-fallback"><Building2 size={18} /></span>}<div><h3>{company.name}</h3><p>{company.website || 'No website added'}</p></div></div><div className="pf-admin-item-actions"><Button variant="ghost" size="sm" onClick={() => editCompany(company)}>Edit</Button><button className="pf-admin-icon-button" title="Archive company" onClick={() => archive(company.id)}><Archive size={16} /></button></div></article>)}</div></section>; }

function CompanyImport({ importRows, importErrors, importSummary, readImport, importCompanies, downloadTemplate, saving }) { return <section className="pf-admin-import"><div><PanelHeading eyebrow="Bulk directory setup" title="Import companies" /><p className="pf-admin-import-copy">Upload a CSV, review the rows, then import valid companies in one step.</p><div className="pf-admin-import-actions"><FilePicker accept=".csv,text/csv" onFile={readImport}>Choose CSV file</FilePicker><Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button></div></div>{importRows.length > 0 && <div className="pf-admin-import-preview"><strong>Preview: {importRows.length} rows</strong>{importRows.slice(0, 5).map((row, index) => <span key={index}>{row.name || 'Missing name'}{row.website ? ` · ${row.website}` : ''}{(row.logo_url || row.logourl) ? ' · 🖼️' : ''}</span>)}{importRows.length > 5 && <small>Showing first 5 rows</small>}</div>}{importErrors.length > 0 && <div className="pf-admin-import-errors">{importErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}{importRows.length > 0 && <Button loading={saving} disabled={importErrors.length > 0} icon={Plus} onClick={importCompanies}>Import {importRows.length} companies</Button>}{importSummary && <div className="pf-admin-import-summary"><b>Imported {importSummary.imported}</b><span>{importSummary.duplicates} duplicates skipped</span><span>{importSummary.errors.length} validation errors</span></div>}</section>; }

function AttachmentList({ namedAttachments, setNamedAttachments }) {
  const makeId = () => `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const addFiles = files => { const newItems = [...files].map(f => ({ id: makeId(), name: f.name.replace(/\.[^.]+$/, ''), file: f, url: '', type: f.type || 'application/octet-stream' })); setNamedAttachments(prev => [...prev, ...newItems]); };
  const rename = (id, name) => setNamedAttachments(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  const remove = id => setNamedAttachments(prev => prev.filter(a => a.id !== id));
  const [dragging, setDragging] = useState(false);
  const onDrop = e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); };
  const onDragOver = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  return <div className="pf-admin-attachments">
    {namedAttachments.length > 0 && <ul className="pf-admin-attachment-list">{namedAttachments.map(item => <li key={item.id} className="pf-admin-attachment-item"><Paperclip size={14} className="pf-admin-attach-icon" /><input className="pf-admin-attachment-name" value={item.name} onChange={e => rename(item.id, e.target.value)} placeholder="Attachment name" />{item.url && !item.file && <a href={item.url} target="_blank" rel="noreferrer" className="pf-admin-attach-link">View</a>}<button type="button" className="pf-admin-icon-button" onClick={() => remove(item.id)}><X size={14} /></button></li>)}</ul>}
    <label className={`pf-admin-attach-drop${dragging ? ' is-dragging' : ''}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}><Paperclip size={16} /><span>{dragging ? 'Drop files here' : 'Drag & drop or click to add files'}</span><input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} /></label>
    <small className="pf-admin-help">Files upload to Cloudinary when you save the draft. Click a name to rename it.</small>
  </div>;
}

function JobWorkspace({ companies, jobs, jobForm, setJobForm, editingJob, resetJob, saveJob, loading, editJob, jobFilter, setJobFilter, publish, saving, selectedFields, setSelectedFields, namedAttachments, setNamedAttachments, update }) { return <section className="pf-admin-workspace"><div className="pf-admin-panel"><PanelHeading eyebrow="Opportunity composer" title={editingJob ? 'Edit draft' : 'Create a post'} action={editingJob && <Button variant="ghost" size="sm" onClick={resetJob}>Cancel</Button>} /><form className="pf-admin-form" onSubmit={saveJob}><Input label="Company"><div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}><input type="search" placeholder="Filter companies..." value={jobForm._companySearch || ''} onChange={update(setJobForm, '_companySearch')} /><select required value={jobForm.companyId} onChange={update(setJobForm, 'companyId')}><option value="">Choose a company</option>{companies.filter(c => c.name.toLowerCase().includes((jobForm._companySearch || '').toLowerCase())).map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></div></Input><Input label="Title"><input required value={jobForm.title} onChange={update(setJobForm, 'title')} placeholder="e.g. Software Engineer" /></Input><Input label="Location"><input value={jobForm.location} onChange={update(setJobForm, 'location')} placeholder="Bengaluru / Remote" /></Input><Input label="Employment type"><select value={jobForm.employmentType} onChange={update(setJobForm, 'employmentType')}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select></Input><Input label="Description" full><textarea required rows="7" value={jobForm.description} onChange={update(setJobForm, 'description')} placeholder="Write the role, responsibilities, and requirements..." /></Input><Input label="Application URL" full><input type="url" value={jobForm.applicationUrl} onChange={update(setJobForm, 'applicationUrl')} placeholder="https://..." /></Input><Input label="Attachments" full><AttachmentList namedAttachments={namedAttachments} setNamedAttachments={setNamedAttachments} /></Input><fieldset className="pf-admin-fieldset"><legend>Collect with application</legend>{formOptions.map(([id, label]) => <label key={id}><input type="checkbox" checked={selectedFields.includes(id)} onChange={() => setSelectedFields(fields => fields.includes(id) ? fields.filter(field => field !== id) : [...fields, id])} />{label}</label>)}</fieldset><Button type="submit" loading={saving} icon={Save}>Save draft</Button></form></div><div className="pf-admin-list"><div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">Published content</p><h2>Posts <span>{jobs.length}</span></h2></div><select className="pf-admin-filter" value={jobFilter} onChange={event => setJobFilter(event.target.value)}><option value="">All statuses</option><option value="draft">Drafts</option><option value="published">Published</option></select></div>{loading ? <Empty text="Loading posts..." /> : jobs.length === 0 ? <Empty text="No posts yet. Save a draft to begin." /> : jobs.map((job, idx) => <article className="pf-admin-list-item" key={job.id}><div><span className={`pf-admin-status-badge is-${job.status}`}>#{jobs.length - idx} {job.status}</span><h3>{job.title}</h3><p>{job.companyName} · {job.location || 'Location flexible'} <span className="pf-admin-date"><Clock size={12} /> {formatISTDate(job.updatedAt)} IST</span></p></div><div className="pf-admin-item-actions"><Button variant="ghost" size="sm" onClick={() => editJob(job)} disabled={job.status === 'published'}>Edit</Button><Button variant={job.status === 'published' ? 'outline' : 'primary'} size="sm" loading={saving} icon={job.status === 'published' ? Undo2 : Send} onClick={() => publish(job)}>{job.status === 'published' ? 'Unpublish' : 'Publish'}</Button></div></article>)}</div></section>; }

function ApplicationWorkspace({ jobs, applicationJobFilter, setApplicationJobFilter, applications, loading, applicationFilter, setApplicationFilter, updateApplication, saving }) { 
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState({});
  const [viewingAppId, setViewingAppId] = useState(null);

  const selectedJob = jobs.find(j => j.id === applicationJobFilter);
  const jobFields = selectedJob?.applicationForm?.fields || [];

  const handleFilterChange = (id, value) => {
    setFieldFilters(prev => ({ ...prev, [id]: value }));
  };

  const getFilteredApplications = () => {
    let filtered = applications;
    Object.entries(fieldFilters).forEach(([fieldId, filterValue]) => {
      if (!filterValue) return;
      const lowerFilter = filterValue.toLowerCase();
      filtered = filtered.filter(app => {
        const val = app.answers?.[fieldId];
        if (val === undefined || val === null) return false;
        // if it's a number (like CGPA) handle minimum logic if they typed a number
        if (!isNaN(parseFloat(filterValue)) && !isNaN(parseFloat(val))) {
          return parseFloat(val) >= parseFloat(filterValue);
        }
        return String(val).toLowerCase().includes(lowerFilter);
      });
    });
    return filtered;
  };

  const exportCsv = () => {
    const filteredApps = getFilteredApplications();
    if (filteredApps.length === 0) {
      alert('No applications match the filter criteria.');
      return;
    }
    const allKeys = new Set();
    filteredApps.forEach(app => {
      if (app.answers) Object.keys(app.answers).forEach(k => allKeys.add(k));
    });
    
    const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Email', 'Status', 'Applied At', ...Array.from(allKeys)].map(escapeCsv);
    
    const rows = filteredApps.map(app => {
      const base = [app.profileSnapshot.fullName || '', app.profileSnapshot.email || '', app.status, new Date(app.createdAt).toISOString()];
      const extras = Array.from(allKeys).map(k => app.answers?.[k] || '');
      return [...base, ...extras].map(escapeCsv).join(',');
    });
    
    const csvContent = [header.join(','), ...rows].join('\n');
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const link = document.createElement('a'); 
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'applications_export.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click(); 
    document.body.removeChild(link);
    
    setFilterModalOpen(false);
  };

  if (!applicationJobFilter) {
    return (
      <section className="pf-admin-single">
        <div className="pf-admin-list">
          <div className="pf-admin-panel-heading">
            <div>
              <p className="pf-admin-eyebrow">Candidate pipeline</p>
              <h2>Select a job post</h2>
            </div>
          </div>
          {jobs.length === 0 ? <Empty text="No posts available." /> : jobs.map((job, idx) => (
            <article className="pf-admin-list-item" key={job.id} onClick={() => setApplicationJobFilter(job.id)} style={{ cursor: 'pointer', background: '#fff' }}>
              <div>
                <span className={`pf-admin-status-badge is-${job.status}`}>#{jobs.length - idx}</span>
                <h3>{job.title}</h3>
                <p>{job.companyName}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setApplicationJobFilter(job.id)}>View applications &rarr;</Button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  const viewingApp = applications.find(a => a.id === viewingAppId);
  const displayApplications = getFilteredApplications();

  return (
    <section className="pf-admin-single">
      <div className="pf-admin-list">
        <div className="pf-admin-panel-heading" style={{ flexWrap: 'wrap', gap: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Button variant="ghost" size="sm" onClick={() => setApplicationJobFilter('')}>&larr; Back to job posts</Button>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p className="pf-admin-eyebrow">Candidate pipeline</p>
              <h2>Applications <span>{displayApplications.length}</span></h2>
              <p style={{ color: '#557550', margin: 0, fontWeight: 500 }}>{selectedJob?.title} ({selectedJob?.companyName})</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="pf-admin-filter" value={applicationFilter} onChange={event => setApplicationFilter(event.target.value)}>
                <option value="">All statuses</option>
                <option value="applied">Applied</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="interview">Interview</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Button type="button" onClick={() => setFilterModalOpen(true)} size="sm" variant="outline" icon={Filter}>
                  Filters {Object.values(fieldFilters).some(v => v) ? '(Active)' : ''}
                </Button>
                <Button type="button" onClick={exportCsv} size="sm" variant="primary" icon={Download}>
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {loading ? <Empty text="Loading applications..." /> : displayApplications.length === 0 ? <Empty text="No applications match the current filters." /> : displayApplications.map((application, idx) => (
          <article className="pf-admin-list-item" key={application.id}>
            <div>
              <span className={`pf-admin-status-badge is-${application.status}`}>
                #{displayApplications.length - idx} {application.status}
              </span>
              <h3>{application.profileSnapshot.fullName || 'Student applicant'}</h3>
              <p>
                {application.profileSnapshot.email} 
                {application.profileSnapshot.department && ` · ${application.profileSnapshot.department}`}
                {application.profileSnapshot.batchYear && ` · ${application.profileSnapshot.batchYear}`}
                <span className="pf-admin-date" style={{ marginLeft: '.5rem', paddingLeft: '.5rem', borderLeft: '1px solid #d4dbd2' }}>
                  <Calendar size={12} /> {formatISTDate(application.createdAt)} IST
                </span>
              </p>
            </div>
            <div className="pf-admin-item-actions">
              {application.answers && Object.keys(application.answers).length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setViewingAppId(application.id)} icon={Eye}>
                  View Info
                </Button>
              )}
              <select value={application.status} disabled={saving} onChange={event => updateApplication(application.id, event.target.value)}>
                <option value="applied">Applied</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="interview">Interview</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </article>
        ))}
      </div>

      <Modal isOpen={!!viewingAppId} onClose={() => setViewingAppId(null)} title="Application Details">
        {viewingApp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #eaeaea', paddingBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>{viewingApp.profileSnapshot.fullName}</h3>
              <p style={{ margin: 0, color: '#557550' }}>{viewingApp.profileSnapshot.email}</p>
            </div>
            <div>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 1rem' }}>Submitted Information</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(viewingApp.answers || {}).map(([k, v]) => (
                  <div key={k}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{k}</strong>
                    {v.startsWith('http') ? <a href={v} target="_blank" rel="noreferrer" style={{ color: '#557550' }}>{v}</a> : <span>{v}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Applications" footer={<div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'flex-end' }}><Button variant="ghost" onClick={() => { setFieldFilters({}); setFilterModalOpen(false); }}>Clear Filters</Button><Button variant="primary" onClick={() => setFilterModalOpen(false)}>Apply Filters</Button></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#557550' }}>Filter applications by collected fields. The current filtered view will be used when exporting.</p>
          {jobFields.length === 0 ? (
             <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No custom fields were collected for this job.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {jobFields.map(field => (
                <label key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  {field.label} {field.id.toLowerCase().includes('cgpa') && '(Min)'}
                  <input type="text" placeholder={`Filter by ${field.label.toLowerCase()}...`} value={fieldFilters[field.id] || ''} onChange={e => handleFilterChange(field.id, e.target.value)} style={{ padding: '0.6rem 0.75rem', border: '1px solid #cbd4ca', borderRadius: '4px', fontSize: '0.9rem' }} />
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}

const SAMPLE_JD = `Software Engineer (Frontend) — Full-time, Bengaluru\n\nWe are looking for a frontend engineer to build polished, accessible web experiences for our placement platform.\n\nWhat you will do:\n- Build responsive interfaces using React, JavaScript, and modern CSS.\n- Collaborate with designers to translate Figma flows into production UI.\n- Integrate REST APIs and manage component state with Redux.\n- Write unit tests and participate in code reviews.\n\nWhat we look for:\n- Strong knowledge of HTML, CSS, and TypeScript.\n- Experience with Git and CI/CD workflows.\n- Minimum CGPA of 7.0 with no active backlogs.\n- Bachelor of Technology or equivalent engineering degree.`;

function JDWorkspace() {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', minScore: 0, eligibleOnly: false });

  const analyze = async event => {
    event?.preventDefault();
    if (jobDescription.trim().length < 20) { setError('Paste a fuller job description before analysing.'); return; }
    setLoading(true); setError('');
    try {
      const data = await adminApi.analyzeJobDescription({ jobTitle, jobDescription });
      setResult(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const loadFile = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJobDescription(String(reader.result || ''));
    reader.readAsText(file);
    event.target.value = '';
  };

  const reset = () => { setJobTitle(''); setJobDescription(''); setResult(null); setError(''); setFilters({ search: '', minScore: 0, eligibleOnly: false }); };

  const exportCsv = () => {
    if (!result?.candidates?.length) return;
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Match score', 'Department', 'Batch', 'CGPA', 'Matched skills', 'Eligibility', 'Email'].map(escapeCsv);
    const rows = result.candidates.map(candidate => [candidate.name, candidate.score, candidate.academic?.department || '', candidate.academic?.batchYear || '', candidate.academic?.cgpa ?? '', candidate.matchedSkills.join('; '), candidate.eligibilityFlags.join('; '), candidate.email || 'Private'].map(escapeCsv).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pathfolio-jd-matches.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const candidates = (result?.candidates || []).filter(candidate => {
    if (candidate.score < filters.minScore) return false;
    if (filters.eligibleOnly && candidate.eligibilityFlags.length) return false;
    if (!filters.search.trim()) return true;
    const needle = filters.search.toLowerCase();
    return `${candidate.name} ${candidate.academic?.department || ''} ${candidate.matchedSkills.join(' ')}`.toLowerCase().includes(needle);
  });

  return <section className="pf-admin-workspace pf-admin-jd">
    <div className="pf-admin-panel">
      <PanelHeading eyebrow="Requirement intelligence" title="Analyse a job description" action={<button className="pf-admin-jd-sample" type="button" onClick={() => { setJobTitle('Software Engineer (Frontend)'); setJobDescription(SAMPLE_JD); }}><Wand2 size={14} />Use sample</button>} />
      <p className="pf-admin-import-copy">Paste a job description or upload a .txt / .md file. Pathfolio extracts the meaningful skills and eligibility criteria, then ranks students with an explainable match.</p>
      <form className="pf-admin-form pf-admin-jd-form" onSubmit={analyze}>
        <Input label="Role title (optional)"><input value={jobTitle} onChange={event => setJobTitle(event.target.value)} placeholder="e.g. Frontend Engineer" /></Input>
        <Input label="Job description" full>
          <textarea required rows="12" value={jobDescription} onChange={event => setJobDescription(event.target.value)} placeholder="Paste the full job description here — responsibilities, skills, and qualifications..." />
        </Input>
        <label className="pf-admin-jd-upload"><Upload size={14} />Upload .txt or .md<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={loadFile} /></label>
        <div className="pf-admin-jd-actions">
          <Button type="submit" loading={loading} icon={Sparkles}>Analyse description</Button>
          <Button type="button" variant="ghost" onClick={reset} icon={X}>Clear</Button>
          {result && <Button type="button" variant="outline" onClick={exportCsv} icon={Download}>Export matches</Button>}
        </div>
      </form>
    </div>

    <div className="pf-admin-jd-results">
      {error && <div className="pf-admin-error" role="alert">{error}</div>}
      {!result && !loading && <div className="pf-admin-jd-empty"><Sparkles size={22} /><h3>No analysis yet</h3><p>Analyse a description to see extracted requirements and ranked candidates.</p></div>}
      {loading && <div className="pf-admin-jd-empty"><Clock size={22} /><h3>Analysing description…</h3><p>Extracting skills and scoring eligible student profiles.</p></div>}

      {result && <>
        <article className="pf-admin-jd-analysis">
          <div className="pf-admin-jd-analysis-head"><div><p className="pf-admin-eyebrow">Extracted requirements</p><h2>{result.analysis.role}</h2></div><Target size={22} /></div>
          <p className="pf-admin-jd-summary">{result.analysis.summary}</p>
          <div className="pf-admin-jd-facts">
            <div><span>Domains</span><strong>{result.analysis.domains.join(', ') || 'Not detected'}</strong></div>
            <div><span>Minimum CGPA</span><strong>{result.analysis.minCgpa ?? 'Not specified'}</strong></div>
            <div><span>Experience</span><strong>{result.analysis.experienceYears ? `${result.analysis.experienceYears}+ years` : 'Not specified'}</strong></div>
            <div><span>Education</span><strong>{result.analysis.education.join(', ') || 'Not specified'}</strong></div>
          </div>
          {result.analysis.skills.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label"><ListChecks size={14} />Detected skills ({result.analysis.skills.length})</span><div className="pf-admin-jd-chips">{result.analysis.skills.map(skill => <b key={skill}>{skill}</b>)}</div></div>}
          {result.analysis.keywords.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label">Keywords</span><div className="pf-admin-jd-chips pf-admin-jd-chips--muted">{result.analysis.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div></div>}
          {result.analysis.responsibilities.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label"><FileSearch size={14} />Responsibilities</span><ul className="pf-admin-jd-responsibilities">{result.analysis.responsibilities.map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
          <div className="pf-admin-jd-stats"><div><strong>{result.stats.evaluated}</strong><span>profiles evaluated</span></div><div><strong>{result.stats.strongMatches}</strong><span>strong matches</span></div><div><strong>{result.stats.returned}</strong><span>ranked below</span></div></div>
        </article>

        <div className="pf-admin-list">
          <div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">Ranked candidates</p><h2>Matches <span>{candidates.length}</span></h2></div></div>
          <div className="pf-admin-jd-filters">
            <input type="search" className="pf-admin-filter" placeholder="Search candidates or skills..." value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} />
            <label className="pf-admin-jd-score"><span>Min score</span><input type="range" min="0" max="100" step="5" value={filters.minScore} onChange={event => setFilters(prev => ({ ...prev, minScore: Number(event.target.value) }))} /><b>{filters.minScore}%</b></label>
            <label className="pf-admin-jd-toggle"><input type="checkbox" checked={filters.eligibleOnly} onChange={event => setFilters(prev => ({ ...prev, eligibleOnly: event.target.checked }))} />Eligible only</label>
          </div>
          {candidates.length === 0 ? <Empty text="No candidates match the current filters." /> : candidates.map(candidate => <article className="pf-admin-jd-candidate" key={candidate.id}>
            <div className="pf-admin-jd-candidate-top">
              <div className="pf-admin-jd-candidate-id"><span className="pf-admin-jd-avatar"><UserRound size={18} /></span><div><h3>{candidate.name}</h3><p>{candidate.academic?.department || 'Department not listed'}{candidate.academic?.batchYear ? ` · Batch ${candidate.academic.batchYear}` : ''}{candidate.academic?.cgpa ? ` · CGPA ${candidate.academic.cgpa}` : ''}</p></div></div>
              <div className="pf-admin-jd-score-badge" style={{ '--score': `${candidate.score}%` }}><strong>{candidate.score}%</strong><span>match</span></div>
            </div>
            <div className="pf-admin-jd-candidate-reasons">{candidate.reasons.map(reason => <span key={reason}><CheckCircle2 size={14} />{reason}</span>)}</div>
            {candidate.matchedSkills.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label">Matched skills</span><div className="pf-admin-jd-chips">{candidate.matchedSkills.map(skill => <b key={skill}>{skill}</b>)}</div></div>}
            {candidate.missingSkills.length > 0 && <div className="pf-admin-jd-block"><span className="pf-admin-jd-block-label">Not evidenced</span><div className="pf-admin-jd-chips pf-admin-jd-chips--muted">{candidate.missingSkills.map(skill => <span key={skill}>{skill}</span>)}</div></div>}
            <div className="pf-admin-jd-candidate-foot">
              {candidate.eligibilityFlags.length > 0 ? <span className="pf-admin-jd-flag"><AlertTriangle size={14} />{candidate.eligibilityFlags.join(' · ')}</span> : <span className="pf-admin-jd-ok"><CheckCircle2 size={14} />Meets stated eligibility</span>}
              {candidate.email ? <a className="pf-candidate-contact" href={`mailto:${candidate.email}`}>Contact candidate</a> : <span className="pf-admin-jd-private">Contact hidden by privacy settings</span>}
            </div>
          </article>)}
        </div>
      </>}
    </div>
  </section>;
}
