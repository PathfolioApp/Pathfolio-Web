import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, BarChart3, Check, CheckCircle2, ChevronDown, Download, Edit3, FileText, Filter, MoreHorizontal,
  Plus, Search, Settings2, Star, Trash2, UploadCloud, X, Zap,
} from 'lucide-react';
import { resumeApi, uploadResume } from './resumeApi';
import { Button } from '../../../components/ui/Button';
import './ResumePage.css';
import './ResumePageEnhancements.css';

const FALLBACK_CATEGORIES = ['Software Engineering', 'Backend Engineering', 'Cloud / DevOps', 'Data / AI', 'Core Engineering', 'Design / Product', 'General'];

function analysisStatus(resume) {
  if (!resume.analysis) return { label: 'Not analysed', tone: 'muted' };
  if ((resume.analysis.score || 0) >= 75) return { label: 'Analysis complete', tone: 'good' };
  return { label: 'Needs review', tone: 'warn' };
}

export function ResumePage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('General');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [role, setRole] = useState('All');
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [sort, setSort] = useState('updated');
  const [openMenu, setOpenMenu] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [resumeData, categoryData] = await Promise.all([resumeApi.list(), resumeApi.categories()]);
      setResumes(Array.isArray(resumeData) ? resumeData : []);
      setCategories(Array.isArray(categoryData) && categoryData.length ? categoryData : FALLBACK_CATEGORIES);
    } catch (err) {
      setError(err.message || 'Unable to load your resumes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const roles = useMemo(() => ['All', ...new Set(resumes.flatMap(resume => resume.tags || []))], [resumes]);
  const visibleResumes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resumes
      .filter(resume => !query || resume.filename.toLowerCase().includes(query) || (resume.tags || []).some(tag => tag.toLowerCase().includes(query)))
      .filter(resume => category === 'All' || (resume.category || 'General') === category)
      .filter(resume => role === 'All' || (resume.tags || []).includes(role))
      .filter(resume => !primaryOnly || resume.isDefault)
      .sort((a, b) => {
        if (sort === 'name') return a.filename.localeCompare(b.filename);
        if (sort === 'uploaded') return new Date(b.uploadedAt) - new Date(a.uploadedAt);
        return new Date(b.updatedAt || b.uploadedAt) - new Date(a.updatedAt || a.uploadedAt);
      });
  }, [resumes, search, category, role, primaryOnly, sort]);
  const libraryStats = useMemo(() => ({
    analyzed: resumes.filter(resume => resume.analysis).length,
    primary: resumes.filter(resume => resume.isDefault).length,
    average: resumes.length ? Math.round(resumes.filter(resume => resume.analysis).reduce((total, resume) => total + Number(resume.analysis.score || 0), 0) / Math.max(1, resumes.filter(resume => resume.analysis).length)) : 0,
  }), [resumes]);

  const handleUpload = async event => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const invalid = files.find(file => file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setError(`${invalid.name}: upload a PDF under 10 MB.`);
      event.target.value = '';
      return;
    }
    try {
      setUploading(true);
      setError('');
      for (const file of files) await uploadResume(file, [], uploadCategory);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to upload resume.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const setPrimary = async resume => {
    if (resume.isDefault || !window.confirm(`Make ${resume.filename} your Primary Resume?`)) return;
    try {
      await resumeApi.setDefault(resume.id);
      await load();
    } catch (err) { setError(err.message || 'Unable to change your primary resume.'); }
  };

  const deleteResume = async resume => {
    const replacement = resume.isDefault ? resumes.find(item => item.id !== resume.id) : null;
    if (!window.confirm(`Delete ${resume.filename}? The original uploaded file will be removed.`)) return;
    try {
      await resumeApi.remove(resume.id);
      if (replacement && window.confirm(`Set ${replacement.filename} as your new Primary Resume?`)) await resumeApi.setDefault(replacement.id);
      await load();
    } catch (err) { setError(err.message || 'Unable to delete resume.'); }
  };

  const createCategory = async event => {
    event.preventDefault();
    if (!categoryName.trim()) return;
    try {
      setSavingCategory(true);
      setCategoryError('');
      await resumeApi.createCategory(categoryName.trim());
      setCategoryName('');
      await load();
    } catch (err) { setCategoryError(err.message || 'Unable to create category.'); }
    finally { setSavingCategory(false); }
  };

  const renameCategory = async name => {
    const nextName = window.prompt('Rename category', name);
    if (!nextName || nextName.trim() === name) return;
    try { await resumeApi.renameCategory(name, nextName.trim()); await load(); }
    catch (err) { setError(err.message || 'Unable to rename category.'); }
  };

  const removeCategory = async name => {
    if (!window.confirm(`Remove ${name}? Resumes will move to General.`)) return;
    try { await resumeApi.deleteCategory(name); await load(); }
    catch (err) { setError(err.message || 'Unable to remove category.'); }
  };

  return (
    <div className="pf-resume-library">
      <header className="pf-library-header">
        <div><span className="pf-library-eyebrow">Career workspace</span><h1>My Resumes</h1><p>Manage, analyse, and tailor resumes for every role you apply to.</p></div>
        <div className="pf-library-header-actions">
          <select value={uploadCategory} onChange={event => setUploadCategory(event.target.value)} aria-label="Upload category">{categories.map(item => <option key={item}>{item}</option>)}</select>
          <Button variant="secondary" onClick={() => navigate('/resume/studio')}><Zap size={15} /> Build Resume</Button>
          <label className="pf-library-upload"><UploadCloud size={16} /> {uploading ? 'Uploading...' : 'Upload Resume'}<input type="file" accept="application/pdf" multiple onChange={handleUpload} disabled={uploading} hidden /></label>
        </div>
      </header>

      {error && <div className="pf-library-alert" role="alert">{error}<button type="button" onClick={() => setError('')}><X size={15} /></button></div>}

      <section className="pf-library-snapshot" aria-label="Resume library summary">
        <div><span><FileText size={15} /> Library</span><strong>{resumes.length}</strong><small>saved resume{resumes.length === 1 ? '' : 's'}</small></div>
        <div><span><CheckCircle2 size={15} /> Coverage</span><strong>{libraryStats.analyzed}/{resumes.length || 0}</strong><small>analysed</small></div>
        <div><span><Star size={15} /> Primary</span><strong>{libraryStats.primary}</strong><small>default resume</small></div>
        <div><span><BarChart3 size={15} /> Average score</span><strong>{libraryStats.analyzed ? `${libraryStats.average}%` : '—'}</strong><small>{libraryStats.analyzed ? 'local ATS estimate' : 'run analysis to compare'}</small></div>
      </section>

      <section className="pf-library-toolbar" aria-label="Resume filters">
        <div className="pf-library-count"><strong>{resumes.length}</strong><span>resume{resumes.length === 1 ? '' : 's'}</span></div>
        <label className="pf-library-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search filename or role" aria-label="Search resumes" /></label>
        <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by category"><option value="All">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
        <select value={role} onChange={event => setRole(event.target.value)} aria-label="Filter by role"><option value="All">All roles</option>{roles.slice(1).map(item => <option key={item}>{item}</option>)}</select>
        <button type="button" className={`pf-filter-toggle ${primaryOnly ? 'is-active' : ''}`} onClick={() => setPrimaryOnly(value => !value)}><Star size={14} fill={primaryOnly ? 'currentColor' : 'none'} /> Primary only</button>
        <label className="pf-library-sort">Sort <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort resumes"><option value="updated">Last modified</option><option value="uploaded">Upload date</option><option value="name">Name</option></select></label>
      </section>

      <details className="pf-category-manager"><summary><Settings2 size={15} /> Manage categories <ChevronDown size={15} /></summary><div className="pf-category-manager-body"><form onSubmit={createCategory}><input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="New custom category" maxLength={48} /><button type="submit" disabled={savingCategory}><Plus size={14} /> Add</button></form>{categoryError && <small>{categoryError}</small>}<div className="pf-category-list">{categories.filter(item => !FALLBACK_CATEGORIES.includes(item)).map(item => <span key={item}>{item}<button type="button" onClick={() => renameCategory(item)} title={`Rename ${item}`}><Edit3 size={12} /></button><button type="button" onClick={() => removeCategory(item)} title={`Remove ${item}`}><Trash2 size={12} /></button></span>)}</div></div></details>

      <main className="pf-resume-library-list">
        {loading ? <div className="pf-library-empty"><Archive size={25} /><p>Loading your resume library...</p></div> : visibleResumes.length === 0 ? <div className="pf-library-empty"><FileText size={28} /><h2>{resumes.length ? 'No resumes match these filters' : 'Your library is ready'}</h2><p>{resumes.length ? 'Try another category, role, or search term.' : 'Upload a PDF or start with a polished resume template.'}</p></div> : visibleResumes.map(resume => {
          const status = analysisStatus(resume);
          return <article className="pf-resume-row" key={resume.id}>
            <div className="pf-resume-row-file"><span className="pf-resume-row-icon"><FileText size={22} /></span><div><h2>{resume.filename}</h2><div className="pf-resume-row-sub"><span className={`pf-resume-kind ${resume.isDefault ? 'is-primary' : ''}`}>{resume.isDefault ? <><Star size={12} fill="currentColor" /> Primary Resume</> : 'Secondary resume'}</span><span>{resume.category || 'General'}</span><span>Updated {new Date(resume.updatedAt || resume.uploadedAt).toLocaleDateString()}</span></div><div className="pf-resume-row-tags">{(resume.tags || []).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}{(resume.tags || []).length > 4 && <span>+{resume.tags.length - 4}</span>}</div></div></div>
            <div className="pf-resume-row-analysis"><span className={`pf-analysis-status is-${status.tone}`}>{status.tone === 'good' ? <Check size={13} /> : status.tone === 'warn' ? <Filter size={13} /> : <Archive size={13} />}{status.label}</span>{resume.analysis?.score !== undefined && <strong>{resume.analysis.score}%</strong>}</div>
            <div className="pf-resume-row-actions"><button type="button" onClick={() => navigate(`/resume/${resume.id}`)}>View Resume</button><button type="button" onClick={() => navigate(`/resume/${resume.id}/studio`)}>Edit in Studio</button><button type="button" className="pf-row-more" onClick={() => setOpenMenu(openMenu === resume.id ? null : resume.id)} aria-label={`More actions for ${resume.filename}`}><MoreHorizontal size={18} /></button>{openMenu === resume.id && <div className="pf-row-menu"><button type="button" onClick={() => navigate(`/resume/${resume.id}?tab=analysis`)}>View Analysis</button><a href={resume.downloadUrl} download={resume.filename}><Download size={14} /> Download</a>{!resume.isDefault && <button type="button" onClick={() => setPrimary(resume)}>Set as primary</button>}<button type="button" onClick={() => deleteResume(resume)} className="is-danger"><Trash2 size={14} /> Delete</button></div>}</div>
          </article>;
        })}
      </main>
    </div>
  );
}
