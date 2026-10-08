import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Share2,
  CheckSquare,
  Square,
  Download,
  SlidersHorizontal,
  RotateCcw,
  X,
  GraduationCap,
  Calendar,
  Briefcase,
  Award,
  Copy,
  Check,
  UserRound,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { adminApi } from '../adminApi';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { PanelHeading, Empty } from '../utils/adminHelpers';
import './StudentSearchWorkspace.css';

const emptyShare = { recruiterId: '', jobPostId: '', note: '' };
const PAGE_SIZE = 50;

function downloadSpreadsheet(filename, rows) {
  const header = Object.keys(rows[0] || {}).join(',');
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows.map(row => Object.values(row).map(escape).join(','))].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getInitials(name) {
  if (!name) return 'ST';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const DEFAULT_FILTERS = {
  search: '',
  department: '',
  batch: '',
  rollNumber: '',
  skills: '',
  interests: '',
  skillMode: 'all',
  minCgpa: '',
  maxBacklogs: '',
  status: '',
  blocked: ''
};

/**
 * Admin-side student discovery and the share-with-recruiter workflow:
 * filter the student directory, select specific students, and share them
 * with a recruiter, optionally tied to a job posting.
 */
export function StudentSearchWorkspace({ jobs }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [copied, setCopied] = useState(false);

  // Share wizard state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState(1);
  const [shareForm, setShareForm] = useState(emptyShare);
  const [recruiters, setRecruiters] = useState([]);
  const [sharableJobs, setSharableJobs] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);

  const buildParams = useCallback(filterObj => {
    return Object.fromEntries(
      Object.entries(filterObj).filter(([, value]) => String(value).trim() !== '')
    );
  }, []);

  const runSearch = useCallback(async (offset = 0, currentFilters) => {
    setLoading(true);
    setError('');
    setSearched(true);
    const activeFilters = currentFilters || filters;
    try {
      const data = await adminApi.searchStudents({
        ...buildParams(activeFilters),
        limit: PAGE_SIZE,
        offset
      });
      setResults(prev => (offset === 0 ? data.students || [] : [...prev, ...(data.students || [])]));
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, buildParams]);

  // Load initial students on mount
  useEffect(() => {
    runSearch(0, DEFAULT_FILTERS);
  }, []);

  const updateFilter = field => event => {
    setFilters(prev => ({ ...prev, [field]: event.target.value }));
  };

  const setFilterValue = (field, val) => {
    setFilters(prev => ({ ...prev, [field]: val }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    runSearch(0, DEFAULT_FILTERS);
  };

  const applyPreset = preset => {
    let updated = { ...filters };
    if (preset === 'zero_backlogs') {
      updated.maxBacklogs = updated.maxBacklogs === '0' ? '' : '0';
    } else if (preset === 'cgpa_8') {
      updated.minCgpa = updated.minCgpa === '8.0' ? '' : '8.0';
    } else if (preset === 'cgpa_7') {
      updated.minCgpa = updated.minCgpa === '7.0' ? '' : '7.0';
    } else if (preset === 'onboarded') {
      updated.status = updated.status === 'active_onboarded' ? '' : 'active_onboarded';
    }
    setFilters(updated);
    runSearch(0, updated);
  };

  const updateShareForm = field => event => {
    setShareForm(prev => ({ ...prev, [field]: event.target.value }));
  };

  const toggleStudent = id => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allShownSelected = results.length > 0 && results.every(student => selected.has(student.id));
  const toggleSelectAll = () => setSelected(prev => {
    if (allShownSelected) {
      const next = new Set(prev);
      results.forEach(student => next.delete(student.id));
      return next;
    }
    return new Set([...prev, ...results.map(student => student.id)]);
  });

  const selectTopN = n => {
    const topIds = results.slice(0, n).map(s => s.id);
    setSelected(new Set(topIds));
  };

  const clearSelection = () => setSelected(new Set());

  const copySelectedEmails = async () => {
    const selectedStudents = results.filter(student => selected.has(student.id));
    const emails = selectedStudents.map(student => student.email).filter(Boolean).join(', ');
    if (!emails) return;
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy emails:', err);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    const rows = (selected.size > 0 ? results.filter(student => selected.has(student.id)) : results).map(student => ({
      Name: student.fullName,
      Email: student.email,
      'Roll Number': student.rollNumber,
      Department: student.department,
      Batch: student.batchYear,
      CGPA: student.cgpa ?? '',
      'Active Backlogs': student.activeBacklogs ?? '',
      Skills: (student.skills || []).join('; '),
      Achievements: student.achievementsCount ?? 0,
      Internships: student.internshipsCount ?? 0,
      Status: student.status,
      Blocked: student.blocked ? 'Yes' : 'No'
    }));
    downloadSpreadsheet(`pathfolio-students-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const loadMore = () => runSearch(results.length);

  const openShareWizard = async () => {
    setShareOpen(true);
    setShareStep(1);
    setShareResult(null);
    setShareForm(emptyShare);
    if (recruiters.length === 0) {
      try {
        const [recruiterData, jobData] = await Promise.all([adminApi.recruiters(), adminApi.jobPosts()]);
        setRecruiters(recruiterData.recruiters || []);
        setSharableJobs(jobData.jobPosts || []);
      } catch { /* share can proceed without a job link */ }
    }
  };

  const confirmShare = async () => {
    setSharing(true);
    setError('');
    try {
      const data = await adminApi.createShare({
        recruiterId: shareForm.recruiterId,
        jobPostId: shareForm.jobPostId || null,
        studentIds: [...selected],
        note: shareForm.note
      });
      setShareResult(data.share);
      setShareStep(3);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  };

  const selectedRecruiter = recruiters.find(recruiter => recruiter.id === shareForm.recruiterId);
  const selectedJob = sharableJobs.find(job => job.id === shareForm.jobPostId);
  const selectedStudents = results.filter(student => selected.has(student.id));

  // Count active secondary filters (excluding the main hero search and skillMode default)
  const activeSecondaryCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'search' || key === 'skillMode') return false;
    return String(val).trim() !== '';
  }).length;

  const hasAnyFilter = activeSecondaryCount > 0 || String(filters.search).trim() !== '';

  return (
    <section className="pf-admin-workspace pf-student-workspace">
      {/* Search & Filter Hero Panel */}
      <div className="pf-admin-panel pf-student-search-panel">
        <div className="pf-student-search-panel__header">
          <div>
            <p className="pf-admin-eyebrow">Student Discovery</p>
            <h1 className="pf-student-search-panel__title">Search & Filter Students</h1>
            <p className="pf-student-search-panel__desc">
              Browse the student directory, filter by department, batch, CGPA, or skills, and curate candidates to share directly with recruiters.
            </p>
          </div>
        </div>

        {/* Primary Search Bar */}
        <form
          className="pf-student-hero-bar"
          onSubmit={event => {
            event.preventDefault();
            runSearch(0);
          }}
        >
          <div className="pf-student-hero-bar__input-wrap">
            <Search className="pf-student-hero-bar__icon" size={18} />
            <input
              type="text"
              className="pf-student-hero-bar__input"
              placeholder="Search by student name, roll number, email, or department..."
              value={filters.search}
              onChange={updateFilter('search')}
            />
            {filters.search && (
              <button
                type="button"
                className="pf-student-hero-bar__clear-btn"
                onClick={() => {
                  setFilterValue('search', '');
                  const updated = { ...filters, search: '' };
                  runSearch(0, updated);
                }}
                title="Clear search text"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <Button type="submit" icon={Search} loading={loading} className="pf-student-hero-bar__submit">
            Search
          </Button>

          <button
            type="button"
            className={`pf-student-filter-toggle ${filterDrawerOpen ? 'is-open' : ''} ${activeSecondaryCount > 0 ? 'has-active' : ''}`}
            onClick={() => setFilterDrawerOpen(prev => !prev)}
            title="Toggle advanced filters"
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeSecondaryCount > 0 && (
              <span className="pf-student-filter-toggle__badge">{activeSecondaryCount}</span>
            )}
            {filterDrawerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {hasAnyFilter && (
            <button
              type="button"
              className="pf-student-reset-btn"
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </form>

        {/* Collapsible Advanced Filters Drawer */}
        {filterDrawerOpen && (
          <div className="pf-student-filter-drawer">
            <div className="pf-student-filter-grid">
              {/* Group 1: Academics & Cohort */}
              <div className="pf-student-filter-group">
                <div className="pf-student-filter-group__header">
                  <GraduationCap size={15} />
                  <span>Academics & Cohort</span>
                </div>
                <div className="pf-student-filter-group__fields">
                  <label className="pf-student-field">
                    <span>Department</span>
                    <input
                      placeholder="e.g. Computer Science"
                      value={filters.department}
                      onChange={updateFilter('department')}
                    />
                  </label>
                  <label className="pf-student-field">
                    <span>Batch Year</span>
                    <input
                      placeholder="e.g. 2024 - 2028"
                      value={filters.batch}
                      onChange={updateFilter('batch')}
                    />
                  </label>
                  <label className="pf-student-field">
                    <span>Roll Number contains</span>
                    <input
                      placeholder="e.g. 2024CS"
                      value={filters.rollNumber}
                      onChange={updateFilter('rollNumber')}
                    />
                  </label>
                  <div className="pf-student-field-row">
                    <label className="pf-student-field">
                      <span>Min CGPA</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        placeholder="e.g. 7.5"
                        value={filters.minCgpa}
                        onChange={updateFilter('minCgpa')}
                      />
                    </label>
                    <label className="pf-student-field">
                      <span>Max Backlogs</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 0"
                        value={filters.maxBacklogs}
                        onChange={updateFilter('maxBacklogs')}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Group 2: Skills & Interests */}
              <div className="pf-student-filter-group">
                <div className="pf-student-filter-group__header">
                  <Sparkles size={15} />
                  <span>Skills & Technical Stack</span>
                </div>
                <div className="pf-student-filter-group__fields">
                  <label className="pf-student-field">
                    <span>Skills (comma-separated)</span>
                    <input
                      placeholder="e.g. React, Node.js, Python, AWS"
                      value={filters.skills}
                      onChange={updateFilter('skills')}
                    />
                  </label>
                  <div className="pf-student-field">
                    <span>Skill Match Mode</span>
                    <div className="pf-student-segmented-control">
                      <button
                        type="button"
                        className={`pf-student-segmented-btn ${filters.skillMode === 'all' ? 'is-active' : ''}`}
                        onClick={() => setFilterValue('skillMode', 'all')}
                      >
                        Match All (AND)
                      </button>
                      <button
                        type="button"
                        className={`pf-student-segmented-btn ${filters.skillMode === 'any' ? 'is-active' : ''}`}
                        onClick={() => setFilterValue('skillMode', 'any')}
                      >
                        Match Any (OR)
                      </button>
                    </div>
                  </div>
                  <label className="pf-student-field">
                    <span>Interests / Passions</span>
                    <input
                      placeholder="e.g. Robotics, AI, Open Source"
                      value={filters.interests}
                      onChange={updateFilter('interests')}
                    />
                  </label>
                </div>
              </div>

              {/* Group 3: Status & Account */}
              <div className="pf-student-filter-group">
                <div className="pf-student-filter-group__header">
                  <UserRound size={15} />
                  <span>Status & Verification</span>
                </div>
                <div className="pf-student-filter-group__fields">
                  <label className="pf-student-field">
                    <span>Record Status</span>
                    <select value={filters.status} onChange={updateFilter('status')}>
                      <option value="">Any Status</option>
                      <option value="active_onboarded">Onboarded</option>
                      <option value="onboarding_completed">Onboarding Completed</option>
                      <option value="active">Active</option>
                    </select>
                  </label>
                  <label className="pf-student-field">
                    <span>Account Status</span>
                    <select value={filters.blocked} onChange={updateFilter('blocked')}>
                      <option value="">All Accounts</option>
                      <option value="false">Active Only (Not Blocked)</option>
                      <option value="true">Blocked Only</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Presets & Filter Actions */}
            <div className="pf-student-filter-drawer__footer">
              <div className="pf-student-preset-chips">
                <span className="pf-student-preset-label">Quick filters:</span>
                <button
                  type="button"
                  className={`pf-student-chip ${filters.maxBacklogs === '0' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('zero_backlogs')}
                >
                  ✓ 0 Backlogs
                </button>
                <button
                  type="button"
                  className={`pf-student-chip ${filters.minCgpa === '8.0' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('cgpa_8')}
                >
                  CGPA ≥ 8.0
                </button>
                <button
                  type="button"
                  className={`pf-student-chip ${filters.minCgpa === '7.0' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('cgpa_7')}
                >
                  CGPA ≥ 7.0
                </button>
                <button
                  type="button"
                  className={`pf-student-chip ${filters.status === 'active_onboarded' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('onboarded')}
                >
                  Onboarded Only
                </button>
              </div>

              <div className="pf-student-filter-drawer__actions">
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Clear Filters
                </Button>
                <Button size="sm" icon={Search} loading={loading} onClick={() => runSearch(0)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results & Candidate Directory */}
      <div className="pf-admin-panel pf-student-results-panel">
        <div className="pf-student-results-header">
          <div className="pf-student-results-header__info">
            <p className="pf-admin-eyebrow">Directory Results</p>
            <h2 className="pf-student-results-header__title">
              Students
              <span className="pf-student-results-count">
                {searched ? `${total} found` : '-'}
              </span>
            </h2>
          </div>

          {/* Bulk Selection and Action Toolbar */}
          <div className="pf-student-toolbar">
            {searched && results.length > 0 && (
              <div className="pf-student-toolbar__quick-select">
                <button
                  type="button"
                  className="pf-student-bulk-btn"
                  onClick={toggleSelectAll}
                >
                  {allShownSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  <span>{allShownSelected ? 'Deselect All' : `Select All (${results.length})`}</span>
                </button>
                <button
                  type="button"
                  className="pf-student-bulk-btn"
                  onClick={() => selectTopN(5)}
                >
                  Top 5
                </button>
                <button
                  type="button"
                  className="pf-student-bulk-btn"
                  onClick={() => selectTopN(10)}
                >
                  Top 10
                </button>
                <button
                  type="button"
                  className="pf-student-bulk-btn"
                  onClick={() => selectTopN(25)}
                >
                  Top 25
                </button>
              </div>
            )}

            <div className="pf-student-toolbar__actions">
              {searched && results.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={exportResults}
                >
                  Export {selected.size > 0 ? `Selected (${selected.size})` : `All (${total})`}
                </Button>
              )}

              {selected.size > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={copied ? Check : Copy}
                    onClick={copySelectedEmails}
                  >
                    {copied ? 'Copied Emails!' : 'Copy Emails'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                  >
                    Clear ({selected.size})
                  </Button>
                  <Button
                    size="sm"
                    icon={Share2}
                    onClick={openShareWizard}
                  >
                    Share with Recruiter ({selected.size})
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {error && <div className="pf-admin-error" role="alert">{error}</div>}

        {!searched && (
          <Empty text="Enter a query in the search bar or configure filters to browse student candidates." />
        )}

        {searched && loading && results.length === 0 && (
          <Empty text="Searching students..." />
        )}

        {searched && !loading && results.length === 0 && (
          <div className="pf-student-empty-state">
            <Filter size={32} className="pf-student-empty-icon" />
            <h3>No matching students found</h3>
            <p>Try broadening your search term or clearing academic and skill filters.</p>
            <Button variant="outline" size="sm" icon={RotateCcw} onClick={handleResetFilters}>
              Reset all filters
            </Button>
          </div>
        )}

        {/* Student Cards List */}
        <div className="pf-student-cards-list">
          {results.map(student => {
            const isSelected = selected.has(student.id);
            const initials = getInitials(student.fullName);
            const hasBacklogs = Number(student.activeBacklogs) > 0;
            const cgpa = student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa) : null;

            return (
              <article
                key={student.id}
                className={`pf-student-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => toggleStudent(student.id)}
              >
                <div className="pf-student-card__layout">
                  {/* Selection Checkbox */}
                  <label
                    className="pf-student-card__select"
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudent(student.id)}
                    />
                    {isSelected ? <CheckSquare size={18} className="pf-student-card__check-active" /> : <Square size={18} />}
                  </label>

                  {/* Avatar Circle */}
                  <div className="pf-student-card__avatar" aria-hidden="true">
                    {initials}
                  </div>

                  {/* Main Info */}
                  <div className="pf-student-card__content">
                    <div className="pf-student-card__top">
                      <div className="pf-student-card__identity">
                        <h3 className="pf-student-card__name">{student.fullName}</h3>
                        {student.rollNumber ? (
                          <span className="pf-student-card__roll">{student.rollNumber}</span>
                        ) : (
                          <span className="pf-student-card__roll pf-student-card__roll--none">No Roll #</span>
                        )}
                        {student.blocked && (
                          <span className="pf-student-badge pf-student-badge--danger">Blocked</span>
                        )}
                        {student.onboardingCompleted && (
                          <span className="pf-student-badge pf-student-badge--success">Verified</span>
                        )}
                      </div>

                      {student.email && (
                        <a
                          href={`mailto:${student.email}`}
                          className="pf-student-card__email"
                          onClick={e => e.stopPropagation()}
                        >
                          {student.email}
                        </a>
                      )}
                    </div>

                    {/* Meta Row: Academic & Experience Badges */}
                    <div className="pf-student-card__meta">
                      {student.department && (
                        <span className="pf-student-pill">
                          <GraduationCap size={13} />
                          {student.department}
                        </span>
                      )}
                      {student.batchYear && (
                        <span className="pf-student-pill">
                          <Calendar size={13} />
                          Batch {student.batchYear}
                        </span>
                      )}
                      {cgpa !== null && (
                        <span className={`pf-student-pill ${cgpa >= 8.5 ? 'pf-student-pill--high' : cgpa >= 7.0 ? 'pf-student-pill--accent' : ''}`}>
                          {cgpa >= 8.5 ? '★ ' : ''}CGPA {cgpa.toFixed(2)}
                        </span>
                      )}
                      <span className={`pf-student-pill ${hasBacklogs ? 'pf-student-pill--warning' : 'pf-student-pill--clear'}`}>
                        {hasBacklogs ? `⚠ ${student.activeBacklogs} Backlogs` : '✓ 0 Backlogs'}
                      </span>
                      {student.internshipsCount > 0 && (
                        <span className="pf-student-pill pf-student-pill--info">
                          <Briefcase size={12} />
                          {student.internshipsCount} {student.internshipsCount === 1 ? 'Internship' : 'Internships'}
                        </span>
                      )}
                      {student.achievementsCount > 0 && (
                        <span className="pf-student-pill pf-student-pill--info">
                          <Award size={12} />
                          {student.achievementsCount} {student.achievementsCount === 1 ? 'Achievement' : 'Achievements'}
                        </span>
                      )}
                    </div>

                    {/* Skills Chips */}
                    {student.skills?.length > 0 && (
                      <div className="pf-student-card__skills">
                        {student.skills.slice(0, 6).map(skill => (
                          <span key={skill} className="pf-student-skill-chip">{skill}</span>
                        ))}
                        {student.skills.length > 6 && (
                          <span className="pf-student-skill-chip pf-student-skill-chip--more">
                            +{student.skills.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Load More Pagination */}
        {searched && !loading && results.length < total && (
          <div className="pf-student-search__more">
            <Button variant="outline" size="sm" loading={loading} onClick={loadMore}>
              Load more ({total - results.length} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Share with Recruiter Wizard Modal */}
      <Modal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share students with a recruiter"
        footer={
          shareStep === 1 ? (
            <>
              <Button variant="secondary" onClick={() => setShareOpen(false)}>Cancel</Button>
              <Button disabled={!shareForm.recruiterId} onClick={() => setShareStep(2)}>Review selection</Button>
            </>
          ) : shareStep === 2 ? (
            <>
              <Button variant="secondary" onClick={() => setShareStep(1)}>Back</Button>
              <Button loading={sharing} onClick={confirmShare}>Confirm share</Button>
            </>
          ) : (
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          )
        }
      >
        {shareStep === 1 && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Step 1 of 3</b> - choose the recipient and context.</p>
            <label>Recruiter *
              <select value={shareForm.recruiterId} onChange={updateShareForm('recruiterId')}>
                <option value="">Select a recruiter...</option>
                {recruiters.map(recruiter => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.fullName}{recruiter.department ? ` - ${recruiter.department}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>Related job post (optional)
              <select value={shareForm.jobPostId} onChange={updateShareForm('jobPostId')}>
                <option value="">No specific job</option>
                {sharableJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.companyName} ({job.status})
                  </option>
                ))}
              </select>
            </label>
            <label>Internal note / context (optional)
              <textarea
                rows="3"
                maxLength={500}
                placeholder="e.g. Shortlist for the upcoming campus recruitment drive"
                value={shareForm.note}
                onChange={updateShareForm('note')}
              />
            </label>
          </div>
        )}

        {shareStep === 2 && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Step 2 of 3</b> - review candidate list before sharing.</p>
            <dl className="pf-share-wizard__summary">
              <div><dt>Recruiter</dt><dd>{selectedRecruiter?.fullName || '-'}</dd></div>
              <div><dt>Job</dt><dd>{selectedJob ? `${selectedJob.title} - ${selectedJob.companyName}` : 'No specific job'}</dd></div>
              <div><dt>Students</dt><dd>{selectedStudents.length} candidate(s)</dd></div>
              <div><dt>Note</dt><dd>{shareForm.note || '-'}</dd></div>
            </dl>
            <ul className="pf-share-wizard__students">
              {selectedStudents.map(student => (
                <li key={student.id}>
                  <b>{student.fullName}</b> · {student.department || 'Dept N/A'} · Roll {student.rollNumber || 'N/A'}
                </li>
              ))}
            </ul>
            <p className="pf-share-wizard__privacy">
              Recruiters see the student's name, department, batch, skills, achievements, experience, and profile details.
            </p>
          </div>
        )}

        {shareStep === 3 && shareResult && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Shared successfully!</b></p>
            <p>
              {shareResult.studentIds.length} candidate{shareResult.studentIds.length === 1 ? '' : 's'} shared with the recruiter. They can view this candidate list under "Shared candidates" in their recruiter portal.
            </p>
          </div>
        )}
      </Modal>
    </section>
  );
}
