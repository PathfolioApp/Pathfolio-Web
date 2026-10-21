import React, { useEffect, useState, useId } from 'react';
import { Building2, MapPin, ArrowUpRight, Search, RefreshCw, BriefcaseBusiness, Compass, ArrowRight, CheckCircle2, SlidersHorizontal, Wallet, Clock, ChevronDown } from 'lucide-react';
import { PlacementApplications } from './PlacementApplications';
import { Button } from '../../../components/ui/Button';
import { filterOpportunities, opportunityState, isClosed, compensationLabel } from './placementModel.mjs';

const dateLabel = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '';

function OpportunityCard({ job, student, now, onSelect }) {
  const state = opportunityState(job, student, now);
  const pay = compensationLabel(job);
  return <button type="button" className="pf-job-card pf-opportunity-card" onClick={() => onSelect(job)}>
    <div className="pf-job-card-header">
      <div className="pf-job-card-company">
        {job.companyLogoUrl ? <img className="pf-job-company-logo" src={job.companyLogoUrl} alt="" loading="lazy" /> : <div className="pf-job-company-logo pf-placement-logo"><Building2 size={23} /></div>}
        <div className="pf-opportunity-company"><strong>{job.companyName || 'Hiring partner'}</strong>{job.createdAt && <span>Posted {dateLabel(job.createdAt)}</span>}</div>
      </div>
      <span className="pf-opportunity-arrow" aria-hidden="true"><ArrowUpRight size={20} /></span>
    </div>
    <div className="pf-opportunity-body">
      <span className="pf-opportunity-type">{job.employmentType || 'Role type not specified'}</span>
      <h2>{job.title}</h2>
      <p className="pf-opportunity-location"><MapPin size={14} />{job.location || 'Location not specified'}{job.workMode ? ' · ' + job.workMode : ''}</p>
      <div className="pf-opportunity-pay"><Wallet size={17} /><div><span>Compensation</span><strong>{pay || 'Not specified'}</strong></div></div>
      <div className="pf-placement-skills">{(job.requiredSkills || []).slice(0, 3).map(skill => <span key={skill} className="pf-job-skill-chip">{skill}</span>)}{job.requiredSkills?.length > 3 && <span className="pf-job-skill-chip">+{job.requiredSkills.length - 3}</span>}</div>
    </div>
    <div className="pf-opportunity-footer">
      <span className={`pf-job-status-badge pf-job-status-badge--${state.tone}`}>{state.key === 'eligible' && <CheckCircle2 size={13} />}{state.label}</span>
      <span className="pf-opportunity-deadline">{job.applicationDeadline ? <><Clock size={13} />{isClosed(job, now) ? 'Closed ' : 'Closes '}{dateLabel(job.applicationDeadline)}</> : <><ArrowRight size={14} />View role</>}</span>
    </div>
  </button>;
}

function OpportunitySkeletons() {
  return <div className="pf-placement-list pf-placement-skeletons" aria-hidden="true">{[0, 1, 2, 3].map(key => <div className="pf-opportunity-skeleton" key={key}><span /><i /><i /><div /><i /></div>)}</div>;
}


export function PlacementBrowse({ student, jobs, loading, error, onRefresh, onSelect, params, setParams }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const view = params.get('view') === 'applications' ? 'applications' : 'opportunities';
  const options = { query: params.get('q') || '', status: params.get('status') || '', mode: params.get('mode') || '', role: params.get('role') || '', sort: params.get('sort') || 'newest' };
  const update = (key, value, replace = true) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); next.delete('job'); next.delete('tab'); return next; }, { replace });
  // Refresh expiry labels while this view remains open; the server checks again at submission.
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const results = filterOpportunities(jobs, options, student, now);
  const activeFilters = [options.status, options.mode, options.role, options.sort !== 'newest'].filter(Boolean).length;
  const hasFilters = options.query || activeFilters > 0;
  const openRoles = jobs.filter(job => !['closed', 'applied'].includes(opportunityState(job, student, now).key));
  const eligibleRoles = openRoles.filter(job => opportunityState(job, student, now).key === 'eligible');
  return <main className="pf-placement-page pf-placement-browse">
    <header className={`pf-placement-header pf-placement-masthead ${view === 'applications' ? 'is-applications' : ''}`}>
      <div className="pf-placement-heading"><p className="pf-placement-eyebrow"><span />CAREERS & OPPORTUNITIES</p><h1>{view === 'applications' ? <>Your next move,<br /><em>in motion.</em></> : <>Your next chapter<br /><em>starts here.</em></>}</h1><p className="pf-placement-intro">{view === 'applications' ? 'Your campus applications, their latest updates, and the road ahead.' : <>Discover a role that fits your ambitions.<br className="pf-placement-desktop-break" /> Keep your next move, and every application, in view.</>}</p></div>
      <div className="pf-placement-header-note"><div className="pf-placement-compass" aria-hidden="true"><Compass size={48} strokeWidth={1} /><span /><span /></div><p>A little direction.<br /><strong>A world of possibilities.</strong></p></div>
    </header>
    <div className="pf-placement-section-bar"><nav className="pf-placement-views" aria-label="Placement views"><button aria-current={view === 'opportunities' ? 'page' : undefined} onClick={() => update('view', '', false)}><Compass size={16} />Discover roles</button><button aria-current={view === 'applications' ? 'page' : undefined} onClick={() => update('view', 'applications', false)}><BriefcaseBusiness size={16} />My applications</button></nav><span className="pf-placement-campus-label"><span />Campus opportunities</span></div>
    {!loading && !error && params.get('job') && !jobs.some(job => job.id === params.get('job')) && <p role="status" className="pf-placement-notice">This opportunity is no longer listed. You can still find any campus submission in My applications.</p>}
    {view === 'applications' ? <PlacementApplications key={student.id} studentId={student.id} jobs={jobs} onSelect={onSelect} params={params} setParams={setParams} /> : <section className="pf-placement-container" aria-label="Find opportunities">
      {!error && <div className="pf-placement-discovery-summary"><span><strong>{loading && !jobs.length ? '…' : openRoles.length}</strong> open to explore</span><button aria-pressed={options.status === 'eligible'} onClick={() => update('status', options.status === 'eligible' ? '' : 'eligible')}><CheckCircle2 size={15} /><strong>{loading && !jobs.length ? '…' : eligibleRoles.length}</strong> eligible for you <ArrowUpRight size={14} /></button></div>}
      <div className="pf-placement-tools"><div className="pf-placement-tools-title"><SlidersHorizontal size={15} /><span>Find your fit</span><small>Search by what matters to you</small></div><label className="pf-placement-search"><Search size={18} /><span className="pf-placement-sr-only">Search opportunities</span><input type="search" placeholder="Role, company, skill or location" value={options.query} onChange={e => update('q', e.target.value)} /></label>
        <button type="button" className="pf-placement-filter-toggle" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16} />Filters & sort{activeFilters > 0 && <span> · {activeFilters} active</span>}<ChevronDown size={16} /></button>
        <div id={filtersId} className="pf-placement-filters" data-open={filtersOpen}><label className="pf-placement-field">Eligibility<select value={options.status} onChange={e => update('status', e.target.value)}><option value="">All opportunities</option><option value="eligible">Eligible</option><option value="missing">Profile details missing</option><option value="ineligible">Doesn’t meet criteria</option><option value="closed">Closed</option><option value="applied">Applied</option></select></label>
          {[['mode', 'Work mode', 'workMode'], ['role', 'Role type', 'employmentType']].map(([key, label, field]) => <label className="pf-placement-field" key={key}>{label}<select value={options[key]} onChange={e => update(key, e.target.value)}><option value="">All</option>{[...new Set(jobs.map(job => job[field]).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label>)}
          <label className="pf-placement-field">Sort by<select value={options.sort} onChange={e => update('sort', e.target.value)}><option value="newest">Newest first</option><option value="deadline">Application deadline</option></select></label></div>
      </div>
      <div className="pf-placement-results"><p role="status">{loading ? 'Loading opportunities…' : `${results.length} opportunit${results.length === 1 ? 'y' : 'ies'}${hasFilters ? ' matching your filters' : ''}`}</p><div>{hasFilters && <Button variant="ghost" onClick={() => setParams({})}>Clear filters</Button>}<Button variant="outline" icon={RefreshCw} disabled={loading} onClick={() => onRefresh()}>Refresh</Button></div></div>
      {error && <div role="alert" className="pf-placement-empty"><p>{error}</p><Button onClick={() => onRefresh()}>Try again</Button></div>}
      {!loading && !error && !results.length && <div className="pf-placement-empty"><BriefcaseBusiness /><h3>{jobs.length ? 'No matching opportunities' : 'New opportunities will appear here'}</h3><p>{jobs.length ? 'Try a different search or clear your filters.' : 'Check back for roles shared by your placement team.'}</p></div>}
      {loading && !jobs.length ? <OpportunitySkeletons /> : <div className="pf-placement-list" aria-busy={loading}>{results.map(job => <OpportunityCard key={job.id} job={job} student={student} now={now} onSelect={onSelect} />)}</div>}
    </section>}
  </main>;
}
