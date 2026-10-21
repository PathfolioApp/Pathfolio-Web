import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, BriefcaseBusiness, Check, CheckCircle2, Circle, FileText, FolderGit2, RefreshCw, User } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { profileApi } from '../profile/services/profileApi';
import { resumeApi } from '../resume/resumeApi';
import { opportunitiesApi } from '../placements/opportunitiesApi';
import { dashboardModel } from './utils/dashboardModel';
import './DashboardPage.css';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const actionIcons = { profile: User, project: FolderGit2, resume: FileText, placement: BriefcaseBusiness, story: BookOpen };

function ActionLink({ action, primary = false }) {
  const Icon = actionIcons[action.kind] || ArrowRight;
  return (
    <Link to={action.path} className={primary ? 'pf-dash-primary-link' : 'pf-dash-action'}>
      {primary ? <>{action.label}<ArrowRight size={17} aria-hidden="true" /></> : <>
        <span className="pf-dash-action__icon"><Icon size={20} aria-hidden="true" /></span>
        <span><strong>{action.title}</strong><small>{action.description}</small></span>
        <ArrowRight size={17} aria-hidden="true" />
      </>}
    </Link>
  );
}

export function DashboardPage() {
  const { student } = useAuth();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState({ owner: null, loading: true, profile: null, resumes: null, applications: null, errors: [], loadedAt: null });
  const lastRequested = useRef(0);
  const studentId = student?.id;

  useEffect(() => {
    if (!studentId) return undefined;
    let active = true;
    lastRequested.current = Date.now();
    setSnapshot({ owner: studentId, loading: true, profile: null, resumes: null, applications: null, errors: [], loadedAt: null });
    Promise.allSettled([
      profileApi.get().then(data => {
        if (!data.student || data.student.id !== studentId) throw new Error('Profile unavailable');
        return data.student;
      }),
      resumeApi.list().then(data => {
        if (!Array.isArray(data)) throw new Error('Resumes unavailable');
        return data;
      }),
      opportunitiesApi.getMine().then(data => {
        if (!Array.isArray(data.applications)) throw new Error('Applications unavailable');
        return data.applications;
      })
    ]).then(results => {
      if (!active) return;
      const [profile, resumes, applications] = results.map(result => result.status === 'fulfilled' ? result.value : null);
      const names = ['profile', 'resumes', 'applications'];
      setSnapshot({ owner: studentId, loading: false, profile, resumes, applications, errors: names.filter((_, index) => results[index].status === 'rejected'), loadedAt: new Date() });
    });
    return () => { active = false; };
  }, [studentId, revision]);

  // Also refresh after returning from another browser tab; avoid rapid focus requests.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastRequested.current > 30000) setRevision(value => value + 1);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (!student) return null;
  const current = snapshot.owner === studentId ? snapshot : { loading: true, profile: null, resumes: null, applications: null, errors: [], loadedAt: null };
  const record = current.profile || student;
  const model = dashboardModel(record, current.resumes, current.applications);
  const complete = model.percentage === 100;
  const RecommendationIcon = actionIcons[model.recommendation.kind] || User;
  const name = record.personal?.fullName?.trim().split(/\s+/)[0] || 'there';
  const selectedCount = current.applications?.filter(item => item.status === 'selected').length || 0;
  const records = [
    { label: 'Projects', count: model.counts.projects, icon: FolderGit2, path: '/profile/edit#projects', note: model.counts.projects ? 'Keep your work up to date' : 'Add something you have built' },
    { label: 'Experiences', count: model.counts.internships, icon: BriefcaseBusiness, path: '/profile/edit#internships', note: model.counts.internships ? 'Review your saved experience' : 'Add an internship or work experience' },
    { label: 'Milestones', count: model.counts.achievements, icon: Award, path: '/profile/edit#achievements', note: model.counts.achievements ? 'Celebrate your progress' : 'Add an achievement when ready' },
    { label: 'Resumes', count: model.counts.resumes, icon: FileText, path: '/resume', note: model.counts.resumes === null ? (current.loading ? 'Checking your resumes…' : 'Open resumes to try again') : model.counts.resumes ? 'Manage your saved versions' : 'Create or upload your first resume' }
  ];

  return (
    <div className="pf-student-dashboard">
      <header className="pf-dash-heading">
        <div><p className="editorial-eyebrow">Your workspace</p><h1>Welcome back, {name}.</h1><p>Your record, your next steps, and the updates that matter.</p></div>
      </header>
      <div className="pf-dash-sync">
        <span role="status" aria-live="polite">{current.loading ? 'Checking your latest saved information…' : current.errors.length ? `Could not refresh ${current.errors.join(', ')}. Last available profile details are shown; unavailable totals are labelled.` : `Updated at ${timeFormat.format(current.loadedAt)} IST.`}</span>
        <button type="button" className="pf-dash-refresh" aria-label={current.loading ? 'Refreshing dashboard' : 'Refresh dashboard'} title={current.loading ? 'Refreshing dashboard' : 'Refresh dashboard'} onClick={() => setRevision(value => value + 1)} disabled={current.loading}>
          <RefreshCw size={16} className={current.loading ? 'pf-dash-spinning' : ''} aria-hidden="true" />
        </button>
      </div>

      <section className="pf-dash-record" aria-labelledby="dashboard-record-title">
        <div className="pf-dash-section-heading"><div><p className="pf-dash-eyebrow">Journey overview</p><h2 id="dashboard-record-title">Your record so far</h2></div><Link to="/profile" className="pf-dash-text-link">View profile <ArrowRight size={15} aria-hidden="true" /></Link></div>
        <div className="pf-dash-record-grid">{records.map(({ label, count, icon: Icon, path, note }) => <Link to={path} key={label} className="pf-dash-card pf-dash-record-item"><div><Icon size={20} aria-hidden="true" /><span className={count === null ? "pf-dash-count-unknown" : undefined}>{count === null ? (current.loading ? '…' : 'Unavailable') : count}</span></div><h3>{label}</h3><p>{note}</p></Link>)}</div>
      </section>

      <section className="pf-dash-workspace" aria-label="Suggested action and profile checklist">
        <div className="pf-dash-suggestion">
          <span className="pf-dash-suggestion__icon" aria-hidden="true"><RecommendationIcon size={20} /></span>
          <div className="pf-dash-suggestion__copy">
            <p className="pf-dash-eyebrow">Suggested for you</p>
            <h2>{model.recommendation.title}</h2>
            <p>{model.recommendation.description}</p>
          </div>
          <ActionLink action={model.recommendation} primary />
        </div>
        <details className="pf-dash-checklist">
          <summary>
            <span className="pf-dash-checklist__title">{complete ? <CheckCircle2 size={17} aria-hidden="true" /> : <User size={17} aria-hidden="true" />}Profile checklist</span>
            <span className="pf-dash-checklist__status">{current.loading ? 'Checking details…' : <><strong>{model.percentage}%</strong> complete</>}</span>
            {!current.loading && <span className="pf-dash-checklist__meter" role="progressbar" aria-label="Profile details complete" aria-valuenow={model.percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${model.percentage}%` }} /></span>}
          </summary>
          <div className="pf-dash-checklist__body">
            <p>Review your saved details when it suits you. Optional information can stay blank. This checklist does not measure placement eligibility or career readiness.</p>
            <ul>{model.checklist.map(item => <li key={item.id}>{item.complete ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}<Link to={item.path}>{item.label}{item.optional && <small>Optional</small>}<span className="sr-only">{item.complete ? ', added' : ', not added'}</span></Link></li>)}</ul>
          </div>
        </details>
      </section>

      <div className="pf-dash-bottom-grid">
        <section className="pf-dash-card" aria-labelledby="dashboard-updates-title">
          <div className="pf-dash-section-heading"><div><p className="pf-dash-eyebrow">Latest saved updates</p><h2 id="dashboard-updates-title">From your record</h2></div><BookOpen size={20} aria-hidden="true" /></div>
          <p className="pf-dash-muted">Dated updates from your current profile, resumes, and applications.</p>
          {model.updates.length ? <ol className="pf-dash-updates">{model.updates.map(update => <li key={update.id}><span className="pf-dash-update-dot" aria-hidden="true" /><div><Link to={update.path}>{update.text}</Link><time dateTime={update.date}>{dateFormat.format(new Date(update.date))}</time></div></li>)}</ol> : <p className="pf-dash-empty">{current.loading ? 'Loading your saved updates…' : 'No dated updates yet. Your saved details still appear in your profile.'}</p>}
        </section>
        <div className="pf-dash-side-stack">
          <section className="pf-dash-card" aria-labelledby="dashboard-actions-title"><p className="pf-dash-eyebrow">Keep moving</p><h2 id="dashboard-actions-title">Make it yours</h2><div className="pf-dash-action-list">{model.actions.map(action => <ActionLink key={`${action.kind}-${action.path}`} action={action} />)}</div></section>
          <section className="pf-dash-card pf-dash-placement" aria-labelledby="dashboard-placement-title">
            <p className="pf-dash-eyebrow">Placement workspace</p><h2 id="dashboard-placement-title">Keep track of your applications</h2>
            {current.applications === null ? <p className="pf-dash-muted">{current.loading ? 'Checking your applications…' : 'Applications could not be loaded. Open placements to try again.'}</p> : current.applications.length ? <><div className="pf-dash-placement-stats"><span><strong>{current.applications.length}</strong>Applications</span><span><strong>{model.shortlisted}</strong>Shortlisted</span><span><strong>{model.interviews}</strong>In interview</span></div><p className="pf-dash-muted">{selectedCount ? `${selectedCount} ${selectedCount === 1 ? 'application' : 'applications'} marked selected. Check the details in placements.` : 'Review status updates and next steps from your placement team.'}</p></> : <p className="pf-dash-muted">No applications yet. Explore roles and check their eligibility requirements when you are ready.</p>}
            <Link to="/placement" className="pf-dash-text-link">Open placements <ArrowRight size={15} aria-hidden="true" /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}
