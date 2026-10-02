import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { resumeApi, uploadResume } from './resumeApi';
import {
  FileText,
  UploadCloud,
  Star,
  Trash2,
  Download,
  Eye,
  Loader,
  ArrowLeft,
  X,
  Edit2,
  Check,
  Tag,
  Plus,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PdfIcon } from '../../../components/ui/PdfIcon';
import { ResumeBuilder } from './ResumeBuilder';
import './ResumePage.css';

const SUGGESTED_ROLES = [
  'SDE',
  'Frontend',
  'Backend',
  'Full Stack',
  'Data Analyst',
  'Data Scientist',
  'DevOps / Cloud',
  'Machine Learning',
  'Product Manager',
  'UI/UX',
  'Cybersecurity',
  'Core Engineering',
];
const RESUME_CATEGORIES = ['Software', 'Data', 'Core', 'Design', 'General'];

const PORTAL_LABELS = {
  naukri: 'Naukri Resume Parser',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
};

function ResumeAnalysisPanel({ analysis, onAnalyze, analyzing }) {
  const [open, setOpen] = useState(false);
  if (!analysis) return null;
  if (!analysis.extracted) {
    return <div className="pf-resume-analysis pf-analysis-stale"><p>This resume has an older analysis format.</p><button type="button" onClick={onAnalyze} disabled={analyzing}>{analyzing ? 'Analyzing resume...' : 'Run full analysis'}</button></div>;
  }
  const extracted = analysis.extracted || {};
  const fields = [
    ['Summary', extracted.summary],
    ['Education', extracted.education],
    ['Experience', extracted.experience],
    ['Projects', extracted.projects],
    ['Skills', extracted.skills],
  ].filter(([, value]) => Array.isArray(value) ? value.length : value);

  return (
    <div className="pf-resume-analysis">
      <div className="pf-analysis-heading">
        <div><span className="pf-analysis-kicker">ATS pass analysis</span><p>Will the screening bots read you right?</p></div>
        <strong>{analysis.score}%<small>pass rate</small></strong>
      </div>
      <div className="pf-analysis-progress"><span style={{ width: `${analysis.score}%` }} /></div>
      <div className="pf-analysis-label">Tested against the parsers recruiters use</div>
      <div className="pf-analysis-portals">
        {Object.entries(analysis.portalReadiness || {}).map(([portal, passed]) => (
          <div key={portal}><span className={passed ? 'is-good' : 'is-review'}>{passed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{PORTAL_LABELS[portal] || portal}</span><b className={passed ? 'is-good' : 'is-review'}>{passed ? 'Parses clean' : 'Review format'}</b></div>
        ))}
      </div>
      <button type="button" className="pf-analysis-toggle" onClick={() => setOpen(!open)}>{open ? 'Hide extracted fields' : 'Show extracted fields'}<ChevronDown size={15} className={open ? 'is-open' : ''} /></button>
      {open && <div className="pf-analysis-fields">
        <div className="pf-analysis-contact"><b>Contact</b><span>{extracted.contact?.email || 'Email not detected'}</span><span>{extracted.contact?.phone || 'Phone not detected'}</span></div>
        {fields.map(([label, value]) => <div className="pf-analysis-field" key={label}><b>{label}</b><p>{Array.isArray(value) ? value.join(' • ') : value}</p></div>)}
      </div>}
    </div>
  );
}

export function ResumePage() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('General');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [analyzingId, setAnalyzingId] = useState(null);
  const [error, setError] = useState('');
  const [previewResume, setPreviewResume] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // Tag Modal State
  const [tagModalResume, setTagModalResume] = useState(null);
  const [activeTags, setActiveTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      setLoading(true);
      const data = await resumeApi.list();
      setResumes(data);
    } catch (err) {
      setError('Failed to load resumes.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const invalid = files.find(file => file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024);
    if (invalid) return setError(`${invalid.name}: only PDF files under 10MB are supported.`);

    try {
      setUploading(true);
      setError('');
      for (const file of files) await uploadResume(file, [], uploadCategory);
      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Failed to upload resume.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCategoryChange = async (resumeId, category) => {
    try {
      await resumeApi.updateCategory(resumeId, category);
      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Failed to update category.');
    }
  };

  const handleAnalyze = async (resumeId) => {
    try {
      setAnalyzingId(resumeId);
      await resumeApi.analyze(resumeId);
      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Failed to analyze resume.');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await resumeApi.setDefault(id);
      await fetchResumes();
    } catch (err) {
      setError('Failed to update default status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resume?')) return;
    try {
      await resumeApi.remove(id);
      if (previewResume?.id === id) setPreviewResume(null);
      if (tagModalResume?.id === id) setTagModalResume(null);
      await fetchResumes();
    } catch (err) {
      setError('Failed to delete resume.');
    }
  };

  const startRename = (resume) => {
    setEditingId(resume.id);
    setEditName(resume.filename);
  };

  const saveRename = async (id) => {
    if (!editName.trim()) return;
    try {
      await resumeApi.rename(id, editName.trim());
      setEditingId(null);
      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Failed to rename resume.');
    }
  };

  // Tag Management
  const openTagModal = (resume) => {
    setTagModalResume(resume);
    setActiveTags(Array.isArray(resume.tags) ? [...resume.tags] : []);
    setCustomTagInput('');
  };

  const handleAddTag = (tagToAdd) => {
    const clean = String(tagToAdd || '').trim();
    if (!clean) return;
    if (activeTags.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    if (activeTags.length >= 8) {
      return setError('You can add up to 8 role tags per resume.');
    }
    setActiveTags([...activeTags, clean]);
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setActiveTags(activeTags.filter((t) => t !== tagToRemove));
  };

  const handleQuickRemoveTagOnCard = async (resumeId, tagToRemove) => {
    const target = resumes.find((r) => r.id === resumeId);
    if (!target) return;
    const updated = (target.tags || []).filter((t) => t !== tagToRemove);
    try {
      await resumeApi.updateTags(resumeId, updated);
      await fetchResumes();
    } catch (err) {
      setError('Failed to update tags.');
    }
  };

  const handleSaveTags = async () => {
    if (!tagModalResume) return;
    try {
      setSavingTags(true);
      await resumeApi.updateTags(tagModalResume.id, activeTags);
      setTagModalResume(null);
      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Failed to save tags.');
    } finally {
      setSavingTags(false);
    }
  };

  return (
    <div className="pf-resume-page">
      <div className="pf-resume-header">
        <div>
          <Link to="/profile" className="pf-back-link">
            <ArrowLeft size={16} /> Back to Profile
          </Link>
          <h1>Your Resumes</h1>
          <p>Upload and manage role-tailored PDF resumes for placements and applications.</p>
        </div>
        <div className="pf-resume-actions">
          <select className="pf-resume-category-select" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} aria-label="Upload category">
            {RESUME_CATEGORIES.map(category => <option key={category} value={category}>{category} resume</option>)}
          </select>
          <label className="pf-upload-btn">
            {uploading ? <Loader className="spin" size={16} /> : <UploadCloud size={16} />}
            <span>Upload PDF</span>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              hidden
            />
          </label>
        </div>
      </div>

      {error && <div className="pf-resume-error">{error}</div>}

      <div className="pf-resume-filter-row">
        <div><strong>{resumes.length}</strong> saved resumes</div>
        <div className="pf-resume-filters">{['All', ...RESUME_CATEGORIES].map(category => <button type="button" key={category} className={categoryFilter === category ? 'is-active' : ''} onClick={() => setCategoryFilter(category)}>{category}</button>)}</div>
      </div>

      <div className="pf-resume-list">
        {loading ? (
          <div className="pf-resume-loading">
            <Loader className="spin" size={24} /> Loading resumes...
          </div>
        ) : resumes.length === 0 ? (
          <div className="pf-resume-empty">
            <PdfIcon size={48} className="pf-resume-pdf-icon" />
            <h3>No resumes uploaded yet</h3>
            <p>Upload your PDF resumes (e.g. SDE, Data Analyst, Core) to get started.</p>
            <label className="pf-upload-btn" style={{ marginTop: '1.25rem' }}>
              {uploading ? <Loader className="spin" size={16} /> : <UploadCloud size={16} />}
              <span>Upload your first PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                hidden
              />
            </label>
          </div>
        ) : (
          resumes.filter(resume => categoryFilter === 'All' || (resume.category || 'General') === categoryFilter).map((resume) => {
            const isEditing = editingId === resume.id;
            return (
              <div
                key={resume.id}
                className={`pf-resume-card ${resume.isDefault ? 'is-default' : ''}`}
              >
                <div className="pf-resume-card-icon">
                  <PdfIcon size={26} className="pf-resume-pdf-icon" />
                </div>
                <div className="pf-resume-card-content">
                  <div className="pf-resume-title-row">
                    {isEditing ? (
                      <div className="pf-rename-row">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="pf-rename-input"
                          autoFocus
                        />
                        <button
                          onClick={() => saveRename(resume.id)}
                          className="pf-icon-btn pf-save-btn"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="pf-icon-btn"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3>{resume.filename}</h3>
                        {resume.isDefault && (
                          <span className="pf-badge">
                            <Star size={12} fill="currentColor" /> Default
                          </span>
                        )}
                        <button
                          onClick={() => startRename(resume)}
                          className="pf-inline-rename-btn"
                          title="Rename file"
                        >
                          <Edit2 size={13} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Role Tags Section */}
                  <div className="pf-resume-tags-row">
                    {resume.tags && resume.tags.length > 0 ? (
                      resume.tags.map((tag) => (
                        <span key={tag} className="pf-role-tag">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleQuickRemoveTagOnCard(resume.id, tag)}
                            title={`Remove ${tag} tag`}
                            aria-label={`Remove ${tag}`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="pf-role-tags-empty">No role tags assigned</span>
                    )}
                    <button
                      type="button"
                      className="pf-add-tag-trigger"
                      onClick={() => openTagModal(resume)}
                      title="Manage role tags"
                    >
                      <Tag size={12} /> {resume.tags?.length ? 'Edit tags' : '+ Add Role Tag'}
                    </button>
                  </div>

                  <p className="pf-resume-meta">
                    PDF Document • Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
                  </p>
                  <div className="pf-resume-insights">
                    <select value={resume.category || 'General'} onChange={e => handleCategoryChange(resume.id, e.target.value)} aria-label={`Category for ${resume.filename}`}>
                      {RESUME_CATEGORIES.map(category => <option key={category}>{category}</option>)}
                    </select>
                    {resume.analysis && <span className={resume.analysis.score >= 75 ? 'is-good' : 'is-review'}>{resume.analysis.score}% parse-ready</span>}
                    <ResumeAnalysisPanel analysis={resume.analysis} onAnalyze={() => handleAnalyze(resume.id)} analyzing={analyzingId === resume.id} />
                  </div>
                </div>
                <div className="pf-resume-card-actions">
                  <button
                    onClick={() => setPreviewResume(resume)}
                    className="pf-preview-btn"
                    title="Preview PDF"
                  >
                    <Eye size={18} />
                  </button>
                  {resume.downloadUrl && (
                    <a
                      href={resume.downloadUrl}
                      download={resume.filename}
                      title="Download PDF"
                    >
                      <Download size={18} />
                    </a>
                  )}
                  <button
                    onClick={() => openTagModal(resume)}
                    title="Manage role tags"
                  >
                    <Tag size={18} />
                  </button>
                  {!resume.isDefault && (
                    <button
                      onClick={() => handleSetDefault(resume.id)}
                      title="Set as default"
                    >
                      <Star size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(resume.id)}
                    className="pf-danger"
                    title="Delete resume"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Role Tags Modal */}
      {tagModalResume && (
        <div className="pf-preview-modal-backdrop" onClick={() => setTagModalResume(null)}>
          <div className="pf-tag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pf-tag-modal-header">
              <div>
                <h3>Role Tags for Resume</h3>
                <p className="pf-tag-modal-subtitle">{tagModalResume.filename}</p>
              </div>
              <button
                className="pf-close-btn"
                onClick={() => setTagModalResume(null)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pf-tag-modal-body">
              <label className="pf-tag-section-label">Active Role Tags</label>
              <div className="pf-tag-chips-wrap">
                {activeTags.length === 0 ? (
                  <p className="pf-tag-empty-msg">No tags added yet. Select from suggestions below or type a custom tag.</p>
                ) : (
                  activeTags.map((tag) => (
                    <span key={tag} className="pf-role-tag pf-role-tag--large">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        title={`Remove ${tag}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <label className="pf-tag-section-label">Suggested Roles</label>
              <div className="pf-suggested-tags">
                {SUGGESTED_ROLES.map((role) => {
                  const isSelected = activeTags.some(
                    (t) => t.toLowerCase() === role.toLowerCase()
                  );
                  return (
                    <button
                      key={role}
                      type="button"
                      className={`pf-suggested-chip ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => (isSelected ? handleRemoveTag(role) : handleAddTag(role))}
                    >
                      {isSelected ? <Check size={13} /> : <Plus size={13} />}
                      {role}
                    </button>
                  );
                })}
              </div>

              <label className="pf-tag-section-label">Add Custom Role Tag</label>
              <form
                className="pf-custom-tag-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddTag(customTagInput);
                }}
              >
                <input
                  type="text"
                  placeholder="e.g. Quantitative Analyst, iOS Developer..."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  maxLength={30}
                />
                <Button type="submit" variant="secondary" disabled={!customTagInput.trim()}>
                  Add
                </Button>
              </form>
            </div>

            <div className="pf-tag-modal-footer">
              <Button variant="secondary" onClick={() => setTagModalResume(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTags} disabled={savingTags}>
                {savingTags ? 'Saving…' : 'Save Tags'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewResume && (
        <div className="pf-preview-modal-backdrop" onClick={() => setPreviewResume(null)}>
          <div className="pf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pf-preview-modal-header">
              <div className="pf-preview-modal-title">
                <PdfIcon size={20} className="pf-resume-pdf-icon" />
                <span>{previewResume.filename}</span>
              </div>
              <div className="pf-preview-modal-actions">
                <a
                  href={previewResume.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-modal-btn"
                  title="Open in new tab"
                >
                  New Tab
                </a>
                <a
                  href={previewResume.downloadUrl}
                  download={previewResume.filename}
                  className="pf-modal-btn"
                  title="Download"
                >
                  <Download size={16} /> Download
                </a>
                <button
                  className="pf-close-btn"
                  onClick={() => setPreviewResume(null)}
                  title="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="pf-preview-modal-body">
              <iframe
                src={`${previewResume.fileUrl}#toolbar=1`}
                title={previewResume.filename}
                className="pf-pdf-iframe"
              />
            </div>
          </div>
        </div>
      )}
      <ResumeBuilder />
    </div>
  );
}
