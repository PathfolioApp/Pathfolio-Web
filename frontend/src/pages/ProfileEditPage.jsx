import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Award, ArrowLeft, FileText, UploadCloud, Trash2, Eye, Plus, Edit2, Briefcase, Building2, Calendar, MapPin, Globe, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileApi, uploadAcademicDocument } from '../services/profileApi';
import { Modal } from '../components/Modal';
import { AvatarEditor } from '../components/AvatarEditor';
import { PdfIcon } from '../components/PdfIcon';
import { AchievementIcon } from '../components/AchievementIcon';
import { ACHIEVEMENT_CATEGORIES } from '../features/onboarding/types/config';
import { InternshipModal } from './InternshipModal';
import { formatInternshipTimeline, sortInternships } from '../utils/internshipUtils';
import './ProfilePages.css';
import './ProfileEditEnhancements.css';
import './AchievementModal.css';
import './AcademicStyles.css';
import './InternshipStyles.css';

const split = value => value.split(',').map(item => item.trim()).filter(Boolean);
const cleanDescription = value => String(value || '').replace(/\*\*(.*?)\*\*/g, '$1');

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateMonthYear = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [year, month] = dateStr.split('-');
    if (!year || !month) return dateStr;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDuration = (startDate, endDate, currentlyWorking) => {
  if (!startDate) return '';
  try {
    const [startYear, startMonth] = startDate.split('-').map(Number);
    let endYear, endMonth;
    if (currentlyWorking || !endDate) {
      const now = new Date();
      endYear = now.getFullYear();
      endMonth = now.getMonth() + 1;
    } else {
      [endYear, endMonth] = endDate.split('-').map(Number);
    }
    const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    if (months <= 0) return '';
    const yrs = Math.floor(months / 12);
    const remMonths = months % 12;
    const parts = [];
    if (yrs > 0) parts.push(`${yrs} yr${yrs > 1 ? 's' : ''}`);
    if (remMonths > 0) parts.push(`${remMonths} mo${remMonths > 1 ? 's' : ''}`);
    return parts.join(' ');
  } catch {
    return '';
  }
};


function AcademicDocUploader({ label, doc, onUpload, onDelete, uploading }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload(file);
    e.target.value = '';
  };

  return (
    <div className="pf-doc-box">
      <span className="pf-doc-box__label">{label}</span>
      {doc?.fileId ? (
        <div className="pf-doc-card">
          <div className="pf-doc-card__info">
            <div className="pf-doc-card__icon">
              <PdfIcon size={26} />
            </div>
            <div className="pf-doc-card__meta">
              <span className="pf-doc-card__name" title={doc.filename}>{doc.filename}</span>
              <div className="pf-doc-card__sub">
                <span>{formatSize(doc.size)}</span>
                {doc.uploadedAt && <span> · {new Date(doc.uploadedAt).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
          <div className="pf-doc-card__actions">
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pf-doc-btn"
              title="Preview PDF"
            >
              <Eye size={13} /> View
            </a>
            <button
              type="button"
              className="pf-doc-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Replace file"
            >
              <UploadCloud size={13} /> {uploading ? '...' : 'Replace'}
            </button>
            <button
              type="button"
              className="pf-doc-btn pf-doc-btn--danger"
              onClick={onDelete}
              disabled={uploading}
              title="Remove document"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="pf-doc-upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={20} />
          <span>{uploading ? 'Uploading PDF...' : `Upload ${label} (PDF)`}</span>
          <small>Max file size 10MB · Official PDF only</small>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

export function ProfileEditPage() {
  const { student, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingSection, setSavingSection] = useState('');
  const [uploadingDocType, setUploadingDocType] = useState('');
  const [personal, setPersonal] = useState(student.personal);
  const [academic, setAcademic] = useState({ degreeProgram: 'B.Tech', graduationYear: 2027, ...student.academic });
  const [interests, setInterests] = useState(student.interests);
  const [family, setFamily] = useState(student.familyContext || { details: '', consentGiven: false });
  const [newAchievement, setNewAchievement] = useState({ title: '', category: ACHIEVEMENT_CATEGORIES[0], customCategory: '', description: '', year: '' });
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [isAddAchievementOpen, setIsAddAchievementOpen] = useState(false);
  const [toastLeaving, setToastLeaving] = useState(false);

  // Semester Modal State
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [semesterModalData, setSemesterModalData] = useState({ semester: 1, sgpa: '', cgpa: '', academicYear: '', file: null });
  const [savingSemester, setSavingSemester] = useState(false);

  // Internship Modal State
  const [isInternshipModalOpen, setIsInternshipModalOpen] = useState(false);
  const [editingInternshipData, setEditingInternshipData] = useState(null);
  const [deletingInternshipId, setDeletingInternshipId] = useState(null);

  useEffect(() => {
    setPersonal(student.personal);
    setAcademic({ degreeProgram: 'B.Tech', graduationYear: 2027, ...student.academic });
    setInterests(student.interests);
    setFamily(student.familyContext || { details: '', consentGiven: false });
  }, [student]);

  const save = async (section, data) => {
    setError('');
    setMessage('');
    setSavingSection(section);
    try {
      await profileApi.update(section, data);
      await refresh();
      setMessage('Saved. Your profile is up to date.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSection('');
    }
  };

  const handleUploadDoc = async (file, type, semester) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('Only PDF documents are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }

    const uploadKey = semester ? `semester_${semester}` : type;
    setUploadingDocType(uploadKey);
    setError('');
    setMessage('');
    try {
      await uploadAcademicDocument(file, type, semester);
      await refresh();
      setMessage(`${type === 'tenth_marksheet' ? '10th Marksheet' : type === 'twelfth_marksheet' ? '12th Marksheet' : `Semester ${semester} transcript`} uploaded successfully.`);
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to upload document.');
    } finally {
      setUploadingDocType('');
    }
  };

  const handleDeleteDoc = async (type, semesterId, semester) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    setError('');
    setMessage('');
    try {
      await profileApi.deleteAcademicDocument(type, { semesterId, semester });
      await refresh();
      setMessage('Document removed.');
    } catch (delError) {
      setError(delError.message || 'Failed to remove document.');
    }
  };

  const handleSaveSemesterSubmit = async () => {
    setError('');
    setMessage('');
    setSavingSemester(true);
    try {
      await profileApi.saveSemester({
        semester: Number(semesterModalData.semester),
        sgpa: semesterModalData.sgpa,
        cgpa: semesterModalData.cgpa,
        academicYear: semesterModalData.academicYear,
      });

      if (semesterModalData.file) {
        await uploadAcademicDocument(semesterModalData.file, 'semester_transcript', semesterModalData.semester);
      }

      await refresh();
      setIsSemesterModalOpen(false);
      setMessage(`Semester ${semesterModalData.semester} record saved.`);
    } catch (semError) {
      setError(semError.message || 'Failed to save semester record.');
    } finally {
      setSavingSemester(false);
    }
  };

  const handleDeleteSemester = async (semesterId) => {
    if (!window.confirm('Delete this semester record and any attached transcript?')) return;
    setError('');
    setMessage('');
    try {
      await profileApi.deleteSemester(semesterId);
      await refresh();
      setMessage('Semester record deleted.');
    } catch (delError) {
      setError(delError.message || 'Failed to delete semester record.');
    }
  };

  const add = async () => {
    setError('');
    setMessage('');
    setSavingSection('achievements');
    try {
      const category = newAchievement.category === 'Other' ? (newAchievement.customCategory.trim() || 'Other') : newAchievement.category;
      await profileApi.addAchievement({ ...newAchievement, category });
      setNewAchievement({ title: '', category: ACHIEVEMENT_CATEGORIES[0], customCategory: '', description: '', year: '' });
      setIsAddAchievementOpen(false);
      await refresh();
      setMessage('Achievement added.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSection('');
    }
  };

  const editAchievement = async () => {
    setError('');
    setMessage('');
    setSavingSection('achievement-edit');
    try {
      await profileApi.editAchievement(editingAchievement.id, editingAchievement);
      setEditingAchievement(null);
      await refresh();
      setMessage('Achievement updated.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSection('');
    }
  };

  const removeAchievement = async id => {
    if (!window.confirm('Remove this achievement?')) return;
    try {
      await profileApi.deleteAchievement(id);
      await refresh();
      setMessage('Achievement removed.');
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const handleOpenAddInternship = () => {
    setEditingInternshipData(null);
    setIsInternshipModalOpen(true);
  };

  const handleOpenEditInternship = (internship) => {
    setEditingInternshipData(internship);
    setIsInternshipModalOpen(true);
  };

  const handleDeleteInternship = async (id, companyName) => {
    if (!window.confirm(`Are you sure you want to remove your internship at ${companyName || 'this company'}?`)) {
      return;
    }
    setDeletingInternshipId(id);
    setError('');
    setMessage('');
    try {
      await profileApi.deleteInternship(id);
      await refresh();
      setMessage('Internship record removed successfully.');
    } catch (delError) {
      setError(delError.message || 'Failed to remove internship.');
    } finally {
      setDeletingInternshipId(null);
    }
  };

  const updateAcademic = (field, value) => setAcademic(previous => ({ ...previous, [field]: value }));

  useEffect(() => {
    if (!location.hash) return undefined;
    const targetId = decodeURIComponent(location.hash.slice(1));
    const scrollToTarget = () => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const frame = window.requestAnimationFrame(scrollToTarget);
    const retry = window.setTimeout(scrollToTarget, 150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
  }, [location.hash]);

  useEffect(() => {
    if (!message && !error) return undefined;
    setToastLeaving(false);
    const hideAnimation = window.setTimeout(() => setToastLeaving(true), 3200);
    const removeToast = window.setTimeout(() => {
      setMessage('');
      setError('');
      setToastLeaving(false);
    }, 3600);
    return () => {
      window.clearTimeout(hideAnimation);
      window.clearTimeout(removeToast);
    };
  }, [message, error]);

  return <div className="pf-profile-page">
    <div className="pf-edit-heading">
      <div><p className="editorial-eyebrow">Edit profile</p><h1>Keep your record current.</h1><p>Update one section at a time. Your other information stays untouched.</p></div>
      <button className="pf-secondary pf-back-button" onClick={() => navigate('/profile')}><ArrowLeft size={16} /> Back</button>
    </div>
    {createPortal(<div className={`pf-edit-toast-region${toastLeaving ? ' pf-edit-toast-region--leaving' : ''}`} aria-live="polite">{message && <div className="pf-edit-toast" role="status">{message}</div>}{error && <div className="pf-edit-toast pf-edit-toast--error" role="alert">{error}</div>}</div>, document.body)}

    <section className="pf-edit-section">
      <h2>Profile picture</h2>
      <p style={{ marginBottom: '14px' }}>Used across your profile, portals, and applications.</p>
      <AvatarEditor name={student.personal.fullName} currentUrl={student.personal.avatarUrl || ''} onSaved={refresh} />
    </section>

    <EditSection title="Personal information" note="Your email is linked to your institutional identity and can't be changed here." onSave={() => save('personal', personal)} saving={savingSection === 'personal'}>
      <label>Full name<input value={personal.fullName} onChange={event => setPersonal({ ...personal, fullName: event.target.value })} /></label>
      <label>Age<input type="number" value={personal.age} onChange={event => setPersonal({ ...personal, age: event.target.value })} /></label>
      <label>Phone number<input type="tel" placeholder="+91 98765 43210" value={personal.phone || ''} onChange={event => setPersonal({ ...personal, phone: event.target.value })} /></label>
      <label>Username<input value={personal.username} onChange={event => setPersonal({ ...personal, username: event.target.value.toLowerCase() })} /></label>
      <label>Institutional email<input value={personal.email} disabled /></label>
    </EditSection>

    {/* Schooling 10+2 Section */}
    <EditSection
      id="schooling"
      title="Schooling (10+2 Details & Marksheets)"
      note="Add your 10th (Matriculation) and 12th (Higher Secondary) schooling records and upload your official marksheets."
      onSave={() => save('academic', academic)}
      saving={savingSection === 'academic'}
      saveLabel="Save schooling details"
    >
      <div className="pf-academic-schooling-grid">
        {/* 10th Standard Card */}
        <div className="pf-schooling-card">
          <div className="pf-schooling-card__header">
            <div className="pf-schooling-card__title">
              10th Standard / Secondary
            </div>
            <span className="pf-schooling-card__badge">Matriculation</span>
          </div>

          <div className="pf-schooling-card__fields">
            <label style={{ gridColumn: '1 / -1' }}>
              School name
              <input
                placeholder="e.g. St. Xavier's High School"
                value={academic.tenthSchool || ''}
                onChange={e => updateAcademic('tenthSchool', e.target.value)}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Board / Council
              <input
                placeholder="e.g. CBSE, ICSE, State Board"
                value={academic.tenthBoard || ''}
                onChange={e => updateAcademic('tenthBoard', e.target.value)}
              />
            </label>
            <label>
              Passing year
              <input
                type="number"
                placeholder="e.g. 2020"
                min="1950"
                max="2100"
                value={academic.tenthYear || ''}
                onChange={e => updateAcademic('tenthYear', e.target.value)}
              />
            </label>
            <label>
              10th Percentage (%)
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 91.50"
                value={academic.tenthPercentage ?? ''}
                onChange={e => updateAcademic('tenthPercentage', e.target.value)}
              />
            </label>
          </div>

          <AcademicDocUploader
            label="10th Marksheet"
            doc={academic.tenthMarksheet}
            uploading={uploadingDocType === 'tenth_marksheet'}
            onUpload={file => handleUploadDoc(file, 'tenth_marksheet')}
            onDelete={() => handleDeleteDoc('tenth_marksheet')}
          />
        </div>

        {/* 12th Standard Card */}
        <div className="pf-schooling-card">
          <div className="pf-schooling-card__header">
            <div className="pf-schooling-card__title">
              12th Standard / Higher Secondary
            </div>
            <span className="pf-schooling-card__badge">10+2 / Diploma</span>
          </div>

          <div className="pf-schooling-card__fields">
            <label style={{ gridColumn: '1 / -1' }}>
              School / College name
              <input
                placeholder="e.g. Delhi Public School"
                value={academic.twelfthSchool || ''}
                onChange={e => updateAcademic('twelfthSchool', e.target.value)}
              />
            </label>
            <label>
              Board / Council
              <input
                placeholder="e.g. CBSE, ISC, State Board"
                value={academic.twelfthBoard || ''}
                onChange={e => updateAcademic('twelfthBoard', e.target.value)}
              />
            </label>
            <label>
              Stream / Specialization
              <input
                placeholder="e.g. Science (PCM), Commerce"
                value={academic.twelfthStream || ''}
                onChange={e => updateAcademic('twelfthStream', e.target.value)}
              />
            </label>
            <label>
              Passing year
              <input
                type="number"
                placeholder="e.g. 2022"
                min="1950"
                max="2100"
                value={academic.twelfthYear || ''}
                onChange={e => updateAcademic('twelfthYear', e.target.value)}
              />
            </label>
            <label>
              12th Percentage (%)
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 89.20"
                value={academic.twelfthPercentage ?? ''}
                onChange={e => updateAcademic('twelfthPercentage', e.target.value)}
              />
            </label>
          </div>

          <AcademicDocUploader
            label="12th Marksheet"
            doc={academic.twelfthMarksheet}
            uploading={uploadingDocType === 'twelfth_marksheet'}
            onUpload={file => handleUploadDoc(file, 'twelfth_marksheet')}
            onDelete={() => handleDeleteDoc('twelfth_marksheet')}
          />
        </div>
      </div>
    </EditSection>

    {/* College Semesters & Transcripts Section */}
    <EditSection
      id="semesters"
      title="College Semesters & Transcripts"
      note="Record your semester SGPA, cumulative CGPA, and upload official semester grade cards / transcripts."
      headerAction={
        <button
          type="button"
          className="pf-add-semester-btn"
          onClick={() => {
            const nextSem = (academic.semesters?.length || 0) + 1;
            setSemesterModalData({
              semester: nextSem <= 8 ? nextSem : 1,
              sgpa: '',
              cgpa: '',
              academicYear: '',
              file: null,
            });
            setIsSemesterModalOpen(true);
          }}
        >
          <Plus size={15} /> Add semester
        </button>
      }
    >
      {academic.semesters && academic.semesters.length > 0 ? (
        <div className="pf-semester-grid" style={{ gridColumn: '1 / -1' }}>
          {academic.semesters.map(sem => (
            <div className="pf-semester-card" key={sem.id || sem.semester}>
              <div className="pf-semester-card__top">
                <div className="pf-semester-badge">
                  Semester {sem.semester}
                  {sem.academicYear && (
                    <span style={{ fontSize: '0.78rem', color: '#7b857a', fontWeight: 500 }}>
                      · {sem.academicYear}
                    </span>
                  )}
                </div>
                <div className="pf-semester-actions">
                  <button
                    type="button"
                    className="pf-doc-btn"
                    onClick={() => {
                      setSemesterModalData({
                        id: sem.id,
                        semester: sem.semester,
                        sgpa: sem.sgpa ?? '',
                        cgpa: sem.cgpa ?? '',
                        academicYear: sem.academicYear || '',
                        file: null,
                      });
                      setIsSemesterModalOpen(true);
                    }}
                    title="Edit scores"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="pf-doc-btn pf-doc-btn--danger"
                    onClick={() => handleDeleteSemester(sem.id)}
                    title="Delete semester record"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="pf-semester-scores">
                <div className="pf-score-item">
                  <span>Semester SGPA</span>
                  <strong>{sem.sgpa !== null && sem.sgpa !== undefined ? Number(sem.sgpa).toFixed(2) : '—'}</strong>
                </div>
                <div className="pf-score-item">
                  <span>Cumulative CGPA</span>
                  <strong>{sem.cgpa !== null && sem.cgpa !== undefined ? Number(sem.cgpa).toFixed(2) : '—'}</strong>
                </div>
              </div>

              <div className="pf-semester-transcript">
                <AcademicDocUploader
                  label={`Semester ${sem.semester} Transcript`}
                  doc={sem.transcript}
                  uploading={uploadingDocType === `semester_${sem.semester}`}
                  onUpload={file => handleUploadDoc(file, 'semester_transcript', sem.semester)}
                  onDelete={() => handleDeleteDoc('semester_transcript', sem.id, sem.semester)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pf-semester-empty" style={{ gridColumn: '1 / -1' }}>
          <FileText size={32} style={{ color: 'var(--color-primary)', opacity: 0.6 }} />
          <p>
            No semester results or grade sheets added yet. Keep your academic record current to verify placement eligibility.
          </p>
          <button
            type="button"
            className="pf-add-semester-btn"
            onClick={() => {
              setSemesterModalData({
                semester: 1,
                sgpa: '',
                cgpa: '',
                academicYear: '',
                file: null,
              });
              setIsSemesterModalOpen(true);
            }}
          >
            <Plus size={15} /> Add Semester 1
          </button>
        </div>
      )}
    </EditSection>

    {/* Semester Modal */}
    <Modal
      isOpen={isSemesterModalOpen}
      onClose={() => setIsSemesterModalOpen(false)}
      title={semesterModalData?.id ? `Edit Semester ${semesterModalData.semester}` : 'Add Semester Result'}
      footer={
        <>
          <button type="button" className="pf-secondary" onClick={() => setIsSemesterModalOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="pf-save"
            disabled={savingSemester}
            onClick={handleSaveSemesterSubmit}
          >
            {savingSemester ? 'Saving...' : 'Save semester'}
          </button>
        </>
      }
    >
      <p className="pf-achievement-modal-intro">
        Enter your SGPA for this semester and cumulative CGPA as issued on your grade card.
      </p>
      <div className="pf-semester-modal-form">
        <label>
          Semester
          <select
            value={semesterModalData.semester}
            onChange={e => setSemesterModalData({ ...semesterModalData, semester: Number(e.target.value) })}
            disabled={Boolean(semesterModalData.id)}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <option key={num} value={num}>Semester {num}</option>
            ))}
          </select>
        </label>
        <label>
          Academic Session / Year
          <input
            placeholder="e.g. 2023 - 2024"
            value={semesterModalData.academicYear}
            onChange={e => setSemesterModalData({ ...semesterModalData, academicYear: e.target.value })}
          />
        </label>
        <label>
          Semester SGPA (0 - 10)
          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            placeholder="e.g. 8.75"
            value={semesterModalData.sgpa}
            onChange={e => setSemesterModalData({ ...semesterModalData, sgpa: e.target.value })}
          />
        </label>
        <label>
          Cumulative CGPA (0 - 10)
          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            placeholder="e.g. 8.80"
            value={semesterModalData.cgpa}
            onChange={e => setSemesterModalData({ ...semesterModalData, cgpa: e.target.value })}
          />
        </label>
        {!semesterModalData.id && (
          <label className="pf-full-width">
            Transcript / Grade Card PDF (optional)
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={e => setSemesterModalData({ ...semesterModalData, file: e.target.files?.[0] || null })}
            />
          </label>
        )}
      </div>
    </Modal>

    <div id="academic" />
    <EditSection id="eligibility" title="Academic eligibility" note="These fields help TNP determine eligibility for placement opportunities. Leave fields blank until you have verified information." onSave={() => save('academic', academic)} saving={savingSection === 'academic'}>
      <label>Degree / program<input placeholder="B.Tech" value={academic.degreeProgram || ''} onChange={event => updateAcademic('degreeProgram', event.target.value)} /></label>
      <label>Graduation year<input type="number" min="2027" placeholder="2027" value={academic.graduationYear || ''} onChange={event => updateAcademic('graduationYear', event.target.value)} /></label>
      <label>Current semester<input type="number" min="1" max="20" value={academic.currentSemester || ''} onChange={event => updateAcademic('currentSemester', event.target.value)} /></label>
      <label>CGPA<input type="number" min="0" max="10" step="0.01" value={academic.cgpa ?? ''} onChange={event => updateAcademic('cgpa', event.target.value)} /></label>
      <label>Active backlogs<input type="number" min="0" max="100" value={academic.activeBacklogs ?? ''} onChange={event => updateAcademic('activeBacklogs', event.target.value)} /></label>
      <label>Historical backlogs<input type="number" min="0" max="100" value={academic.historicalBacklogs ?? ''} onChange={event => updateAcademic('historicalBacklogs', event.target.value)} /></label>
      <label>Gap years<input type="number" min="0" max="20" step="0.5" value={academic.gapYears ?? ''} onChange={event => updateAcademic('gapYears', event.target.value)} /></label>
      <label>Department<input value={academic.department} onChange={event => updateAcademic('department', event.target.value)} /></label>
      <label>Batch year<input value={academic.batchYear} onChange={event => updateAcademic('batchYear', event.target.value)} /></label>
      <label>Roll number<input value={academic.rollNumber} disabled /></label>
    </EditSection>

    <div id="internships" />
    <EditSection
      id="internships-section"
      title="Internships & work experience"
      note="Add verified corporate internships, research appointments, or technical training engagements."
      headerAction={
        <button
          type="button"
          className="pf-achievement-add-button"
          onClick={handleOpenAddInternship}
        >
          <Plus size={16} /> Add internship
        </button>
      }
    >
      {(() => {
        const sortedInternships = sortInternships(student.internships);
        return sortedInternships.length > 0 ? (
          <div className="pf-internship-editor-list">
            {sortedInternships.map(internship => {
              const timelineStr = formatInternshipTimeline(internship.startDate, internship.endDate, internship.currentlyWorking);

              return (
                <article className="pf-internship-editor" key={internship.id}>
                {internship.companyLogo ? (
                  <img
                    src={internship.companyLogo}
                    alt={internship.companyName}
                    className="pf-company-logo"
                  />
                ) : (
                  <div className="pf-company-monogram">
                    {internship.companyName ? internship.companyName.slice(0, 2).toUpperCase() : <Building2 size={20} />}
                  </div>
                )}

                <div className="pf-internship-editor__body">
                  <div className="pf-internship-editor__header">
                    <div className="pf-internship-editor__title-row">
                      <strong>{internship.role}</strong>
                      <div className="pf-internship-editor__company-line">
                        <span>{internship.companyName}</span>
                        {internship.companyWebsite && (
                          <a
                            href={internship.companyWebsite.startsWith('http') ? internship.companyWebsite : `https://${internship.companyWebsite}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pf-company-link"
                          >
                            <Globe size={12} /> Website
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="pf-internship-editor__actions">
                      <button
                        type="button"
                        onClick={() => handleOpenEditInternship(internship)}
                        title="Edit internship details"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        className="pf-btn-danger"
                        disabled={deletingInternshipId === internship.id}
                        onClick={() => handleDeleteInternship(internship.id, internship.companyName)}
                        title="Remove internship"
                      >
                        <Trash2 size={13} /> {deletingInternshipId === internship.id ? '...' : 'Remove'}
                      </button>
                    </div>
                  </div>

                  <div className="pf-internship-editor__meta">
                    <span>
                      <Calendar size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                      {timelineStr}
                    </span>
                    {internship.internshipType && (
                      <span className="pf-internship-pill pf-internship-pill--type">
                        {internship.internshipType}
                      </span>
                    )}
                    {internship.workMode && (
                      <span className="pf-internship-pill pf-internship-pill--mode">
                        {internship.workMode}
                      </span>
                    )}
                    {internship.currentlyWorking && (
                      <span className="pf-internship-pill pf-internship-pill--present">
                        <span className="pf-pulse-dot" /> Present
                      </span>
                    )}
                    {internship.location && (
                      <span>
                        <MapPin size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                        {internship.location}
                      </span>
                    )}
                  </div>

                  {internship.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#445649', lineHeight: 1.45 }}>
                      {internship.description}
                    </p>
                  )}

                  {Array.isArray(internship.skills) && internship.skills.length > 0 && (
                    <div className="pf-internship-tags" style={{ marginTop: '4px' }}>
                      {internship.skills.map((skill, i) => (
                        <span key={i} className="pf-internship-tag">{skill}</span>
                      ))}
                    </div>
                  )}

                  {(internship.certificate?.fileUrl || internship.certificateUrl) && (
                    <div style={{ marginTop: '4px' }}>
                      <a
                        href={internship.certificate?.fileUrl || internship.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pf-cert-btn"
                        style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                      >
                        <FileText size={12} /> Certificate attached
                      </a>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        ) : (
          <div className="pf-internship-empty-card">
            <Briefcase size={32} style={{ color: '#88998c' }} />
            <p>No internships added yet</p>
            <span>Showcase your practical work experience, research internships, projects, and certificates to placement officers.</span>
            <button
              type="button"
              className="pf-achievement-add-button"
              style={{ marginTop: '8px' }}
              onClick={handleOpenAddInternship}
            >
              <Plus size={15} /> Add an internship
            </button>
          </div>
        );
      })()}
    </EditSection>

    <EditSection id="achievements" title="Achievements" note="Your certifications, hackathons, projects, and milestones." headerAction={<button type="button" className="pf-achievement-add-button" onClick={() => setIsAddAchievementOpen(true)}><Award size={16} /> Add achievement</button>}>
      <div className="pf-achievement-editor-list">
        {student.achievements.map(achievement =>
          editingAchievement?.id === achievement.id ? (
            <div className="pf-achievement-editor pf-achievement-editor--editing" key={achievement.id}>
              <div className="pf-achievement-editor__edit-header">
                <AchievementIcon category={editingAchievement.category} size={18} variant="badge" />
                <div className="pf-achievement-editor__edit-title-wrap">
                  <strong>Edit achievement</strong>
                  <span>Update milestone credentials, category, and description.</span>
                </div>
              </div>

              <div className="pf-achievement-edit-form">
                <div className="pf-achievement-edit-grid">
                  <label className="pf-achievement-field pf-field-title">
                    Title
                    <input
                      value={editingAchievement.title}
                      onChange={event => setEditingAchievement({ ...editingAchievement, title: event.target.value })}
                      placeholder="e.g. AWS Certified Solutions Architect"
                    />
                  </label>
                  <label className="pf-achievement-field pf-field-category">
                    Type / category
                    <input
                      value={editingAchievement.category}
                      onChange={event => setEditingAchievement({ ...editingAchievement, category: event.target.value })}
                      placeholder="e.g. Certification, Hackathon"
                    />
                  </label>
                  <label className="pf-achievement-field pf-field-year">
                    Completion year
                    <input
                      type="number"
                      value={editingAchievement.year || ''}
                      onChange={event => setEditingAchievement({ ...editingAchievement, year: event.target.value })}
                      placeholder="e.g. 2025"
                    />
                  </label>
                </div>

                <label className="pf-achievement-field pf-field-desc">
                  Description
                  <textarea
                    value={editingAchievement.description || ''}
                    onChange={event => setEditingAchievement({ ...editingAchievement, description: event.target.value })}
                    placeholder="What did you achieve, build, or learn?"
                  />
                </label>
              </div>

              <div className="pf-achievement-edit-footer">
                <button
                  type="button"
                  className="pf-achievement-btn pf-achievement-btn--cancel"
                  disabled={savingSection === 'achievement-edit'}
                  onClick={() => setEditingAchievement(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pf-achievement-btn pf-achievement-btn--save"
                  disabled={savingSection === 'achievement-edit'}
                  onClick={editAchievement}
                >
                  {savingSection === 'achievement-edit' ? 'Saving...' : 'Save edit'}
                </button>
              </div>
            </div>
          ) : (
            <article className="pf-achievement-editor" key={achievement.id}>
              <AchievementIcon category={achievement.category} size={18} variant="badge" />
              <div className="pf-achievement-editor__body">
                <div className="pf-achievement-editor__header">
                  <div>
                    <strong>{achievement.title}</strong>
                    <span className="pf-achievement-editor__meta">
                      <span className="pf-achievement-editor__category">{achievement.category || 'General'}</span>
                      {achievement.year ? `Completed ${achievement.year}` : 'Year not added'}
                    </span>
                  </div>
                  <div className="pf-achievement-editor__actions">
                    <button type="button" onClick={() => setEditingAchievement({ ...achievement })}>Edit</button>
                    <button type="button" onClick={() => removeAchievement(achievement.id)}>Remove</button>
                  </div>
                </div>
                {achievement.description && <p className="pf-achievement-editor__description">{cleanDescription(achievement.description)}</p>}
              </div>
            </article>
          )
        )}
      </div>
    </EditSection>

    <Modal isOpen={isAddAchievementOpen} onClose={() => setIsAddAchievementOpen(false)} title="Add an achievement" footer={<><button type="button" className="pf-secondary" onClick={() => setIsAddAchievementOpen(false)}>Cancel</button><button type="button" className="pf-save" disabled={savingSection === 'achievements'} onClick={add}>{savingSection === 'achievements' ? 'Adding...' : 'Save achievement'}</button></>}>
      <p className="pf-achievement-modal-intro">Capture a milestone with enough detail to help TNP understand its value.</p>
      <div className="pf-achievement-modal-form"><label>Title<input autoFocus value={newAchievement.title} onChange={event => setNewAchievement({ ...newAchievement, title: event.target.value })} placeholder="AWS certification or hackathon rank" /></label><label>Type / category<select value={newAchievement.category} onChange={event => setNewAchievement({ ...newAchievement, category: event.target.value, customCategory: '' })}>{ACHIEVEMENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}<option value="Other">Other</option></select></label>{newAchievement.category === 'Other' && <label>Custom category<input value={newAchievement.customCategory} onChange={event => setNewAchievement({ ...newAchievement, customCategory: event.target.value })} placeholder="Write a category" /></label>}<label>Completion year<input type="number" value={newAchievement.year} onChange={event => setNewAchievement({ ...newAchievement, year: event.target.value })} placeholder="2026" /></label><label className="pf-achievement-modal-form__description">Description<textarea value={newAchievement.description} onChange={event => setNewAchievement({ ...newAchievement, description: event.target.value })} placeholder="What did you achieve, build, or learn?" /></label></div>
    </Modal>

    <EditSection id="interests" title="Hobbies & passions" note="Use commas to add or remove tags. Custom interests are welcome." onSave={() => save('interests', interests)} saving={savingSection === 'interests'}>
      <label>Hobbies<input value={interests.hobbies.join(', ')} onChange={event => setInterests({ ...interests, hobbies: split(event.target.value) })} /></label>
      <label>Passions / interests<input value={interests.passions.join(', ')} onChange={event => setInterests({ ...interests, passions: split(event.target.value) })} /></label>
    </EditSection>

    <EditSection title="Personal / family context" note="Optional sensitive information. It is saved only with your explicit consent." onSave={() => save('family-context', family)} saving={savingSection === 'family-context'}>
      <label>Context<textarea value={family.details} onChange={event => setFamily({ ...family, details: event.target.value })} /></label>
      <label className="pf-check"><input type="checkbox" checked={family.consentGiven} onChange={event => setFamily({ ...family, consentGiven: event.target.checked })} /> I consent to storing this sensitive context.</label>
    </EditSection>

    <InternshipModal
      isOpen={isInternshipModalOpen}
      onClose={() => {
        setIsInternshipModalOpen(false);
        setEditingInternshipData(null);
      }}
      initialData={editingInternshipData}
      onSaved={async () => {
        await refresh();
        setMessage(editingInternshipData ? 'Internship updated successfully.' : 'New internship added successfully.');
      }}
    />
  </div>;
}

function EditSection({ id, title, note, onSave, saveLabel = 'Save changes', saving = false, headerAction, children }) {
  return (
    <section id={id} className="pf-edit-section pf-edit-section--target">
      <div className="pf-edit-section__heading">
        <h2>{title}</h2>
        {headerAction}
      </div>
      {note && <p className="pf-edit-section__note">{note}</p>}
      <div className="pf-edit-fields">{children}</div>
      {onSave && (
        <button className="pf-save" disabled={saving} onClick={onSave}>
          {saving ? 'Saving...' : saveLabel}
        </button>
      )}
    </section>
  );
}