import React, { useCallback, useEffect, useState } from 'react';
import { Search, Share2, CheckSquare, Square, Download } from 'lucide-react';
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

/**
 * Admin-side student discovery and the share-with-recruiter workflow:
 * filter the student directory, select specific students, and share them
 * with a recruiter, optionally tied to a job posting.
 */
export function StudentSearchWorkspace({ jobs }) {
  const [filters, setFilters] = useState({ search: '', department: '', batch: '', rollNumber: '', skills: '', interests: '', skillMode: 'all', minCgpa: '', maxBacklogs: '', status: '', blocked: '' });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(new Set());

  // Share wizard state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState(1);
  const [shareForm, setShareForm] = useState(emptyShare);
  const [recruiters, setRecruiters] = useState([]);
  const [sharableJobs, setSharableJobs] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);

  const buildParams = useCallback(filters => Object.fromEntries(Object.entries(filters).filter(([, value]) => String(value).trim() !== '')), []);

  const runSearch = useCallback(async (offset = 0, currentFilters) => {
    setLoading(true); setError(''); setSearched(true);
    try {
      const data = await adminApi.searchStudents({ ...buildParams(currentFilters || filters), limit: PAGE_SIZE, offset });
      setResults(prev => (offset === 0 ? data.students || [] : [...prev, ...(data.students || [])]));
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, buildParams]);

  const updateFilter = field => event => setFilters(prev => ({ ...prev, [field]: event.target.value }));
  const updateShareForm = field => event => setShareForm(prev => ({ ...prev, [field]: event.target.value }));

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

  const clearSelection = () => setSelected(new Set());

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
    setShareOpen(true); setShareStep(1); setShareResult(null); setShareForm(emptyShare);
    if (recruiters.length === 0) {
      try {
        const [recruiterData, jobData] = await Promise.all([adminApi.recruiters(), adminApi.jobPosts()]);
        setRecruiters(recruiterData.recruiters || []);
        setSharableJobs(jobData.jobPosts || []);
      } catch { /* share can proceed without a job link */ }
    }
  };

  const confirmShare = async () => {
    setSharing(true); setError('');
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

  return (
    <section className="pf-admin-workspace">
      {/* Search / filter panel */}
      <div className="pf-admin-panel pf-student-search">
        <PanelHeading eyebrow="Student discovery" title="Search & filter students" />
        <p className="pf-student-search__intro">
          Find students by department, batch, skills, academics, and more. Select the ones who fit and share them with a recruiter, with or without a specific job attached.
        </p>
        <form
          className="pf-student-search__form"
          onSubmit={event => { event.preventDefault(); runSearch(0); }}
        >
          <label className="pf-student-search__field pf-student-search__field--wide">
            <span>Search</span>
            <input placeholder="Name, email, or roll number..." value={filters.search} onChange={updateFilter('search')} />
          </label>
          <label className="pf-student-search__field">
            <span>Department contains</span>
            <input placeholder="e.g. Computer Science" value={filters.department} onChange={updateFilter('department')} />
          </label>
          <label className="pf-student-search__field">
            <span>Batch contains</span>
            <input placeholder="e.g. 2024 - 2028" value={filters.batch} onChange={updateFilter('batch')} />
          </label>
          <label className="pf-student-search__field">
            <span>Roll number contains</span>
            <input placeholder="e.g. 2024CS" value={filters.rollNumber} onChange={updateFilter('rollNumber')} />
          </label>
          <label className="pf-student-search__field">
            <span>Skills / interests (comma separated)</span>
            <input placeholder="e.g. React, Machine Learning" value={filters.skills} onChange={updateFilter('skills')} />
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Skill match</span>
            <select value={filters.skillMode} onChange={updateFilter('skillMode')}>
              <option value="all">All listed</option>
              <option value="any">Any listed</option>
            </select>
          </label>
          <label className="pf-student-search__field">
            <span>Interests (comma separated)</span>
            <input placeholder="e.g. Photography, Robotics" value={filters.interests} onChange={updateFilter('interests')} />
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Min CGPA</span>
            <input type="number" step="0.01" min="0" max="10" placeholder="7.0" value={filters.minCgpa} onChange={updateFilter('minCgpa')} />
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Max backlogs</span>
            <input type="number" min="0" placeholder="0" value={filters.maxBacklogs} onChange={updateFilter('maxBacklogs')} />
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Record status</span>
            <select value={filters.status} onChange={updateFilter('status')}>
              <option value="">Any</option>
              <option value="active_onboarded">Onboarded</option>
              <option value="onboarding_completed">Onboarding completed</option>
              <option value="active">Active</option>
            </select>
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Account</span>
            <select value={filters.blocked} onChange={updateFilter('blocked')}>
              <option value="">All accounts</option>
              <option value="false">Not blocked</option>
              <option value="true">Blocked</option>
            </select>
          </label>
          <div className="pf-student-search__actions">
            <Button type="submit" icon={Search} loading={loading}>Search</Button>
          </div>
        </form>
      </div>

      {/* Results + selection */}
      <div className="pf-admin-list">
        <div className="pf-admin-panel-heading">
          <div>
            <p className="pf-admin-eyebrow">Matches</p>
            <h2>Students <span>{searched ? total : '-'}</span></h2>
          </div>
          <div className="pf-student-search__selection-bar">
            {searched && results.length > 0 && (
              <>
                <button type="button" className="pf-student-select-all" onClick={toggleSelectAll}>
                  {allShownSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  {allShownSelected ? 'Deselect all shown' : 'Select all shown'}
                </button>
                <Button variant="ghost" size="sm" icon={Download} onClick={exportResults}>
                  Export {selected.size > 0 ? `${selected.size} selected` : 'results'}
                </Button>
              </>
            )}
            {selected.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
                <Button size="sm" icon={Share2} onClick={openShareWizard}>Share with recruiter</Button>
              </>
            )}
          </div>
        </div>

        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {!searched && <Empty text="Set filters above and search to browse the student directory." />}
        {searched && loading && <Empty text="Searching students..." />}
        {searched && !loading && results.length === 0 && <Empty text="No students match these filters." />}

        {results.map(student => {
          const isSelected = selected.has(student.id);
          return (
            <article key={student.id} className={`pf-admin-list-item pf-student-row ${isSelected ? 'is-selected' : ''}`}>
              <label className="pf-student-row__select">
                <input type="checkbox" checked={isSelected} onChange={() => toggleStudent(student.id)} />
                {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
              </label>
              <div className="pf-student-row__body">
                <h3>{student.fullName}</h3>
                <p>
                  {student.department || 'Department N/A'} · {student.batchYear || 'Batch N/A'} · Roll {student.rollNumber}
                  {student.cgpa !== null && student.cgpa !== undefined ? ` · CGPA ${student.cgpa}` : ''}
                </p>
                {student.skills?.length > 0 && (
                  <div className="pf-student-row__skills">
                    {student.skills.slice(0, 5).map(skill => <b key={skill}>{skill}</b>)}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {searched && !loading && results.length < total && (
          <div className="pf-student-search__more">
            <Button variant="outline" size="sm" loading={loading} onClick={loadMore}>
              Load more ({total - results.length} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Share wizard */}
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
                {recruiters.map(recruiter => <option key={recruiter.id} value={recruiter.id}>{recruiter.fullName}{recruiter.department ? ` - ${recruiter.department}` : ''}</option>)}
              </select>
            </label>
            <label>Related job post (optional)
              <select value={shareForm.jobPostId} onChange={updateShareForm('jobPostId')}>
                <option value="">No specific job</option>
                {sharableJobs.map(job => <option key={job.id} value={job.id}>{job.title} - {job.companyName} ({job.status})</option>)}
              </select>
            </label>
            <label>Internal note / context (optional)
              <textarea rows="3" maxLength={500} placeholder="e.g. Shortlist for the Q3 backend hiring drive" value={shareForm.note} onChange={updateShareForm('note')} />
            </label>
          </div>
        )}

        {shareStep === 2 && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Step 2 of 3</b> - review before sharing.</p>
            <dl className="pf-share-wizard__summary">
              <div><dt>Recruiter</dt><dd>{selectedRecruiter?.fullName || '-'}</dd></div>
              <div><dt>Job</dt><dd>{selectedJob ? `${selectedJob.title} - ${selectedJob.companyName}` : 'No specific job'}</dd></div>
              <div><dt>Students</dt><dd>{selectedStudents.length}</dd></div>
              <div><dt>Note</dt><dd>{shareForm.note || '-'}</dd></div>
            </dl>
            <ul className="pf-share-wizard__students">
              {selectedStudents.map(student => (
                <li key={student.id}><b>{student.fullName}</b> · {student.department} · Roll {student.rollNumber}</li>
              ))}
            </ul>
            <p className="pf-share-wizard__privacy">
              Recruiters see the student's name, department, batch, skills, achievements, experience, and resume.
            </p>
          </div>
        )}

        {shareStep === 3 && shareResult && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Shared.</b></p>
            <p>
              {shareResult.studentIds.length} student{shareResult.studentIds.length === 1 ? '' : 's'} shared with the recruiter. They will see the list under "Shared candidates" in their portal and receive a notification.
            </p>
          </div>
        )}
      </Modal>
    </section>
  );
}
