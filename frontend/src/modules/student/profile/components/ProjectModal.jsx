import React, { useState, useEffect, useRef } from 'react';
import { FolderGit2, Calendar, Globe, ExternalLink, Plus, Trash2, Upload, UploadCloud, FileText, Check, AlertCircle, X, Star, Code2, Sparkles, Layers } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { PdfIcon } from '../../../../components/ui/PdfIcon';
import { uploadProjectThumbnail, uploadProjectDocument, profileApi } from '../services/profileApi';
import { PROJECT_TYPES } from '../utils/projectUtils';
import '../styles/ProjectStyles.css';

export function ProjectModal({
  isOpen,
  onClose,
  onSaved,
  initialData = null,
}) {
  const isEditing = Boolean(initialData?.id);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);
  const imageDragCounter = useRef(0);
  const docDragCounter = useRef(0);
  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    projectName: '',
    projectType: 'Personal',
    customType: '',
    startDate: '',
    endDate: '',
    currentlyWorking: false,
    description: '',
    contributions: [''],
    technologies: [],
    techInput: '',
    projectUrl: '',
    repoUrl: '',
    thumbnail: '',
    featured: false,
  });

  const [existingDoc, setExistingDoc] = useState(null);
  const [selectedDocFile, setSelectedDocFile] = useState(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [isDocDragging, setIsDocDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const isCustomType = initialData.projectType && !PROJECT_TYPES.slice(0, -1).includes(initialData.projectType);
        setFormData({
          projectName: initialData.projectName || '',
          projectType: isCustomType ? 'Other' : (initialData.projectType || 'Personal'),
          customType: isCustomType ? initialData.projectType : '',
          startDate: initialData.startDate ? initialData.startDate.slice(0, 10) : '',
          endDate: initialData.endDate ? initialData.endDate.slice(0, 10) : '',
          currentlyWorking: Boolean(initialData.currentlyWorking),
          description: initialData.description || '',
          contributions: Array.isArray(initialData.contributions) && initialData.contributions.length > 0
            ? initialData.contributions
            : [''],
          technologies: Array.isArray(initialData.technologies) ? initialData.technologies : [],
          techInput: '',
          projectUrl: initialData.projectUrl || '',
          repoUrl: initialData.repoUrl || '',
          thumbnail: initialData.thumbnail || '',
          featured: Boolean(initialData.featured),
        });
        setExistingDoc(initialData.document || null);
      } else {
        setFormData({
          projectName: '',
          projectType: 'Personal',
          customType: '',
          startDate: '',
          endDate: '',
          currentlyWorking: false,
          description: '',
          contributions: [''],
          technologies: [],
          techInput: '',
          projectUrl: '',
          repoUrl: '',
          thumbnail: '',
          featured: false,
        });
        setExistingDoc(null);
      }
      setSelectedDocFile(null);
      setError('');
      setIsImageDragging(false);
      setIsDocDragging(false);
      imageDragCounter.current = 0;
      docDragCounter.current = 0;
    }
  }, [isOpen, initialData]);

  // Image upload handling
  const processImageFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Project image size must be less than 5MB.');
      return;
    }

    try {
      setUploadingImage(true);
      setError('');
      const url = await uploadProjectThumbnail(file);
      setFormData(prev => ({ ...prev, thumbnail: url }));
    } catch (err) {
      setError(err.message || 'Failed to upload project image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleImageDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsImageDragging(true);
    }
  };

  const handleImageDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounter.current -= 1;
    if (imageDragCounter.current <= 0) {
      imageDragCounter.current = 0;
      setIsImageDragging(false);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounter.current = 0;
    setIsImageDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processImageFile(file);
  };

  // PDF Document handling
  const processDocFile = (file) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setError('Only PDF documents are allowed for project reports or presentations.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Document file size must be less than 10MB.');
      return;
    }
    setError('');
    setSelectedDocFile(file);
  };

  const handleDocFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processDocFile(file);
  };

  const handleDocDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDocDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    docDragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDocDragging(true);
    }
  };

  const handleDocDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    docDragCounter.current -= 1;
    if (docDragCounter.current <= 0) {
      docDragCounter.current = 0;
      setIsDocDragging(false);
    }
  };

  const handleDocDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    docDragCounter.current = 0;
    setIsDocDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processDocFile(file);
  };

  // Bullet list manager
  const updateContribution = (index, value) => {
    setFormData(prev => {
      const updated = [...prev.contributions];
      updated[index] = value;
      return { ...prev, contributions: updated };
    });
  };

  const addContribution = () => {
    setFormData(prev => ({
      ...prev,
      contributions: [...prev.contributions, ''],
    }));
  };

  const removeContribution = (index) => {
    setFormData(prev => {
      const updated = prev.contributions.filter((_, i) => i !== index);
      return { ...prev, contributions: updated.length ? updated : [''] };
    });
  };

  // Technologies tags manager
  const handleTechKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTechTag();
    }
  };

  const addTechTag = () => {
    const raw = formData.techInput.trim().replace(/^,+|,+$/g, '');
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    setFormData(prev => {
      const combined = [...new Set([...prev.technologies, ...parts])];
      return { ...prev, technologies: combined, techInput: '' };
    });
  };

  const removeTechTag = (index) => {
    setFormData(prev => ({
      ...prev,
      technologies: prev.technologies.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    if (formData.startDate && formData.startDate > todayStr) {
      setError('Start date cannot be in the future.');
      return;
    }

    if (!formData.currentlyWorking && formData.endDate && formData.endDate > todayStr) {
      setError('End date cannot be in the future for completed projects. Enable "Currently working" if this project is ongoing.');
      return;
    }

    if (!formData.currentlyWorking && formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setError('Start date cannot be after end date.');
        return;
      }
    }

    const effectiveType = formData.projectType === 'Other'
      ? (formData.customType.trim() || 'Project')
      : formData.projectType;

    const cleanContributions = formData.contributions
      .map(c => c.trim())
      .filter(Boolean);

    const payload = {
      projectName: formData.projectName.trim(),
      projectType: effectiveType,
      startDate: formData.startDate || null,
      endDate: formData.currentlyWorking ? null : (formData.endDate || null),
      currentlyWorking: formData.currentlyWorking,
      description: formData.description.trim(),
      contributions: cleanContributions,
      technologies: formData.technologies,
      projectUrl: formData.projectUrl.trim(),
      repoUrl: formData.repoUrl.trim(),
      thumbnail: formData.thumbnail.trim(),
      featured: formData.featured,
    };

    try {
      setSaving(true);
      let studentResult;
      let projectId = initialData?.id;

      if (isEditing) {
        studentResult = await profileApi.editProject(projectId, payload);
      } else {
        studentResult = await profileApi.addProject(payload);
        if (studentResult.student?.projects?.length) {
          projectId = studentResult.student.projects[0].id;
        }
      }

      // If document was removed
      if (isEditing && !existingDoc && !selectedDocFile && initialData?.document?.fileId) {
        studentResult = await profileApi.deleteProjectDocument(projectId);
      }

      // If new document file was selected, upload to R2
      if (selectedDocFile && projectId) {
        studentResult = await uploadProjectDocument(projectId, selectedDocFile);
      }

      await onSaved?.(studentResult);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save project. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Project' : 'Add Project'}
      maxWidth="820px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <button
            type="button"
            className="pf-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploadingImage}
          >
            {saving ? 'Saving Project...' : isEditing ? 'Save Changes' : 'Add Project'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="pf-project-modal-body">
        {error && (
          <div className="pf-alert pf-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Featured Project Switch Card */}
        <div
          className={`pf-featured-switch-card ${formData.featured ? 'pf-featured-switch-card--active' : ''}`}
          onClick={() => setFormData(prev => ({ ...prev, featured: !prev.featured }))}
        >
          <div className="pf-featured-switch-card__left">
            <div className={`pf-featured-icon-badge ${formData.featured ? 'pf-featured-icon-badge--active' : ''}`}>
              <Star size={20} className={formData.featured ? 'pf-star-filled' : ''} />
            </div>
            <div className="pf-featured-switch-card__text">
              <div className="pf-featured-switch-card__title-row">
                <strong>Featured Project</strong>
                {formData.featured && (
                  <span className="pf-featured-status-pill">Spotlight Active</span>
                )}
              </div>
              <p>Highlight this project prominently at the top of your portfolio with a distinctive accent.</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.featured}
            aria-label="Toggle featured project status"
            className={`pf-switch ${formData.featured ? 'pf-switch--on' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setFormData(prev => ({ ...prev, featured: !prev.featured }));
            }}
          >
            <span className="pf-switch__handle" />
          </button>
        </div>

        {/* Section 1: Overview & Identity */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Layers size={16} /> Project Identity
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <label htmlFor="projectName">
                Project Name <span className="pf-required-star">*</span>
              </label>
              <input
                id="projectName"
                type="text"
                placeholder="e.g. Distributed Task Scheduler, AI Resume Builder"
                value={formData.projectName}
                onChange={e => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                required
              />
            </div>

            <div className="pf-form-field">
              <label htmlFor="projectType">Project Type</label>
              <select
                id="projectType"
                value={formData.projectType}
                onChange={e => setFormData(prev => ({ ...prev, projectType: e.target.value }))}
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.projectType === 'Other' && (
            <div className="pf-form-field">
              <label htmlFor="customType">Custom Project Type</label>
              <input
                id="customType"
                type="text"
                placeholder="e.g. Capstone Project, Community Initiative"
                value={formData.customType}
                onChange={e => setFormData(prev => ({ ...prev, customType: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* Section 2: Timeline & Status */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Calendar size={16} /> Timeline & Project Status
          </div>

          <div>
            <label className="pf-checkbox-row">
              <input
                type="checkbox"
                checked={formData.currentlyWorking}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  currentlyWorking: e.target.checked,
                  endDate: e.target.checked ? '' : prev.endDate,
                }))}
              />
              <span>Currently Working on this Project (Present / In Development)</span>
            </label>
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <label htmlFor="startDate">Start Date</label>
              <input
                id="startDate"
                type="date"
                max={todayStr}
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="pf-form-field">
              <label htmlFor="endDate">End Date</label>
              {formData.currentlyWorking ? (
                <div style={{ padding: '10px 14px', background: '#edf7ee', border: '1px solid #c8ebd1', borderRadius: '8px', color: '#166434', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="pf-pulse-dot" /> Present (Active project)
                </div>
              ) : (
                <input
                  id="endDate"
                  type="date"
                  min={formData.startDate || undefined}
                  max={todayStr}
                  value={formData.endDate}
                  onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Overview & Description */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <FileText size={16} /> Overview & Scope
          </div>

          <div className="pf-form-field">
            <label htmlFor="projectDescription">Short Overview / Description</label>
            <textarea
              id="projectDescription"
              rows={3}
              placeholder="Briefly describe the purpose of the project, problem it solves, and high-level architecture..."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>

        {/* Section 4: Key Contributions */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Sparkles size={16} /> Key Contributions & Accomplishments
          </div>

          <div className="pf-bullets-input-list">
            {formData.contributions.map((bullet, idx) => (
              <div key={idx} className="pf-bullet-input-row">
                <span className="pf-bullet-number">{idx + 1}</span>
                <input
                  type="text"
                  placeholder={`Contribution bullet point #${idx + 1} (e.g. Architected resilient failover pipeline with 99.9% uptime)`}
                  value={bullet}
                  onChange={e => updateContribution(idx, e.target.value)}
                />
                {formData.contributions.length > 1 && (
                  <button
                    type="button"
                    className="pf-bullet-remove-btn"
                    onClick={() => removeContribution(idx)}
                    title="Remove contribution"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="pf-bullet-add-btn"
            onClick={addContribution}
          >
            <Plus size={14} /> Add another contribution bullet
          </button>
        </div>

        {/* Section 5: Technologies / Skills */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Code2 size={16} /> Technologies & Skills
          </div>

          <div className="pf-form-field">
            <label htmlFor="techInput">Technologies (Type skill name and press Enter or comma)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="techInput"
                type="text"
                placeholder="e.g. React, FastAPI, PostgreSQL, Docker, Redis, LLM"
                value={formData.techInput}
                onChange={e => setFormData(prev => ({ ...prev, techInput: e.target.value }))}
                onKeyDown={handleTechKeyDown}
              />
              <button
                type="button"
                className="pf-secondary"
                onClick={addTechTag}
                style={{ padding: '0 18px', flexShrink: 0, fontWeight: 600 }}
              >
                Add
              </button>
            </div>
          </div>

          {formData.technologies.length > 0 && (
            <div className="pf-tags-chips">
              {formData.technologies.map((tech, idx) => (
                <span key={idx} className="pf-tag-chip">
                  {tech}
                  <button type="button" onClick={() => removeTechTag(idx)} title="Remove technology">
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Section 6: Deliverables & URLs */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Globe size={16} /> Project Links
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <label htmlFor="projectUrl">Project URL / Live Demo</label>
              <div className="pf-input-with-icon">
                <Globe size={16} className="pf-input-icon" />
                <input
                  id="projectUrl"
                  type="url"
                  placeholder="https://myproject.dev"
                  value={formData.projectUrl}
                  onChange={e => setFormData(prev => ({ ...prev, projectUrl: e.target.value }))}
                />
              </div>
            </div>

            <div className="pf-form-field">
              <label htmlFor="repoUrl">Repository URL (GitHub / GitLab)</label>
              <div className="pf-input-with-icon">
                <Code2 size={16} className="pf-input-icon" />
                <input
                  id="repoUrl"
                  type="url"
                  placeholder="https://github.com/user/project-repo"
                  value={formData.repoUrl}
                  onChange={e => setFormData(prev => ({ ...prev, repoUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 7: Media & Attachments */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <UploadCloud size={16} /> Media & Project Documents
          </div>

          <div className="pf-form-grid-2">
            {/* Project Image / Thumbnail */}
            <div className="pf-form-field">
              <label>Project Image / Thumbnail</label>
              {formData.thumbnail ? (
                <div className="pf-uploaded-preview">
                  <div className="pf-uploaded-preview__info">
                    <img src={formData.thumbnail} alt="Thumbnail preview" className="pf-uploaded-preview__thumb" />
                    <div className="pf-uploaded-preview__text">
                      <strong>Project Thumbnail</strong>
                      <span>Uploaded to Cloudinary</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pf-bullet-remove-btn"
                    onClick={() => setFormData(prev => ({ ...prev, thumbnail: '' }))}
                    title="Remove image"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className={`pf-dropzone ${isImageDragging ? 'pf-dropzone--active' : ''}`}
                  onDragOver={handleImageDragOver}
                  onDragEnter={handleImageDragEnter}
                  onDragLeave={handleImageDragLeave}
                  onDrop={handleImageDrop}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <UploadCloud size={24} style={{ color: isImageDragging ? '#1b4d3e' : '#6b8270' }} />
                  <p>{uploadingImage ? 'Uploading image...' : 'Drag & drop project thumbnail here'}</p>
                  <span>or click to browse image (PNG, JPG, WebP)</span>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleImageFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Project Documents (PDF) */}
            <div className="pf-form-field">
              <label>Project Document (PDF)</label>
              {selectedDocFile ? (
                <div className="pf-uploaded-preview">
                  <div className="pf-uploaded-preview__info">
                    <div className="pf-uploaded-preview__doc-icon">
                      <PdfIcon size={32} />
                    </div>
                    <div className="pf-uploaded-preview__text">
                      <strong>{selectedDocFile.name}</strong>
                      <span>{(selectedDocFile.size / 1024).toFixed(1)} KB (Ready to upload)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pf-bullet-remove-btn"
                    onClick={() => setSelectedDocFile(null)}
                    title="Remove file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : existingDoc ? (
                <div className="pf-uploaded-preview">
                  <div className="pf-uploaded-preview__info">
                    <div className="pf-uploaded-preview__doc-icon">
                      <PdfIcon size={32} />
                    </div>
                    <div className="pf-uploaded-preview__text">
                      <strong>{existingDoc.filename || 'Project Document'}</strong>
                      <span>{(existingDoc.size / 1024).toFixed(1)} KB (Attached in R2)</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {existingDoc.fileUrl && (
                      <a
                        href={existingDoc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pf-doc-btn"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      >
                        View
                      </a>
                    )}
                    <button
                      type="button"
                      className="pf-bullet-remove-btn"
                      onClick={() => setExistingDoc(null)}
                      title="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`pf-dropzone ${isDocDragging ? 'pf-dropzone--active' : ''}`}
                  onDragOver={handleDocDragOver}
                  onDragEnter={handleDocDragEnter}
                  onDragLeave={handleDocDragLeave}
                  onDrop={handleDocDrop}
                  onClick={() => docInputRef.current?.click()}
                >
                  <UploadCloud size={24} style={{ color: isDocDragging ? '#1b4d3e' : '#6b8270' }} />
                  <p>Drag & drop project document here</p>
                  <span>or click to browse (.pdf only, max 10MB)</span>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleDocFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
