import React, { useEffect, useMemo, useState } from 'react';
import { History, Download, RotateCw, UserRound, Building2, BriefcaseBusiness, Share2, ShieldCheck, Sparkles, Target, FileText, Users, Check } from 'lucide-react';
import { adminApi } from '../adminApi';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import './LogsWorkspace.css';

const ACTION_LABELS = {
  'job.submit': 'Job submitted',
  'job.approve': 'Job approved',
  'job.reject': 'Changes requested',
  'job.edit': 'Job edited',
  'job.publish': 'Job published',
  'share.create': 'Students shared',
  'share.feedback': 'Recruiter feedback',
  'user.block': 'User blocked',
  'user.unblock': 'User unblocked',
  'user.delete': 'User deleted',
  'user.role': 'Role changed',
  // Recruitment intelligence events
  'recruitment.recommendation.generated': 'AI recommendation generated',
  'recruitment.recommendation.accepted': 'Recommendation accepted',
  'recruitment.recommendation.overridden': 'Recommendation overridden',
  'recruitment.recommendation.ignored': 'Recommendation ignored',
  'recruitment.proposal.created': 'Proposal created',
  'recruitment.proposal.edited': 'Proposal edited',
  'recruitment.proposal.sent': 'Proposal sent',
  'recruitment.company.responded': 'Company responded',
  'recruitment.status.changed': 'Status changed',
  'recruitment.confirmed': 'Recruitment confirmed',
  'recruitment.cancelled': 'Recruitment cancelled',
  'recruitment.completed': 'Recruitment completed',
  'recruitment.message.sent': 'Message sent',
  'recruitment.role.analyzed': 'Role analysed',
  'recruitment.candidate.shared': 'Candidate shared',
  'recruitment.candidate.accessed': 'Candidate accessed',
  'recruitment.candidate.feedback': 'Candidate feedback',
  'recruitment.resume.selected': 'Resume selected',
  'recruitment.resume.approved': 'Resume approved',
  'recruitment.resume.tailored': 'Resume tailored',
  'recruitment.share.revoked': 'Share revoked',
  'recruitment.settings.updated': 'Recruitment settings updated',
  'profile.share.created': 'Public profile link created',
  'profile.share.revoked': 'Public profile link revoked'
};

const ENTITY_META = {
  job_post: { label: 'Job post', icon: BriefcaseBusiness },
  recruiter_share: { label: 'Share', icon: Share2 },
  user: { label: 'User', icon: UserRound },
  company: { label: 'Company', icon: Building2 },
  recruitment_engagement: { label: 'Engagement', icon: Target },
  recruitment_share: { label: 'Candidate share', icon: Share2 },
  resume: { label: 'Resume', icon: FileText },
  public_profile: { label: 'Public profile', icon: Users },
  placement_policy: { label: 'Policy', icon: ShieldCheck }
};

// Group events into families for the category filter.
const CATEGORY_OF = action => {
  if (action.startsWith('recruitment.recommendation')) return 'AI & recommendations';
  if (action.startsWith('recruitment.proposal') || action.startsWith('recruitment.company') || ['recruitment.confirmed', 'recruitment.cancelled', 'recruitment.completed', 'recruitment.status.changed'].includes(action)) return 'Proposals & drives';
  if (action.startsWith('recruitment.candidate') || action.startsWith('recruitment.resume') || action.startsWith('recruitment.share')) return 'Candidates & resumes';
  if (action.startsWith('recruitment.message')) return 'Communication';
  if (action.startsWith('job.')) return 'Job posts';
  if (action.startsWith('share.')) return 'Legacy shares';
  if (action.startsWith('user.')) return 'Accounts';
  if (action.startsWith('profile.share')) return 'Public profiles';
  return 'Other';
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function exportCsv(logs) {
  const header = ['When', 'Actor', 'Event', 'Record', 'Label', 'Detail'].join(',');
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = logs.map(log => [
    new Date(log.createdAt).toISOString(),
    log.actorName, ACTION_LABELS[log.action] || log.action,
    ENTITY_META[log.entityType]?.label || log.entityType,
    log.entityLabel, log.detail
  ].map(escape).join(','));
  const blob = new Blob([`\uFEFF${[header, ...rows].join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `pathfolio-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Professional audit trail: summary stats, category + entity + search filters,
 * relative timestamps with absolute time on hover, per-event entity icons,
 * CSV export, and recruitment-intelligence events fully labelled.
 */
export function LogsWorkspace() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [filters, setFilters] = useState({ action: '', entity: '', category: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exported, setExported] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await adminApi.logs(filters);
      setLogs(data.logs || []);
      setActions(data.actions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.action, filters.entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const byCategory = new Map();
    for (const log of logs) {
      const category = CATEGORY_OF(log.action);
      byCategory.set(category, (byCategory.get(category) || 0) + 1);
    }
    const today = logs.filter(log => new Date(log.createdAt).toDateString() === new Date().toDateString()).length;
    const actors = new Set(logs.map(log => log.actorName)).size;
    return { total: logs.length, today, actors, byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]) };
  }, [logs]);

  const categories = useMemo(() => [...new Set(actions.map(CATEGORY_OF))].sort(), [actions]);
  const visibleLogs = useMemo(() =>
    logs.filter(log =>
      (!filters.category || CATEGORY_OF(log.action) === filters.category)
      && (!filters.search || `${log.actorName} ${log.entityLabel} ${log.detail}`.toLowerCase().includes(filters.search.toLowerCase()))
    ), [logs, filters.category, filters.search]);

  return (
    <section className="pf-admin-single">
      <div className="pf-admin-list">
        <div className="pf-logs-header">
          <div>
            <p className="pf-admin-eyebrow">Audit trail</p>
            <h2>Workspace activity log</h2>
            <p className="pf-logs-subtitle">Every important action across placements, recruitment drives, candidate sharing and accounts - who did what, when, and why.</p>
          </div>
          <div className="pf-logs-header__actions">
            <Button variant="ghost" size="sm" icon={RotateCw} onClick={load} loading={loading}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={exported ? Check : Download} onClick={() => { exportCsv(visibleLogs); setExported(true); setTimeout(() => setExported(false), 2000); }}>
              {exported ? 'Exported' : `Export CSV (${visibleLogs.length})`}
            </Button>
          </div>
        </div>

        <div className="pf-logs-stats">
          <div className="pf-logs-stat"><b>{stats.total}</b><span>events shown</span></div>
          <div className="pf-logs-stat"><b>{stats.today}</b><span>today</span></div>
          <div className="pf-logs-stat"><b>{stats.actors}</b><span>actors involved</span></div>
          {stats.byCategory.slice(0, 3).map(([category, count]) => (
            <div className="pf-logs-stat" key={category}><b>{count}</b><span>{category.toLowerCase()}</span></div>
          ))}
        </div>

        <div className="pf-logs-filters">
          <select className="pf-admin-filter" value={filters.category} onChange={event => setFilters(prev => ({ ...prev, category: event.target.value }))} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className="pf-admin-filter" value={filters.action} onChange={event => setFilters(prev => ({ ...prev, action: event.target.value }))} aria-label="Filter by event type">
            <option value="">All events</option>
            {actions.map(action => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
          </select>
          <select className="pf-admin-filter" value={filters.entity} onChange={event => setFilters(prev => ({ ...prev, entity: event.target.value }))} aria-label="Filter by record type">
            <option value="">All records</option>
            {Object.entries(ENTITY_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
          <form onSubmit={event => { event.preventDefault(); load(); }} className="pf-logs-filters__grow">
            <input type="search" className="pf-admin-filter pf-admin-filter--grow" placeholder="Search actor, record, or detail…" value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} />
          </form>
        </div>

        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {loading && <EmptyState text="Loading logs…" />}
        {!loading && visibleLogs.length === 0 && (
          <EmptyState
            icon={History}
            title={logs.length ? 'No events match these filters' : 'No activity yet'}
            text={logs.length ? 'Try clearing a filter or the search.' : 'Job submissions, recruitment drives, shares, and account actions will appear here.'}
          />
        )}

        {!loading && visibleLogs.length > 0 && (
          <div className="pf-logs-table" role="table" aria-label="Audit log">
            <div className="pf-logs-table__head" role="row">
              <span role="columnheader">Event</span>
              <span role="columnheader">Actor</span>
              <span role="columnheader">When</span>
            </div>
            {visibleLogs.map(log => {
              const entity = ENTITY_META[log.entityType] || { label: log.entityType, icon: FileText };
              const EntityIcon = entity.icon;
              const isAiEvent = log.action.includes('recommendation');
              return (
                <article className="pf-logs-row" role="row" key={log.id}>
                  <div className="pf-logs-row__event">
                    <span className={`pf-logs-row__icon ${isAiEvent ? 'pf-logs-row__icon--ai' : ''}`}>
                      {isAiEvent ? <Sparkles size={15} /> : <EntityIcon size={15} />}
                    </span>
                    <div className="pf-logs-row__body">
                      <p className="pf-logs-row__title">
                        <b>{ACTION_LABELS[log.action] || log.action}</b>
                        {log.entityLabel && <span className="pf-logs-row__label"> · {log.entityLabel}</span>}
                      </p>
                      {log.detail && <p className="pf-logs-row__detail">{log.detail}</p>}
                      <Badge variant="neutral" size="sm" className="pf-logs-row__entity">{entity.label}</Badge>
                    </div>
                  </div>
                  <div className="pf-logs-row__actor">
                    <span className="pf-logs-row__avatar">{(log.actorName || 'S').slice(0, 1).toUpperCase()}</span>
                    <span>{log.actorName || 'System'}</span>
                  </div>
                  <time className="pf-logs-row__when" title={new Date(log.createdAt).toLocaleString()} dateTime={log.createdAt}>
                    {relativeTime(log.createdAt)}
                  </time>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
