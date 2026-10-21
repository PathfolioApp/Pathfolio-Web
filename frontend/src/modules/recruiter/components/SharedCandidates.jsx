import React, { useEffect, useState } from 'react';
import { Users, FileText, ThumbsUp, MessageSquare, Building2, GraduationCap } from 'lucide-react';
import { recruiterApi } from '../recruiterApi';
import { recruiterRecruitmentApi } from '../recruitmentApi';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/Badge';
import './SharedCandidates.css';

const proficiencyLabel = value => {
  const labels = { exploring: 'Exploring', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' };
  return labels[value] || value;
};

// Structured company feedback options (requirement #15).
const FEEDBACK_OPTIONS = [
  ['interested', 'Interested'],
  ['shortlisted', 'Shortlisted'],
  ['rejected', 'Rejected'],
  ['interview_requested', 'Interview requested'],
  ['needs_more_info', 'Needs more information']
];

/**
 * Recruiter-facing list of candidate shortlists shared by the placement team.
 * Only students explicitly shared with this recruiter appear here, there is
 * no search or browsing of the wider student population.
 */
export function SharedCandidates() {
  const [shares, setShares] = useState([]);
  const [myResumes, setMyResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [savingFeedback, setSavingFeedback] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await recruiterApi.sharedCandidates();
      setShares(data.shares || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  // Resumes are needed only for student-controlled selection; loaded lazily
  // through the student resume API (recruiter accounts ARE student rows here).
  useEffect(() => {
    if (shares.some(share => (share.students || []).some(student => student.resumeSelectionPending))) {
      import('../../student/resume/resumeApi').then(module => {
        module.resumeApi.list().then(data => setMyResumes(Array.isArray(data) ? data : [])).catch(() => setMyResumes([]));
      }).catch(() => setMyResumes([]));
    }
  }, [shares]);

  const openShare = async share => {
    if (expanded === share.id) return setExpanded(null);
    setExpanded(share.id);
    try {
      const data = await recruiterApi.sharedCandidate(share.id);
      setShares(prev => prev.map(item => (item.id === share.id ? { ...item, ...data.share } : item)));
    } catch (err) {
      setError(err.message);
    }
  };

  const submitFeedback = async (share, student) => {
    const draft = feedbackDraft[`${share.id}:${student.id}`] || {};
    if (!draft.feedback && !draft.status) return;
    setSavingFeedback(true);
    try {
      const data = await recruiterApi.recordCandidateFeedback(share.id, { studentId: student.id, feedback: draft.feedback || '', status: draft.status || null });
      setShares(prev => prev.map(item => (item.id === share.id ? { ...item, status: data.share.status, feedback: data.share.feedback } : item)));
      setFeedbackDraft(prev => ({ ...prev, [`${share.id}:${student.id}`]: {} }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  const selectResume = async (shareId, studentId, resumeId) => {
    setError('');
    try {
      await recruiterRecruitmentApi.selectResume(shareId, resumeId);
      setShares(prev => prev.map(item => (item.id === shareId ? {
        ...item,
        students: (item.students || []).map(student => (student.id === studentId ? { ...student, resumeUrl: `/api/resumes/${resumeId}/file?mode=view`, resumeSelectionPending: false } : student))
      } : item)));
    } catch (err) { setError(err.message); }
  };

  const feedbackFor = (share, studentId) => (share.feedback || []).find(item => item.studentId === studentId);

  if (loading) {
    return (
      <section className="pf-recruiter-results">
        <p className="pf-recruiter-loading">Loading shared candidates…</p>
      </section>
    );
  }

  return (
    <section className="pf-recruiter-results">
      <p className="pf-recruiter-overview-note">
        Candidate lists shared with your company by the Training &amp; Placement cell. Feedback you record here goes straight back to the placement team.
      </p>
      {error && <div className="pf-recruiter-error" role="alert">{error}</div>}
      {shares.length === 0 && (
        <EmptyState
          icon={Users}
          title="No shared candidates yet"
          text="The placement team will share relevant student profiles with your company here. Submitting job posts helps the team match candidates to your needs."
        />
      )}

      <div className="pf-shared-list">
        {shares.map(share => (
          <article key={share.id} className={`pf-shared-card ${expanded === share.id ? 'is-open' : ''}`}>
            <button type="button" className="pf-shared-card__header" onClick={() => openShare(share)} aria-expanded={expanded === share.id}>
              <div>
                <div className="pf-shared-card__badges">
                  <StatusBadge status={share.status} />
                  {share.job && <span className="pf-shared-card__job"><Building2 size={13} /> {share.job.title}</span>}
                </div>
                <h3>{share.students?.length ?? 0} candidate{(share.students?.length ?? 0) === 1 ? '' : 's'} shared with you</h3>
                <p>Shared {new Date(share.createdAt).toLocaleDateString()}{share.viewedAt ? ` · viewed ${new Date(share.viewedAt).toLocaleDateString()}` : ''}</p>
              </div>
            </button>

            {share.note && <p className="pf-shared-card__note">“{share.note}”</p>}

            {expanded === share.id && (
              <div className="pf-shared-card__body">
                {(share.students || []).map(student => {
                  const existing = feedbackFor(share, student.id);
                  const draft = feedbackDraft[`${share.id}:${student.id}`] || {};
                  return (
                    <div key={student.id} className="pf-shared-student">
                      <div className="pf-shared-student__head">
                        <div>
                          <strong>{student.fullName}</strong>
                          <span className="pf-shared-student__meta">
                            <GraduationCap size={13} /> {student.department || 'Department N/A'} · Roll {student.rollNumber}{student.cgpa ? ` · CGPA ${student.cgpa}` : ''}
                          </span>
                        </div>
                        {student.resumeUrl && (
                          <a className="pf-shared-student__resume" href={student.resumeUrl} target="_blank" rel="noreferrer">
                            <FileText size={13} /> Resume
                          </a>
                        )}
                      </div>

                      {/* Student-controlled policy: the student picks which resume to submit. */}
                      {student.resumeSelectionPending && (
                        <div className="pf-shared-student__feedback" style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                          <span className="pf-shared-student__feedback-existing"><FileText size={13} /> Choose which of your resumes to submit:</span>
                          <select value="" onChange={event => event.target.value && selectResume(share.id, student.id, event.target.value)}>
                            <option value="">Select a resume…</option>
                            {myResumes.map(resume => <option key={resume.id} value={resume.id}>{resume.filename}{resume.category ? ` (${resume.category})` : ''}</option>)}
                          </select>
                        </div>
                      )}

                      {student.interests?.passions?.length > 0 && (
                        <div className="pf-shared-student__tags">
                          {student.interests.passions.map(item => (
                            <span key={item.name} className="pf-job-skill-chip" title={item.reason || undefined}>
                              {item.name}{item.proficiency ? ` · ${proficiencyLabel(item.proficiency)}` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {student.achievements?.length > 0 && (
                        <p className="pf-shared-student__line"><b>Latest achievement:</b> {student.achievements[0].title}</p>
                      )}
                      {student.internships?.length > 0 && (
                        <p className="pf-shared-student__line"><b>Experience:</b> {student.internships[0].role} at {student.internships[0].companyName}</p>
                      )}

                      <div className="pf-shared-student__feedback">
                        {existing && (
                          <span className="pf-shared-student__feedback-existing">
                            <ThumbsUp size={13} /> Recorded: {existing.status || 'note'}{existing.feedback ? `, “${existing.feedback}”` : ''}
                          </span>
                        )}
                        <select
                          value={draft.status || ''}
                          onChange={e => { const status = e.target.value || null; setFeedbackDraft(prev => ({ ...prev, [`${share.id}:${student.id}`]: { ...prev[`${share.id}:${student.id}`], status } })); }}
                          aria-label="Feedback type"
                        >
                          <option value="">Feedback type…</option>
                          {FEEDBACK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <input
                          type="text"
                          aria-label={`Feedback for ${student.fullName}`}
                          placeholder="Add feedback for the placement team (optional)…"
                          value={draft.feedback || ''}
                          onChange={e => { const feedback = e.target.value; setFeedbackDraft(prev => ({ ...prev, [`${share.id}:${student.id}`]: { ...prev[`${share.id}:${student.id}`], feedback } })); }}
                        />
                        <button type="button" disabled={savingFeedback || (!draft.feedback && !draft.status)} onClick={() => submitFeedback(share, student)}>
                          <MessageSquare size={13} /> {savingFeedback ? 'Saving…' : 'Send'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
