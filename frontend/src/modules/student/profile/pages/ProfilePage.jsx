import React, { useState, useEffect, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Compass,
  Sparkles,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  Calendar,
  FolderGit2,
  Code2,
  Star,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../../../app/providers/AuthProvider';
import { profileCompleteness } from '../utils/profileCompleteness';
import { resumeApi } from '../../resume/resumeApi';
import { PdfIcon } from '../../../../components/ui/PdfIcon';
import { AchievementIcon } from '../../../../components/ui/AchievementIcon';
import { InternshipDetailModal } from '../components/InternshipDetailModal';
import { formatInternshipTimeline, sortInternships } from '../utils/internshipUtils';
import { ProjectDetailModal } from '../components/ProjectDetailModal';
import { formatProjectTimeline, sortProjects } from '../utils/projectUtils';
import { PRESET_PLATFORMS, getSocialPlatform, formatSocialUrl, displaySocialHandle, SocialIcon } from '../utils/socialUtils';
import '../styles/ProfilePages.css';
import '../styles/ProfileEligibility.css';
import '../styles/AcademicStyles.css';
import '../styles/InternshipStyles.css';
import '../styles/ProjectStyles.css';
import '../styles/SocialStyles.css';
import '../styles/ProfileViewport.css';

// Interests arrive in two shapes across the app's history: legacy plain
// strings and the canonical onboarding objects {name, proficiency, reason}.
// Render both safely; never let an unexpected shape crash the page.
const interestLabel = value => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.name || value.title || '';
  return String(value ?? '');
};

const Tags = ({ values, empty }) => {
  if (!values?.length) return <p className="pf-empty">{empty}</p>;
  const labels = values.map(interestLabel).filter(Boolean);
  if (!labels.length) return <p className="pf-empty">{empty}</p>;
  return (
    <div className="pf-tags">
      {labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
    </div>
  );
};
const displayValue = value => value === undefined || value === '' ? 'Not added yet' : value;

function formatDuration(startDateStr, endDateStr, currentlyWorking) {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const end = currentlyWorking || !endDateStr ? new Date() : new Date(endDateStr);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  if (months <= 0) return '';
  if (months < 12) return `${months} mo${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} yr${years > 1 ? 's' : ''}${remMonths ? ` ${remMonths} mo${remMonths > 1 ? 's' : ''}` : ''}`;
}

function formatDateMonthYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function ProfilePage() {
  const { student } = useAuth();
  const personal = student.personal;
  const academic = student.academic;
  const family = student.familyContext;
  const percent = profileCompleteness(student);

  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [selectedInternshipDetail, setSelectedInternshipDetail] = useState(null);
  const [showAllInternships, setShowAllInternships] = useState(false);

  const internships = sortInternships(student.internships);
  const visibleInternships = showAllInternships ? internships : internships.slice(0, 3);
  const hasMoreInternships = internships.length > 3;

  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null);
  const projects = sortProjects(student.projects);
  const projectTrackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);

  const checkProjectScroll = () => {
    const el = projectTrackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);

    if (clientWidth > 0 && el.firstElementChild) {
      const cardWidth = el.firstElementChild.offsetWidth + 22;
      const idx = Math.min(
        Math.round(scrollLeft / cardWidth),
        Math.max(0, projects.length - 1)
      );
      setActiveProjectIndex(Math.max(0, idx));
    }
  };

  useEffect(() => {
    checkProjectScroll();
    const el = projectTrackRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkProjectScroll, { passive: true });
    window.addEventListener('resize', checkProjectScroll);
    return () => {
      el.removeEventListener('scroll', checkProjectScroll);
      window.removeEventListener('resize', checkProjectScroll);
    };
  }, [projects.length]);

  const handleScrollProjects = (direction) => {
    const el = projectTrackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? el.firstElementChild.offsetWidth + 22 : 440;
    el.scrollBy({
      left: direction === 'left' ? -cardWidth : cardWidth,
      behavior: 'smooth',
    });
  };

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

  return <div className="pf-profile-page pf-profile-view">
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
            <span>Roll No. {academic.rollNumber}</span>
            <span className="pf-dot">·</span>
            <span>{academic.department}</span>
            <span className="pf-dot">·</span>
            <span>{academic.batchYear}</span>
          </p>

          {/* Hero Social Profiles Quick-Links */}
          {(() => {
            const hasLinkedin = Boolean(student.social?.linkedin && student.social.linkedin.trim());
            const extraLinks = Array.isArray(student.social?.links) ? student.social.links.filter(l => l.url && l.url.trim()) : [];
            const hasAnySocial = hasLinkedin || extraLinks.length > 0;

            return (
              <div className="pf-hero-social-row">
                {hasLinkedin && (
                  <a
                    href={formatSocialUrl(student.social.linkedin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-hero-social-pill pf-hero-social-pill--linkedin"
                    title="LinkedIn Profile"
                  >
                    <SocialIcon platform="linkedin" size={14} />
                    <span>LinkedIn</span>
                    <ExternalLink size={11} className="pf-pill-external" />
                  </a>
                )}
                {extraLinks.map(link => (
                  <a
                    key={link.id || link.url}
                    href={formatSocialUrl(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`pf-hero-social-pill pf-hero-social-pill--${link.platform || 'other'}`}
                    title={link.name || link.platform}
                  >
                    <SocialIcon platform={link.platform} size={14} />
                    <span>{link.name || link.platform}</span>
                    <ExternalLink size={11} className="pf-pill-external" />
                  </a>
                ))}
                {!hasAnySocial && (
                  <Link to="/profile/edit#social" className="pf-hero-add-social-btn">
                    <ExternalLink size={12} /> Add LinkedIn & Coding Profiles
                  </Link>
                )}
              </div>
            );
          })()}
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
            <span className="pf-info-label">Date of birth</span>
            <span className="pf-info-value">{personal.dateOfBirth ? new Date(`${personal.dateOfBirth}T00:00:00`).toLocaleDateString() : '-'}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Phone number</span>
            <span className="pf-info-value">{personal.phone || '-'}</span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Institutional email</span>
            <span className="pf-info-value pf-email-verified">
              {personal.email}
              <CheckCircle2 size={14} className="pf-verified-icon" />
            </span>
          </div>
          <div className="pf-info-row">
            <span className="pf-info-label">Roll number</span>
            <span className="pf-info-value">{academic.rollNumber}</span>
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
          <Link to="/profile/edit#academic" className="pf-section-link">Edit</Link>
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
              <div className="pf-resume-inner-info">
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
                      <span className="pf-profile-resume-tags" style={{ display: 'inline-flex', gap: '0.3rem' }}>
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
          <div className="pf-profile-empty-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f4f7f4', border: '1px dashed #cfdacf', borderRadius: '10px' }}>
            <p className="pf-empty" style={{ margin: 0 }}>You haven't uploaded a resume yet.</p>
            <Link to="/resume" className="pf-btn-primary-pill">
              Upload resume
            </Link>
          </div>
        )}
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
                  <span className="pf-not-attached">Pending upload</span>
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
                  <span className="pf-not-attached">Pending upload</span>
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
          <div className="pf-transcripts-table-wrapper" role="region" aria-label="Semester results and transcripts" tabIndex={0}>
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
                        '-'
                      )}
                    </td>
                    <td>
                      {sem.cgpa !== null && sem.cgpa !== undefined ? (
                        <span style={{ fontWeight: 600 }}>{Number(sem.cgpa).toFixed(2)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{sem.academicYear || '-'}</td>
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
          <div className="pf-profile-empty-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#f4f7f4', border: '1px dashed #cfdacf', borderRadius: '10px', marginTop: '12px' }}>
            <p className="pf-empty" style={{ margin: 0 }}>No semester records or transcripts uploaded yet.</p>
            <Link to="/profile/edit#semesters" className="pf-btn-subtle">
              Add semester results
            </Link>
          </div>
        )}
      </section>

      {/* Academic Eligibility Section */}
      <section className="pf-profile-wide pf-eligibility-card">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-with-icon">
            <ShieldCheck size={18} />
            <span>Academic eligibility</span>
          </div>
          <Link to="/profile/edit#eligibility" className="pf-section-link">Edit</Link>
        </div>
        <div className="pf-eligibility-grid">
          <div><dt>Graduation year</dt><dd>{displayValue(academic.graduationYear)}</dd></div>
          <div><dt>Current semester</dt><dd>{displayValue(academic.currentSemester)}</dd></div>
          <div><dt>CGPA</dt><dd>{displayValue(academic.cgpa)}</dd></div>
          <div><dt>Active backlogs</dt><dd>{displayValue(academic.activeBacklogs)}</dd></div>
          <div><dt>Historical backlogs</dt><dd>{displayValue(academic.historicalBacklogs)}</dd></div>
          <div><dt>Gap years</dt><dd>{displayValue(academic.gapYears)}</dd></div>
          <div><dt>10th percentage</dt><dd>{academic.tenthPercentage !== undefined && academic.tenthPercentage !== '' ? (String(academic.tenthPercentage).endsWith('%') ? academic.tenthPercentage : `${academic.tenthPercentage}%`) : 'Not added yet'}</dd></div>
          <div><dt>12th percentage</dt><dd>{academic.twelfthPercentage !== undefined && academic.twelfthPercentage !== '' ? (String(academic.twelfthPercentage).endsWith('%') ? academic.twelfthPercentage : `${academic.twelfthPercentage}%`) : 'Not added yet'}</dd></div>
        </div>
      </section>

      {/* Social & Professional Profiles Section */}
      <section className="pf-profile-wide pf-social-section" id="social">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-group">
            <div className="pf-title-with-icon">
              <Globe size={18} />
              <span>Social & coding profiles</span>
              {((student.social?.linkedin ? 1 : 0) + (Array.isArray(student.social?.links) ? student.social.links.length : 0)) > 0 && (
                <span className="pf-count-pill">
                  {(student.social?.linkedin ? 1 : 0) + (Array.isArray(student.social?.links) ? student.social.links.length : 0)}
                </span>
              )}
            </div>
            <p className="pf-card-subtitle">
              Verified online presence, algorithmic platforms, repositories, and portfolios
            </p>
          </div>
          <Link to="/profile/edit#social" className="pf-section-link">Manage profiles</Link>
        </div>

        {(() => {
          const hasLinkedin = Boolean(student.social?.linkedin && student.social.linkedin.trim());
          const extraLinks = Array.isArray(student.social?.links) ? student.social.links.filter(l => l.url && l.url.trim()) : [];
          const hasAny = hasLinkedin || extraLinks.length > 0;

          if (!hasAny) {
            return (
              <div className="pf-social-empty">
                <Globe size={28} style={{ color: '#889e8e' }} />
                <p>No social or coding profiles linked yet</p>
                <span>Connect your LinkedIn, GitHub, LeetCode, and personal portfolio to showcase your online presence to recruiters.</span>
                <Link to="/profile/edit#social" className="pf-btn-subtle" style={{ marginTop: '8px' }}>
                  Add profiles now
                </Link>
              </div>
            );
          }

          return (
            <div className="pf-social-grid">
              {hasLinkedin && (
                <a
                  href={formatSocialUrl(student.social.linkedin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-social-card"
                >
                  <div className="pf-social-card__icon-wrap">
                    <SocialIcon platform="linkedin" size={22} />
                  </div>
                  <div className="pf-social-card__info">
                    <div className="pf-social-card__title">
                      LinkedIn
                    </div>
                    <span className="pf-social-card__handle">
                      {displaySocialHandle(student.social.linkedin)}
                    </span>
                  </div>
                  <ExternalLink size={15} className="pf-social-card__action" />
                </a>
              )}

              {extraLinks.map(link => {
                const meta = getSocialPlatform(link.platform);
                return (
                  <a
                    key={link.id || link.url}
                    href={formatSocialUrl(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pf-social-card"
                  >
                    <div className="pf-social-card__icon-wrap">
                      <SocialIcon platform={link.platform} size={22} />
                    </div>
                    <div className="pf-social-card__info">
                      <div className="pf-social-card__title">
                        {link.name || meta.name}
                      </div>
                      <span className="pf-social-card__handle">
                        {displaySocialHandle(link.url)}
                      </span>
                    </div>
                    <ExternalLink size={15} className="pf-social-card__action" />
                  </a>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* Internships & Experience Section */}
      <section className="pf-profile-wide pf-internship-section">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-group">
            <div className="pf-title-with-icon">
              <Briefcase size={18} />
              <span>Internships & work experience</span>
              {internships.length > 0 && (
                <span className="pf-count-pill">{internships.length}</span>
              )}
            </div>
            <p className="pf-card-subtitle">
              Corporate internships, research engagements, and technical apprenticeships
            </p>
          </div>
          <Link to="/profile/edit#internships" className="pf-section-link">
            {internships.length ? 'Edit' : 'Add internship'}
          </Link>
        </div>

        {internships.length ? (
          <>
            <div className="pf-internship-list">
              {visibleInternships.map(internship => {
                const timelineStr = formatInternshipTimeline(internship.startDate, internship.endDate, internship.currentlyWorking);

                return (
                  <article key={internship.id} className="pf-internship-card">
                    <div className="pf-internship-card__header">
                      <div className="pf-internship-card__identity">
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
                        <div className="pf-internship-card__titles">
                          <h3 className="pf-internship-role">{internship.role}</h3>
                          <div className="pf-internship-company-row">
                            <span className="pf-internship-company">{internship.companyName}</span>
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
                      </div>

                      <div className="pf-internship-card__badges">
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
                      </div>
                    </div>

                    <div className="pf-internship-meta-row">
                      <div className="pf-internship-meta-item">
                        <Calendar size={14} />
                        <span>{timelineStr}</span>
                      </div>
                      {internship.location && (
                        <div className="pf-internship-meta-item">
                          <MapPin size={14} />
                          <span>{internship.location}</span>
                        </div>
                      )}
                    </div>

                    {internship.description && (
                      <p className="pf-internship-desc">{internship.description}</p>
                    )}

                    {Array.isArray(internship.responsibilities) && internship.responsibilities.length > 0 && (
                      <ul className="pf-internship-bullets">
                        {internship.responsibilities.slice(0, 2).map((resp, i) => (
                          <li key={i}>{resp}</li>
                        ))}
                        {internship.responsibilities.length > 2 && (
                          <li style={{ listStyle: 'none', color: '#687e6f', fontSize: '0.82rem', fontStyle: 'italic', marginTop: '2px' }}>
                            +{internship.responsibilities.length - 2} more contributions documented
                          </li>
                        )}
                      </ul>
                    )}

                    {Array.isArray(internship.skills) && internship.skills.length > 0 && (
                      <div className="pf-internship-tags">
                        {internship.skills.map((skill, i) => (
                          <span key={i} className="pf-internship-tag">{skill}</span>
                        ))}
                      </div>
                    )}

                    <div className="pf-internship-card__footer">
                      <div>
                        {internship.certificate?.fileUrl && (
                          <a
                            href={internship.certificate.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pf-cert-btn"
                          >
                            <Eye size={13} /> View Certificate (PDF)
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        className="pf-details-btn"
                        onClick={() => setSelectedInternshipDetail(internship)}
                      >
                        <Eye size={13} /> View full details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMoreInternships && (
              <div className="pf-expand-row">
                <button
                  type="button"
                  className="pf-expand-btn"
                  onClick={() => setShowAllInternships(prev => !prev)}
                >
                  {showAllInternships ? (
                    <>Show less <ChevronUp size={15} /></>
                  ) : (
                    <>Show all {internships.length} internships ({internships.length - 3} more) <ChevronDown size={15} /></>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="pf-profile-empty-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f4f7f4', border: '1px dashed #cfdacf', borderRadius: '10px', marginTop: '12px' }}>
            <p className="pf-empty" style={{ margin: 0 }}>No internships or corporate experience added yet.</p>
            <Link to="/profile/edit#internships" className="pf-btn-subtle">
              Add your first internship
            </Link>
          </div>
        )}
      </section>

      {/* Projects Section - Horizontal Snap Carousel */}
      <section className="pf-profile-wide pf-project-section">
        <div className="pf-title-row-enhanced">
          <div className="pf-title-group">
            <div className="pf-title-with-icon">
              <FolderGit2 size={18} />
              <span>Projects</span>
              {projects.length > 0 && (
                <span className="pf-count-pill">{projects.length}</span>
              )}
            </div>
            <p className="pf-card-subtitle">
              Personal, academic, open-source, and hackathon technical projects
            </p>
          </div>

          <div className="pf-project-header-actions">
            {(canScrollLeft || canScrollRight) && (
              <div className="pf-carousel-nav-arrows">
                <button
                  type="button"
                  className="pf-carousel-nav-btn"
                  onClick={() => handleScrollProjects('left')}
                  disabled={!canScrollLeft}
                  title="Previous projects"
                  aria-label="Previous projects"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="pf-carousel-nav-btn"
                  onClick={() => handleScrollProjects('right')}
                  disabled={!canScrollRight}
                  title="Next projects"
                  aria-label="Next projects"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <Link to="/profile/edit#projects" className="pf-section-link">Manage projects</Link>
          </div>
        </div>

        {projects.length ? (
          <div className="pf-project-carousel-wrapper">
            <div
              ref={projectTrackRef}
              className={`pf-project-carousel-track ${projects.length <= 2 ? 'pf-project-carousel-track--few' : ''}`}
              data-project-count={projects.length}
            >
              {projects.map(project => {
                const timelineStr = formatProjectTimeline(project.startDate, project.endDate, project.currentlyWorking);

                return (
                  <article
                    key={project.id}
                    className={`pf-project-card pf-project-card--carousel ${project.featured ? 'pf-project-card--featured' : ''}`}
                  >
                    {/* Media Column (260px prominent thumbnail) */}
                    <div className="pf-project-card__media">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.projectName}
                          className="pf-project-thumbnail"
                        />
                      ) : (
                        <div className="pf-project-monogram">
                          <FolderGit2 size={36} />
                          <span>{project.projectType || 'Project'}</span>
                        </div>
                      )}
                      {project.featured && (
                        <span className="pf-project-media-badge">
                          <Star size={11} style={{ fill: '#d97706', color: '#d97706' }} /> Featured
                        </span>
                      )}
                    </div>

                    {/* Content Column */}
                    <div className="pf-project-card__content">
                      <div className="pf-project-card__header">
                        <div className="pf-project-card__titles">
                          <div className="pf-project-name-row">
                            <h3 className="pf-project-name">{project.projectName}</h3>
                            {project.featured && (
                              <span className="pf-project-pill pf-project-pill--featured">
                                <Star size={11} style={{ fill: '#d97706', color: '#d97706' }} /> Featured
                              </span>
                            )}
                          </div>
                          <div className="pf-project-card__badges">
                            {project.projectType && (
                              <span className="pf-project-pill pf-project-pill--type">
                                {project.projectType}
                              </span>
                            )}
                            {project.currentlyWorking && (
                              <span className="pf-project-pill pf-project-pill--present">
                                <span className="pf-pulse-dot" /> Present
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pf-project-links-group">
                          {project.projectUrl && (
                            <a
                              href={project.projectUrl.startsWith('http') ? project.projectUrl : `https://${project.projectUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pf-project-link"
                            >
                              <Globe size={12} /> Live Demo <ExternalLink size={10} />
                            </a>
                          )}
                          {project.repoUrl && (
                            <a
                              href={project.repoUrl.startsWith('http') ? project.repoUrl : `https://${project.repoUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pf-project-link"
                            >
                              <Code2 size={12} /> Code <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>

                      {timelineStr && (
                        <div className="pf-project-meta-row">
                          <div className="pf-project-meta-item">
                            <Calendar size={14} />
                            <span>{timelineStr}</span>
                          </div>
                        </div>
                      )}

                      {project.description && (
                        <p className="pf-project-desc">{project.description}</p>
                      )}

                      {Array.isArray(project.contributions) && project.contributions.length > 0 && (
                        <ul className="pf-project-bullets">
                          {project.contributions.slice(0, 2).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                          {project.contributions.length > 2 && (
                            <li style={{ listStyle: 'none', color: '#687e6f', fontSize: '0.82rem', fontStyle: 'italic', marginTop: '2px' }}>
                              +{project.contributions.length - 2} more contributions documented
                            </li>
                          )}
                        </ul>
                      )}

                      {Array.isArray(project.technologies) && project.technologies.length > 0 && (
                        <div className="pf-project-tags">
                          {project.technologies.map((tech, i) => (
                            <span key={i} className="pf-project-tag">{tech}</span>
                          ))}
                        </div>
                      )}

                      <div className="pf-project-card__footer">
                        <div>
                          {project.document?.fileUrl && (
                            <a
                              href={project.document.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pf-doc-btn"
                            >
                              <Eye size={13} /> View Document (PDF)
                            </a>
                          )}
                        </div>
                        <button
                          type="button"
                          className="pf-details-btn"
                          onClick={() => setSelectedProjectDetail(project)}
                        >
                          <Eye size={13} /> View full details
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Carousel Pagination & Indicator */}
            {projects.length > 2 && (
              <div className="pf-carousel-pagination">
                <div className="pf-carousel-dots">
                  {projects.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`pf-carousel-dot ${i === activeProjectIndex ? 'pf-carousel-dot--active' : ''}`}
                      onClick={() => {
                        const el = projectTrackRef.current;
                        if (!el) return;
                        const cardWidth = el.firstElementChild ? el.firstElementChild.offsetWidth + 22 : 440;
                        el.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
                      }}
                      aria-label={`Go to project ${i + 1}`}
                    />
                  ))}
                </div>
                <span className="pf-carousel-counter">
                  {projects.length} projects · Swipe or use arrows to view more
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="pf-profile-empty-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f4f7f4', border: '1px dashed #cfdacf', borderRadius: '10px', marginTop: '12px' }}>
            <p className="pf-empty" style={{ margin: 0 }}>No projects added yet.</p>
            <Link to="/profile/edit#projects" className="pf-btn-subtle">
              Add your first project
            </Link>
          </div>
        )}
      </section>

      {/* Achievements Section */}
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

      {/* Personal Context Section */}
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

      <InternshipDetailModal
        isOpen={Boolean(selectedInternshipDetail)}
        onClose={() => setSelectedInternshipDetail(null)}
        internship={selectedInternshipDetail}
        className="pf-profile-detail-viewport"
      />

      <ProjectDetailModal
        isOpen={Boolean(selectedProjectDetail)}
        onClose={() => setSelectedProjectDetail(null)}
        project={selectedProjectDetail}
        className="pf-profile-detail-viewport"
      />
    </div>
  </div>;
}