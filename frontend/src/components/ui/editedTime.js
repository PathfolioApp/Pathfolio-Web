/**
 * Relative-time formatting for "Edited 2h ago" style labels.
 * Lives outside EditedBadge so callers without React (tests, services) can
 * reuse it.
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
