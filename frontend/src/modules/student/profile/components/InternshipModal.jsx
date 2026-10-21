import '../styles/ProfileEditViewport.css';
import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, Building2, Calendar, MapPin, Globe, ExternalLink, Plus, Trash2, Upload, UploadCloud, FileText, Check, AlertCircle, X } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { PdfIcon } from '../../../../components/ui/PdfIcon';
import { uploadCompanyLogo, uploadInternshipCertificate, profileApi } from '../services/profileApi';
import '../styles/InternshipStyles.css';

const INTERNSHIP_TYPES = [
  'Summer Internship',
  'Winter Internship',
  'Research Internship',
  'Industrial Trainee',
  'Graduate Internship',
  'Virtual Internship',
  'Part-time Internship',
  'Other'
];

const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];

export function InternshipModal({
  isOpen,
  onClose,
  onSaved,
  initialData = null,
}) {
  const isEditing = Boolean(initialData?.id);
  const logoInputRef = useRef(null);
  const certInputRef = useRef(null);
  const logoDragCounter = useRef(0);
  const certDragCounter = useRef(0);
  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    companyName: '',
    companyLogo: '',
    role: '',
    startDate: '',
    endDate: '',
    currentlyWorking: false,
    internshipType: 'Summer Internship',
    customType: '',
    workMode: 'On-site',
    location: '',
    description: '',
    responsibilities: [''],
    skills: [],
    skillInput: '',
    projectName: '',
    projectDescription: '',
    projectUrl: '',
    companyWebsite: '',
  });

  const [existingCert, setExistingCert] = useState(null);
  const [selectedCertFile, setSelectedCertFile] = useState(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isLogoDragging, setIsLogoDragging] = useState(false);
  const [isCertDragging, setIsCertDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const isCustomType = initialData.internshipType && !INTERNSHIP_TYPES.slice(0, -1).includes(initialData.internshipType);
        setFormData({
          companyName: initialData.companyName || '',
          companyLogo: initialData.companyLogo || '',
          role: initialData.role || '',
          startDate: initialData.startDate ? initialData.startDate.slice(0, 10) : '',
          endDate: initialData.endDate ? initialData.endDate.slice(0, 10) : '',
          currentlyWorking: Boolean(initialData.currentlyWorking),
          internshipType: isCustomType ? 'Other' : (initialData.internshipType || 'Summer Internship'),
          customType: isCustomType ? initialData.internshipType : '',
          workMode: initialData.workMode || 'On-site',
          location: initialData.location || '',
          description: initialData.description || '',
          responsibilities: Array.isArray(initialData.responsibilities) && initialData.responsibilities.length > 0 
            ? initialData.responsibilities 
            : [''],
          skills: Array.isArray(initialData.skills) ? initialData.skills : [],
          skillInput: '',
          projectName: initialData.projects?.projectName || '',
          projectDescription: initialData.projects?.projectDescription || '',
          projectUrl: initialData.projects?.projectUrl || initialData.projectUrl || '',
          companyWebsite: initialData.companyWebsite || '',
        });
        setExistingCert(initialData.certificate || null);
      } else {
        setFormData({
          companyName: '',
          companyLogo: '',
          role: '',
          startDate: '',
          endDate: '',
          currentlyWorking: false,
          internshipType: 'Summer Internship',
          customType: '',
          workMode: 'On-site',
          location: '',
          description: '',
          responsibilities: [''],
          skills: [],
          skillInput: '',
          projectName: '',
          projectDescription: '',
          projectUrl: '',
          companyWebsite: '',
        });
        setExistingCert(null);
      }
      setSelectedCertFile(null);
      setError('');
      setIsLogoDragging(false);
      setIsCertDragging(false);
      logoDragCounter.current = 0;
      certDragCounter.current = 0;
    }
  }, [isOpen, initialData]);

  // Handle Logo Upload with Drag & Drop
  const processLogoFile = async (file) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
    if (!isImage) {
      setError('Only image files (PNG, JPG, SVG, WebP) are allowed for company logo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Company logo must be under 5 MB.');
      return;
    }

    try {
      setUploadingLogo(true);
      setError('');
      const secureUrl = await uploadCompanyLogo(file);
      setFormData(prev => ({ ...prev, companyLogo: secureUrl }));
    } catch (err) {
      setError(err.message || 'Failed to upload company logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleLogoDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    logoDragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsLogoDragging(true);
    }
  };

  const handleLogoDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    logoDragCounter.current -= 1;
    if (logoDragCounter.current <= 0) {
      logoDragCounter.current = 0;
      setIsLogoDragging(false);
    }
  };

  const handleLogoDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    logoDragCounter.current = 0;
    setIsLogoDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processLogoFile(file);
    }
  };

  // Certificate Drag & Drop Handlers
  const processCertFile = (file) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setError('Only PDF documents (*.pdf) are allowed for certificates.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Certificate file size must be under 10MB.');
      return;
    }
    setError('');
    setSelectedCertFile(file);
  };

  const handleCertDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCertDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    certDragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsCertDragging(true);
    }
  };

  const handleCertDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    certDragCounter.current -= 1;
    if (certDragCounter.current <= 0) {
      certDragCounter.current = 0;
      setIsCertDragging(false);
    }
  };

  const handleCertDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    certDragCounter.current = 0;
    setIsCertDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processCertFile(file);
    }
  };

  // Responsibilities bullets manager
  const updateBullet = (index, value) => {
    setFormData(prev => {
      const updated = [...prev.responsibilities];
      updated[index] = value;
      return { ...prev, responsibilities: updated };
    });
  };

  const addBullet = () => {
    setFormData(prev => ({
      ...prev,
      responsibilities: [...prev.responsibilities, ''],
    }));
  };

  const removeBullet = (index) => {
    setFormData(prev => {
      const updated = prev.responsibilities.filter((_, i) => i !== index);
      return { ...prev, responsibilities: updated.length ? updated : [''] };
    });
  };

  // Skills tags manager
  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = formData.skillInput.trim().replace(/^,+|,+$/g, '');
      if (val && !formData.skills.includes(val)) {
        setFormData(prev => ({
          ...prev,
          skills: [...prev.skills, val],
          skillInput: '',
        }));
      }
    }
  };

  const handleSkillBlur = () => {
    const val = formData.skillInput.trim().replace(/^,+|,+$/g, '');
    if (val && !formData.skills.includes(val)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, val],
        skillInput: '',
      }));
    }
  };

  const removeSkill = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== tagToRemove),
    }));
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!formData.companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!formData.role.trim()) {
      setError('Role / position is required.');
      return;
    }
    if (!formData.startDate) {
      setError('Start date is required.');
      return;
    }
    if (formData.startDate > todayStr) {
      setError('Start date cannot be in the future.');
      return;
    }
    if (!formData.currentlyWorking && !formData.endDate) {
      setError('End date is required unless currently working.');
      return;
    }
    if (!formData.currentlyWorking && formData.endDate > todayStr) {
      setError('End date cannot be in the future for completed internships. Enable "Currently working" if this is an active role.');
      return;
    }
    if (!formData.currentlyWorking && formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setError('Start date cannot be after end date.');
        return;
      }
    }

    const effectiveType = formData.internshipType === 'Other' 
      ? (formData.customType.trim() || 'Internship') 
      : formData.internshipType;

    const cleanResponsibilities = formData.responsibilities
      .map(r => r.trim())
      .filter(Boolean);

    const payload = {
      companyName: formData.companyName.trim(),
      companyLogo: formData.companyLogo,
      role: formData.role.trim(),
      startDate: formData.startDate,
      endDate: formData.currentlyWorking ? '' : formData.endDate,
      currentlyWorking: formData.currentlyWorking,
      internshipType: effectiveType,
      workMode: formData.workMode,
      location: formData.location.trim(),
      description: formData.description.trim(),
      responsibilities: cleanResponsibilities,
      skills: formData.skills,
      projects: {
        projectName: formData.projectName.trim(),
        projectDescription: formData.projectDescription.trim(),
        projectUrl: formData.projectUrl.trim(),
      },
      companyWebsite: formData.companyWebsite.trim(),
      projectUrl: formData.projectUrl.trim(),
    };

    try {
      setSaving(true);
      let studentResult;
      let internshipId = initialData?.id;

      if (isEditing) {
        studentResult = await profileApi.editInternship(internshipId, payload);
      } else {
        studentResult = await profileApi.addInternship(payload);
        // Find the newly added internship ID (it's the first in the array)
        if (studentResult.student?.internships?.length) {
          internshipId = studentResult.student.internships[0].id;
        }
      }

      // If a new certificate file was selected, upload it now to R2
      if (selectedCertFile && internshipId) {
        studentResult = await uploadInternshipCertificate(internshipId, selectedCertFile);
      }

      await onSaved?.(studentResult);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save internship.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCertificate = async () => {
    if (!initialData?.id || !existingCert) return;
    try {
      setSaving(true);
      const studentResult = await profileApi.deleteInternshipCertificate(initialData.id);
      setExistingCert(null);
      await onSaved?.(studentResult);
    } catch (err) {
      setError(err.message || 'Failed to delete certificate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal className="pf-profile-edit-dialog"
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Internship Experience' : 'Add Internship Experience'}
      maxWidth="840px"
      footer={
        <>
          <button type="button" className="pf-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={saving}
          >
            {isEditing ? 'Update internship' : 'Save internship'}
          </Button>
        </>
      }
    >
      <div className="pf-internship-modal-body">
        {error && (
          <div className="pf-error" style={{ marginBottom: '4px' }}>
            <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            {error}
          </div>
        )}

        {/* Section 1: Company & Role */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Building2 size={16} /> Company & Role
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <label htmlFor="companyName">
                Company Name <span className="pf-required-star">*</span>
              </label>
              <input
                id="companyName"
                placeholder="e.g. Google, Microsoft, Razorpay"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
            </div>

            <div className="pf-form-field">
              <label htmlFor="role">
                Role / Position <span className="pf-required-star">*</span>
              </label>
              <input
                id="role"
                placeholder="e.g. Software Engineering Intern"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <span className="pf-field-label">Company Logo (Optional)</span>
              {formData.companyLogo ? (
                <div
                  className={`pf-logo-uploader--has-logo ${isLogoDragging ? 'pf-logo-dropzone--active' : ''}`}
                  onDragOver={handleLogoDragOver}
                  onDragEnter={handleLogoDragEnter}
                  onDragLeave={handleLogoDragLeave}
                  onDrop={handleLogoDrop}
                >
                  <img src={formData.companyLogo} alt="Logo" className="pf-logo-preview" />
                  <div className="pf-logo-actions">
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) processLogoFile(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className="pf-upload-btn-pill"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      <Upload size={14} /> {uploadingLogo ? 'Uploading...' : 'Change logo'}
                    </button>
                    <button
                      type="button"
                      className="pf-remove-btn-subtle"
                      onClick={() => setFormData({ ...formData, companyLogo: '' })}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                    <span className="pf-logo-replace-hint">(or drop image here to replace)</span>
                  </div>
                </div>
              ) : (
                <div
                  className={`pf-logo-dropzone ${isLogoDragging ? 'pf-logo-dropzone--active' : ''}`}
                  onDragOver={handleLogoDragOver}
                  onDragEnter={handleLogoDragEnter}
                  onDragLeave={handleLogoDragLeave}
                  onDrop={handleLogoDrop}
                  onClick={() => logoInputRef.current?.click()}
                  title="Drop company logo here, or browse"
                >
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) processLogoFile(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="pf-company-monogram" style={{ width: 44, height: 44, fontSize: '0.95rem' }}>
                    {formData.companyName ? formData.companyName.slice(0, 2).toUpperCase() : <Building2 size={20} />}
                  </div>
                  <div className="pf-logo-dropzone__content">
                    <div className="pf-logo-dropzone__prompt">
                      <Upload size={14} />
                      <span>{uploadingLogo ? 'Uploading logo...' : 'Drop company logo here, or click to browse'}</span>
                    </div>
                    <span className="pf-logo-dropzone__hint">PNG, JPG, SVG or WebP up to 5MB</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pf-form-field">
              <label htmlFor="companyWebsite">Company Website (Optional)</label>
              <input
                id="companyWebsite"
                type="url"
                placeholder="https://company.com"
                value={formData.companyWebsite}
                onChange={e => setFormData({ ...formData, companyWebsite: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Timeline & Work Arrangement */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <Calendar size={16} /> Timeline & Work Arrangement
          </div>

          <div style={{ marginBottom: '4px' }}>
            <label className="pf-check" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a442e', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.currentlyWorking}
                onChange={e => setFormData({ ...formData, currentlyWorking: e.target.checked })}
              />
              I am currently working in this internship role (Present)
            </label>
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <label htmlFor="startDate">
                Start Date <span className="pf-required-star">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                max={todayStr}
                value={formData.startDate}
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>

            <div className="pf-form-field">
              <label htmlFor="endDate">
                End Date {!formData.currentlyWorking && <span className="pf-required-star">*</span>}
              </label>
              {formData.currentlyWorking ? (
                <div style={{ padding: '10px 14px', background: '#edf7ee', border: '1px solid #c8ebd1', borderRadius: '8px', color: '#166434', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="pf-pulse-dot" /> Present (Active role)
                </div>
              ) : (
                <input
                  id="endDate"
                  type="date"
                  min={formData.startDate || undefined}
                  max={todayStr}
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  required={!formData.currentlyWorking}
                />
              )}
            </div>
          </div>

          <div className="pf-form-grid-3">
            <div className="pf-form-field">
              <label htmlFor="internshipType">Internship Type</label>
              <select
                id="internshipType"
                value={formData.internshipType}
                onChange={e => setFormData({ ...formData, internshipType: e.target.value })}
              >
                {INTERNSHIP_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="pf-form-field">
              <label htmlFor="workMode">Work Mode</label>
              <select
                id="workMode"
                value={formData.workMode}
                onChange={e => setFormData({ ...formData, workMode: e.target.value })}
              >
                {WORK_MODES.map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>

            <div className="pf-form-field">
              <label htmlFor="location">Location (Optional)</label>
              <input
                id="location"
                placeholder="e.g. Bengaluru, India"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          {formData.internshipType === 'Other' && (
            <div className="pf-form-field">
              <label htmlFor="customType">Specify Internship Type</label>
              <input
                id="customType"
                placeholder="e.g. Fellowship, Co-op, Apprenticeship"
                value={formData.customType}
                onChange={e => setFormData({ ...formData, customType: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Section 3: Overview, Contributions & Skills */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <FileText size={16} /> Description & Key Contributions
          </div>

          <div className="pf-form-field">
            <label htmlFor="description">Short Overview</label>
            <textarea
              id="description"
              placeholder="High-level overview of the team, products, or core challenges you tackled..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="pf-form-field">
            <span className="pf-field-label">Responsibilities & Contributions (Bullet Points)</span>
            <div className="pf-bullet-list">
              {formData.responsibilities.map((bullet, idx) => (
                <div key={idx} className="pf-bullet-row">
                  <input
                    placeholder={`Contribution ${idx + 1}, e.g. Engineered microservice architecture reducing latency by 35%`}
                    value={bullet}
                    onChange={e => updateBullet(idx, e.target.value)}
                  />
                  {formData.responsibilities.length > 1 && (
                    <button
                      type="button"
                      className="pf-bullet-delete-btn"
                      onClick={() => removeBullet(idx)}
                      title="Remove bullet"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="pf-add-bullet-btn"
                onClick={addBullet}
              >
                <Plus size={14} /> Add bullet point
              </button>
            </div>
          </div>

          <div className="pf-form-field">
            <label htmlFor="skills">Technologies / Skills (Comma-separated or press Enter)</label>
            <div className="pf-tags-input-wrap">
              <input
                id="skills"
                placeholder="e.g. React, Node.js, Python, PostgreSQL, AWS"
                value={formData.skillInput}
                onChange={e => setFormData({ ...formData, skillInput: e.target.value })}
                onKeyDown={handleSkillKeyDown}
                onBlur={handleSkillBlur}
              />
              <div className="pf-active-tags-preview">
                {formData.skills.map((skill, idx) => (
                  <span key={idx} className="pf-editable-tag-chip">
                    {skill}
                    <button
                      type="button"
                      className="pf-tag-remove-x"
                      onClick={() => removeSkill(skill)}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Projects & Work Done (Optional) */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <ExternalLink size={16} /> Projects / Work Done (Optional)
          </div>

          <div className="pf-form-grid-2">
            <div className="pf-form-field">
              <label htmlFor="projectName">Project Name</label>
              <input
                id="projectName"
                placeholder="e.g. Real-Time Telemetry Dashboard"
                value={formData.projectName}
                onChange={e => setFormData({ ...formData, projectName: e.target.value })}
              />
            </div>

            <div className="pf-form-field">
              <label htmlFor="projectUrl">Project / Work URL</label>
              <input
                id="projectUrl"
                type="url"
                placeholder="https://github.com/... or live demo URL"
                value={formData.projectUrl}
                onChange={e => setFormData({ ...formData, projectUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="pf-form-field">
            <label htmlFor="projectDescription">Project Description</label>
            <textarea
              id="projectDescription"
              placeholder="Summary of scope, architecture, or deliverables produced for this project..."
              value={formData.projectDescription}
              onChange={e => setFormData({ ...formData, projectDescription: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        {/* Section 5: Internship Certificate */}
        <div className="pf-form-fieldset">
          <div className="pf-fieldset-legend">
            <FileText size={16} /> Internship Certificate
          </div>

          <input
            type="file"
            ref={certInputRef}
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) processCertFile(file);
              e.target.value = '';
            }}
          />

          {existingCert && !selectedCertFile ? (
            <div className="pf-cert-uploader-box">
              <div className="pf-cert-file-info">
                <PdfIcon size={28} />
                <div>
                  <div className="pf-cert-filename">{existingCert.filename}</div>
                  <div className="pf-cert-filesize">
                    {existingCert.size ? `${(existingCert.size / 1024).toFixed(1)} KB · ` : ''}Verified Document (PDF)
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={existingCert.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-doc-btn"
                >
                  View PDF
                </a>
                <button
                  type="button"
                  className="pf-upload-btn-pill"
                  onClick={() => certInputRef.current?.click()}
                  style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                >
                  <Upload size={13} /> Replace
                </button>
                <button
                  type="button"
                  className="pf-remove-btn-subtle"
                  onClick={handleDeleteCertificate}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ) : selectedCertFile ? (
            <div className="pf-cert-uploader-box">
              <div className="pf-cert-file-info">
                <PdfIcon size={28} />
                <div>
                  <div className="pf-cert-filename">{selectedCertFile.name}</div>
                  <div className="pf-cert-filesize">{(selectedCertFile.size / 1024).toFixed(1)} KB (Ready to upload)</div>
                </div>
              </div>
              <button
                type="button"
                className="pf-remove-btn-subtle"
                onClick={() => setSelectedCertFile(null)}
              >
                <Trash2 size={14} /> Cancel file
              </button>
            </div>
          ) : (
            <div
              className={`pf-cert-uploader-box ${isCertDragging ? 'pf-logo-dropzone--active' : ''}`}
              onDragOver={handleCertDragOver}
              onDragEnter={handleCertDragEnter}
              onDragLeave={handleCertDragLeave}
              onDrop={handleCertDrop}
              onClick={() => certInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <UploadCloud size={24} style={{ color: '#275237', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#163623', fontWeight: 600, fontSize: '0.88rem' }}>
                    Drop certificate PDF here, or click to browse
                  </div>
                  <div style={{ color: '#687b6d', fontSize: '0.78rem' }}>
                    Official completion certificate, recommendation letter, or offer document (PDF up to 10MB)
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="pf-upload-btn-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  certInputRef.current?.click();
                }}
              >
                <Upload size={14} /> Browse document
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
