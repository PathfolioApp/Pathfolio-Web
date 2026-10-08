/**
 * Project utility functions for Pathfolio.
 * Handles date formatting, timeline ranges, durations, and chronological sorting.
 */

export const PROJECT_TYPES = [
  'Personal',
  'Academic',
  'Hackathon',
  'Open Source',
  'Client / Freelance',
  'Research',
  'Other'
];

/**
 * Formats a duration in months / years given start and end date strings.
 */
export function formatProjectDuration(startDateStr, endDateStr, currentlyWorking) {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return '';

  const end = currentlyWorking || !endDateStr ? new Date() : new Date(endDateStr);
  if (isNaN(end.getTime())) return '';

  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  if (months <= 0) return '';
  if (months < 12) return `${months} mo${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} yr${years > 1 ? 's' : ''}${remMonths ? ` ${remMonths} mo${remMonths > 1 ? 's' : ''}` : ''}`;
}

/**
 * Formats a single date string to "Mon YYYY" (e.g., "Sep 2026").
 */
export function formatDateMonthYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Formats the full project timeline string cleanly without redundancies.
 * Examples:
 * - Same month: "Sep 2026 (1 mo)"
 * - Same year:  "Jun - Aug 2026 (3 mos)"
 * - Cross year: "Nov 2025 - Feb 2026 (4 mos)"
 * - Active:     "Sep 2026 - Present (1 mo)"
 */
export function formatProjectTimeline(startDateStr, endDateStr, currentlyWorking) {
  if (!startDateStr && !endDateStr) return '';
  if (!startDateStr && endDateStr) {
    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) return endDateStr;
    return `Completed ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }

  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return startDateStr;

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startYear = start.getFullYear();
  const duration = formatProjectDuration(startDateStr, endDateStr, currentlyWorking);
  const durationSuffix = duration ? ` (${duration})` : '';

  if (currentlyWorking) {
    return `${startMonth} ${startYear} - Present${durationSuffix}`;
  }

  if (!endDateStr) {
    return `${startMonth} ${startYear}${durationSuffix}`;
  }

  const end = new Date(endDateStr);
  if (isNaN(end.getTime())) {
    return `${startMonth} ${startYear} - ${endDateStr}${durationSuffix}`;
  }

  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endYear = end.getFullYear();

  // If in the exact same month & year:
  if (startYear === endYear && start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startYear}${durationSuffix}`;
  }

  // If in the same year:
  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${endYear}${durationSuffix}`;
  }

  // Cross-year:
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}${durationSuffix}`;
}

/**
 * Sorts projects:
 * 1. Featured projects at top
 * 2. Currently working projects next (sorted by latest startDate descending)
 * 3. Completed projects (sorted by latest endDate descending, then latest startDate descending)
 * 4. Tie-breaker by creation timestamp (newest first) or id
 */
export function sortProjects(projects) {
  if (!Array.isArray(projects)) return [];

  return [...projects].sort((a, b) => {
    // 1. Featured priority
    const aFeat = Boolean(a.featured);
    const bFeat = Boolean(b.featured);
    if (aFeat && !bFeat) return -1;
    if (!aFeat && bFeat) return 1;

    // 2. Currently active priority
    if (a.currentlyWorking && !b.currentlyWorking) return -1;
    if (!a.currentlyWorking && b.currentlyWorking) return 1;

    // 3. Chronological sorting
    if (a.currentlyWorking && b.currentlyWorking) {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    } else {
      const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0;
      const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0;
      if (aEnd !== bEnd) return bEnd - aEnd;

      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    }

    // 4. Tie-breaker
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated && bCreated && aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}
