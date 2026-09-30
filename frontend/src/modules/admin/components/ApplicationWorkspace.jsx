import React, { useState } from 'react';
import {
  Calendar, Eye, Filter, Download, BriefcaseBusiness, FileText,
  ExternalLink, CheckSquare, Check,
  Globe, Share2, ChevronLeft, ChevronRight, X,
  Building2, ArrowLeft, ArrowUpDown
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { DataRow } from '../../../components/ui/DataRow';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Empty, formatISTDate } from '../utils/adminHelpers';
import { adminApi } from '../adminApi';
import './ApplicationWorkspace.css';

const STATUS_OPTIONS = ['applied', 'shortlisted', 'interview', 'selected', 'rejected'];

// Standard exportable columns grouped logically
const BASE_EXPORT_COLUMNS = [
  { id: 'fullName', label: 'Full Name', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.fullName || app.profileSnapshot?.fullName || '' },
  { id: 'rollNumber', label: 'Roll Number', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.rollNumber || app.profileSnapshot?.personal?.rollNumber || app.profileSnapshot?.rollNumber || '' },
  { id: 'email', label: 'Email Address', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.email || app.profileSnapshot?.email || '' },
  { id: 'phone', label: 'Phone Number', group: 'Personal Details', defaultSelected: true, getValue: app => app.profileSnapshot?.personal?.phone || app.profileSnapshot?.phone || '' },

  { id: 'department', label: 'Department / Branch', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.department || app.profileSnapshot?.department || '' },
  { id: 'batchYear', label: 'Batch Year', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.batchYear || app.profileSnapshot?.batchYear || '' },
  { id: 'degree', label: 'Degree', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.degree || app.profileSnapshot?.academic?.degreeProgram || '' },
  { id: 'currentSemester', label: 'Current Semester', group: 'Academic Records', defaultSelected: false, getValue: app => app.profileSnapshot?.academic?.currentSemester ?? '' },
  { id: 'cgpa', label: 'Current CGPA', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.cgpa ?? app.profileSnapshot?.cgpa ?? '' },
  { id: 'tenthPercentage', label: '10th Percentage (%)', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.tenthPercentage ?? '' },
  { id: 'twelfthPercentage', label: '12th Percentage (%)', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.twelfthPercentage ?? '' },
  { id: 'activeBacklogs', label: 'Active Backlogs', group: 'Academic Records', defaultSelected: true, getValue: app => app.profileSnapshot?.academic?.activeBacklogs ?? 0 },
  { id: 'historyOfBacklogs', label: 'History of Backlogs', group: 'Academic Records', defaultSelected: false, getValue: app => app.profileSnapshot?.academic?.historicalBacklogs ?? app.profileSnapshot?.academic?.historyOfBacklogs ?? 0 },
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

const INITIAL_ACADEMIC_FILTERS = {
  minCgpa: '',
  branch: '',
  batchYear: '',
  backlogs: '',
  minTenth: '',
  minTwelfth: ''
};

export function ApplicationWorkspace({
  companies = [],
  jobs,
  applicationJobFilter,
  setApplicationJobFilter,
  applications,
  loading,
  updateApplication,
  saving
}) {
  // Job selection page search & filter
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('');

  // Applications view search, sort & filters
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [academicFilters, setAcademicFilters] = useState(INITIAL_ACADEMIC_FILTERS);

  // Multi-select for bulk actions
  const [selectedAppIds, setSelectedAppIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('shortlisted');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Rapid review modal
  const [viewingAppId, setViewingAppId] = useState(null);

  // Column Selection CSV Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState(STANDARD_PRESET_IDS);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);

  // Recruiter Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);

  const selectedJob = jobs.find(j => j.id === applicationJobFilter);

  // Helper to handle typed academic filter change
  const handleAcademicFilterChange = (field, value) => {
    setAcademicFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearAcademicFilters = () => {
    setAcademicFilters(INITIAL_ACADEMIC_FILTERS);
    setFilterModalOpen(false);
  };

  // Count active academic filters
  const activeAcademicFilterCount = Object.values(academicFilters).filter(v => v !== '').length;

  // Collect applications for current job
  const jobApplications = applications.filter(app => app.jobPostId === applicationJobFilter);

  // Calculate funnel counts for this job
  const funnelCounts = {
    all: jobApplications.length,
    applied: jobApplications.filter(a => a.status === 'applied').length,
    shortlisted: jobApplications.filter(a => a.status === 'shortlisted').length,
    interview: jobApplications.filter(a => a.status === 'interview').length,
    selected: jobApplications.filter(a => a.status === 'selected').length,
    rejected: jobApplications.filter(a => a.status === 'rejected').length
  };

  // Filter applications by status, search, and typed academic fields
  const getFilteredAndSortedApplications = () => {
    let filtered = jobApplications;

    // 1. Status filter
    if (applicationFilter) {
      filtered = filtered.filter(app => app.status === applicationFilter);
    }

    // 2. Candidate live search query (name, roll, email, dept)
    if (candidateSearchQuery.trim()) {
      const q = candidateSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(app => {
        const snap = app.profileSnapshot || {};
        const name = (snap.personal?.fullName || snap.fullName || '').toLowerCase();
        const roll = (snap.academic?.rollNumber || snap.personal?.rollNumber || snap.rollNumber || '').toLowerCase();
        const email = (snap.personal?.email || snap.email || '').toLowerCase();
        const dept = (snap.academic?.department || snap.department || '').toLowerCase();
        return name.includes(q) || roll.includes(q) || email.includes(q) || dept.includes(q);
      });
    }

    // 3. Typed Academic Filters (reads directly from profileSnapshot.academic!)
    filtered = filtered.filter(app => {
      const snap = app.profileSnapshot || {};
      const academic = snap.academic || {};

      // Min CGPA filter
      if (academicFilters.minCgpa !== '') {
        const cgpa = Number(academic.cgpa ?? snap.cgpa);
        if (isNaN(cgpa) || cgpa < Number(academicFilters.minCgpa)) return false;
      }

      // Department / Branch filter
      if (academicFilters.branch.trim()) {
        const dept = (academic.department || snap.department || '').toLowerCase();
        if (!dept.includes(academicFilters.branch.trim().toLowerCase())) return false;
      }

      // Batch Year filter
      if (academicFilters.batchYear.trim()) {
        const batch = String(academic.batchYear || snap.batchYear || '');
        if (!batch.includes(academicFilters.batchYear.trim())) return false;
      }

      // Backlogs filter
      if (academicFilters.backlogs === 'zero') {
        const active = Number(academic.activeBacklogs ?? snap.activeBacklogs ?? 0);
        if (active > 0) return false;
      } else if (academicFilters.backlogs === 'max1') {
        const active = Number(academic.activeBacklogs ?? snap.activeBacklogs ?? 0);
        if (active > 1) return false;
      }

      // Min 10th % filter
      if (academicFilters.minTenth !== '') {
        const tenth = Number(academic.tenthPercentage);
        if (isNaN(tenth) || tenth < Number(academicFilters.minTenth)) return false;
      }

      // Min 12th % filter
      if (academicFilters.minTwelfth !== '') {
        const twelfth = Number(academic.twelfthPercentage);
        if (isNaN(twelfth) || twelfth < Number(academicFilters.minTwelfth)) return false;
      }

      return true;
    });

    // 4. Sort applications
    const sorted = [...filtered].sort((a, b) => {
      const snapA = a.profileSnapshot || {};
      const snapB = b.profileSnapshot || {};

      if (sortOption === 'cgpa_desc') {
        const cgpaA = Number(snapA.academic?.cgpa ?? snapA.cgpa ?? 0);
        const cgpaB = Number(snapB.academic?.cgpa ?? snapB.cgpa ?? 0);
        return cgpaB - cgpaA;
      }
      if (sortOption === 'cgpa_asc') {
        const cgpaA = Number(snapA.academic?.cgpa ?? snapA.cgpa ?? 0);
        const cgpaB = Number(snapB.academic?.cgpa ?? snapB.cgpa ?? 0);
        return cgpaA - cgpaB;
      }
      if (sortOption === 'name_asc') {
        const nameA = (snapA.personal?.fullName || snapA.fullName || '').toLowerCase();
        const nameB = (snapB.personal?.fullName || snapB.fullName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortOption === 'roll_asc') {
        const rollA = (snapA.academic?.rollNumber || snapA.personal?.rollNumber || snapA.rollNumber || '').toLowerCase();
        const rollB = (snapB.academic?.rollNumber || snapB.personal?.rollNumber || snapB.rollNumber || '').toLowerCase();
        return rollA.localeCompare(rollB);
      }
      if (sortOption === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      // Default: newest applied first
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return sorted;
  };

  const displayApplications = getFilteredAndSortedApplications();

  // Multi-select handlers
  const handleToggleSelectAll = () => {
    if (selectedAppIds.size === displayApplications.length && displayApplications.length > 0) {
      setSelectedAppIds(new Set());
    } else {
      setSelectedAppIds(new Set(displayApplications.map(a => a.id)));
    }
  };

  const handleToggleSelectRow = (id, event) => {
    event.stopPropagation();
    setSelectedAppIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk status update
  const handleApplyBulkStatus = async () => {
    if (selectedAppIds.size === 0) return;
    if (!window.confirm(`Update status of ${selectedAppIds.size} candidate(s) to "${bulkStatus}"?`)) return;

    setBulkUpdating(true);
    try {
      const ids = Array.from(selectedAppIds);
      if (adminApi.updateApplicationsBulk) {
        await adminApi.updateApplicationsBulk(ids, { status: bulkStatus });
      } else {
        await Promise.all(ids.map(id => updateApplication(id, bulkStatus)));
      }
      for (const id of ids) {
        updateApplication(id, bulkStatus);
      }
      setSelectedAppIds(new Set());
    } catch (err) {
      alert(`Bulk update error: ${err.message}`);
    } finally {
      setBulkUpdating(false);
    }
  };

  // Recruiter sharing
  const openShareModal = async (targetStudentIds = null) => {
    try {
      const data = await adminApi.recruiters();
      setRecruiters(data.recruiters || []);
      if (data.recruiters?.length > 0) {
        setSelectedRecruiterId(data.recruiters[0].id);
      }
      setShareNote(`Shortlisted candidates for ${selectedJob?.title || 'Job Post'}`);
      setShareModalOpen(true);
    } catch (err) {
      alert(`Failed to load recruiters: ${err.message}`);
    }
  };

  const handleConfirmShare = async () => {
    if (!selectedRecruiterId) {
      alert('Please select a recruiter.');
      return;
    }

    const targetApps = selectedAppIds.size > 0
      ? jobApplications.filter(a => selectedAppIds.has(a.id))
      : jobApplications.filter(a => a.status === 'shortlisted');

    if (targetApps.length === 0) {
      alert('No candidates available to share. Please select candidates or shortlist some first.');
      return;
    }

    const studentIds = targetApps.map(a => a.studentId);

    setSharing(true);
    try {
      await adminApi.createShare({
        recruiterId: selectedRecruiterId,
        jobPostId: selectedJob?.id || null,
        studentIds,
        note: shareNote
      });
      alert(`Successfully shared ${studentIds.length} candidate(s) with the recruiter!`);
      setShareModalOpen(false);
      setSelectedAppIds(new Set());
    } catch (err) {
      alert(`Failed to share candidates: ${err.message}`);
    } finally {
      setSharing(false);
    }
  };

  // Collect custom answers fields for export
  const customAnswerKeys = new Set();
  jobApplications.forEach(app => {
    if (app.answers) {
      Object.keys(app.answers).forEach(k => customAnswerKeys.add(k));
    }
  });

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

  const executeCsvExport = () => {
    let targetApps = exportSelectedOnly && selectedAppIds.size > 0
      ? displayApplications.filter(a => selectedAppIds.has(a.id))
      : displayApplications;

    if (targetApps.length === 0) {
      alert('No applications match the export criteria.');
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

  // =========================================================================
  // VIEW 1: JOB SELECTION SCREEN (When no job is selected)
  // =========================================================================
  if (!applicationJobFilter) {
    const filteredJobs = jobs.filter(job => {
      const matchesSearch = !jobSearchQuery.trim() ||
        job.title.toLowerCase().includes(jobSearchQuery.toLowerCase()) ||
        job.companyName.toLowerCase().includes(jobSearchQuery.toLowerCase());
      const matchesStatus = !jobStatusFilter || job.status === jobStatusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <section className="pf-admin-single">
        <div className="pf-admin-list">
          {/* Job Search & Filter Toolbar */}
          <div className="pf-admin-toolbar pf-admin-toolbar--wrap" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              className="pf-app-search-input"
              placeholder="Search job posts by company or role..."
              value={jobSearchQuery}
              onChange={e => setJobSearchQuery(e.target.value)}
            />
            <select
              className="pf-admin-filter pf-app-sort-select"
              value={jobStatusFilter}
              onChange={e => setJobStatusFilter(e.target.value)}
              aria-label="Filter jobs by status"
            >
              <option value="">All job statuses</option>
              <option value="published">Published</option>
              <option value="approved">Approved</option>
              <option value="closed">Closed</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {filteredJobs.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No matching job posts"
              text={jobs.length === 0 ? "Create a job post first; applications will be grouped per post here." : "No jobs match your search criteria."}
            />
          ) : (
            filteredJobs.map(job => {
              const jobApps = applications.filter(app => app.jobPostId === job.id);
              const appliedCnt = jobApps.filter(a => a.status === 'applied').length;
              const shortlistedCnt = jobApps.filter(a => a.status === 'shortlisted').length;
              const selectedCnt = jobApps.filter(a => a.status === 'selected').length;

              // Find company to display logo
              const company = (companies || []).find(
                c => c.id === job.companyId || c.name?.toLowerCase() === job.companyName?.toLowerCase()
              );
              const logoUrl = company?.logoUrl;

              return (
                <div key={job.id} className="pf-app-job-row pf-app-job-row--clickable" onClick={() => setApplicationJobFilter(job.id)}>
                  {logoUrl ? (
                    <img src={logoUrl} alt={job.companyName} className="pf-app-job-logo" />
                  ) : (
                    <div className="pf-app-job-logo-fallback">
                      {job.companyName?.slice(0, 2).toUpperCase() || 'CO'}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <DataRow
                      title={<>
                        {job.title}
                        <StatusBadge status={job.status} />
                      </>}
                      meta={<>
                        <Building2 size={13} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                        {job.companyName}
                        {job.location && <span> · {job.location}</span>}
                        {job.employmentType && <span> · {job.employmentType}</span>}
                        <span className="pf-data-row__meta-date">
                          <Calendar size={12} /> Posted {formatISTDate(job.publishedAt || job.createdAt)} IST
                        </span>
                        {job.applicationDeadline && (
                          <span className="pf-data-row__meta-date" style={{ color: '#b45309', fontWeight: 600 }}>
                            Deadline: {formatISTDate(job.applicationDeadline)} IST
                          </span>
                        )}
                      </>}
                      aside={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="pf-admin-app-count">
                            <strong>{jobApps.length}</strong> total
                          </span>
                          {jobApps.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', fontSize: '0.75rem' }}>
                              {appliedCnt > 0 && <span style={{ background: '#eef2ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{appliedCnt} new</span>}
                              {shortlistedCnt > 0 && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{shortlistedCnt} shortlisted</span>}
                              {selectedCnt > 0 && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{selectedCnt} selected</span>}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  }

  // =========================================================================
  // VIEW 2: JOB APPLICATIONS WORKSPACE (When a job is selected)
  // =========================================================================
  const viewingAppIndex = displayApplications.findIndex(a => a.id === viewingAppId);
  const viewingApp = viewingAppIndex >= 0 ? displayApplications[viewingAppIndex] : null;

  // Stepper navigation in rapid review modal
  const handlePrevCandidate = () => {
    if (viewingAppIndex > 0) {
      setViewingAppId(displayApplications[viewingAppIndex - 1].id);
    }
  };

  const handleNextCandidate = () => {
    if (viewingAppIndex < displayApplications.length - 1) {
      setViewingAppId(displayApplications[viewingAppIndex + 1].id);
    }
  };

  // Resume & profile helpers for viewing modal
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
        {/* Header Breadcrumb & Job Meta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <Button variant="ghost" size="sm" onClick={() => { setApplicationJobFilter(''); setSelectedAppIds(new Set()); }} icon={ArrowLeft}>
            All job posts
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedJob?.companyName}</span>
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{selectedJob?.title}</span>
            <StatusBadge status={selectedJob?.status} />
          </div>
        </div>

        {/* Funnel Metrics Bar (Clickable Filter Pills) */}
        <div className="pf-app-funnel-bar">
          <button
            type="button"
            className={`pf-app-funnel-pill ${!applicationFilter ? 'active' : ''}`}
            onClick={() => setApplicationFilter('')}
          >
            <span>All Candidates</span>
            <span className="pf-app-funnel-count">{funnelCounts.all}</span>
          </button>
          <button
            type="button"
            className={`pf-app-funnel-pill ${applicationFilter === 'applied' ? 'active' : ''}`}
            onClick={() => setApplicationFilter('applied')}
          >
            <span>Applied / In Review</span>
            <span className="pf-app-funnel-count">{funnelCounts.applied}</span>
          </button>
          <button
            type="button"
            className={`pf-app-funnel-pill ${applicationFilter === 'shortlisted' ? 'active' : ''}`}
            onClick={() => setApplicationFilter('shortlisted')}
          >
            <span>Shortlisted</span>
            <span className="pf-app-funnel-count">{funnelCounts.shortlisted}</span>
          </button>
          <button
            type="button"
            className={`pf-app-funnel-pill ${applicationFilter === 'interview' ? 'active' : ''}`}
            onClick={() => setApplicationFilter('interview')}
          >
            <span>Interview</span>
            <span className="pf-app-funnel-count">{funnelCounts.interview}</span>
          </button>
          <button
            type="button"
            className={`pf-app-funnel-pill ${applicationFilter === 'selected' ? 'active' : ''}`}
            onClick={() => setApplicationFilter('selected')}
          >
            <span>Selected</span>
            <span className="pf-app-funnel-count">{funnelCounts.selected}</span>
          </button>
          <button
            type="button"
            className={`pf-app-funnel-pill ${applicationFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setApplicationFilter('rejected')}
          >
            <span>Rejected</span>
            <span className="pf-app-funnel-count">{funnelCounts.rejected}</span>
          </button>
        </div>

        {/* Candidate Search & Actions Toolbars */}
        <div className="pf-app-search-toolbar">
          <input
            type="text"
            className="pf-app-search-input pf-app-search-input--full"
            placeholder="Search by candidate name, roll number, email, branch..."
            value={candidateSearchQuery}
            onChange={e => setCandidateSearchQuery(e.target.value)}
          />
        </div>

        <div className="pf-admin-toolbar pf-admin-toolbar--wrap pf-app-actions-toolbar">
          <div className="pf-app-actions-group">
            {/* Sort Dropdown */}
            <select
              className="pf-admin-filter pf-app-sort-select"
              value={sortOption}
              onChange={e => setSortOption(e.target.value)}
              aria-label="Sort applications"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="cgpa_desc">Sort: CGPA (High → Low)</option>
              <option value="cgpa_asc">Sort: CGPA (Low → High)</option>
              <option value="name_asc">Sort: Name (A → Z)</option>
              <option value="roll_asc">Sort: Roll Number</option>
            </select>

            {/* Academic & Criteria Filters Button */}
            <Button
              type="button"
              onClick={() => setFilterModalOpen(true)}
              size="sm"
              variant="secondary"
              icon={Filter}
            >
              Academic Filters {activeAcademicFilterCount > 0 ? `(${activeAcademicFilterCount} Active)` : ''}
            </Button>
          </div>

          <div className="pf-app-actions-group">
            <Button
              type="button"
              onClick={() => openShareModal()}
              size="sm"
              variant="secondary"
              icon={Share2}
            >
              Share with Recruiter
            </Button>
            <Button
              type="button"
              onClick={() => { setExportSelectedOnly(false); setExportModalOpen(true); }}
              size="sm"
              variant="primary"
              icon={Download}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Bulk Action Bar (Shows when 1+ candidates are checked) */}
        {selectedAppIds.size > 0 && (
          <div className="pf-app-bulk-bar">
            <div className="pf-app-bulk-info">
              <CheckSquare size={18} />
              <span>{selectedAppIds.size} candidate{selectedAppIds.size === 1 ? '' : 's'} selected</span>
            </div>
            <div className="pf-app-bulk-actions">
              <span style={{ fontSize: '0.8rem', color: '#2b592b', fontWeight: 600 }}>Move to:</span>
              <select
                className="pf-app-status-select"
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyBulkStatus}
                loading={bulkUpdating}
                icon={Check}
              >
                Apply Status
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openShareModal(Array.from(selectedAppIds))}
                icon={Share2}
              >
                Share Selected
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setExportSelectedOnly(true); setExportModalOpen(true); }}
                icon={Download}
              >
                Export Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAppIds(new Set())}
                icon={X}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Applications List */}
        {loading ? (
          <Empty text="Loading applications..." />
        ) : displayApplications.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No applications match criteria"
            text={candidateSearchQuery || applicationFilter || activeAcademicFilterCount > 0
              ? "Try clearing your search query or academic filters."
              : "No applications submitted for this job yet."}
          />
        ) : (
          <>
            {/* Table Header Row with Select All */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={selectedAppIds.size === displayApplications.length && displayApplications.length > 0}
                  onChange={handleToggleSelectAll}
                  style={{ width: '15px', height: '15px', accentColor: 'var(--color-primary)' }}
                />
                <span>Select All ({displayApplications.length})</span>
              </label>
              <span>Showing {displayApplications.length} candidate{displayApplications.length === 1 ? '' : 's'}</span>
            </div>

            {displayApplications.map(application => {
              const snapshot = application.profileSnapshot || {};
              const candidateName = snapshot.personal?.fullName || snapshot.fullName || 'Student applicant';
              const candidateRoll = snapshot.academic?.rollNumber || snapshot.personal?.rollNumber || snapshot.rollNumber;
              const candidateEmail = snapshot.personal?.email || snapshot.email;
              const candidateDept = snapshot.academic?.department || snapshot.department;
              const candidateBatch = snapshot.academic?.batchYear || snapshot.batchYear;
              const candidateCgpa = snapshot.academic?.cgpa ?? snapshot.cgpa;
              const hasResume = !!(application.selectedResume || snapshot.selectedResume);
              const isSelected = selectedAppIds.has(application.id);

              return (
                <div
                  key={application.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: isSelected ? '#f5f9f5' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                    transition: 'background var(--transition-fast)'
                  }}
                >
                  <div className="pf-app-row-select" style={{ paddingLeft: '8px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => handleToggleSelectRow(application.id, e)}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <DataRow
                      onClick={() => setViewingAppId(application.id)}
                      title={<>
                        {candidateName}
                        {candidateRoll && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>({candidateRoll})</span>}
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
                        {candidateCgpa !== undefined && candidateCgpa !== null && (
                          <span style={{ background: '#f0fdf4', color: '#166534', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            CGPA: {candidateCgpa}
                          </span>
                        )}
                        <span className="pf-data-row__meta-date">
                          <Calendar size={12} /> {formatISTDate(application.createdAt)} IST
                        </span>
                      </>}
                      aside={
                        <div className="pf-admin-item-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => { e.stopPropagation(); setViewingAppId(application.id); }}
                            icon={Eye}
                          >
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
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RAPID CANDIDATE REVIEW MODAL (With Stepper Navigation)                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!viewingAppId}
        onClose={() => setViewingAppId(null)}
        title="Application Snapshot & Verification"
        footer={
          viewingApp ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
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

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNextCandidate}
                  disabled={viewingAppIndex >= displayApplications.length - 1}
                  icon={ChevronRight}
                >
                  Next Candidate
                </Button>
                <Button variant="primary" size="sm" onClick={() => setViewingAppId(null)}>
                  Done
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {viewingApp && (
          <div className="pf-app-details-modal">
            {/* Stepper Navigation Bar */}
            <div className="pf-app-modal-nav">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevCandidate}
                disabled={viewingAppIndex <= 0}
                icon={ChevronLeft}
              >
                Previous
              </Button>
              <span className="pf-app-modal-counter">
                Candidate <strong>{viewingAppIndex + 1}</strong> of <strong>{displayApplications.length}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextCandidate}
                disabled={viewingAppIndex >= displayApplications.length - 1}
              >
                Next <ChevronRight size={14} style={{ marginLeft: '2px' }} />
              </Button>
            </div>

            {/* Header info */}
            <div className="pf-app-details-header">
              <div>
                <h3>{viewingPersonal.fullName || viewingApp.profileSnapshot.fullName || 'Student Applicant'}</h3>
                <p className="pf-app-details-meta">
                  <span>{viewingPersonal.email || viewingApp.profileSnapshot.email}</span>
                  {(viewingPersonal.phone || viewingApp.profileSnapshot.phone) && <span>· 📞 {viewingPersonal.phone || viewingApp.profileSnapshot.phone}</span>}
                  {(viewingAcademic.rollNumber || viewingPersonal.rollNumber || viewingApp.profileSnapshot.rollNumber) && (
                    <span>· 🆔 {viewingAcademic.rollNumber || viewingPersonal.rollNumber || viewingApp.profileSnapshot.rollNumber}</span>
                  )}
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
                    {viewingAcademic.historicalBacklogs ?? viewingAcademic.historyOfBacklogs ?? 0}
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
                    {viewingAcademic.degree || viewingAcademic.degreeProgram || 'B.Tech'}
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
                      <p className="pf-app-resume-name">{viewingResume?.filename || viewingResume?.originalName || 'Selected Resume Document'}</p>
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

      {/* ========================================================================= */}
      {/* FIXED & TYPED ACADEMIC FILTERS MODAL                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Applications by Academic Criteria"
        footer={
          <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={clearAcademicFilters}>Clear Filters</Button>
            <Button variant="primary" onClick={() => setFilterModalOpen(false)}>Apply Filters</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#557550' }}>
            Filter candidates by verified academic records. Applications matching these cutoffs can be reviewed, bulk updated, or exported.
          </p>

          <div className="pf-filter-modal-grid">
            <div className="pf-filter-field">
              <label htmlFor="filter-cgpa">Minimum CGPA (out of 10)</label>
              <input
                id="filter-cgpa"
                type="number"
                step="0.1"
                min="0"
                max="10"
                placeholder="e.g. 7.5"
                value={academicFilters.minCgpa}
                onChange={e => handleAcademicFilterChange('minCgpa', e.target.value)}
              />
              <small>Matches candidates with CGPA &ge; this value</small>
            </div>

            <div className="pf-filter-field">
              <label htmlFor="filter-backlogs">Active Backlogs Status</label>
              <select
                id="filter-backlogs"
                value={academicFilters.backlogs}
                onChange={e => handleAcademicFilterChange('backlogs', e.target.value)}
              >
                <option value="">Any Backlogs</option>
                <option value="zero">Zero Active Backlogs Only</option>
                <option value="max1">Maximum 1 Active Backlog</option>
              </select>
            </div>

            <div className="pf-filter-field">
              <label htmlFor="filter-branch">Department / Branch</label>
              <input
                id="filter-branch"
                list="branch-options"
                placeholder="Select or type branch..."
                value={academicFilters.branch}
                onChange={e => handleAcademicFilterChange('branch', e.target.value)}
              />
              <datalist id="branch-options">
                <option value="Computer Science" />
                <option value="Information Technology" />
                <option value="Electronics & Communication" />
                <option value="Electrical" />
                <option value="Mechanical" />
                <option value="Civil" />
                <option value="Chemical" />
                <option value="MCA" />
                <option value="MBA" />
              </datalist>
            </div>

            <div className="pf-filter-field">
              <label htmlFor="filter-batch">Graduating Batch Year</label>
              <input
                id="filter-batch"
                type="number"
                min="2020"
                max="2035"
                placeholder="e.g. 2025"
                value={academicFilters.batchYear}
                onChange={e => handleAcademicFilterChange('batchYear', e.target.value)}
              />
              <small>Filter by the final passing out year</small>
            </div>

            <div className="pf-filter-field">
              <label htmlFor="filter-tenth">Minimum 10th Percentage (%)</label>
              <input
                id="filter-tenth"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="e.g. 75"
                value={academicFilters.minTenth}
                onChange={e => handleAcademicFilterChange('minTenth', e.target.value)}
              />
            </div>

            <div className="pf-filter-field">
              <label htmlFor="filter-twelfth">Minimum 12th Percentage (%)</label>
              <input
                id="filter-twelfth"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="e.g. 70"
                value={academicFilters.minTwelfth}
                onChange={e => handleAcademicFilterChange('minTwelfth', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* RECRUITER SHARE MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share Candidates with Recruiter"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Button variant="ghost" onClick={() => setShareModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleConfirmShare}
              loading={sharing}
              icon={Share2}
            >
              Confirm & Share
            </Button>
          </div>
        }
      >
        <div className="pf-share-modal-form">
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Share {selectedAppIds.size > 0 ? (
              <strong>{selectedAppIds.size} selected candidate(s)</strong>
            ) : (
              <strong>{funnelCounts.shortlisted} shortlisted candidate(s)</strong>
            )} for <strong>{selectedJob?.title}</strong> ({selectedJob?.companyName}) with a registered recruiter.
          </p>

          <div className="pf-share-modal-field">
            <label htmlFor="recruiter-select">Select Target Recruiter *</label>
            <select
              id="recruiter-select"
              value={selectedRecruiterId}
              onChange={e => setSelectedRecruiterId(e.target.value)}
            >
              {recruiters.length === 0 ? (
                <option value="">No recruiters found</option>
              ) : (
                recruiters.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.companyName ? `${r.companyName} — ` : ''}{r.name} ({r.email})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="pf-share-modal-field">
            <label htmlFor="share-note">Note / Instructions for Recruiter (Optional)</label>
            <textarea
              id="share-note"
              rows={3}
              value={shareNote}
              onChange={e => setShareNote(e.target.value)}
              placeholder="e.g. Here are the shortlisted candidates following Round 1 OA. Please review and schedule interviews."
            />
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* COLUMN-SELECTABLE CSV EXPORT MODAL                                        */}
      {/* ========================================================================= */}
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
              Exporting <strong>{exportSelectedOnly && selectedAppIds.size > 0 ? selectedAppIds.size : displayApplications.length}</strong> candidate{displayApplications.length === 1 ? '' : 's'} for <strong>{selectedJob?.title}</strong>
              {exportSelectedOnly ? ' (Selected Only)' : applicationFilter ? ` (Status: ${applicationFilter})` : ''}
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pf-export-presets">
            <span className="pf-export-preset-label">Presets:</span>
            <button
              type="button"
              className="pf-export-preset-btn highlight"
              onClick={() => setSelectedColumnIds(STANDARD_PRESET_IDS)}
            >
              Standard T&P Preset
            </button>
            <button
              type="button"
              className="pf-export-preset-btn"
              onClick={() => setSelectedColumnIds(allAvailableColumns.map(c => c.id))}
            >
              Select All
            </button>
            <button
              type="button"
              className="pf-export-preset-btn"
              onClick={() => setSelectedColumnIds([])}
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
