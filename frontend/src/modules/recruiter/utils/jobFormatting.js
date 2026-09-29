/**
 * Shared formatting helpers for recruiter job posts.
 * (Kept in sync with the student placement views' formatting.)
 */

export const salaryLabel = job => {
  if (!job.salaryMin && !job.salaryMax) return '';
  const currency = job.salaryCurrency || 'INR';
  const format = value => (value >= 100000 ? `${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value);
  if (job.salaryMin && job.salaryMax) return `${currency} ${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return `${currency} ${format(job.salaryMin || job.salaryMax)}`;
};

export const deadlineLabel = job =>
  job.applicationDeadline
    ? new Date(job.applicationDeadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export const deadlinePassed = job => Boolean(job.applicationDeadline && new Date(job.applicationDeadline) < new Date());
