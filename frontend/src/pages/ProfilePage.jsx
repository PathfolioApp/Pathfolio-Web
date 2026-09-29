import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, ShieldCheck, Award, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileCompleteness } from '../utils/profileCompleteness';
import { resumeApi } from '../services/resumeApi';
import './ProfilePages.css';
import './ProfileEligibility.css';

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
      <section className="pf-profile-wide">
        <div className="pf-title-row">
          <h2>Resumes</h2>
          <Link to="/resume">Manage resumes</Link>
        </div>
        {loadingResumes ? (
          <p className="pf-empty">Loading resume information...</p>
        ) : defaultResume ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileText size={22} style={{ color: 'var(--color-primary)' }} />
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--color-text)' }}>{defaultResume.filename}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--color-text-light)', marginTop: '0.2rem' }}>
                  <span>PDF Document</span>
                  <span>·</span>
                  <span>{defaultResume.isDefault ? 'Primary Resume' : 'Active Resume'}</span>
                  {defaultResume.tags && defaultResume.tags.length > 0 && (
                    <>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        {defaultResume.tags.map(t => (
                          <span key={t} style={{ background: 'rgba(41, 74, 49, 0.08)', color: 'var(--color-primary)', padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {t}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a
                href={defaultResume.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pf-profile-edit"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                Preview
              </a>
              <Link
                to="/resume"
                className="pf-profile-edit"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                All resumes ({resumes.length})
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <p className="pf-empty" style={{ margin: 0 }}>You haven't uploaded a resume yet.</p>
            <Link to="/resume" className="pf-profile-edit" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              Upload resume
            </Link>
          </div>
        )}
      </section>
      <section><h2>Personal information</h2><dl><dt>Full name</dt><dd>{personal.fullName}</dd><dt>Age</dt><dd>{personal.age}</dd><dt>Institutional email</dt><dd>{personal.email}</dd><dt>Username</dt><dd>@{personal.username}</dd></dl></section>
      <section><h2>Academic identity</h2><dl><dt>Roll number</dt><dd>{academic.rollNumber}</dd><dt>Department</dt><dd>{academic.department}</dd><dt>Batch year</dt><dd>{academic.batchYear}</dd><dt>Degree / program</dt><dd>{displayValue(academic.degreeProgram)}</dd><dt>Graduation year</dt><dd>{displayValue(academic.graduationYear)}</dd></dl></section>
      <section className="pf-profile-wide pf-eligibility-card"><div className="pf-title-row"><h2>Academic eligibility</h2><Link to="/profile/edit">Complete eligibility</Link></div><div className="pf-eligibility-grid"><div><dt>Current semester</dt><dd>{displayValue(academic.currentSemester)}</dd></div><div><dt>CGPA</dt><dd>{displayValue(academic.cgpa)}</dd></div><div><dt>10th percentage</dt><dd>{displayValue(academic.tenthPercentage)}</dd></div><div><dt>12th percentage</dt><dd>{displayValue(academic.twelfthPercentage)}</dd></div><div><dt>Active backlogs</dt><dd>{displayValue(academic.activeBacklogs)}</dd></div><div><dt>Historical backlogs</dt><dd>{displayValue(academic.historicalBacklogs)}</dd></div><div><dt>Gap years</dt><dd>{displayValue(academic.gapYears)}</dd></div></div></section>
      <section><h2>Hobbies</h2><Tags values={student.interests.hobbies} empty="Your interests will appear here as you add them." /></section>
      <section><h2>Passions & interests</h2><Tags values={student.interests.passions} empty="Your interests will appear here as you add them." /></section>
      <section className="pf-profile-wide"><div className="pf-title-row"><h2>Achievements</h2><Link to="/profile/edit#achievements">Add achievement</Link></div>{student.achievements?.length ? <div className="pf-achievement-list">{student.achievements.map(achievement => <article key={achievement.id}><Award size={18} /><div><strong>{achievement.title}</strong><small>{achievement.category || 'General'}{achievement.year ? ` · Completed ${achievement.year}` : ''}</small>{achievement.description && <p>{achievement.description}</p>}</div></article>)}</div> : <p className="pf-empty">You haven't added any achievements yet.</p>}</section>
      <section className="pf-profile-wide pf-sensitive"><div className="pf-title-row"><h2><ShieldCheck size={18} /> Personal context</h2><Link to="/profile/settings">Privacy controls</Link></div>{family?.details && family.consentGiven ? <p>{family.details}</p> : <p className="pf-empty">This section is optional and can be completed whenever you’re comfortable.</p>}</section>
    </div>
  </div>;
}