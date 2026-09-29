import React, { useEffect, useState } from 'react';
import { Share2, Building2 } from 'lucide-react';
import { adminApi } from '../adminApi';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';

/**
 * History of recruiter shares: who they were shared with, for which job,
 * and whether the recruiter has viewed or responded.
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
    <section className="pf-admin-single">
      <div className="pf-admin-list">
        {error && <div className="pf-admin-error" role="alert">{error}</div>}
        {loading && <EmptyState text="Loading shares…" />}
        {!loading && shares.length === 0 && (
          <EmptyState
            icon={Share2}
            title="No student shares yet"
            text="Search students and use “Share with recruiter” to create one."
          />
        )}
        {shares.map(share => (
          <article className="pf-admin-list-item" key={share.id}>
            <div>
              <div className="pf-admin-user-badges">
                <StatusBadge status={share.status} />
                <StatusBadge status="draft" label={`${share.studentCount} students`} />
              </div>
              <h3>{share.recruiterName}</h3>
              <p>
                {share.jobTitle ? <><Building2 size={13} /> {share.jobTitle} · </> : null}
                Created {new Date(share.createdAt).toLocaleDateString()}
                {share.note ? <>, “{share.note}”</> : null}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
