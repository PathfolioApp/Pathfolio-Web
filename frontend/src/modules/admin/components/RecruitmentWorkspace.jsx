import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Send, Sparkles, ThumbsUp, ThumbsDown, EyeOff, RefreshCw,
  CalendarRange, Users, MessageSquare, Target, FileText, X, ChevronDown, ChevronUp,
  ShieldAlert, ClipboardList, Wand2
} from 'lucide-react';
import { recruitmentApi } from '../recruitmentApi';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusBadge } from '../../../components/ui/Badge';
import { Input, PanelHeading, Empty } from '../utils/adminHelpers';
import {
  EngagementStatusBadge, RecommendationBadge, ScoreBreakdown, ScoreChip,
  AiLabel, AiUnavailable, PipelineTracker, formatDate, formatDateTime
} from './RecruitmentUI';
import './RecruitmentUI.css';
import './RecruitmentWorkspace.css';

const emptyProposal = { companyId: '', title: '', roles: '', proposedStart: '', proposedEnd: '', jobDescription: '', proposalNote: '', companyContact: '' };

/**
 * Recruitment Planning workspace.
 *
 * Tabs (progressive disclosure):
 *  - Recommendations: AI-ranked companies with explainable factors + accept/override/ignore.
 *  - Engagements: proposals & drives with provisional/confirmed dates, communication, matching.
 *  - Dashboard: recruitment intelligence metrics + pending actions.
 */
export function RecruitmentWorkspace({ companies }) {
  const [view, setView] = useState('recommendations');
  return (
    <section className="pf-admin-single">
      <div className="pf-rec-subnav" role="tablist" aria-label="Recruitment views">
        {[['recommendations', 'Recommendations'], ['engagements', 'Drives & proposals'], ['dashboard', 'Intelligence']].map(([id, label]) => (
          <button key={id} type="button" className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      {view === 'recommendations' && <RecommendationsView companies={companies} onEngagementCreated={() => setView('engagements')} />}
      {view === 'engagements' && <EngagementsView companies={companies} />}
      {view === 'dashboard' && <DashboardView />}
    </section>
  );
}

/* ------------------------------------------------------------ recommendations */

function RecommendationsView({ companies, onEngagementCreated }) {
  const [recommendations, setRecommendations] = useState([]);
  const [fromCache, setFromCache] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [proposalTarget, setProposalTarget] = useState(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const data = refresh ? await recruitmentApi.refreshRecommendations() : await recruitmentApi.recommendations();
      setRecommendations(data.recommendations || []);
      setFromCache(Boolean(data.fromCache));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const decide = async (recommendation, decision, reason = '') => {
    setDecisionBusy(true);
    setError('');
    try {
      await recruitmentApi.decideRecommendation(recommendation.recommendationId, decision, reason);
      setRecommendations(prev => prev.map(item => item.recommendationId === recommendation.recommendationId
        ? { ...item, decision, decisionReason: reason }
        : item));
      setOverrideTarget(null); setOverrideReason('');
    } catch (err) { setError(err.message); }
    finally { setDecisionBusy(false); }
  };

  return (
    <div className="pf-admin-list">
      <PanelHeading
        eyebrow="Recruitment planning"
        title="Companies recommended for outreach"
        action={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={refreshing} onClick={() => load(true)}>
            Refresh analysis
          </Button>
        }
      />
      <p className="pf-admin-help" style={{ margin: '0 0 12px' }}>
        Priority is computed from your real placement data - eligible students, past drives, communication history and timing.
        {fromCache ? ' Showing the stored analysis; refresh to recompute.' : ' Freshly computed.'} Every recommendation below is decision support: the placement team decides.
      </p>
      {error && <div className="pf-admin-error" role="alert">{error}</div>}
      {loading && <Empty text="Analysing companies…" />}
      {!loading && recommendations.length === 0 && (
        <EmptyState icon={Building2} title="No companies yet" text="Add companies first - they will be ranked here automatically." />
      )}
      {!loading && recommendations.map(recommendation => (
        <RecommendationCard
          key={recommendation.recommendationId || recommendation.company.id}
          recommendation={recommendation}
          expanded={expanded === recommendation.company.id}
          onToggle={() => setExpanded(expanded === recommendation.company.id ? null : recommendation.company.id)}
          onAccept={() => decide(recommendation, 'accepted')}
          onIgnore={() => decide(recommendation, 'ignored')}
          onOverride={() => { setOverrideTarget(recommendation); setOverrideReason(''); }}
          onStartOutreach={() => setProposalTarget(recommendation.company)}
          decisionBusy={decisionBusy}
        />
      ))}

      <Modal
        isOpen={Boolean(overrideTarget)}
        onClose={() => setOverrideTarget(null)}
        title="Override AI recommendation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={decisionBusy}
              disabled={overrideReason.trim().length < 3}
              onClick={() => decide(overrideTarget, 'overridden', overrideReason)}
            >
              Record override
            </Button>
          </>
        }
      >
        {overrideTarget && (
          <div>
            <p style={{ margin: '0 0 10px' }}>
              <b>{overrideTarget.company.name}</b> - AI recommendation: {overrideTarget.recommendationLabel} ({overrideTarget.score}/100).
            </p>
            <label>
              Reason for the override (stored as an audit event)
              <textarea
                rows={3}
                value={overrideReason}
                onChange={event => setOverrideReason(event.target.value)}
                placeholder="e.g. Company has not responded to previous outreach."
                style={{ width: '100%', marginTop: 4, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', font: 'inherit' }}
              />
            </label>
          </div>
        )}
      </Modal>

      {proposalTarget && (
        <ProposalDrawer
          open
          companies={companies}
          initialCompany={proposalTarget}
          onClose={() => setProposalTarget(null)}
          onCreated={() => { setProposalTarget(null); onEngagementCreated(); }}
        />
      )}
    </div>
  );
}

function RecommendationCard({ recommendation, expanded, onToggle, onAccept, onIgnore, onOverride, onStartOutreach, decisionBusy }) {
  const { company, score, factors, reasons, source, decision, derived } = recommendation;
  return (
    <article className="pf-rec-company-card">
      <div className="pf-rec-company-card__head">
        <div className="pf-rec-company-card__title">
          <ScoreChip score={score} />
          <div>
            <h3>{company.name}</h3>
            <p className="pf-rec-company-card__meta">
              <RecommendationBadge recommendation={recommendation.recommendation} label={recommendation.recommendationLabel} />
              {' · '}
              {derived?.eligibleStudents ?? '-'} eligible students · {derived?.strongMatches ?? '-'} strong matches
              {derived?.completedDrives ? ` · ${derived.completedDrives} previous drive(s)` : ' · no previous drives'}
            </p>
          </div>
        </div>
        <div className="pf-rec-company-card__actions">
          {decision && <StatusBadge status={decision === 'accepted' ? 'approved' : decision === 'overridden' ? 'rejected' : 'archived'} label={decision === 'accepted' ? 'Accepted by TPO' : decision === 'overridden' ? 'Overridden by TPO' : 'Ignored by TPO'} />}
          <Button variant="primary" size="sm" icon={Send} onClick={onStartOutreach}>Ready for recruitment</Button>
          <Button variant="secondary" size="sm" onClick={onAccept} loading={decisionBusy} icon={ThumbsUp}>Accept</Button>
          <Button variant="secondary" size="sm" onClick={onOverride} icon={ThumbsDown}>Override</Button>
          <Button variant="ghost" size="sm" onClick={onIgnore} icon={EyeOff}>Ignore</Button>
          <button type="button" className="pf-admin-icon-button" onClick={onToggle} aria-label={expanded ? 'Collapse why' : 'Expand why'}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <div className="pf-rec-why">
        <p className="pf-rec-why__title">Why {recommendation.recommendationLabel.toLowerCase()}</p>
        {reasons?.length ? (
          <ul className="pf-rec-reasons">
            {reasons.map((reason, index) => <li key={index}>{reason}</li>)}
          </ul>
        ) : <Empty text="No overriding factors - mid-range score across the board." />}
        {expanded && (
          <>
            <ScoreBreakdown factors={factors} />
            <p className="pf-rec-ai-label">
              <Sparkles size={13} /> Analysis source: {source === 'ai' ? 'AI-assisted (from your stored data)' : 'deterministic scoring of your stored data'}. Factors above are computed from real records - open the company page for the full history.
            </p>
          </>
        )}
      </div>
    </article>
  );
}

/* --------------------------------------------------------------- engagements */

function EngagementsView({ companies }) {
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await recruitmentApi.engagements(); setEngagements(data.engagements || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="pf-admin-list">
      <PanelHeading
        eyebrow="Recruitment engagements"
        title="Drives & proposals"
        action={<Button variant="primary" size="sm" icon={Send} onClick={() => setDrawerOpen(true)}>New proposal</Button>}
      />
      <p className="pf-admin-help" style={{ margin: '0 0 12px' }}>
        Proposed dates stay provisional until the company accepts them. Negotiation, confirmation and the whole communication trail live here.
      </p>
      {error && <div className="pf-admin-error" role="alert">{error}</div>}
      {loading && <Empty text="Loading engagements…" />}
      {!loading && engagements.length === 0 && (
        <EmptyState icon={CalendarRange} title="No recruitment engagements yet" text="Start one from a recommendation, or create a proposal directly." />
      )}
      {!loading && engagements.map(engagement => (
        <EngagementRow key={engagement.id} engagement={engagement} onOpen={() => setDetailId(engagement.id)} onChanged={load} />
      ))}

      <ProposalDrawer open={drawerOpen} companies={companies} onClose={() => setDrawerOpen(false)} onCreated={() => { setDrawerOpen(false); load(); }} />
      {detailId && (
        <EngagementDetailModal
          engagementId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function EngagementRow({ engagement, onOpen, onChanged }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await recruitmentApi.sendProposal(engagement.id); await onChanged(); }
    catch (err) { window.alert(err.message); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!window.confirm('Withdraw this proposal? The company will see it as cancelled.')) return;
    setBusy(true);
    try { await recruitmentApi.cancelEngagement(engagement.id); await onChanged(); }
    catch (err) { window.alert(err.message); }
    finally { setBusy(false); }
  };
  return (
    <article className="pf-admin-list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <div className="pf-rec-company-card__head" style={{ width: '100%' }}>
        <div className="pf-rec-company-card__title">
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 500 }}>{engagement.title}</h3>
            <p className="pf-rec-company-card__meta">
              <EngagementStatusBadge status={engagement.status} label={engagement.statusLabel} />
              {' · '}{engagement.companyName}
              {' · '}proposed {formatDate(engagement.proposedStart)} – {formatDate(engagement.proposedEnd)}
              {engagement.confirmedStart ? <> · <b>confirmed {formatDate(engagement.confirmedStart)} – {formatDate(engagement.confirmedEnd)}</b></> : null}
              {' · '}{engagement.messageCount} message(s) · {engagement.sharedCount} candidate(s) shared
            </p>
          </div>
        </div>
        <div className="pf-rec-company-card__actions">
          {engagement.status === 'proposed' && <Button variant="primary" size="sm" icon={Send} loading={busy} onClick={send}>Send proposal</Button>}
          <Button variant="secondary" size="sm" icon={ClipboardList} onClick={onOpen}>Open</Button>
          {['proposed', 'under_discussion', 'reschedule_requested'].includes(engagement.status) && (
            <Button variant="ghost" size="sm" icon={X} onClick={cancel}>Cancel</Button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ proposal drawer */

export function ProposalDrawer({ open, companies, initialCompany, onClose, onCreated }) {
  const [form, setForm] = useState({ ...emptyProposal, companyId: initialCompany?.id || '' });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (open) {
      setForm({ ...emptyProposal, companyId: initialCompany?.id || '' });
      setPreview(null);
      setError('');
    }
  }, [open, initialCompany]);

  const buildPreview = async () => {
    if (!form.companyId) { setError('Choose a company first.'); return; }
    setPreviewing(true); setError('');
    try {
      const payload = { ...form, roles: form.roles.split(',').map(item => item.trim()).filter(Boolean) };
      const data = await recruitmentApi.previewProposal(payload);
      setPreview(data.proposal);
    } catch (err) { setError(err.message); }
    finally { setPreviewing(false); }
  };

  const create = async event => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form, roles: form.roles.split(',').map(item => item.trim()).filter(Boolean) };
      await recruitmentApi.createProposal(payload);
      onCreated?.();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Drawer isOpen={open} onClose={onClose} title="New recruitment proposal" width={560}>
      <form className="pf-admin-form" onSubmit={create}>
        <label className="pf-admin-full-field">
          Company
          <select value={form.companyId} onChange={event => update('companyId', event.target.value)}>
            <option value="">Select a company…</option>
            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <label className="pf-admin-full-field">
          Proposal title
          <input value={form.title} onChange={event => update('title', event.target.value)} placeholder="e.g. Microsoft campus recruitment 2026" />
        </label>
        <label className="pf-admin-full-field">
          Suggested roles (comma separated)
          <input value={form.roles} onChange={event => update('roles', event.target.value)} placeholder="Software Development Engineer, Backend Engineer" />
        </label>
        <Input label="Proposed window start">
          <input type="date" value={form.proposedStart} onChange={event => update('proposedStart', event.target.value)} />
        </Input>
        <Input label="Proposed window end">
          <input type="date" value={form.proposedEnd} onChange={event => update('proposedEnd', event.target.value)} />
        </Input>
        <label className="pf-admin-full-field">
          Job description (optional now, analysed later for candidate matching)
          <textarea rows={4} value={form.jobDescription} onChange={event => update('jobDescription', event.target.value)} />
        </label>
        <label className="pf-admin-full-field">
          Note to the company
          <textarea rows={2} value={form.proposalNote} onChange={event => update('proposalNote', event.target.value)} />
        </label>
        <p className="pf-rec-form-hint">Proposed dates are provisional - the engagement is only confirmed when the company accepts.</p>
        <div className="pf-admin-full-field" style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="secondary" icon={Sparkles} loading={previewing} onClick={buildPreview}>Generate proposal preview</Button>
          <Button type="submit" variant="primary" icon={Send} loading={saving}>Create proposal</Button>
        </div>
        {error && <div className="pf-admin-error pf-admin-full-field" role="alert">{error}</div>}
      </form>

      {preview && (
        <div className="pf-rec-proposal" style={{ marginTop: 14 }}>
          <h3>{preview.company.name}</h3>
          <p>Pathfolio recommends initiating recruitment discussions.</p>
          <p>Eligible students: <b>{preview.eligibleStudents ?? '-'}</b></p>
          <p>Strong matches: <b>{preview.strongMatches ?? '-'}</b></p>
          {preview.priorityScore !== null && <p>Priority score: <b>{preview.priorityScore}/100</b> ({preview.recommendation})</p>}
          <p>Suggested roles: <b>{preview.roles.join(', ') || 'to be discussed'}</b></p>
          <p>Proposed recruitment window: <b>{formatDate(preview.proposedStart)} – {formatDate(preview.proposedEnd)}</b></p>
          <p>Status: <b>Provisional</b></p>
          <p className="pf-rec-provisional-note">This date is provisional. It becomes a confirmed recruitment date only when the company accepts.</p>
        </div>
      )}
    </Drawer>
  );
}

/* --------------------------------------------------------- engagement detail */

function EngagementDetailModal({ engagementId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [subView, setSubView] = useState('communication');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [matches, setMatches] = useState(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [bulkTailorSelected, setBulkTailorSelected] = useState(new Set());
  const [bulkTailoring, setBulkTailoring] = useState(false);
  const [bulkTailorResult, setBulkTailorResult] = useState(null);
  const [stages, setStages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await recruitmentApi.engagement(engagementId);
      setDetail(data);
    } catch (err) { setError(err.message); }
  }, [engagementId]);

  useEffect(() => { load(); recruitmentApi.pipeline().then(data => setStages(data.stages || [])).catch(() => {}); }, [load]);

  const sendMessage = async event => {
    event.preventDefault();
    if (!messageDraft.trim()) return;
    setSending(true);
    try {
      await recruitmentApi.postMessage(engagementId, { body: messageDraft });
      setMessageDraft('');
      await load();
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  const loadSummary = async () => {
    setSummaryLoading(true); setSubView('summary');
    try { const data = await recruitmentApi.communicationSummary(engagementId); setSummary(data.summary); }
    catch (err) { setError(err.message); }
    finally { setSummaryLoading(false); }
  };

  const loadMatches = async () => {
    setMatchesLoading(true); setMatchError(''); setSubView('matches');
    setBulkTailorSelected(new Set()); setBulkTailorResult(null);
    try {
      const data = await recruitmentApi.matches(engagementId);
      setMatches(data);
    } catch (err) { setMatchError(err.message); }
    finally { setMatchesLoading(false); }
  };

  const runBulkTailor = async () => {
    if (!bulkTailorSelected.size || !detail?.engagement) return;
    setBulkTailoring(true); setBulkTailorResult(null);
    try {
      const data = await recruitmentApi.tailorBulk({
        studentIds: [...bulkTailorSelected],
        jobTitle: (detail.engagement.roles || [])[0] || detail.engagement.title,
        company: detail.engagement.companyName,
        jobDescription: detail.engagement.jobDescription || matches?.analysis?.rawText || ''
      });
      setBulkTailorResult(data);
    } catch (err) { setMatchError(err.message); }
    finally { setBulkTailoring(false); }
  };

  const confirmRecruitment = async () => {
    if (!window.confirm('Confirm this recruitment with the current proposed window? The company will be notified.')) return;
    setStatusBusy(true);
    try {
      await recruitmentApi.setEngagementStatus(engagementId, { status: 'confirmed' });
      await load(); await onChanged();
    } catch (err) { window.alert(err.message); }
    finally { setStatusBusy(false); }
  };

  const acceptReschedule = async () => {
    const engagement = detail?.engagement;
    setStatusBusy(true);
    try {
      await recruitmentApi.setEngagementStatus(engagementId, { status: 'under_discussion', proposedStart: engagement.proposedStart, proposedEnd: engagement.proposedEnd, message: 'University accepted the requested window; awaiting final confirmation.' });
      await load(); await onChanged();
    } catch (err) { window.alert(err.message); }
    finally { setStatusBusy(false); }
  };

  const markCompleted = async outcome => {
    setStatusBusy(true);
    try {
      await recruitmentApi.setEngagementStatus(engagementId, { status: 'completed', finalOutcome: outcome });
      await load(); await onChanged();
    } catch (err) { window.alert(err.message); }
    finally { setStatusBusy(false); }
  };

  const engagement = detail?.engagement;
  return (
    <Modal isOpen onClose={onClose} title={engagement ? `${engagement.title} - ${engagement.companyName}` : 'Recruitment engagement'} maxWidth={860}>
      {!detail && !error && <Empty text="Loading…" />}
      {error && <div className="pf-admin-error" role="alert">{error}</div>}
      {detail && engagement && (
        <>
          <div className="pf-rec-facts">
            <div className="pf-rec-fact"><span>Status</span><b><EngagementStatusBadge status={engagement.status} label={engagement.statusLabel} /></b></div>
            <div className="pf-rec-fact"><span>Proposed window</span><b>{formatDate(engagement.proposedStart)} – {formatDate(engagement.proposedEnd)}</b></div>
            <div className="pf-rec-fact"><span>Confirmed window</span><b>{engagement.confirmedStart ? `${formatDate(engagement.confirmedStart)} – ${formatDate(engagement.confirmedEnd)}` : 'Not yet confirmed'}</b></div>
            <div className="pf-rec-fact"><span>Candidates shared</span><b>{detail.shares.length}</b></div>
          </div>
          {engagement.provisional && <p className="pf-rec-provisional-note" style={{ margin: '0 0 8px' }}>Dates are provisional until the company accepts. {['accepted'].includes(engagement.status) && 'The company has accepted - you can confirm now.'}</p>}
          {stages.length > 0 && <PipelineTracker stages={stages} currentStage={engagement.pipelineStage} />}

          <div className="pf-rec-subnav" style={{ marginTop: 14 }}>
            {[['communication', 'Communication'], ['summary', 'AI summary'], ['matches', 'Candidate matches'], ['shares', `Shared (${detail.shares.length})`]].map(([id, label]) => (
              <button key={id} type="button" className={subView === id ? 'is-active' : ''} onClick={() => id === 'summary' ? loadSummary() : id === 'matches' ? loadMatches() : setSubView(id)}>{label}</button>
            ))}
          </div>

          {subView === 'communication' && (
            <>
              <div className="pf-rec-timeline">
                {detail.messages.map(message => (
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
                      {message.attachments?.length > 0 && (
                        <div className="pf-rec-timeline__attachments">
                          {message.attachments.map((attachment, index) => <a key={index} href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {detail.messages.length === 0 && <Empty text="No communication yet." />}
              </div>
              <form className="pf-rec-respond" onSubmit={sendMessage}>
                <label style={{ flex: 1, minWidth: 240 }}>
                  Message to the company
                  <textarea rows={2} value={messageDraft} onChange={event => setMessageDraft(event.target.value)} placeholder="Share student statistics, eligibility criteria, or answer questions…" />
                </label>
                <Button type="submit" variant="primary" size="sm" icon={MessageSquare} loading={sending}>Send</Button>
              </form>
              <div className="pf-rec-decision-row">
                {engagement.status === 'reschedule_requested' && <Button variant="secondary" size="sm" onClick={acceptReschedule} loading={statusBusy}>Accept company's requested dates</Button>}
                {['accepted', 'under_discussion'].includes(engagement.status) && <Button variant="primary" size="sm" onClick={confirmRecruitment} loading={statusBusy}>Confirm recruitment</Button>}
                {engagement.status === 'confirmed' && <Button variant="secondary" size="sm" onClick={() => markCompleted('completed')} loading={statusBusy}>Mark drive completed</Button>}
              </div>
            </>
          )}

          {subView === 'summary' && (
            summaryLoading ? <Empty text="Summarising communication…" /> : summary && (
              <div className="pf-rec-ai-summary">
                <h4>AI summary of the communication</h4>
                <p>{summary.summary}</p>
                {(summary.pending?.length > 0 || summary.completed?.length > 0) && (
                  <div className="pf-rec-ai-summary__cols">
                    <div>
                      <h5>Pending</h5>
                      <ul>{summary.pending.map((item, index) => <li key={index}><b>{item.owner}:</b> {item.action}</li>)}</ul>
                    </div>
                    <div>
                      <h5>Completed</h5>
                      <ul>{summary.completed.length ? summary.completed.map((item, index) => <li key={index}>{item}</li>) : <li>Nothing completed yet.</li>}</ul>
                    </div>
                  </div>
                )}
                {summary.note && <AiUnavailable>{summary.note}</AiUnavailable>}
              </div>
            )
          )}

          {subView === 'matches' && (
            matchesLoading ? <Empty text="Matching students against the role…" /> : (
              <>
                {matchError && <div className="pf-admin-error" role="alert">{matchError}</div>}
                {matches && (
                  <>
                    <p className="pf-admin-help">Evaluated {matches.stats?.evaluated ?? 0} students · {matches.stats?.strongMatches ?? 0} strong matches. <AiLabel /></p>
                    {matches.analysis?.summary && <p className="pf-rec-company-card__meta">{matches.analysis.summary}</p>}
                    <div className="pf-rec-bulk-bar">
                      <label className="pf-rec-bulk-bar__count">
                        <input
                          type="checkbox"
                          checked={bulkTailorSelected.size > 0 && bulkTailorSelected.size === (matches.candidates || []).filter(c => !c.alreadyShared).length}
                          onChange={event => setBulkTailorSelected(event.target.checked ? new Set((matches.candidates || []).filter(c => !c.alreadyShared).map(c => c.id)) : new Set())}
                        />
                        Select all
                      </label>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Wand2}
                        loading={bulkTailoring}
                        disabled={bulkTailorSelected.size === 0}
                        onClick={runBulkTailor}
                      >
                        Tailor {bulkTailorSelected.size || ''} resume{bulkTailorSelected.size === 1 ? '' : 's'} for this JD
                      </Button>
                      {bulkTailorResult && (
                        <span className={bulkTailorResult.summary.failed ? 'pf-rec-bulk-bar__note' : 'pf-rec-bulk-bar__note pf-rec-bulk-bar__note--ok'}>
                          {bulkTailorResult.summary.succeeded} tailored · {bulkTailorResult.summary.failed} failed
                        </span>
                      )}
                    </div>
                    {(matches.candidates || []).slice(0, 20).map(candidate => (
                      <div className="pf-rec-match" key={candidate.id}>
                        <div className="pf-rec-match__head">
                          <label className="pf-rec-match__select">
                            <input
                              type="checkbox"
                              checked={bulkTailorSelected.has(candidate.id)}
                              disabled={candidate.alreadyShared}
                              onChange={event => setBulkTailorSelected(prev => {
                                const next = new Set(prev);
                                if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id);
                                return next;
                              })}
                            />
                            <h4>{candidate.name} <small style={{ color: 'var(--text-faint)' }}>#{candidate.id}</small></h4>
                          </label>
                          <span className="pf-rec-match__pct">{candidate.score}% role match</span>
                        </div>
                        <div className="pf-rec-match__cols">
                          <div><h5>Why they match</h5><ul>{candidate.reasons.slice(0, 4).map((reason, index) => <li key={index}>{reason}</li>)}</ul></div>
                          <div><h5>Strengths</h5><ul>{candidate.matchedSkills.slice(0, 6).map((skill, index) => <li key={index}>{skill}</li>)}</ul></div>
                          <div><h5>Potential gaps</h5><ul>{candidate.missingSkills.length ? candidate.missingSkills.slice(0, 4).map((skill, index) => <li key={index}>{skill}</li>) : <li>None detected</li>}</ul></div>
                          {candidate.eligibilityFlags?.length > 0 && (
                            <div><h5>Eligibility flags</h5><ul>{candidate.eligibilityFlags.map((flag, index) => <li key={index}>{flag}</li>)}</ul></div>
                          )}
                        </div>
                        {candidate.alreadyShared && <p className="pf-rec-company-card__meta">Already shared for this engagement.</p>}
                      </div>
                    ))}
                    {bulkTailorResult?.results?.some(item => !item.ok) && (
                      <div className="pf-admin-error" role="alert">
                        {bulkTailorResult.results.filter(item => !item.ok).map(item => (
                          <div key={item.studentId}>{item.error}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )
          )}

          {subView === 'shares' && (
            detail.shares.length === 0 ? <Empty text="No candidates shared for this engagement yet." /> : (
              detail.shares.map(share => (
                <div className="pf-admin-list-item" key={share.id}>
                  <div>
                    <div className="pf-admin-user-badges">
                      <StatusBadge status={share.status === 'revoked' ? 'blocked' : share.status} />
                      <StatusBadge status="draft" label={`access: ${share.accessLevel}`} />
                      {share.companyResponse && <StatusBadge status="feedback" label={`company: ${share.companyResponse.replace(/_/g, ' ')}`} />}
                    </div>
                    <h3>{share.studentName}</h3>
                    <p>{share.studentDepartment || '-'} · approved by {share.approvedByName || '-'} · shared by {share.sharedByName} · {formatDateTime(share.createdAt)}</p>
                  </div>
                  <div className="pf-admin-item-actions">
                    {share.status !== 'revoked' && (
                      <Button variant="ghost" size="sm" icon={ShieldAlert} onClick={async () => {
                        if (!window.confirm(`Revoke ${share.studentName}'s access for this company?`)) return;
                        try { await recruitmentApi.revokeShare(share.id, 'Revoked by placement team'); await load(); }
                        catch (err) { window.alert(err.message); }
                      }}>Revoke</Button>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ dashboard */

function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    recruitmentApi.dashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="pf-admin-list"><Empty text="Loading recruitment intelligence…" /></div>;
  if (error) return <div className="pf-admin-list"><div className="pf-admin-error" role="alert">{error}</div></div>;
  if (!data) return null;
  const { metrics, pendingCompanyActions } = data;
  return (
    <div className="pf-admin-list">
      <PanelHeading eyebrow="Recruitment intelligence" title="Pipeline at a glance" />
      <div className="pf-rec-facts">
        <div className="pf-rec-fact"><b>{metrics.pendingCompanyResponses}</b><span>Pending company responses</span></div>
        <div className="pf-rec-fact"><b>{metrics.provisionalDrives}</b><span>Provisional drives</span></div>
        <div className="pf-rec-fact"><b>{metrics.confirmedDrives}</b><span>Confirmed drives</span></div>
        <div className="pf-rec-fact"><b>{metrics.candidatesAwaitingApproval}</b><span>Candidates awaiting approval</span></div>
        <div className="pf-rec-fact"><b>{metrics.candidatesShared}</b><span>Candidates shared</span></div>
        <div className="pf-rec-fact"><b>{metrics.pendingCompanyActions}</b><span>Pending company actions</span></div>
      </div>
      <p className="pf-rec-why__title">Pending actions</p>
      {pendingCompanyActions.length === 0 ? <Empty text="Nothing pending - the pipeline is clear." /> : (
        <ul className="pf-rec-reasons">
          {pendingCompanyActions.map((item, index) => (
            <li key={index}><b>{item.company}</b> - {item.action} <em style={{ color: 'var(--text-faint)' }}>({item.title})</em></li>
          ))}
        </ul>
      )}
    </div>
  );
}
