import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, MessageSquare, Users, FileText, History, BarChart3,
  BriefcaseBusiness, Send, Sparkles, CalendarRange
} from 'lucide-react';
import { adminApi } from '../adminApi';
import { recruitmentApi } from '../recruitmentApi';
import { Button } from '../../../components/ui/Button';
import { AdminModal as Modal } from './AdminDialogs';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/Badge';
import { Empty } from '../utils/adminHelpers';
import {
  EngagementStatusBadge, ScoreBreakdown, ScoreChip, RecommendationBadge,
  AiLabel, AiUnavailable, formatDate, formatDateTime
} from './RecruitmentUI';

/**
 * Company Relationship page - one company, the complete story.
 * Sub-tabs: Overview / Recruitment / Communication / Roles / Candidates /
 * Resumes / History / Analytics (requirement #18). Data comes from the
 * EXISTING admin content endpoints (jobs, applications, shares) plus the new
 * recruitment endpoints - nothing duplicated.
 */
export function CompanyRelationshipPage({ companyId, onBack }) {
  const [tab, setTab] = useState('overview');
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [shares, setShares] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [detail, setDetail] = useState(null); // open engagement detail
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [companyData, jobData, appData, shareData, engagementData, recData] = await Promise.all([
          adminApi.companies(),
          adminApi.jobPosts(),
          adminApi.applications(),
          adminApi.shares(),
          recruitmentApi.engagements(),
          recruitmentApi.recommendations().catch(() => ({ recommendations: [] }))
        ]);
        if (cancelled) return;
        const found = (companyData.companies || []).find(item => item.id === companyId);
        setCompany(found || null);
        setJobs((jobData.jobPosts || []).filter(job => job.companyId === companyId));
        const jobIds = new Set((jobData.jobPosts || []).filter(job => job.companyId === companyId).map(job => job.id));
        setApplications((appData.applications || []).filter(application => jobIds.has(application.jobPostId)));
        // Legacy recruiter shares for this company's recruiters via job linkage.
        setShares((shareData.shares || []).filter(share => share.jobTitle && (share.companyName || '').toLowerCase() === (found?.name || '').toLowerCase()));
        setEngagements((engagementData.engagements || []).filter(engagement => engagement.companyId === companyId));
        setRecommendation((recData.recommendations || []).find(item => item.company.id === companyId) || null);
      } catch (err) { if (!cancelled) setError(err.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading) return <div className="pf-admin-list"><Empty text="Loading company relationship…" /></div>;
  if (error) return <div className="pf-admin-list"><div className="pf-admin-error" role="alert">{error}</div></div>;
  if (!company) return <div className="pf-admin-list"><EmptyState icon={Building2} title="Company not found" /></div>;

  const publishedJobs = jobs.filter(job => job.status === 'published');
  const hiredCount = applications.filter(application => ['selected'].includes(application.status)).length;

  return (
    <div className="pf-admin-single">
      <div className="pf-rec-company-card__head">
        <div className="pf-rec-company-card__title">
          {company.logoUrl
            ? <img src={company.logoUrl} alt="" className="pf-admin-company-logo" style={{ width: 44, height: 44 }} />
            : <span className="pf-admin-company-logo-fallback" style={{ width: 44, height: 44 }}><Building2 size={18} /></span>}
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 500 }}>{company.name}</h2>
            <p className="pf-rec-company-card__meta">
              {company.website && <a href={company.website} target="_blank" rel="noreferrer">{company.website}</a>}
              {company.website && ' · '}{jobs.length} job post(s) · {engagements.length} engagement(s)
              {recommendation && <> · priority <b>{recommendation.score}/100</b></>}
            </p>
          </div>
        </div>
        <div className="pf-rec-company-card__actions">
          <Button variant="ghost" size="sm" onClick={onBack}>Back to companies</Button>
        </div>
      </div>

      <div className="pf-rec-subnav" role="tablist">
        {[
          ['overview', 'Overview'], ['recruitment', 'Recruitment'], ['communication', 'Communication'],
          ['roles', 'Roles'], ['candidates', 'Candidates'], ['resumes', 'Resumes'], ['history', 'History'], ['analytics', 'Analytics']
        ].map(([id, label]) => <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === 'overview' && (
        <div className="pf-admin-list">
          <Panel title="Relationship overview" />
          <div className="pf-rec-facts">
            <div className="pf-rec-fact"><b>{jobs.length}</b><span>Job posts</span></div>
            <div className="pf-rec-fact"><b>{publishedJobs.length}</b><span>Published roles</span></div>
            <div className="pf-rec-fact"><b>{applications.length}</b><span>Student applications</span></div>
            <div className="pf-rec-fact"><b>{hiredCount}</b><span>Selected / hired</span></div>
            <div className="pf-rec-fact"><b>{engagements.length}</b><span>Recruitment engagements</span></div>
            <div className="pf-rec-fact"><b>{shares.length}</b><span>Candidate shares</span></div>
          </div>
          {company.description && <p className="pf-rec-company-card__meta">{company.description}</p>}
          {recommendation && (
            <div className="pf-rec-why">
              <p className="pf-rec-why__title">Current AI priority: <RecommendationBadge recommendation={recommendation.recommendation} label={recommendation.recommendationLabel} /> <ScoreChip score={recommendation.score} /></p>
              <ScoreBreakdown factors={recommendation.factors} compact />
            </div>
          )}
        </div>
      )}

      {tab === 'recruitment' && (
        <div className="pf-admin-list">
          <Panel title="Recruitment engagements & drives" />
          {engagements.length === 0 ? <EmptyState icon={CalendarRange} title="No engagements yet" text="Use Ready for recruitment on the recommendations page to start one." /> : (
            engagements.map(engagement => (
              <article className="pf-admin-list-item" key={engagement.id}>
                <div>
                  <div className="pf-admin-user-badges">
                    <EngagementStatusBadge status={engagement.status} label={engagement.statusLabel} />
                    {engagement.provisional && engagement.status === 'proposed' && <StatusBadge status="draft" label="dates provisional" />}
                  </div>
                  <h3>{engagement.title}</h3>
                  <p>
                    proposed {formatDate(engagement.proposedStart)} – {formatDate(engagement.proposedEnd)}
                    {engagement.confirmedStart && <> · confirmed {formatDate(engagement.confirmedStart)} – {formatDate(engagement.confirmedEnd)}</>}
                    {' · '}{engagement.messageCount} messages · {engagement.sharedCount} shared
                  </p>
                </div>
                <div className="pf-admin-item-actions">
                  <Button variant="secondary" size="sm" onClick={() => setDetail(engagement.id)}>Open</Button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {tab === 'communication' && (
        <EngagementCommunicationPicker engagements={engagements} />
      )}

      {tab === 'roles' && (
        <div className="pf-admin-list">
          <Panel title="Roles this company hires for" />
          {jobs.length === 0 ? <Empty text="No job posts on record." /> : jobs.map(job => (
            <article className="pf-admin-list-item" key={job.id}>
              <div>
                <div className="pf-admin-user-badges"><StatusBadge status={job.status} /></div>
                <h3>{job.title}</h3>
                <p>{job.location || '-'} · {job.employmentType || '-'}{(job.requiredSkills || []).length ? ` · ${job.requiredSkills.slice(0, 6).join(', ')}` : ''}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'candidates' && (
        <div className="pf-admin-list">
          <Panel title="Candidates shared with this company" />
          {shares.length === 0 ? <Empty text="No recruiter shares addressed to this company yet." /> : shares.map(share => (
            <article className="pf-admin-list-item" key={share.id}>
              <div>
                <div className="pf-admin-user-badges"><StatusBadge status={share.status} /></div>
                <h3>{share.jobTitle}</h3>
                <p>{share.studentCount} student(s) · shared {formatDateTime(share.createdAt)}</p>
              </div>
            </article>
          ))}
          <p className="pf-admin-help">Per-candidate shares with access levels live inside each recruitment engagement (Recruitment tab).</p>
        </div>
      )}

      {tab === 'resumes' && (
        <div className="pf-admin-list">
          <Panel title="Resume activity" />
          <Empty text="Resume recommendations and approvals are recorded per engagement - open an engagement to see which resume was recommended, approved and shared." />
        </div>
      )}

      {tab === 'history' && (
        <div className="pf-admin-list">
          <Panel title="Relationship history" />
          {engagements.length === 0 && jobs.length === 0 ? <Empty text="No history yet." /> : (
            <ul className="pf-rec-reasons">
              {engagements.map(engagement => (
                <li key={engagement.id}>
                  {formatDate(engagement.createdAt)} - engagement "{engagement.title}" ({engagement.statusLabel})
                </li>
              ))}
              {jobs.map(job => (
                <li key={job.id}>
                  {formatDate(job.createdAt || job.updatedAt)} - job post "{job.title}" ({job.status})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="pf-admin-list">
          <Panel title="Analytics" />
          <div className="pf-rec-facts">
            <div className="pf-rec-fact"><b>{publishedJobs.length ? Math.round(applications.length / publishedJobs.length) : 0}</b><span>Avg applications per published role</span></div>
            <div className="pf-rec-fact"><b>{applications.length ? `${Math.round((hiredCount / applications.length) * 100)}%` : '-'}</b><span>Application → selected rate</span></div>
            <div className="pf-rec-fact"><b>{engagements.filter(item => ['confirmed', 'completed'].includes(item.status)).length}</b><span>Confirmed/completed drives</span></div>
          </div>
          {recommendation && (
            <>
              <p className="pf-rec-why__title">Priority factors (current)</p>
              <ScoreBreakdown factors={recommendation.factors} />
            </>
          )}
        </div>
      )}

      {detail && <EngagementQuickView engagementId={detail} onClose={() => { setDetail(null); }} />}
    </div>
  );
}

function Panel({ title }) {
  return <p className="pf-rec-why__title" style={{ marginBottom: 10 }}>{title}</p>;
}

function EngagementCommunicationPicker({ engagements }) {
  const [selected, setSelected] = useState(null);
  useEffect(() => { if (engagements.length && !selected) setSelected(engagements[0].id); }, [engagements, selected]);
  if (!engagements.length) {
    return <div className="pf-admin-list"><EmptyState icon={MessageSquare} title="No communication yet" text="Communication lives inside each recruitment engagement." /></div>;
  }
  return (
    <div className="pf-admin-list">
      <Panel title="Communication timeline" />
      <div className="pf-admin-toolbar">
        <select className="pf-admin-filter" value={selected || ''} onChange={event => setSelected(event.target.value)} aria-label="Engagement">
          {engagements.map(engagement => <option key={engagement.id} value={engagement.id}>{engagement.title}</option>)}
        </select>
      </div>
      {selected && <CommunicationTimeline engagementId={selected} />}
    </div>
  );
}

export function CommunicationTimeline({ engagementId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    recruitmentApi.messages(engagementId)
      .then(data => setMessages(data.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [engagementId]);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try { const data = await recruitmentApi.communicationSummary(engagementId); setSummary(data.summary); }
    catch { setSummary(null); }
    finally { setSummaryLoading(false); }
  };

  if (loading) return <Empty text="Loading timeline…" />;
  return (
    <>
      {summary && (
        <div className="pf-rec-ai-summary">
          <h4>AI summary</h4>
          <p>{summary.summary}</p>
          {summary.note && <AiUnavailable>{summary.note}</AiUnavailable>}
        </div>
      )}
      <div className="pf-rec-timeline">
        {messages.map(message => (
          <div className="pf-rec-timeline__item" key={message.id}>
            <span className="pf-rec-timeline__date">{formatDateTime(message.createdAt)}</span>
            <div className="pf-rec-timeline__body">
              <header>
                <span className={`pf-rec-timeline__sender pf-rec-timeline__sender--${message.senderRole === 'university' ? 'university' : 'company'}`}>
                  {message.senderRole === 'university' ? 'TPO' : 'Company'}{message.senderName ? ` · ${message.senderName}` : ''}
                </span>
                {message.kind !== 'message' && <StatusBadge status="draft" label={message.kind.replace(/_/g, ' ')} />}
              </header>
              <div className="pf-rec-timeline__text">{message.body}</div>
            </div>
          </div>
        ))}
        {messages.length === 0 && <Empty text="No messages in this engagement yet." />}
      </div>
      {!summary && (
        <Button variant="secondary" size="sm" icon={Sparkles} loading={summaryLoading} onClick={loadSummary}>Summarise with AI</Button>
      )}
    </>
  );
}

/** Lightweight read-only engagement peek used by the relationship page. */
function EngagementQuickView({ engagementId, onClose }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => { recruitmentApi.engagement(engagementId).then(data => setDetail(data)).catch(() => setDetail(null)); }, [engagementId]);
  return (
    <Modal isOpen onClose={onClose} title={detail ? detail.engagement.title : 'Engagement'} maxWidth={720}>
      {detail && (
        <>
          <CommunicationTimeline engagementId={engagementId} />
          {detail.shares.length > 0 && (
            <>
              <p className="pf-rec-why__title" style={{ marginTop: 12 }}>Shared candidates</p>
              {detail.shares.map(share => (
                <div className="pf-admin-list-item" key={share.id}>
                  <div>
                    <h3>{share.studentName}</h3>
                    <p>access: {share.accessLevel} · {share.status}{share.companyResponse ? ` · company: ${share.companyResponse.replace(/_/g, ' ')}` : ''}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
