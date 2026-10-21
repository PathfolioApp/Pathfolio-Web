import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, Building2, ChevronDown, Compass, ExternalLink, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { opportunitiesApi } from './opportunitiesApi';
import { applicationLabels, filterApplications } from './placementModel.mjs';
import { ApplicationJourney, placementDate } from './ApplicationJourney';

function CompanyMark({ logoUrl }) {
  const [failed, setFailed] = useState(false);
  return <div className={`pf-application-company-mark ${logoUrl && !failed ? 'has-logo' : ''}`}>
    {logoUrl && !failed ? <img src={logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Building2 size={21} />}
  </div>;
}

export function PlacementApplications({ studentId, jobs, onSelect, params, setParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const options = { query: params.get('applicationSearch') || '', status: params.get('applicationStatus') || '', sort: params.get('applicationSort') || 'applied' };
  const update = (key, value) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  const reset = () => setParams(previous => { const next = new URLSearchParams(previous); ['applicationSearch', 'applicationStatus', 'applicationSort'].forEach(key => next.delete(key)); return next; }, { replace: true });
  const discover = () => setParams(previous => { const next = new URLSearchParams(previous); next.delete('view'); next.delete('job'); next.delete('tab'); return next; });
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    opportunitiesApi.getMine(studentId).then(value => { if (alive) setData(value.applications || []); })
      .catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId, version]);
  const applications = filterApplications(data || [], options);
  const hasFilters = options.query || options.status;
  return <section className="pf-applications-view pf-applications-workspace" aria-label="My applications" aria-busy={loading}>
    <div className="pf-applications-intro"><div><p className="pf-placement-eyebrow">Every move, in one place</p><h2>Your applications.</h2><p>Follow your submissions from your first step to the next update.</p></div><Button variant="outline" icon={RefreshCw} disabled={loading} onClick={() => setVersion(v => v + 1)}>{loading ? 'Checking…' : 'Refresh status'}</Button></div>
    {data && <div className="pf-application-metrics" aria-label="Filter by application status">
      {[['', 'All applications'], ['applied', 'Applied'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['selected', 'Selected']].map(([status, label]) => <button key={status} aria-pressed={options.status === status} onClick={() => update('applicationStatus', status)}><span>{label}</span><strong>{status ? data.filter(app => app.status === status).length : data.length}</strong><ArrowUpRight size={14} /></button>)}
    </div>}
    <div className="pf-application-controls"><label className="pf-placement-search"><Search size={17} /><span className="pf-placement-sr-only">Search applications</span><input type="search" value={options.query} placeholder="Search your roles or companies" onChange={e => update('applicationSearch', e.target.value)} /></label>
      <label className="pf-placement-field"><span><SlidersHorizontal size={12} />Status</span><select value={options.status} onChange={e => update('applicationStatus', e.target.value)}><option value="">All statuses</option>{Object.entries(applicationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="pf-placement-field">Sort by<select value={options.sort} onChange={e => update('applicationSort', e.target.value)}><option value="applied">Recently applied</option><option value="updated">Recently updated</option></select></label>
    </div>
    <div className="pf-placement-results"><p role="status">{loading && !data ? 'Loading your applications…' : `${applications.length} application${applications.length === 1 ? '' : 's'}${hasFilters ? ' matching your filters' : ' on record'}`}</p>{hasFilters && <Button variant="ghost" onClick={reset}>Clear filters</Button>}</div>
    {error && <div role="alert" className="pf-placement-empty"><h3>We couldn’t refresh your applications.</h3><p>{error}</p><Button onClick={() => setVersion(v => v + 1)}>Try again</Button></div>}
    {!data && loading && <div className="pf-application-skeletons" aria-hidden="true">{[0, 1].map(key => <div key={key} className="pf-opportunity-skeleton"><span /><i /><i /><div /></div>)}</div>}
    {data && !applications.length && <div className="pf-placement-empty pf-application-empty"><span className="pf-application-empty-icon">{data.length ? <Search size={26} /> : <BriefcaseBusiness size={26} />}</span><p className="pf-placement-eyebrow">{data.length ? 'A different view' : 'Room for your next move'}</p><h3>{data.length ? 'No applications match just yet.' : 'Your first application starts a story.'}</h3><p>{data.length ? 'Try another company, role, or status to find your submission.' : 'Discover campus opportunities and apply when you find a role that feels right.'}</p><Button icon={data.length ? Search : Compass} onClick={data.length ? reset : discover}>{data.length ? 'Reset filters' : 'Discover roles'}</Button></div>}
    <div className="pf-application-records">{applications.map(app => {
      const job = jobs.find(item => item.id === app.jobPostId);
      const logoUrl = app.job?.companyLogoUrl || job?.companyLogoUrl || '';
      return <article className="pf-application-record pf-application-dossier" key={app.id}>
        <div className="pf-application-dossier-top"><CompanyMark key={logoUrl} logoUrl={logoUrl} /><div><p className="pf-placement-eyebrow">{app.job?.companyName || 'Hiring partner'}</p><h3>{app.job?.title || 'Opportunity no longer listed'}</h3></div><span className={`pf-job-status-badge pf-job-status-badge--${app.status}`}>{applicationLabels[app.status] || app.status}</span></div>
        <dl className="pf-application-facts"><div><dt>Submitted</dt><dd>{placementDate(app.appliedAt)}</dd></div><div><dt>Last updated</dt><dd>{placementDate(app.updatedAt || app.appliedAt)}</dd></div>{app.job?.employmentType && <div><dt>Role type</dt><dd>{app.job.employmentType}</dd></div>}</dl>
        <div className="pf-application-record-actions"><details><summary>Application journey <ChevronDown size={15} /></summary><ApplicationJourney application={app} compact /></details>{job && <Button variant="outline" icon={ArrowUpRight} iconPosition="right" onClick={() => onSelect(job)}>View role</Button>}</div>
        {!job && <p className="pf-placement-notice">This role is no longer listed. Your saved application and recorded updates remain available here.</p>}
      </article>;
    })}</div>
    <aside className="pf-application-external-note"><ExternalLink size={16} /><p><strong>Applied on a company website?</strong> Those applications are managed by the company and won’t appear in this campus tracker.</p></aside>
  </section>;
}
