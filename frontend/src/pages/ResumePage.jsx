import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { resumeApi, uploadResume } from '../services/resumeApi';
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
} from 'lucide-react';
import { Button } from '../components/Button';
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

export function ResumePage() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      return setError('Only PDF files are supported.');
    }
    if (file.size > 10 * 1024 * 1024) {
      return setError('File size must be under 10MB.');
    }

    try {
      setUploading(true);
      setError('');
      await uploadResume(file);
      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Failed to upload resume.');
    } finally {
      setUploading(false);
      e.target.value = '';
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
          <label className="pf-upload-btn">
            {uploading ? <Loader className="spin" size={16} /> : <UploadCloud size={16} />}
            <span>Upload PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              hidden
            />
          </label>
        </div>
      </div>

      {error && <div className="pf-resume-error">{error}</div>}

      <div className="pf-resume-list">
        {loading ? (
          <div className="pf-resume-loading">
            <Loader className="spin" size={24} /> Loading resumes...
          </div>
        ) : resumes.length === 0 ? (
          <div className="pf-resume-empty">
            <FileText size={48} />
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
          resumes.map((resume) => {
            const isEditing = editingId === resume.id;
            return (
              <div
                key={resume.id}
                className={`pf-resume-card ${resume.isDefault ? 'is-default' : ''}`}
              >
                <div className="pf-resume-card-icon">
                  <FileText size={24} />
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
                <FileText size={20} />
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
    </div>
  );
}
