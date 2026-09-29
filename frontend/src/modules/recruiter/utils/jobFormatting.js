/**
 * Shared formatting helpers for recruiter job posts.
 * (Kept in sync with the student placement views' formatting.)
 */

export const salaryLabel = job => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const currency = job.salaryCurrency || 'INR';
  const format = value => (value >= 100000 ? `${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value);
  // When min equals max (or only one bound exists), show a single value:
  // "INR 2L", not "INR 2L – 2L".
  if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) {
    return `${currency} ${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  }
  return `${currency} ${format(job.salaryMin || job.salaryMax)}`;
};

export const deadlineLabel = job =>
  job.applicationDeadline
    ? new Date(job.applicationDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export const deadlinePassed = job => Boolean(job.applicationDeadline && new Date(job.applicationDeadline) < new Date());

/**
 * Relative time ("Edited 2h ago") for post timestamps; the caller renders the
 * full date/time in a tooltip.
 */
export const relativeTimeLabel = (timestamp, verb = 'Edited') => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const label =
    minutes < 1 ? 'just now'
    : minutes < 60 ? `${minutes}m ago`
    : minutes < 60 * 24 ? `${Math.floor(minutes / 60)}h ago`
    : minutes < 60 * 24 * 7 ? `${Math.floor(minutes / (60 * 24))}d ago`
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${verb} ${label}`;
};
