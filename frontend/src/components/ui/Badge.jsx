import React from 'react';
import './Badge.css';

export function Badge({ children, variant = 'neutral', size = 'md', className = '' }) {
  return (
    <span className={`pf-badge pf-badge--${variant} pf-badge--${size} ${className}`}>
      {children}
    </span>
  );
}

// Fixed status colors for job/share/account states across portals:
// green = live/published/approved, grey = draft/pending, amber = needs action,
// red = blocked/closed, sage outline = neutral info.
const STATUS_VARIANTS = {
  draft: 'neutral',
  pending_approval: 'amber',
  approved: 'success',
  rejected: 'danger',
  published: 'success',
  closed: 'danger',
  archived: 'neutral',
  shared: 'amber',
  viewed: 'success',
  feedback: 'success',
  blocked: 'danger'
};

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Changes requested',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
  shared: 'Shared',
  viewed: 'Viewed',
  feedback: 'Feedback',
  blocked: 'Blocked'
};

/**
 * The single status badge used everywhere (job posts, shares, accounts).
 * Pass `label` to override the display text (e.g. "Live" for published).
 */
export function StatusBadge({ status, label, size = 'sm', className = '' }) {
  const variant = STATUS_VARIANTS[status] || 'neutral';
  const text = label || STATUS_LABELS[status] || status;
  return (
    <Badge variant={variant} size={size} className={className}>{text}</Badge>
  );
}
