import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, BarChart3, Check, CheckCircle2, ChevronDown, Download, Edit3, FileText, Filter, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, Star, Trash2, UploadCloud, X, Zap, Layers, FileCheck, Gauge,
  CircleDashed, AlertCircle, Target
} from 'lucide-react';
import { resumeApi, uploadResume } from './resumeApi';
import { Button } from '../../../components/ui/Button';
import { PdfIcon } from '../../../components/ui/PdfIcon';
import './ResumePage.css';
import './ResumePageEnhancements.css';

const FALLBACK_CATEGORIES = ['Software Engineering', 'Backend Engineering', 'Cloud / DevOps', 'Data / AI', 'Core Engineering', 'Design / Product', 'General'];

function analysisStatus(resume) {
  if (!resume.analysis) return { label: 'Not analysed', tone: 'muted' };
  if ((resume.analysis.score || 0) >= 75) return { label: 'ATS Ready', tone: 'good' };
  return { label: 'Needs review', tone: 'warn' };
}

export function ResumePage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
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
      for (const file of files) await uploadResume(file, [], 'General');
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

  const changeResumeCategory = async resume => {
    const currentCat = resume.category || 'General';
    const nextCat = window.prompt(
      `Change category for "${resume.filename}":\n\nExisting categories: ${categories.join(', ')}`,
      currentCat
    );
    if (!nextCat || !nextCat.trim() || nextCat.trim() === currentCat) return;
    try {
      await resumeApi.updateCategory(resume.id, nextCat.trim());
      await load();
    } catch (err) {
      setError(err.message || 'Unable to update category.');
    }
  };

  return (
    <div className="pf-resume-library">
      <header className="pf-library-header">
        <div>
          <span className="pf-library-eyebrow">Career workspace</span>
          <h1>My Resumes</h1>
          <p>Manage, analyse, and tailor verified resumes for every role you apply to.</p>
        </div>
        <div className="pf-library-header-actions">
          <button
            type="button"
            className="pf-btn-tailor-jd"
            onClick={() => setNotice('AI Resume Tailor is coming soon! You will be able to input any Job Description and auto-generate an ATS-optimized resume matched to your profile.')}
          >
            <Target size={15} /> Tailor for JD
          </button>
          <button type="button" className="pf-btn-build-studio" onClick={() => navigate('/resume/studio')}>
            <Sparkles size={15} /> Build in Studio
          </button>
          <label className="pf-library-upload">
            <UploadCloud size={16} /> {uploading ? 'Uploading...' : 'Upload PDF'}
            <input type="file" accept="application/pdf" multiple onChange={handleUpload} disabled={uploading} hidden />
          </label>
        </div>
      </header>

      {notice && (
        <div className="pf-library-notice" role="status">
          <div className="pf-library-notice-content">
            <Target size={16} />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={15} /></button>
        </div>
      )}

      {error && (
        <div className="pf-library-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss alert"><X size={15} /></button>
        </div>
      )}

      <section className="pf-library-snapshot" aria-label="Resume library summary">
        <div className="pf-snapshot-card">
          <div className="pf-snapshot-card-top">
            <span className="pf-snapshot-label">Total Resumes</span>
            <div className="pf-snapshot-icon-wrapper is-emerald"><Layers size={15} strokeWidth={2.2} /></div>
          </div>
          <div className="pf-snapshot-card-bottom">
            <strong className="pf-snapshot-value">{resumes.length}</strong>
            <span className="pf-snapshot-badge is-neutral">In library</span>
          </div>
        </div>

        <div className="pf-snapshot-card">
          <div className="pf-snapshot-card-top">
            <span className="pf-snapshot-label">ATS Analysed</span>
            <div className="pf-snapshot-icon-wrapper is-teal"><FileCheck size={15} strokeWidth={2.2} /></div>
          </div>
          <div className="pf-snapshot-card-bottom">
            <strong className="pf-snapshot-value">
              {libraryStats.analyzed}
              <small className="pf-snapshot-denom"> / {resumes.length || 0}</small>
            </strong>
            <span className="pf-snapshot-badge is-neutral">
              {resumes.length ? `${Math.round((libraryStats.analyzed / resumes.length) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="pf-snapshot-card">
          <div className="pf-snapshot-card-top">
            <span className="pf-snapshot-label">Primary Resume</span>
            <div className="pf-snapshot-icon-wrapper is-amber"><Star size={15} fill="currentColor" strokeWidth={2} /></div>
          </div>
          <div className="pf-snapshot-card-bottom">
            <strong className="pf-snapshot-value">{libraryStats.primary ? '1' : '0'}</strong>
            <span className={`pf-snapshot-badge ${libraryStats.primary ? 'is-active' : 'is-missing'}`}>
              {libraryStats.primary ? 'Active' : 'Not set'}
            </span>
          </div>
        </div>

        <div className="pf-snapshot-card">
          <div className="pf-snapshot-card-top">
            <span className="pf-snapshot-label">Avg Readiness</span>
            <div className="pf-snapshot-icon-wrapper is-indigo"><Gauge size={15} strokeWidth={2.2} /></div>
          </div>
          <div className="pf-snapshot-card-bottom">
            <strong className="pf-snapshot-value">{libraryStats.analyzed ? `${libraryStats.average}%` : '—'}</strong>
            {libraryStats.analyzed ? (
              <span className={`pf-snapshot-badge ${libraryStats.average >= 75 ? 'is-good' : 'is-warn'}`}>
                {libraryStats.average >= 75 ? 'ATS Ready' : 'Needs Review'}
              </span>
            ) : (
              <span className="pf-snapshot-badge is-missing">No data</span>
            )}
          </div>
        </div>
      </section>

      <section className="pf-library-toolbar" aria-label="Resume filters">
        <div className="pf-library-count">
          <strong>{resumes.length}</strong>
          <span>resume{resumes.length === 1 ? '' : 's'}</span>
        </div>
        <label className="pf-library-search">
          <Search size={15} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, role, or skill..." aria-label="Search resumes" />
        </label>
        <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by category" className="pf-toolbar-select">
          <option value="All">All Categories</option>
          {categories.map(item => <option key={item}>{item}</option>)}
        </select>
        <select value={role} onChange={event => setRole(event.target.value)} aria-label="Filter by role" className="pf-toolbar-select">
          <option value="All">All Roles</option>
          {roles.slice(1).map(item => <option key={item}>{item}</option>)}
        </select>
        <button
          type="button"
          className={`pf-filter-toggle ${primaryOnly ? 'is-active' : ''}`}
          onClick={() => setPrimaryOnly(value => !value)}
        >
          <Star size={14} fill={primaryOnly ? 'currentColor' : 'none'} /> Primary only
        </button>
        <div className="pf-library-sort">
          <span>Sort:</span>
          <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort resumes">
            <option value="updated">Recently updated</option>
            <option value="uploaded">Upload date</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </section>

      <details className="pf-category-manager">
        <summary>
          <Settings2 size={15} />
          <span>Manage custom categories ({categories.filter(item => !FALLBACK_CATEGORIES.includes(item)).length})</span>
          <ChevronDown size={15} className="pf-chevron-icon" />
        </summary>
        <div className="pf-category-manager-body">
          <form onSubmit={createCategory}>
            <input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Enter new category name..." maxLength={48} />
            <button type="submit" disabled={savingCategory || !categoryName.trim()} className="pf-btn-add-cat">
              <Plus size={14} /> Add Category
            </button>
          </form>
          {categoryError && <small className="pf-cat-error">{categoryError}</small>}
          <div className="pf-category-list">
            {categories.filter(item => !FALLBACK_CATEGORIES.includes(item)).map(item => (
              <span key={item} className="pf-category-item-pill">
                {item}
                <button type="button" onClick={() => renameCategory(item)} title={`Rename ${item}`} aria-label={`Rename ${item}`}>
                  <Edit3 size={12} />
                </button>
                <button type="button" onClick={() => removeCategory(item)} title={`Remove ${item}`} aria-label={`Remove ${item}`}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
            {categories.filter(item => !FALLBACK_CATEGORIES.includes(item)).length === 0 && (
              <span className="pf-no-custom-cats">No custom categories added yet. Default domains are active.</span>
            )}
          </div>
        </div>
      </details>

      <main className="pf-resume-library-list">
        {loading ? (
          <div className="pf-library-empty">
            <div className="pf-resume-pdf-box" style={{ width: '48px', height: '48px' }}>
              <PdfIcon size={28} className="pf-resume-pdf-icon" />
            </div>
            <p>Loading your resume library...</p>
          </div>
        ) : visibleResumes.length === 0 ? (
          <div className="pf-library-empty">
            <div className="pf-resume-pdf-box" style={{ width: '56px', height: '56px' }}>
              <PdfIcon size={32} className="pf-resume-pdf-icon" />
            </div>
            <h2>{resumes.length ? 'No resumes match these filters' : 'Your resume library is ready'}</h2>
            <p>{resumes.length ? 'Try clearing your filters or search term to see all resumes.' : 'Upload an existing PDF or build an ATS-ready resume in the studio.'}</p>
            {!resumes.length && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="pf-btn-build-studio" onClick={() => navigate('/resume/studio')}>
                  <Sparkles size={15} /> Build in Studio
                </button>
              </div>
            )}
          </div>
        ) : (
          visibleResumes.map(resume => {
            const status = analysisStatus(resume);
            return (
              <article className={`pf-resume-row ${openMenu === resume.id ? 'is-menu-open' : ''}`} key={resume.id}>
                <div className="pf-resume-row-file">
                  <div className="pf-resume-pdf-box">
                    <PdfIcon size={25} className="pf-resume-pdf-icon" />
                  </div>
                  <div className="pf-resume-row-details">
                    <div className="pf-resume-title-row">
                      <h2 onClick={() => navigate(`/resume/${resume.id}`)} title={resume.filename}>
                        {resume.filename}
                      </h2>
                      {resume.isDefault && (
                        <span className="pf-resume-primary-pill" title="Default primary resume used for applications">
                          <Star size={11} fill="currentColor" /> Primary
                        </span>
                      )}
                      <span
                        className="pf-category-badge is-clickable"
                        onClick={() => changeResumeCategory(resume)}
                        title="Click to change category"
                      >
                        {resume.category || 'General'}
                      </span>
                    </div>

                    <div className="pf-resume-row-sub">
                      <span className="pf-date-text">
                        Added {new Date(resume.createdAt || resume.uploadedAt || new Date()).toLocaleDateString()}
                      </span>
                      <span className="pf-dot">·</span>
                      <span className="pf-date-text">
                        Updated {new Date(resume.updatedAt || resume.uploadedAt || new Date()).toLocaleDateString()}
                      </span>

                      {resume.tags && resume.tags.length > 0 && (
                        <>
                          <span className="pf-sub-divider" />
                          <div className="pf-resume-row-tags">
                            {resume.tags.slice(0, 6).map(tag => (
                              <span key={tag} className="pf-resume-tag-pill">{tag}</span>
                            ))}
                            {resume.tags.length > 6 && (
                              <span className="pf-resume-tag-pill pf-tag-more">+{resume.tags.length - 6}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pf-resume-row-analysis">
                  <span className={`pf-analysis-status is-${status.tone}`}>
                    {status.tone === 'good' ? (
                      <CheckCircle2 size={14} />
                    ) : status.tone === 'warn' ? (
                      <AlertCircle size={14} />
                    ) : (
                      <CircleDashed size={14} />
                    )}
                    {status.label}
                    {resume.analysis?.score !== undefined && (
                      <span className="pf-analysis-score-inline">
                        <span className="pf-score-divider" />
                        {resume.analysis.score}%
                      </span>
                    )}
                  </span>
                </div>

                <div className="pf-resume-row-actions">
                  <button
                    type="button"
                    className="pf-btn-subtle"
                    onClick={() => navigate(`/resume/${resume.id}`)}
                  >
                    View Resume
                  </button>
                  <button
                    type="button"
                    className="pf-btn-primary-pill"
                    onClick={() => navigate(`/resume/${resume.id}/studio`)}
                  >
                    <Sparkles size={13} /> Edit in Studio
                  </button>
                  <button
                    type="button"
                    className="pf-row-more"
                    onClick={() => setOpenMenu(openMenu === resume.id ? null : resume.id)}
                    aria-label={`More actions for ${resume.filename}`}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {openMenu === resume.id && (
                    <div className="pf-resume-action-menu">
                      <button type="button" onClick={() => navigate(`/resume/${resume.id}?tab=analysis`)}>
                        <BarChart3 size={14} /> View Analysis
                      </button>
                      <a href={resume.downloadUrl} download={resume.filename}>
                        <Download size={14} /> Download PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => { setOpenMenu(null); changeResumeCategory(resume); }}
                      >
                        <Edit3 size={14} /> Change Category
                      </button>
                      {!resume.isDefault && (
                        <button type="button" onClick={() => { setOpenMenu(null); setPrimary(resume); }}>
                          <Star size={14} /> Set as primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setOpenMenu(null); deleteResume(resume); }}
                        className="is-danger"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}

