import React, { useState } from 'react';
import {
  Calendar, Eye, Filter, Download, BriefcaseBusiness, FileText,
  ExternalLink, CheckSquare, Square, Check, CheckCircle2,
  Globe, Award, Briefcase, User
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { DataRow } from '../../../components/ui/DataRow';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Empty, formatISTDate } from '../utils/adminHelpers';
import './ApplicationWorkspace.css';

const STATUS_OPTIONS = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'];

// Standard exportable columns grouped logically
const BASE_EXPORT_COLUMNS = [
  { id: 'fullName', label: 'Full Name', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.fullName || app.profileSnapshot?.fullName || '' },
  { id: 'rollNumber', label: 'Roll Number', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.rollNumber || app.profileSnapshot?.rollNumber || '' },
  { id: 'email', label: 'Email Address', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.email || app.profileSnapshot?.email || '' },
  { id: 'phone', label: 'Phone Number', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.phone || app.profileSnapshot?.phone || '' },

  { id: 'department', label: 'Department / Branch', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.department || app.profileSnapshot?.department || '' },
  { id: 'batchYear', label: 'Batch Year', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.batchYear || app.profileSnapshot?.batchYear || '' },
  { id: 'degree', label: 'Degree', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.degree || '' },
  { id: 'currentSemester', label: 'Current Semester', group: 'Academic Records', defaultSelected: false, getValue: app => app.profileSnapshot?.academic?.currentSemester ?? '' },
  { id: 'cgpa', label: 'Current CGPA', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.cgpa ?? app.profileSnapshot?.cgpa ?? '' },
  { id: 'tenthPercentage', label: '10th Percentage (%)', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.tenthPercentage ?? '' },
  { id: 'twelfthPercentage', label: '12th Percentage (%)', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.twelfthPercentage ?? '' },
  { id: 'activeBacklogs', label: 'Active Backlogs', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.activeBacklogs ?? 0 },
  { id: 'historyOfBacklogs', label: 'History of Backlogs', group: 'Academic Records', defaultSelected: false, getValue: app => app.profileSnapshot?.academic?.historyOfBacklogs ?? 0 },
  { id: 'gapYears', label: 'Gap Years', group: 'Academic Records', defaultSelected: false, getValue: app => app.profileSnapshot?.academic?.gapYears ?? 0 },

  { id: 'resumeName', label: 'Resume File Name', group: 'Resume & Links', defaultSelected: false, getValue: app => app.selectedResume?.filename || app.selectedResume?.originalName || app.profileSnapshot?.selectedResume?.filename || app.profileSnapshot?.selectedResume?.originalName || '' },
  { id: 'resumeUrl', label: 'Resume Direct Link (URL)', group: 'Resume & Links', defaultSelected: true, getValue: app => {
    const raw = app.selectedResume?.url || app.selectedResume?.fileUrl || app.profileSnapshot?.selectedResume?.url || app.profileSnapshot?.selectedResume?.fileUrl;
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }},
  { id: 'linkedinUrl', label: 'LinkedIn Profile', group: 'Resume & Links', defaultSelected: true, getValue: app => app.profileSnapshot?.social?.linkedin || app.profileSnapshot?.social?.linkedinUrl || '' },
  { id: 'githubUrl', label: 'GitHub Profile', group: 'Resume & Links', defaultSelected: false, getValue: app => app.profileSnapshot?.social?.github || app.profileSnapshot?.social?.githubUrl || '' },
  { id: 'portfolioUrl', label: 'Portfolio URL', group: 'Resume & Links', defaultSelected: false, getValue: app => app.profileSnapshot?.social?.portfolio || app.profileSnapshot?.social?.portfolioUrl || '' },
  { id: 'leetcodeUrl', label: 'LeetCode Profile', group: 'Resume & Links', defaultSelected: false, getValue: app => app.profileSnapshot?.social?.leetcode || app.profileSnapshot?.social?.leetcodeUrl || '' },

  { id: 'status', label: 'Application Status', group: 'Status & Timeline', defaultSelected: true, getValue: app => app.status || '' },
  { id: 'createdAt', label: 'Applied At (IST)', group: 'Status & Timeline', defaultSelected: true, getValue: app => formatISTDate(app.createdAt) || '' },
  { id: 'applicationId', label: 'Application ID', group: 'Status & Timeline', defaultSelected: false, getValue: app => app.id || '' }
];

const STANDARD_PRESET_IDS = [
  'fullName', 'rollNumber', 'email', 'phone',
  'department', 'batchYear', 'degree', 'cgpa',
  'tenthPercentage', 'twelfthPercentage', 'activeBacklogs',
  'resumeUrl', 'linkedinUrl', 'status', 'createdAt'
];

export function ApplicationWorkspace({ jobs, applicationJobFilter, setApplicationJobFilter, applications, loading, updateApplication, saving }) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState({});
  const [viewingAppId, setViewingAppId] = useState(null);
  const [applicationFilter, setApplicationFilter] = useState('');
  
  // Column Selection Modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState(STANDARD_PRESET_IDS);

  const selectedJob = jobs.find(j => j.id === applicationJobFilter);
  const jobFields = selectedJob?.applicationForm?.fields || [];

  const handleFilterChange = (id, value) => setFieldFilters(prev => ({ ...prev, [id]: value }));

  const getFilteredApplications = base => {
    let filtered = base;
    Object.entries(fieldFilters).forEach(([fieldId, filterValue]) => {
      if (!filterValue) return;
      const lowerFilter = filterValue.toLowerCase();
      filtered = filtered.filter(app => {
        const val = app.answers?.[fieldId];
        if (val === undefined || val === null) return false;
        if (!isNaN(parseFloat(filterValue)) && !isNaN(parseFloat(val))) return parseFloat(val) >= parseFloat(filterValue);
        return String(val).toLowerCase().includes(lowerFilter);
      });
    });
    return filtered;
  };

  // Collect custom answers fields across applications
  const jobApplications = applications.filter(app => app.jobPostId === applicationJobFilter);
  const customAnswerKeys = new Set();
  jobApplications.forEach(app => {
    if (app.answers) {
      Object.keys(app.answers).forEach(k => customAnswerKeys.add(k));
    }
  });

  // Full columns list (Base + custom answers)
  const allAvailableColumns = [
    ...BASE_EXPORT_COLUMNS,
    ...Array.from(customAnswerKeys).map(key => ({
      id: `custom_${key}`,
      label: `Form: ${key}`,
      group: 'Custom Form Answers',
      defaultSelected: true,
      getValue: app => app.answers?.[key] || ''
    }))
  ];

  // Group columns by category
  const groupedColumns = allAvailableColumns.reduce((acc, col) => {
    if (!acc[col.group]) acc[col.group] = [];
    acc[col.group].push(col);
    return acc;
  }, {});

  const toggleColumn = id => {
    setSelectedColumnIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumnIds(allAvailableColumns.map(c => c.id));
  };

  const deselectAllColumns = () => {
    setSelectedColumnIds([]);
  };

  const applyStandardPreset = () => {
    setSelectedColumnIds(STANDARD_PRESET_IDS);
  };

  const executeCsvExport = () => {
    const statusFiltered = jobApplications.filter(app => !applicationFilter || app.status === applicationFilter);
    const targetApps = getFilteredApplications(statusFiltered);
    
    if (targetApps.length === 0) {
      alert('No applications match the filter criteria.');
      return;
    }

    if (selectedColumnIds.length === 0) {
      alert('Please select at least one column to export.');
      return;
    }

    const activeColumns = allAvailableColumns.filter(c => selectedColumnIds.includes(c.id));
    const escapeCsv = val => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const header = activeColumns.map(c => escapeCsv(c.label)).join(',');
    const rows = targetApps.map(app => {
      return activeColumns.map(col => escapeCsv(col.getValue(app))).join(',');
    });

    // \uFEFF is the UTF-8 BOM so Microsoft Excel correctly parses UTF-8 encoding
    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const safeTitle = (selectedJob?.title || 'applications').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const filename = `${safeTitle}_applicants_${new Date().toISOString().slice(0, 10)}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportModalOpen(false);
  };

  if (!applicationJobFilter) {
    return (
      <section className="pf-admin-single">
        <div className="pf-admin-list">
          {jobs.length === 0 ? (
            <EmptyState icon={BriefcaseBusiness} title="No posts available" text="Create a job post first; applications will be grouped per post here." />
          ) : jobs.map(job => (
            <DataRow
              key={job.id}
              onClick={() => setApplicationJobFilter(job.id)}
              title={<>
                {job.title}
                <StatusBadge status={job.status} />
              </>}
              meta={job.companyName}
              aside={<span className="pf-admin-app-count">{applications.filter(app => app.jobPostId === job.id).length} applications</span>}
            />
          ))}
        </div>
      </section>
    );
  }

  const viewingApp = applications.find(a => a.id === viewingAppId);
  const statusFiltered = jobApplications.filter(app => !applicationFilter || app.status === applicationFilter);
  const displayApplications = getFilteredApplications(statusFiltered);

  // Resume helper for viewing modal
  const viewingResume = viewingApp?.selectedResume || viewingApp?.profileSnapshot?.selectedResume;
  const viewingResumeRawUrl = viewingResume?.fileUrl || viewingResume?.url;
  const viewingResumeUrl = viewingResumeRawUrl
    ? (viewingResumeRawUrl.startsWith('http') ? viewingResumeRawUrl : `${window.location.origin}${viewingResumeRawUrl.startsWith('/') ? '' : '/'}${viewingResumeRawUrl}`)
    : (viewingResume?.id ? `/api/resumes/${viewingResume.id}/file` : null);

  const viewingAcademic = viewingApp?.profileSnapshot?.academic || {};
  const viewingPersonal = viewingApp?.profileSnapshot?.personal || {};
  const viewingSocial = viewingApp?.profileSnapshot?.social || {};
  const viewingLinkedin = viewingSocial.linkedin || viewingSocial.linkedinUrl;
  const viewingGithub = viewingSocial.github || viewingSocial.githubUrl;
  const viewingPortfolio = viewingSocial.portfolio || viewingSocial.portfolioUrl;
  const viewingLeetcode = viewingSocial.leetcode || viewingSocial.leetcodeUrl;
  const viewingCodeforces = viewingSocial.codeforces || viewingSocial.codeforcesUrl;

  return (
    <section className="pf-admin-single">
      <div className="pf-admin-list">
        <div className="pf-admin-toolbar pf-admin-toolbar--wrap">
          <Button variant="ghost" size="sm" onClick={() => setApplicationJobFilter('')}>&larr; All job posts</Button>
          <select className="pf-admin-filter" value={applicationFilter} onChange={event => setApplicationFilter(event.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <Button type="button" onClick={() => setFilterModalOpen(true)} size="sm" variant="secondary" icon={Filter}>
            Filters {Object.values(fieldFilters).some(v => v) ? '(Active)' : ''}
          </Button>
          <Button type="button" onClick={() => setExportModalOpen(true)} size="sm" variant="primary" icon={Download}>
            Export CSV
          </Button>
        </div>

        {loading ? <Empty text="Loading applications..." /> : displayApplications.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No applications" text="No applications match the current filters." />
        ) : displayApplications.map(application => {
          const snapshot = application.profileSnapshot || {};
          const candidateName = snapshot.personal?.fullName || snapshot.fullName || 'Student applicant';
          const candidateEmail = snapshot.personal?.email || snapshot.email;
          const candidateDept = snapshot.academic?.department || snapshot.department;
          const candidateBatch = snapshot.academic?.batchYear || snapshot.batchYear;
          const candidateCgpa = snapshot.academic?.cgpa ?? snapshot.cgpa;
          const hasResume = !!(application.selectedResume || snapshot.selectedResume);

          return (
            <DataRow
              key={application.id}
              onClick={() => setViewingAppId(application.id)}
              title={<>
                {candidateName}
                <StatusBadge status={application.status === 'applied' ? 'draft' : application.status} label={application.status} />
                {hasResume && (
                  <span style={{ fontSize: '0.72rem', background: '#eef6ee', color: '#2b592b', padding: '1px 6px', borderRadius: '4px', border: '1px solid #c2e0c2', fontWeight: 600 }}>
                    Resume Attached
                  </span>
                )}
              </>}
              meta={<>
                {candidateEmail}
                {candidateDept && <span> · {candidateDept}</span>}
                {candidateBatch && <span> · {candidateBatch}</span>}
                {candidateCgpa !== undefined && candidateCgpa !== null && <span> · CGPA: <strong>{candidateCgpa}</strong></span>}
                <span className="pf-data-row__meta-date"><Calendar size={12} /> {formatISTDate(application.createdAt)} IST</span>
              </>}
              aside={
                <div className="pf-admin-item-actions">
                  <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setViewingAppId(application.id); }} icon={Eye}>
                    Review
                  </Button>
                  <select
                    value={application.status}
                    disabled={saving}
                    onClick={event => event.stopPropagation()}
                    onChange={event => updateApplication(application.id, event.target.value)}
                    aria-label="Application status"
                  >
                    {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              }
            />
          );
        })}
      </div>

      {/* DETAILED APPLICATION VIEW MODAL */}
      <Modal
        isOpen={!!viewingAppId}
        onClose={() => setViewingAppId(null)}
        title="Application Snapshot & Verification"
        footer={
          viewingApp ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="pf-app-status-control">
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
                <select
                  className="pf-app-status-select"
                  value={viewingApp.status}
                  disabled={saving}
                  onChange={e => updateApplication(viewingApp.id, e.target.value)}
                >
                  {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <Button variant="primary" onClick={() => setViewingAppId(null)}>Done</Button>
            </div>
          ) : null
        }
      >
        {viewingApp && (
          <div className="pf-app-details-modal">
            {/* Header info */}
            <div className="pf-app-details-header">
              <div>
                <h3>{viewingPersonal.fullName || viewingApp.profileSnapshot.fullName || 'Student Applicant'}</h3>
                <p className="pf-app-details-meta">
                  <span>{viewingPersonal.email || viewingApp.profileSnapshot.email}</span>
                  {(viewingPersonal.phone || viewingApp.profileSnapshot.phone) && <span>· 📞 {viewingPersonal.phone || viewingApp.profileSnapshot.phone}</span>}
                  {(viewingPersonal.rollNumber || viewingApp.profileSnapshot.rollNumber) && <span>· 🆔 {viewingPersonal.rollNumber || viewingApp.profileSnapshot.rollNumber}</span>}
                </p>
              </div>
              <StatusBadge status={viewingApp.status === 'applied' ? 'draft' : viewingApp.status} label={viewingApp.status} />
            </div>

            {/* Academic Snapshot Card */}
            <div className="pf-app-section">
              <h4 className="pf-app-section-title">Academic Verification (Snapshot at Apply Time)</h4>
              <div className="pf-app-academic-grid">
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">Current CGPA</span>
                  <span className="pf-app-metric-val highlight">
                    {viewingAcademic.cgpa ?? viewingApp.profileSnapshot.cgpa ?? 'N/A'}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">10th Marks</span>
                  <span className="pf-app-metric-val">
                    {viewingAcademic.tenthPercentage ? `${viewingAcademic.tenthPercentage}%` : 'N/A'}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">12th Marks</span>
                  <span className="pf-app-metric-val">
                    {viewingAcademic.twelfthPercentage ? `${viewingAcademic.twelfthPercentage}%` : 'N/A'}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">Active Backlogs</span>
                  <span className="pf-app-metric-val">
                    {viewingAcademic.activeBacklogs ?? 0}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">History Backlogs</span>
                  <span className="pf-app-metric-val">
                    {viewingAcademic.historyOfBacklogs ?? 0}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">Department</span>
                  <span className="pf-app-metric-val" style={{ fontSize: '0.85rem' }}>
                    {viewingAcademic.department || viewingApp.profileSnapshot.department || 'N/A'}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">Batch Year</span>
                  <span className="pf-app-metric-val">
                    {viewingAcademic.batchYear || viewingApp.profileSnapshot.batchYear || 'N/A'}
                  </span>
                </div>
                <div className="pf-app-metric-card">
                  <span className="pf-app-metric-label">Degree</span>
                  <span className="pf-app-metric-val" style={{ fontSize: '0.85rem' }}>
                    {viewingAcademic.degree || 'B.Tech'}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Resume Section */}
            <div className="pf-app-section">
              <h4 className="pf-app-section-title">Submitted Resume Document</h4>
              {viewingResumeUrl ? (
                <div className="pf-app-resume-card">
                  <div className="pf-app-resume-info">
                    <div className="pf-app-resume-icon">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="pf-app-resume-name">{viewingResume?.originalName || 'Selected Resume Document'}</p>
                      {viewingResume?.uploadedAt && (
                        <p className="pf-app-resume-date">Uploaded: {formatISTDate(viewingResume.uploadedAt)}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={viewingResumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="secondary" size="sm" icon={ExternalLink}>
                      Open PDF
                    </Button>
                  </a>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No resume document was attached with this application.
                </p>
              )}
            </div>

            {/* Online Profiles & Handles */}
            {(viewingLinkedin || viewingGithub || viewingPortfolio || viewingLeetcode || viewingCodeforces) && (
              <div className="pf-app-section">
                <h4 className="pf-app-section-title">Verified Profiles & Handles</h4>
                <div className="pf-app-links-row">
                  {viewingLinkedin && (
                    <a href={viewingLinkedin} target="_blank" rel="noreferrer" className="pf-app-link-pill">
                      <Globe size={14} /> LinkedIn <ExternalLink size={11} />
                    </a>
                  )}
                  {viewingGithub && (
                    <a href={viewingGithub} target="_blank" rel="noreferrer" className="pf-app-link-pill">
                      <Globe size={14} /> GitHub <ExternalLink size={11} />
                    </a>
                  )}
                  {viewingPortfolio && (
                    <a href={viewingPortfolio} target="_blank" rel="noreferrer" className="pf-app-link-pill">
                      <Globe size={14} /> Portfolio <ExternalLink size={11} />
                    </a>
                  )}
                  {viewingLeetcode && (
                    <a href={viewingLeetcode} target="_blank" rel="noreferrer" className="pf-app-link-pill">
                      <Globe size={14} /> LeetCode <ExternalLink size={11} />
                    </a>
                  )}
                  {viewingCodeforces && (
                    <a href={viewingCodeforces} target="_blank" rel="noreferrer" className="pf-app-link-pill">
                      <Globe size={14} /> Codeforces <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Custom Answers */}
            {viewingApp.answers && Object.keys(viewingApp.answers).length > 0 && (
              <div className="pf-app-section">
                <h4 className="pf-app-section-title">Job-Specific Form Responses</h4>
                <div className="pf-app-answers-list">
                  {Object.entries(viewingApp.answers).map(([k, v]) => (
                    <div key={k} className="pf-app-answer-item">
                      <div className="pf-app-answer-q">{k}</div>
                      <div className="pf-app-answer-a">
                        {String(v).startsWith('http') ? (
                          <a href={v} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>{v}</a>
                        ) : (
                          <span>{v}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* FILTER MODAL */}
      <Modal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Applications"
        footer={
          <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => { setFieldFilters({}); setFilterModalOpen(false); }}>Clear Filters</Button>
            <Button variant="primary" onClick={() => setFilterModalOpen(false)}>Apply Filters</Button>
          </div>
        }
      >
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

      {/* COLUMN-SELECTABLE CSV EXPORT MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Applications to CSV"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Button variant="ghost" onClick={() => setExportModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={executeCsvExport}
              disabled={selectedColumnIds.length === 0}
              icon={Download}
            >
              Download CSV ({selectedColumnIds.length} columns)
            </Button>
          </div>
        }
      >
        <div className="pf-export-modal">
          <div className="pf-export-summary-banner">
            <p className="pf-export-summary-text">
              Exporting <strong>{displayApplications.length}</strong> candidate{displayApplications.length === 1 ? '' : 's'} for <strong>{selectedJob?.title}</strong>
              {applicationFilter ? ` (Status: ${applicationFilter})` : ''}
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pf-export-presets">
            <span className="pf-export-preset-label">Presets:</span>
            <button
              type="button"
              className="pf-export-preset-btn highlight"
              onClick={applyStandardPreset}
            >
              Standard T&P Preset
            </button>
            <button
              type="button"
              className="pf-export-preset-btn"
              onClick={selectAllColumns}
            >
              Select All
            </button>
            <button
              type="button"
              className="pf-export-preset-btn"
              onClick={deselectAllColumns}
            >
              Clear All
            </button>
          </div>

          {/* Grouped Column Checkboxes */}
          {Object.entries(groupedColumns).map(([groupName, cols]) => (
            <div key={groupName} className="pf-export-group">
              <div className="pf-export-group-title">
                <span>{groupName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {cols.filter(c => selectedColumnIds.includes(c.id)).length} of {cols.length} selected
                </span>
              </div>
              <div className="pf-export-columns-grid">
                {cols.map(col => {
                  const isChecked = selectedColumnIds.includes(col.id);
                  return (
                    <label
                      key={col.id}
                      className={`pf-export-col-card ${isChecked ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColumn(col.id)}
                      />
                      <span>{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </section>
  );
}
