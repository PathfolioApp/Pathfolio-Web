import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { adminApi } from '../adminApi';
import { PanelHeading, Empty } from '../utils/adminHelpers';
import './LogsWorkspace.css';

const ACTION_LABELS = {
  'job.submit': 'Job submitted',
  'job.approve': 'Job approved',
  'job.reject': 'Changes requested',
  'job.publish': 'Job published',
  'share.create': 'Students shared',
  'share.feedback': 'Recruiter feedback',
  'user.block': 'User blocked',
  'user.unblock': 'User unblocked',
  'user.delete': 'User deleted',
  'user.role': 'Role changed'
};

const ENTITY_LABELS = { job_post: 'Job post', recruiter_share: 'Share', user: 'User' };

/**
 * Audit trail for the placement workspace: job submissions, review decisions,
 * publishes, recruiter shares, and account actions, newest first.
 */
export function LogsWorkspace() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [filters, setFilters] = useState({ action: '', entity: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const submitSearch = event => {
    event.preventDefault();
    load();
  };

  return (
    <section className="pf-admin-workspace">
      <div className="pf-admin-list">
        <div className="pf-admin-panel-heading">
          <div>
            <p className="pf-admin-eyebrow">Activity</p>
            <h2>Logs <span>{logs.length}</span></h2>
          </div>
          <div className="pf-logs-filters">
            <select className="pf-admin-filter" value={filters.action} onChange={event => setFilters(prev => ({ ...prev, action: event.target.value }))}>
              <option value="">All events</option>
              {actions.map(action => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
            </select>
            <select className="pf-admin-filter" value={filters.entity} onChange={event => setFilters(prev => ({ ...prev, entity: event.target.value }))}>
              <option value="">All records</option>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <form onSubmit={submitSearch}>
              <input type="search" className="pf-admin-filter" placeholder="Search actor or record..." value={filters.search} onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))} />
            </form>
          </div>
        </div>

        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {loading && <Empty text="Loading logs..." />}
        {!loading && logs.length === 0 && <Empty text="No activity recorded yet. Job submissions, reviews, publishes, shares, and account actions will appear here." />}

        {logs.map(log => (
          <article className="pf-admin-list-item pf-log-row" key={log.id}>
            <span className="pf-log-icon"><History size={16} /></span>
            <div className="pf-log-body">
              <p className="pf-log-title">
                <b>{log.actorName}</b> {ACTION_LABELS[log.action] || log.action.toLowerCase()}
                {log.entityLabel ? <span> - {log.entityLabel}</span> : null}
              </p>
              {log.detail && <p className="pf-log-detail">{log.detail}</p>}
              <p className="pf-log-meta">
                {ENTITY_LABELS[log.entityType] || log.entityType} · {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
