import React from 'react';
import { relativeTimeLabel } from './editedTime';
import './EditedBadge.css';

/**
 * Shows "Edited 2h ago" when a record was meaningfully edited after creation
 * (more than 60 seconds), otherwise "Created ...". The full date/time is in
 * the title tooltip.
 */
export function EditedBadge({ createdAt, updatedAt, labels = { edited: 'Edited', created: 'Created' }, className = '' }) {
  if (!createdAt && !updatedAt) return null;
  const created = createdAt ? new Date(createdAt) : null;
  const updated = updatedAt ? new Date(updatedAt) : null;
  const meaningfullyEdited = Boolean(
    created && updated && (updated.getTime() - created.getTime()) > 60_000
  );
  const base = meaningfullyEdited ? updated : (created || updated);
  if (!base || Number.isNaN(base.getTime())) return null;
  const full = base.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const text = meaningfullyEdited
    ? relativeTimeLabel(updatedAt, labels.edited)
    : `${labels.created} ${full}`;
  return (
    <span className={`pf-edited-badge ${className}`} title={full}>
      {text}
    </span>
  );
}
