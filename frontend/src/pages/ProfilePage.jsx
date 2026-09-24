import React from 'react';
import { Link } from 'react-router-dom';
import { Edit3, ShieldCheck, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileCompleteness } from '../utils/profileCompleteness';
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

  return <div className="pf-profile-page">
    <section className="pf-profile-hero">
      <div className="pf-profile-avatar">{personal.fullName.split(' ').map(value => value[0]).join('').slice(0, 2)}</div>
      <div><p className="editorial-eyebrow">Your profile</p><h1>{personal.fullName}</h1><p>@{personal.username} · {academic.department} · {academic.batchYear}</p></div>
      <div className="pf-profile-completeness"><strong>{percent}%</strong><span>profile complete</span></div>
      <Link className="pf-profile-edit" to="/profile/edit"><Edit3 size={17} /> Edit profile</Link>
    </section>
    <p className="pf-profile-intro">Everything you’ve shared so far, in one place.</p>
    <div className="pf-profile-grid">
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