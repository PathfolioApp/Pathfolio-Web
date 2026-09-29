/**
 * Internship utility functions for Pathfolio.
 * Handles date formatting, timeline ranges, durations, and chronological sorting.
 */

/**
 * Formats a duration in months / years given start and end date strings.
 */
export function formatDuration(startDateStr, endDateStr, currentlyWorking) {
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
 * Formats the full internship timeline string cleanly without redundancies.
 * Examples:
 * - Same month: "Sep 2026 (1 mo)" (Fixes "Sep 2026, Sep 2026 (1 mo)")
 * - Same year:  "Jun, Aug 2026 (3 mos)"
 * - Cross year: "Nov 2025, Feb 2026 (4 mos)"
 * - Active:     "Sep 2026, Present (1 mo)"
 */
export function formatInternshipTimeline(startDateStr, endDateStr, currentlyWorking) {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return startDateStr;

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startYear = start.getFullYear();
  const duration = formatDuration(startDateStr, endDateStr, currentlyWorking);
  const durationSuffix = duration ? ` (${duration})` : '';

  if (currentlyWorking) {
    return `${startMonth} ${startYear}, Present${durationSuffix}`;
  }

  if (!endDateStr) {
    return `${startMonth} ${startYear}${durationSuffix}`;
  }

  const end = new Date(endDateStr);
  if (isNaN(end.getTime())) {
    return `${startMonth} ${startYear}, ${endDateStr}${durationSuffix}`;
  }

  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endYear = end.getFullYear();

  // If in the exact same month & year:
  if (startYear === endYear && start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startYear}${durationSuffix}`;
  }

  // If in the same year:
  if (startYear === endYear) {
    return `${startMonth}, ${endMonth} ${endYear}${durationSuffix}`;
  }

  // Cross-year:
  return `${startMonth} ${startYear}, ${endMonth} ${endYear}${durationSuffix}`;
}

/**
 * Sorts internships in reverse chronological order:
 * 1. Currently working roles at top (sorted by latest startDate descending).
 * 2. Completed roles sorted by latest endDate descending.
 * 3. Ties broken by latest startDate descending.
 * 4. Final tie-breaker: First-Come-First-Served (FCFS by createdAt).
 */
export function sortInternships(internships) {
  if (!Array.isArray(internships)) return [];

  return [...internships].sort((a, b) => {
    // 1. Currently working roles come first
    if (a.currentlyWorking && !b.currentlyWorking) return -1;
    if (!a.currentlyWorking && b.currentlyWorking) return 1;

    // Both currently working: compare start dates descending (latest start date first)
    if (a.currentlyWorking && b.currentlyWorking) {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    } else {
      // Both completed: compare end dates descending (most recently ended first)
      const aEnd = a.endDate ? new Date(a.endDate).getTime() : 0;
      const bEnd = b.endDate ? new Date(b.endDate).getTime() : 0;
      if (aEnd !== bEnd) return bEnd - aEnd;

      // Tie on end date: compare start dates descending
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (aStart !== bStart) return bStart - aStart;
    }

    // Tie-breaker: FCFS (First-Come, First-Served by creation time)
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated && bCreated && aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}
