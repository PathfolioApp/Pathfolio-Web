import React, { useEffect, useState } from 'react';
import { Share2, Users, Building2 } from 'lucide-react';
import { adminApi } from '../adminApi';
import { PanelHeading, Empty } from '../utils/adminHelpers';

const STATUS_TONE = { shared: 'draft', viewed: 'published', feedback: 'published' };

/**
 * Admin-facing history of recruiter shares ("student shortlists"): who they
 * were shared with, for which job, and whether the recruiter has viewed or
 * responded (requirement 18 audit trail).
 */
export function SharesWorkspace() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.shares()
      .then(data => setShares(data.shares || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="pf-admin-workspace">
      <div className="pf-admin-list">
        <div className="pf-admin-panel-heading">
          <div>
            <p className="pf-admin-eyebrow">Referral history</p>
            <h2>Recruiter shares <span>{shares.length}</span></h2>
          </div>
        </div>
        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {loading && <Empty text="Loading shares…" />}
        {!loading && shares.length === 0 && <Empty text="No student shares yet. Search students and use “Share with recruiter” to create one." />}
        {shares.map(share => (
          <article className="pf-admin-list-item" key={share.id}>
            <div>
              <div className="pf-admin-user-badges">
                <span className={`pf-admin-status-badge is-${STATUS_TONE[share.status] || 'draft'}`}>{share.status}</span>
                <span className="pf-admin-status-badge is-draft">{share.studentCount} students</span>
              </div>
              <h3>{share.recruiterName}</h3>
              <p>
                {share.jobTitle ? <><Building2 size={13} /> {share.jobTitle} · </> : null}
                Created {new Date(share.createdAt).toLocaleDateString()}
                {share.note ? <> — “{share.note}”</> : null}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
