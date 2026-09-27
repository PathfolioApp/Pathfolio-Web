import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, BriefcaseBusiness, Building2, Calendar, Clock, FileSearch, ImagePlus, LayoutDashboard, LogOut, Paperclip, Plus, Save, Send, Users, Undo2, X, Eye, EyeOff, Filter, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { adminApi } from '../services/adminApi';
import './AdminPage.css';

const emptyCompany = { name: '', website: '', description: '', logoUrl: '', logoPublicId: '' };
const emptyJob = { companyId: '', title: '', description: '', location: '', employmentType: 'Full-time', applicationUrl: '' };
const formOptions = [['rollNumber', 'Roll number'], ['department', 'Department'], ['batchYear', 'Batch year'], ['resumeUrl', 'Resume link'], ['portfolioUrl', 'Portfolio link'], ['skills', 'Skills'], ['cgpa', 'CGPA']];

function Input({ label, children, full = false }) { return <label className={full ? 'pf-admin-full-field' : ''}>{label}{children}</label>; }
function PanelHeading({ eyebrow, title, action }) { return <div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>; }
function Empty({ text }) { return <p className="pf-admin-empty">{text}</p>; }
async function uploadToCloudinary(file) { const signed = await adminApi.uploadSignature(); const formData = new FormData(); formData.append('file', file); formData.append('api_key', signed.apiKey); formData.append('timestamp', signed.timestamp); formData.append('folder', signed.folder); if (signed.accessMode) formData.append('access_mode', signed.accessMode); formData.append('signature', signed.signature); const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`, { method: 'POST', body: formData }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error?.message || `Unable to upload ${file.name}.`); return { name: file.name, url: data.secure_url, publicId: data.public_id, type: file.type || 'application/octet-stream' }; }
function parseCsv(text) { const rows = []; let row = []; let value = ''; let quoted = false; for (let index = 0; index < text.length; index += 1) { const character = text[index]; const next = text[index + 1]; if (character === '"' && quoted && next === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; } else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') index += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; } else value += character; } row.push(value.trim()); if (row.some(Boolean)) rows.push(row); if (!rows.length) return []; const headers = rows.shift().map(header => header.toLowerCase().replace(/\s+/g, '')); return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))); }

const formatISTDate = dateString => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(dateString));
};
export function AdminPage() {
  const { student, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('jobs');
  const [companies, setCompanies] = useState([]); const [jobs, setJobs] = useState([]); const [applications, setApplications] = useState([]);
  const [importRows, setImportRows] = useState([]); const [importErrors, setImportErrors] = useState([]); const [importSummary, setImportSummary] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany); const [logoFile, setLogoFile] = useState(null); const [jobForm, setJobForm] = useState(emptyJob); const [selectedFields, setSelectedFields] = useState([]); const [namedAttachments, setNamedAttachments] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null); const [editingJob, setEditingJob] = useState(null); const [jobFilter, setJobFilter] = useState(''); const [applicationFilter, setApplicationFilter] = useState(''); const [applicationJobFilter, setApplicationJobFilter] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const update = (setter, field) => event => setter(value => ({ ...value, [field]: event.target.value }));
  const loadBase = async () => { setLoading(true); setError(''); try { const [companyData, jobData] = await Promise.all([adminApi.companies(), adminApi.jobPosts(jobFilter)]); setCompanies(companyData.companies); setJobs(jobData.jobPosts); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  const loadApplications = async () => { setLoading(true); try { const data = await adminApi.applications(applicationJobFilter); setApplications(data.applications); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { loadBase(); }, [jobFilter]);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, applicationJobFilter]);
  const resetCompany = () => { setCompanyForm({ ...emptyCompany }); setLogoFile(null); setEditingCompany(null); };
  const resetJob = () => { setJobForm({ ...emptyJob, companyId: companies[0]?.id || '' }); setSelectedFields([]); setNamedAttachments([]); setEditingJob(null); };
  const saveCompany = async event => { event.preventDefault(); setSaving(true); setError(''); try { const payload = { ...companyForm }; if (logoFile) { const uploaded = await uploadToCloudinary(logoFile); payload.logoUrl = uploaded.url; payload.logoPublicId = uploaded.publicId; } if (editingCompany) await adminApi.updateCompany(editingCompany, payload); else await adminApi.createCompany(payload); resetCompany(); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const saveJob = async event => { event.preventDefault(); setSaving(true); setError(''); try { const attachments = await Promise.all(namedAttachments.map(async item => { if (item.file) { const uploaded = await uploadToCloudinary(item.file); return { name: item.name || uploaded.name, url: uploaded.url, publicId: uploaded.publicId, type: uploaded.type }; } return { name: item.name, url: item.url, type: item.type || 'link' }; })); const payload = { ...jobForm, attachments, applicationForm: { fields: selectedFields.map(id => ({ id, label: formOptions.find(option => option[0] === id)?.[1], type: id.includes('Url') ? 'url' : 'text', required: false })) } }; if (editingJob) await adminApi.updateJobPost(editingJob, payload); else await adminApi.createJobPost(payload); resetJob(); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const editCompany = company => { setTab('companies'); setEditingCompany(company.id); setCompanyForm({ name: company.name, website: company.website, description: company.description, logoUrl: company.logoUrl || '', logoPublicId: company.logoPublicId || '' }); setLogoFile(null); };
  const editJob = job => { setTab('jobs'); setEditingJob(job.id); setJobForm({ companyId: job.companyId, title: job.title, description: job.description, location: job.location, employmentType: job.employmentType, applicationUrl: job.applicationUrl }); setSelectedFields((job.applicationForm?.fields || []).map(field => field.id)); setNamedAttachments((job.attachments || []).map((item, i) => ({ id: `existing_${i}`, name: item.name, url: item.url, type: item.type, file: null }))); };
  const archive = async id => { if (!window.confirm('Archive this company?')) return; setSaving(true); try { await adminApi.archiveCompany(id); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const publish = async job => { setSaving(true); setError(''); try { const action = job.status === 'published' ? adminApi.unpublishJobPost : adminApi.publishJobPost; await action(job.id); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const updateApplication = async (id, status) => { setSaving(true); try { await adminApi.updateApplication(id, { status }); await loadApplications(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const readImport = event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const rows = parseCsv(String(reader.result || '')); const errors = rows.flatMap((row, index) => row.name ? [] : [{ row: index + 2, message: 'Company name is required.' }]); setImportRows(rows); setImportErrors(errors); setImportSummary(null); } catch (err) { setImportRows([]); setImportErrors([{ row: 0, message: err.message }]); } }; reader.readAsText(file); };
  const importCompanies = async () => { if (!importRows.length || importErrors.length) return; setSaving(true); setError(''); try { const result = await adminApi.importCompanies(importRows); setImportSummary(result.summary); setImportRows([]); await loadBase(); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  const downloadTemplate = () => { const blob = new Blob(['name,website,description,logo_url\nAcme Systems,https://acme.example,Technology company,https://logo.example/acme.png\n'], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pathfolio-companies-template.csv'; link.click(); URL.revokeObjectURL(link.href); };
  const visibleApplications = applications.filter(application => !applicationFilter || application.status === applicationFilter);

  return <main className="pf-admin-page"><header className="pf-admin-header"><div><p className="pf-admin-eyebrow">TnP operations workspace</p><h1>Good to see you, {student?.personal?.fullName || 'Admin'}.</h1><p className="pf-admin-intro">Publish opportunities, collect applications, and move candidates through your hiring workflow.</p></div><div className="pf-admin-header-actions"><button className="pf-admin-dashboard-btn" type="button" onClick={() => navigate('/dashboard')}><LayoutDashboard size={16} />Student view</button><button className="pf-admin-signout" type="button" onClick={logout}><LogOut size={16} />Sign out</button></div></header>
    {error && <div className="pf-admin-error" role="alert">{error}</div>}
    <nav className="pf-admin-tabs"><button className={tab === 'jobs' ? 'is-active' : ''} onClick={() => setTab('jobs')}><BriefcaseBusiness size={17} />Posts</button><button className={tab === 'companies' ? 'is-active' : ''} onClick={() => setTab('companies')}><Building2 size={17} />Companies</button><button className={tab === 'applications' ? 'is-active' : ''} onClick={() => setTab('applications')}><Users size={17} />Applications</button><button className="pf-admin-tab-muted" type="button"><FileSearch size={17} />JD matching <span>Coming soon</span></button></nav>
    {tab === 'companies' && <><CompanyWorkspace companies={companies} companyForm={companyForm} setCompanyForm={setCompanyForm} editingCompany={editingCompany} resetCompany={resetCompany} saveCompany={saveCompany} loading={loading} editCompany={editCompany} archive={archive} saving={saving} update={update} logoFile={logoFile} setLogoFile={setLogoFile} /><CompanyImport importRows={importRows} importErrors={importErrors} importSummary={importSummary} readImport={readImport} importCompanies={importCompanies} downloadTemplate={downloadTemplate} saving={saving} /></>}
    {tab === 'jobs' && <JobWorkspace companies={companies} jobs={jobs} jobForm={jobForm} setJobForm={setJobForm} editingJob={editingJob} resetJob={resetJob} saveJob={saveJob} loading={loading} editJob={editJob} jobFilter={jobFilter} setJobFilter={setJobFilter} publish={publish} saving={saving} selectedFields={selectedFields} setSelectedFields={setSelectedFields} namedAttachments={namedAttachments} setNamedAttachments={setNamedAttachments} update={update} />}
    {tab === 'applications' && <ApplicationWorkspace jobs={jobs} applicationJobFilter={applicationJobFilter} setApplicationJobFilter={setApplicationJobFilter} applications={visibleApplications} loading={loading} applicationFilter={applicationFilter} setApplicationFilter={setApplicationFilter} updateApplication={updateApplication} saving={saving} />}
    <section className="pf-admin-coming-soon"><span><FileSearch size={18} />JD analysis and candidate matching</span><b>Coming soon</b><p>Paste a job description and discover eligible students with explainable matching.</p></section>
  </main>;
}

function LogoDropZone({ logoFile, setLogoFile, companyForm, setCompanyForm }) {
  const [dragging, setDragging] = useState(false);
  const logoPreview = logoFile ? URL.createObjectURL(logoFile) : companyForm.logoUrl || null;
  const accept = file => { if (file && file.type.startsWith('image/')) setLogoFile(file); };
  const onDrop = e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files?.[0]); };
  const onDragOver = e => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  if (logoPreview) return <div className="pf-admin-logo-preview"><img src={logoPreview} alt="Logo preview" /><button type="button" className="pf-admin-logo-remove" onClick={() => { setLogoFile(null); setCompanyForm(v => ({ ...v, logoUrl: '', logoPublicId: '' })); }}><X size={14} /></button></div>;
  return <label className={`pf-admin-logo-upload${dragging ? ' is-dragging' : ''}`} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}><ImagePlus size={20} /><span>{dragging ? 'Drop image here' : 'Drag & drop or click to choose'}</span><input type="file" accept="image/*" onChange={e => accept(e.target.files?.[0])} /></label>;
}

function CompanyWorkspace({ companies, companyForm, setCompanyForm, editingCompany, resetCompany, saveCompany, loading, editCompany, archive, saving, update, logoFile, setLogoFile }) { const [searchTerm, setSearchTerm] = useState(''); const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())); return <section className="pf-admin-workspace"><div className="pf-admin-panel"><PanelHeading eyebrow="Hiring partners" title={editingCompany ? 'Edit company' : 'Add a company'} action={editingCompany && <Button variant="ghost" size="sm" onClick={resetCompany}>Cancel</Button>} /><form className="pf-admin-form" onSubmit={saveCompany}><Input label="Company name"><input required value={companyForm.name} onChange={update(setCompanyForm, 'name')} /></Input><Input label="Website"><input type="url" value={companyForm.website} onChange={update(setCompanyForm, 'website')} placeholder="https://company.com" /></Input><Input label="Description" full><textarea rows="4" value={companyForm.description} onChange={update(setCompanyForm, 'description')} /></Input><Input label="Company logo" full><LogoDropZone logoFile={logoFile} setLogoFile={setLogoFile} companyForm={companyForm} setCompanyForm={setCompanyForm} /></Input><Button type="submit" loading={saving} icon={editingCompany ? Save : Plus}>{editingCompany ? 'Save changes' : 'Add company'}</Button></form></div><div className="pf-admin-list"><div className="pf-admin-panel-heading"><div><p className="pf-admin-eyebrow">Hiring partners</p><h2>Companies <span>{filteredCompanies.length}</span></h2></div><input type="search" className="pf-admin-filter" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>{loading ? <Empty text="Loading companies..." /> : filteredCompanies.length === 0 ? <Empty text={searchTerm ? 'No companies found matching search.' : 'No companies yet. Add your first hiring partner.'} /> : filteredCompanies.map(company => <article className="pf-admin-list-item" key={company.id}><div className="pf-admin-company-info">{company.logoUrl ? <img className="pf-admin-company-logo" src={company.logoUrl} alt={`${company.name} logo`} /> : <span className="pf-admin-company-logo-fallback"><Building2 size={18} /></span>}<div><h3>{company.name}</h3><p>{company.website || 'No website added'}</p></div></div><div className="pf-admin-item-actions"><Button variant="ghost" size="sm" onClick={() => editCompany(company)}>Edit</Button><button className="pf-admin-icon-button" title="Archive company" onClick={() => archive(company.id)}><Archive size={16} /></button></div></article>)}</div></section>; }

function CompanyImport({ importRows, importErrors, importSummary, readImport, importCompanies, downloadTemplate, saving }) { return <section className="pf-admin-import"><div><PanelHeading eyebrow="Bulk directory setup" title="Import companies" /><p className="pf-admin-import-copy">Upload a CSV, review the rows, then import valid companies in one step.</p><div className="pf-admin-import-actions"><input type="file" accept=".csv,text/csv" onChange={readImport} /><Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button></div></div>{importRows.length > 0 && <div className="pf-admin-import-preview"><strong>Preview: {importRows.length} rows</strong>{importRows.slice(0, 5).map((row, index) => <span key={index}>{row.name || 'Missing name'}{row.website ? ` · ${row.website}` : ''}{(row.logo_url || row.logourl) ? ' · 🖼️' : ''}</span>)}{importRows.length > 5 && <small>Showing first 5 rows</small>}</div>}{importErrors.length > 0 && <div className="pf-admin-import-errors">{importErrors.map((item, index) => <span key={index}>Row {item.row}: {item.message}</span>)}</div>}{importRows.length > 0 && <Button loading={saving} disabled={importErrors.length > 0} icon={Plus} onClick={importCompanies}>Import {importRows.length} companies</Button>}{importSummary && <div className="pf-admin-import-summary"><b>Imported {importSummary.imported}</b><span>{importSummary.duplicates} duplicates skipped</span><span>{importSummary.errors.length} validation errors</span></div>}</section>; }

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
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#9aa79a', margin: '0 0 1rem' }}>Submitted Information</h4>
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
             <p style={{ color: '#777', fontStyle: 'italic', margin: 0 }}>No custom fields were collected for this job.</p>
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
