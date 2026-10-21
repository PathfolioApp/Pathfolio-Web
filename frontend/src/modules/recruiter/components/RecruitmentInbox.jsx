import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarRange, MessageSquare, Send, Sparkles, Users, Building2,
  CheckCircle2, XCircle, CalendarClock, ArrowLeft, TrendingUp, Award, Milestone, Eye
} from 'lucide-react';
import { apiUrl, apiHeaders } from '../../../app/services/apiClient.js';
import { recruiterRecruitmentApi } from '../recruitmentApi';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/Badge';
import { Empty } from '../../admin/utils/adminHelpers';
import {
  EngagementStatusBadge, AiUnavailable, formatDateTime, formatDate
} from '../../admin/components/RecruitmentUI';
import './RecruitmentInbox.css';

/**
 * Hiring history snapshot: how this company's relationship with the campus has
 * gone (hires per year, drives, sentiment). First visit? Falls back to
 * supply-side stats so the page is still useful.
 */
function HistoryBanner() {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/recruiter/recruitment/history'), { credentials: 'include', headers: apiHeaders() })
      .then(response => response.json())
      .then(data => setHistory(data.history || null))
      .catch(() => setHistory(null));
  }, []);

  if (!history || history.available === false) return null;
  const isPositive = history.sentiment === 'positive';

  return (
    <div className={`pf-rec-history ${isPositive ? 'pf-rec-history--positive' : ''}`}>
      <div className="pf-rec-history__head">
        <span className="pf-rec-history__sentiment">
          {isPositive ? <TrendingUp size={15} /> : <Milestone size={15} />}
          {history.sentimentLabel}
        </span>
        <span className="pf-rec-history__company">
          <Building2 size={13} /> {history.company.name} · your history with this campus
        </span>
      </div>

      <div className="pf-rec-history__stats">
        <div className="pf-rec-history__stat"><b>{history.totalHires}</b><span>students hired</span></div>
        {history.hiresByYear.slice(0, 3).map(({ year, hires }) => (
          <div className="pf-rec-history__stat" key={year}><b>{hires}</b><span>hired in {year}</span></div>
        ))}
        <div className="pf-rec-history__stat"><b>{history.drivesCompleted}</b><span>drives completed</span></div>
        <div className="pf-rec-history__stat"><b>{history.jobPosts}</b><span>roles posted</span></div>
        <div className="pf-rec-history__stat"><b>{history.candidatesShared}</b><span>candidates shared with you</span></div>
      </div>

      {history.firstVisit ? (
        <div className="pf-rec-history__first">
          <p>{history.firstVisit.note}</p>
          <div className="pf-rec-history__first-stats">
            <span><b>{history.firstVisit.placementReady}</b> placement-ready students</span>
            {history.firstVisit.avgCgpa && <span>avg CGPA <b>{history.firstVisit.avgCgpa}</b></span>}
            {history.firstVisit.topSkills.slice(0, 5).map(({ skill, count }) => (
              <span key={skill}>{skill}: <b>{count}</b></span>
            ))}
          </div>
        </div>
      ) : history.recentDrives?.length > 0 && (
        <div className="pf-rec-history__drives">
          {history.recentDrives.map(drive => (
            <span key={drive.id} className="pf-rec-history__drive">
              {drive.year || ''} {drive.title} - {drive.statusLabel}{drive.outcome ? ` (${drive.outcome})` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Company-side recruitment surface: respond to proposals, negotiate dates,
 * keep the conversation in-platform, review shared candidates and record
 * feedback. Follows the existing recruiter portal look (pf-recruiter-*).
 */
export function RecruitmentInbox() {
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    recruiterRecruitmentApi.engagements()
      .then(data => setEngagements(data.engagements || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <section className="pf-recruiter-results"><p className="pf-recruiter-loading">Loading recruitment proposals…</p></section>;
  if (openId) return <EngagementConversation engagementId={openId} onClose={() => { setOpenId(null); window.scrollTo({ top: 0, behavior: 'instant' }); }} />;

  return (
    <section className="pf-recruiter-results">
      <HistoryBanner />
      <p className="pf-recruiter-overview-note">
        Recruitment proposals from the university placement team. Dates shown are provisional until you accept them.
      </p>
      {error && <div className="pf-recruiter-error" role="alert">{error}</div>}
      {engagements.length === 0 && (
        <EmptyState
          icon={CalendarRange}
          title="No recruitment proposals yet"
          text="When the placement team proposes a recruitment drive with your company, it will appear here for you to respond."
        />
      )}
      {engagements.map(engagement => (
        <EngagementCard key={engagement.id} engagement={engagement} onOpen={() => { setOpenId(engagement.id); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
      ))}
    </section>
  );
}

function EngagementCard({ engagement, onOpen }) {
  return (
    <article className="pf-shared-card">
      <button type="button" className="pf-shared-card__header" onClick={onOpen}>
        <div>
          <div className="pf-shared-card__badges">
            <EngagementStatusBadge status={engagement.status} label={engagement.statusLabel} />
            {engagement.provisional && ['proposed', 'reschedule_requested'].includes(engagement.status) && <StatusBadge status="draft" label="dates provisional" />}
          </div>
          <h3>{engagement.title}</h3>
          <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: 'var(--text-muted)' }}>
            Proposed window: {formatDate(engagement.proposedStart)} – {formatDate(engagement.proposedEnd)}
            {engagement.roles?.length ? ` · roles: ${engagement.roles.join(', ')}` : ''}
            {' · '}{engagement.messageCount} message(s)
          </p>
        </div>
      </button>
    </article>
  );
}

function EngagementConversation({ engagementId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await recruiterRecruitmentApi.engagement(engagementId);
      setDetail(data);
      setRescheduleStart(data.engagement.proposedStart ? data.engagement.proposedStart.slice(0, 10) : '');
      setRescheduleEnd(data.engagement.proposedEnd ? data.engagement.proposedEnd.slice(0, 10) : '');
    } catch (err) { setError(err.message); }
  }, [engagementId]);

  useEffect(() => { load(); }, [load]);

  const send = async event => {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try { await recruiterRecruitmentApi.postMessage(engagementId, { body: draft }); setDraft(''); await load(); }
    catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  const respond = async (response, extra = {}) => {
    setBusy(true);
    try {
      await recruiterRecruitmentApi.respond(engagementId, { response, ...extra });
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try { const data = await recruiterRecruitmentApi.communicationSummary(engagementId); setSummary(data.summary); }
    catch { setSummary(null); }
    finally { setSummaryLoading(false); }
  };

  const engagement = detail?.engagement;
  return (
    <section className="pf-recruiter-results" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onClose}>All proposals</Button>
        {engagement && <EngagementStatusBadge status={engagement.status} label={engagement.statusLabel} />}
      </div>
      {error && <div className="pf-recruiter-error" role="alert">{error}</div>}
      {!detail && !error && <Empty text="Loading…" />}
      {detail && engagement && (
        <>
          <article className="pf-shared-card" style={{ marginTop: 10 }}>
            <div style={{ padding: '12px 16px' }}>
              <h3 style={{ margin: '0 0 4px' }}>{engagement.title}</h3>
              <p style={{ margin: 0, fontSize: '.82rem', color: 'var(--text-muted)' }}>
                Proposed: {formatDate(engagement.proposedStart)} – {formatDate(engagement.proposedEnd)}
                {engagement.confirmedStart && <> · Confirmed: <b>{formatDate(engagement.confirmedStart)} – {formatDate(engagement.confirmedEnd)}</b></>}
              </p>
              {engagement.roles?.length > 0 && <p style={{ margin: '4px 0 0', fontSize: '.82rem' }}>Roles: {engagement.roles.join(', ')}</p>}
              {engagement.proposalNote && <p style={{ margin: '6px 0 0', fontSize: '.84rem' }}>{engagement.proposalNote}</p>}

              {['proposed', 'under_discussion', 'reschedule_requested'].includes(engagement.status) && (
                <div className="pf-rec-respond">
                  <Button variant="primary" size="sm" icon={CheckCircle2} loading={busy} onClick={() => respond('accepted')}>Accept proposal</Button>
                  <Button variant="secondary" size="sm" icon={CalendarClock} loading={busy} onClick={() => respond('reschedule_requested', { proposedStart: rescheduleStart, proposedEnd: rescheduleEnd, message: `Company requested ${rescheduleStart} – ${rescheduleEnd}.` })}>
                    Request other dates
                  </Button>
                  <label>
                    Alternate start
                    <input type="date" value={rescheduleStart} onChange={event => setRescheduleStart(event.target.value)} />
                  </label>
                  <label>
                    Alternate end
                    <input type="date" value={rescheduleEnd} onChange={event => setRescheduleEnd(event.target.value)} />
                  </label>
                  <Button variant="ghost" size="sm" icon={XCircle} loading={busy} onClick={() => { if (window.confirm('Decline this recruitment proposal?')) respond('rejected'); }}>Decline</Button>
                </div>
              )}
            </div>
          </article>

          <div className="pf-rec-timeline">
            {detail.messages.map(message => (
              <div className="pf-rec-timeline__item" key={message.id}>
                <span className="pf-rec-timeline__date">{formatDateTime(message.createdAt)}</span>
                <div className="pf-rec-timeline__body">
                  <header>
                    <span className={`pf-rec-timeline__sender pf-rec-timeline__sender--${message.senderRole === 'university' ? 'university' : 'company'}`}>
                      {message.senderRole === 'university' ? 'Placement team' : 'You'}{message.senderName && message.senderRole === 'university' ? ` · ${message.senderName}` : ''}
                    </span>
                    {message.kind !== 'message' && <StatusBadge status="draft" label={message.kind.replace(/_/g, ' ')} />}
                  </header>
                  <div className="pf-rec-timeline__text">{message.body}</div>
                </div>
              </div>
            ))}
          </div>

          <form className="pf-rec-respond" onSubmit={send}>
            <label style={{ flex: 1, minWidth: 240 }}>
              Reply to the placement team
              <textarea rows={2} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Interested in SDE candidates… / requesting backend candidate resumes…" />
            </label>
            <Button type="submit" variant="primary" size="sm" icon={MessageSquare} loading={sending}>Send</Button>
          </form>

          {summary ? (
            <div className="pf-rec-ai-summary">
              <h4>AI summary</h4>
              <p>{summary.summary}</p>
              {summary.note && <AiUnavailable>{summary.note}</AiUnavailable>}
            </div>
          ) : (
            <Button variant="secondary" size="sm" icon={Sparkles} loading={summaryLoading} onClick={loadSummary}>Summarise conversation</Button>
          )}

          {detail.candidates.length > 0 && (
            <>
              <p className="pf-rec-why__title" style={{ marginTop: 14 }}>Candidates shared for this engagement</p>
              {detail.candidates.map(candidate => (
                <div className="pf-admin-list-item" key={candidate.shareId}>
                  <div>
                    <h3>{candidate.candidate.fullName || candidate.candidate.initials || 'Candidate'}</h3>
                    <p>{candidate.candidate.department || '-'} · access: {candidate.accessLevel} · status: {candidate.status}{candidate.companyResponse ? ` · your response: ${candidate.companyResponse.replace(/_/g, ' ')}` : ''}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
