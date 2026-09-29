import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Edit3,
  ShieldCheck,
  Award,
  FileText,
  Eye,
  UserCheck,
  GraduationCap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileCompleteness } from '../utils/profileCompleteness';
import { resumeApi } from '../services/resumeApi';
import { PdfIcon } from '../components/PdfIcon';
import { AchievementIcon } from '../components/AchievementIcon';
import './ProfilePages.css';
import './ProfileEligibility.css';
import './AcademicStyles.css';

const Tags = ({ values, empty }) => values?.length ? <div className="pf-tags">{values.map(value => <span key={value}>{value}</span>)}</div> : <p className="pf-empty">{empty}</p>;
const displayValue = value => value === undefined || value === '' ? 'Not added yet' : value;

export function ProfilePage() {
  const { student } = useAuth();
  const personal = student.personal;
  const academic = student.academic;
  const family = student.familyContext;
  const percent = profileCompleteness(student);

  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);

  useEffect(() => {
    resumeApi.list()
      .then(data => setResumes(Array.isArray(data) ? data : []))
      .catch(() => setResumes([]))
      .finally(() => setLoadingResumes(false));
  }, []);

  const defaultResume = resumes.find(r => r.isDefault) || resumes[0];
  const avatarUrl = personal?.avatarUrl || student?.avatarUrl || '';
  const initials = (personal?.fullName || 'User')
    .split(' ')
    .filter(Boolean)
    .map(value => value[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const achievements = student.achievements || [];
  const visibleAchievements = showAllAchievements ? achievements : achievements.slice(0, 3);
  const hasMoreAchievements = achievements.length > 3;

  return <div className="pf-profile-page">
    <section className="pf-profile-hero">
      <div className="pf-profile-hero-left">
        <div className="pf-profile-avatar-wrapper">
          {avatarUrl ? (
            <img className="pf-profile-avatar-img" src={avatarUrl} alt={personal.fullName} />
          ) : (
            <div className="pf-profile-avatar-fallback">{initials}</div>
          )}
        </div>
        <div className="pf-profile-hero-info">
          <div className="pf-profile-eyebrow-row">
            <span className="editorial-eyebrow">Your profile</span>
            <span className="pf-role-badge">Student</span>
          </div>
          <h1 className="pf-profile-name">{personal.fullName}</h1>
          <p className="pf-profile-subtext">
            <span>@{personal.username}</span>
            <span className="pf-dot">·</span>
            <span>{academic.department}</span>
            <span className="pf-dot">·</span>
            <span>{academic.batchYear}</span>
          </p>
        </div>
      </div>

      <div className="pf-profile-hero-right">
        <div className="pf-profile-completeness-card">
          <div className="pf-completeness-info">
            <strong>{percent}%</strong>
            <span>profile complete</span>
          </div>
          <div className="pf-completeness-bar">
            <div className="pf-completeness-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <Link className="pf-hero-edit-btn" to="/profile/edit">
          <Edit3 size={16} /> Edit profile
        </Link>
      </div>
    </section>
    <p className="pf-profile-intro">Everything you’ve shared so far, in one place.</p>
    <div className="pf-profile-grid">
      {/* Resumes Section */}
      <section className="pf-profile-wide">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <FileText size={18} />
            <span>Resumes</span>
          </div>
          <Link to="/resume" className="pf-section-link">Manage resumes</Link>
        </div>
        {loadingResumes ? (
          <p className="pf-empty">Loading resume information...</p>
        ) : defaultResume ? (
          <div className="pf-resume-inner-card">
            <div className="pf-resume-inner-left">
              <div className="pf-resume-pdf-box">
                <PdfIcon size={25} className="pf-resume-pdf-icon" />
              </div>
              <div className="pf-resume-details">
                <strong className="pf-resume-filename">
                  {defaultResume.filename}
                </strong>
                <div className="pf-resume-meta">
                  <span>PDF Document</span>
                  <span className="pf-dot">·</span>
                  <span className="pf-resume-status-badge">
                    {defaultResume.isDefault ? 'Primary Resume' : 'Active Resume'}
                  </span>
                  {defaultResume.tags && defaultResume.tags.length > 0 && (
                    <>
                      <span className="pf-dot">·</span>
                      <span style={{ display: 'inline-flex', gap: '0.3rem' }}>
                        {defaultResume.tags.map(t => (
                          <span key={t} className="pf-resume-tag-pill">
                            {t}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                  {defaultResume.uploadedAt && (
                    <>
                      <span className="pf-dot">·</span>
                      <span>Updated {new Date(defaultResume.uploadedAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="pf-resume-btn-group">
              <a
                href={defaultResume.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pf-btn-subtle"
              >
                Preview
              </a>
              <Link
                to="/resume"
                className="pf-btn-primary-pill"
              >
                All resumes ({resumes.length})
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f4f7f4', border: '1px dashed #cfdacf', borderRadius: '10px' }}>
            <p className="pf-empty" style={{ margin: 0 }}>You haven't uploaded a resume yet.</p>
            <Link to="/resume" className="pf-btn-primary-pill">
              Upload resume
            </Link>
          </div>
        )}
      </section>

      {/* Personal Information Section */}
      <section>
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <UserCheck size={18} />
            <span>Personal information</span>
          </div>
          <Link to="/profile/edit" className="pf-section-link">Edit</Link>
        </div>
        <div className="pf-info-list">
          <div className="pf-info-row">
            <span className="pf-info-label">Full name</span>
            <span className="pf-info-value">{personal.fullName}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Age</span>
            <span className="pf-info-value">{personal.age || '—'}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Institutional email</span>
            <span className="pf-info-value pf-email-verified">
              {personal.email}
              <CheckCircle2 size={14} className="pf-verified-icon" />
            </span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Username</span>
            <span className="pf-info-value">@{personal.username}</span>
          </div>
        </div>
      </section>

      {/* Academic Identity Section */}
      <section>
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <GraduationCap size={18} />
            <span>Academic identity</span>
          </div>
          <span className="pf-verified-badge">Registrar Verified</span>
        </div>
        <div className="pf-info-list">
          <div className="pf-info-row">
            <span className="pf-info-label">Roll number</span>
            <span className="pf-info-value">{academic.rollNumber}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Department</span>
            <span className="pf-info-value">{academic.department}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Batch year</span>
            <span className="pf-info-value">{academic.batchYear}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Degree / program</span>
            <span className="pf-info-value">{displayValue(academic.degreeProgram)}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Graduation year</span>
            <span className="pf-info-value">{displayValue(academic.graduationYear)}</span>
          </div>
        </div>
      </section>

      {/* Schooling Showcase */}
      <section className="pf-profile-wide">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-group">
            <div className="pf-title-with-icon">
              <GraduationCap size={18} />
              <span>Schooling</span>
            </div>
            <p className="pf-card-subtitle">
              Pre-requisite academic background records for recruitment screening
            </p>
          </div>
          <Link to="/profile/edit#schooling" className="pf-section-link">Manage schooling & marksheets</Link>
        </div>
        <div className="pf-schooling-showcase">
          {/* 10th Standard */}
          <div className="pf-schooling-subcard">
            <div className="pf-schooling-subcard__header">
              <h3>10th Standard (Matriculation)</h3>
              {academic.tenthPercentage !== undefined && academic.tenthPercentage !== '' && (
                <span className="pf-mint-badge">{academic.tenthPercentage}%</span>
              )}
            </div>
            <div className="pf-schooling-subcard__rows">
              <div className="pf-info-row">
                <span className="pf-info-label">School</span>
                <span className="pf-info-value">{displayValue(academic.tenthSchool)}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label">Board</span>
                <span className="pf-info-value">{displayValue(academic.tenthBoard)}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label">Passing year</span>
                <span className="pf-info-value">{displayValue(academic.tenthYear)}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label">Marksheet</span>
                {academic.tenthMarksheet?.fileUrl ? (
                  <a
                    href={academic.tenthMarksheet.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-attached-link"
                  >
                    <CheckCircle2 size={13} /> Verified & Attached
                  </a>
                ) : (
                  <span className="pf-not-attached">Not uploaded</span>
                )}
              </div>
            </div>
          </div>

          {/* 12th Standard / Diploma */}
          <div className="pf-schooling-subcard">
            <div className="pf-schooling-subcard__header">
              <h3>12th Standard / Diploma</h3>
              {academic.twelfthPercentage !== undefined && academic.twelfthPercentage !== '' && (
                <span className="pf-mint-badge">{academic.twelfthPercentage}%</span>
              )}
            </div>
            <div className="pf-schooling-subcard__rows">
              <div className="pf-info-row">
                <span className="pf-info-label">College / School</span>
                <span className="pf-info-value">{displayValue(academic.twelfthSchool)}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label">Board & Stream</span>
                <span className="pf-info-value">
                  {academic.twelfthBoard && academic.twelfthStream
                    ? `${academic.twelfthBoard} • ${academic.twelfthStream}`
                    : displayValue(academic.twelfthBoard || academic.twelfthStream)}
                </span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label">Passing year</span>
                <span className="pf-info-value">{displayValue(academic.twelfthYear)}</span>
              </div>
              <div className="pf-info-row">
                <span className="pf-info-label">Marksheet</span>
                {academic.twelfthMarksheet?.fileUrl ? (
                  <a
                    href={academic.twelfthMarksheet.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-attached-link"
                  >
                    <CheckCircle2 size={13} /> Verified & Attached
                  </a>
                ) : (
                  <span className="pf-not-attached">Not uploaded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* College Semesters & Transcripts Showcase */}
      <section className="pf-profile-wide">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-group">
            <div className="pf-title-with-icon">
              <GraduationCap size={18} />
              <span>College Semesters & Transcripts</span>
            </div>
            <p className="pf-card-subtitle">
              Semester-wise grade performance and official transcripts
            </p>
          </div>
          <Link to="/profile/edit#semesters" className="pf-section-link">Manage semester results</Link>
        </div>
        {academic.semesters && academic.semesters.length > 0 ? (
          <div className="pf-transcripts-table-wrapper">
            <table className="pf-transcripts-table">
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>SGPA</th>
                  <th>CGPA</th>
                  <th>Academic Session</th>
                  <th>Official Transcript</th>
                </tr>
              </thead>
              <tbody>
                {academic.semesters.map(sem => (
                  <tr key={sem.id || sem.semester}>
                    <td>
                      <strong>Semester {sem.semester}</strong>
                    </td>
                    <td>
                      {sem.sgpa !== null && sem.sgpa !== undefined ? (
                        <span className="pf-sgpa-pill">{Number(sem.sgpa).toFixed(2)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {sem.cgpa !== null && sem.cgpa !== undefined ? (
                        <span style={{ fontWeight: 600 }}>{Number(sem.cgpa).toFixed(2)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{sem.academicYear || '—'}</td>
                    <td>
                      {sem.transcript?.fileUrl ? (
                        <a
                          href={sem.transcript.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pf-doc-btn"
                        >
                          <Eye size={12} /> View Transcript (PDF)
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pending upload</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f4f7f4', border: '1px dashed #cfdacf', borderRadius: '10px', marginTop: '12px' }}>
            <p className="pf-empty" style={{ margin: 0 }}>No semester records or transcripts uploaded yet.</p>
            <Link to="/profile/edit#semesters" className="pf-btn-subtle">
              Add semester results
            </Link>
          </div>
        )}
      </section>

      <section className="pf-profile-wide pf-eligibility-card">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <ShieldCheck size={18} />
            <span>Academic eligibility</span>
          </div>
          <Link to="/profile/edit" className="pf-section-link">Complete eligibility</Link>
        </div>
        <div className="pf-eligibility-grid">
          <div><dt>Current semester</dt><dd>{displayValue(academic.currentSemester)}</dd></div>
          <div><dt>CGPA</dt><dd>{displayValue(academic.cgpa)}</dd></div>
          <div><dt>10th percentage</dt><dd>{displayValue(academic.tenthPercentage)}</dd></div>
          <div><dt>12th percentage</dt><dd>{displayValue(academic.twelfthPercentage)}</dd></div>
          <div><dt>Active backlogs</dt><dd>{displayValue(academic.activeBacklogs)}</dd></div>
          <div><dt>Historical backlogs</dt><dd>{displayValue(academic.historicalBacklogs)}</dd></div>
          <div><dt>Gap years</dt><dd>{displayValue(academic.gapYears)}</dd></div>
        </div>
      </section>

      {/* Hobbies Section */}
      <section>
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <Compass size={18} />
            <span>Hobbies</span>
          </div>
          <Link to="/profile/edit#interests" className="pf-section-link">Edit</Link>
        </div>
        <Tags values={student.interests.hobbies} empty="Your interests will appear here as you add them." />
      </section>

      {/* Passions & Interests Section */}
      <section>
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <Sparkles size={18} />
            <span>Passions & interests</span>
          </div>
          <Link to="/profile/edit#interests" className="pf-section-link">Edit</Link>
        </div>
        <Tags values={student.interests.passions} empty="Your interests will appear here as you add them." />
      </section>

      <section className="pf-profile-wide">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-group">
            <div className="pf-title-with-icon">
              <Award size={18} />
              <span>Achievements</span>
              {achievements.length > 0 && (
                <span className="pf-count-pill">{achievements.length}</span>
              )}
            </div>
            <p className="pf-card-subtitle">
              Milestones, certifications, competitions, and recognized credentials
            </p>
          </div>
          <Link to="/profile/edit#achievements" className="pf-section-link">Add achievement</Link>
        </div>
        {achievements.length ? (
          <>
            <div className="pf-achievement-list">
              {visibleAchievements.map(achievement => (
                <article key={achievement.id}>
                  <AchievementIcon category={achievement.category} size={18} variant="badge" />
                  <div className="pf-achievement-content">
                    <strong>{achievement.title}</strong>
                    <small>{achievement.category || 'General'}{achievement.year ? ` · Completed ${achievement.year}` : ''}</small>
                    {achievement.description && <p>{achievement.description}</p>}
                  </div>
                </article>
              ))}
            </div>
            {hasMoreAchievements && (
              <div className="pf-expand-row">
                <button
                  type="button"
                  className="pf-expand-btn"
                  onClick={() => setShowAllAchievements(prev => !prev)}
                >
                  {showAllAchievements ? (
                    <>Show less <ChevronUp size={15} /></>
                  ) : (
                    <>Show all {achievements.length} achievements ({achievements.length - 3} more) <ChevronDown size={15} /></>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="pf-empty">You haven't added any achievements yet.</p>
        )}
      </section>

      <section className="pf-profile-wide pf-sensitive">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <ShieldCheck size={18} />
            <span>Personal context</span>
          </div>
          <Link to="/profile/settings" className="pf-section-link">Privacy controls</Link>
        </div>
        {family?.details && family.consentGiven ? (
          <p>{family.details}</p>
        ) : (
          <p className="pf-empty">This section is optional and can be completed whenever you’re comfortable.</p>
        )}
      </section>
    </div>
  </div>;
}