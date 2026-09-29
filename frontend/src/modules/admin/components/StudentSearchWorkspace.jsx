import React, { useCallback, useEffect, useState } from 'react';
import { Search, Users, Share2, CheckSquare, Square, Loader2, X, Send } from 'lucide-react';
import { adminApi } from '../adminApi';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { PanelHeading, Empty } from '../utils/adminHelpers';
import './StudentSearchWorkspace.css';

const emptyShare = { recruiterId: '', jobPostId: '', note: '' };

/**
 * Admin-only student discovery (requirement 14) plus the share-with-recruiter
 * workflow (requirement 15). This is the sanctioned replacement for the
 * recruiter-side talent search: admins filter the student population, select
 * specific students, and share them with a recruiter — optionally tied to a
 * job posting.
 */
export function StudentSearchWorkspace({ jobs }) {
  const [filters, setFilters] = useState({ search: '', department: '', batch: '', skills: '', minCgpa: '', maxBacklogs: '' });
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

  const runSearch = useCallback(async () => {
    setLoading(true); setError(''); setSearched(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => String(value).trim() !== ''));
      const data = await adminApi.searchStudents(params);
      setResults(data.students || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const updateFilter = field => event => setFilters(prev => ({ ...prev, [field]: event.target.value }));

  const toggleStudent = id => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const clearSelection = () => setSelected(new Set());

  const openShareWizard = async () => {
    setShareOpen(true); setShareStep(1); setShareResult(null); setShareForm(emptyShare);
    if (recruiters.length === 0) {
      try {
        const [recruiterData, jobData] = await Promise.all([adminApi.recruiters(), adminApi.jobPosts()]);
        setRecruiters(recruiterData.recruiters || []);
        setSharableJobs(jobData.jobPosts || []);
      } catch { /* non-critical; share can proceed without job link */ }
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
          Filter the student population using structured profile information. Selected students can be shared with a recruiter as a curated shortlist — recruiters never search this data themselves.
        </p>
        <form
          className="pf-student-search__form"
          onSubmit={event => { event.preventDefault(); runSearch(); }}
        >
          <label className="pf-student-search__field pf-student-search__field--wide">
            <span>Search</span>
            <input placeholder="Name, email, or roll number…" value={filters.search} onChange={updateFilter('search')} />
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
            <span>Skills / interests (comma separated)</span>
            <input placeholder="e.g. React, Machine Learning" value={filters.skills} onChange={updateFilter('skills')} />
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Min CGPA</span>
            <input type="number" step="0.01" min="0" max="10" placeholder="7.0" value={filters.minCgpa} onChange={updateFilter('minCgpa')} />
          </label>
          <label className="pf-student-search__field pf-student-search__field--small">
            <span>Max backlogs</span>
            <input type="number" min="0" placeholder="0" value={filters.maxBacklogs} onChange={updateFilter('maxBacklogs')} />
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
            <h2>Students <span>{searched ? total : '—'}</span></h2>
          </div>
          {selected.size > 0 && (
            <div className="pf-student-search__selection-bar">
              <span><CheckSquare size={15} /> {selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
              <Button size="sm" icon={Share2} onClick={openShareWizard}>Share with recruiter</Button>
            </div>
          )}
        </div>

        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {!searched && <Empty text="Set filters above and search to browse the student directory." />}
        {searched && loading && <Empty text="Searching students…" />}
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
              <Button loading={sharing} icon={Send} onClick={confirmShare}>Confirm share</Button>
            </>
          ) : (
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          )
        }
      >
        {shareStep === 1 && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Step 1 of 3</b> — choose the recipient and context.</p>
            <label>Recruiter *
              <select value={shareForm.recruiterId} onChange={updateFilter('recruiterId')}>
                <option value="">Select a recruiter…</option>
                {recruiters.map(recruiter => <option key={recruiter.id} value={recruiter.id}>{recruiter.fullName}{recruiter.department ? ` — ${recruiter.department}` : ''}</option>)}
              </select>
            </label>
            <label>Related job post (optional)
              <select value={shareForm.jobPostId} onChange={updateFilter('jobPostId')}>
                <option value="">No specific job</option>
                {sharableJobs.map(job => <option key={job.id} value={job.id}>{job.title} — {job.companyName} ({job.status})</option>)}
              </select>
            </label>
            <label>Internal note / context (optional)
              <textarea rows="3" maxLength={500} placeholder="e.g. Shortlist for the Q3 backend hiring drive" value={shareForm.note} onChange={updateFilter('note')} />
            </label>
          </div>
        )}

        {shareStep === 2 && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Step 2 of 3</b> — review before sharing.</p>
            <dl className="pf-share-wizard__summary">
              <div><dt>Recruiter</dt><dd>{selectedRecruiter?.fullName || '—'}</dd></div>
              <div><dt>Job</dt><dd>{selectedJob ? `${selectedJob.title} — ${selectedJob.companyName}` : 'No specific job'}</dd></div>
              <div><dt>Students</dt><dd>{selectedStudents.length}</dd></div>
              <div><dt>Note</dt><dd>{shareForm.note || '—'}</dd></div>
            </dl>
            <ul className="pf-share-wizard__students">
              {selectedStudents.map(student => (
                <li key={student.id}><b>{student.fullName}</b> · {student.department} · Roll {student.rollNumber}</li>
              ))}
            </ul>
            <p className="pf-share-wizard__privacy">
              Recruiters see a curated profile view (name, department, batch, skills, achievements, experience, resume). Sensitive personal data, internal notes, and authentication details are never shared.
            </p>
          </div>
        )}

        {shareStep === 3 && shareResult && (
          <div className="pf-share-wizard">
            <p className="pf-share-wizard__step"><b>Shared.</b></p>
            <p>
              {shareResult.studentIds.length} student{shareResult.studentIds.length === 1 ? '' : 's'} shared with the recruiter. They will see the list under “Shared candidates” in their portal and receive a notification.
            </p>
          </div>
        )}
      </Modal>
    </section>
  );
}
