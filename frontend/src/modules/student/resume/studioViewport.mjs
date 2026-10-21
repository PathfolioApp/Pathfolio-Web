// Screen scaling only: the A4 page and print layout remain at their original size.
export function fitPreviewZoom(width, paddingLeft = 12, paddingRight = 12) {
  if (!Number.isFinite(width) || width < 100) return null;
  const available = width - paddingLeft - paddingRight - 14;
  if (available <= 0) return null;
  return Math.min(1.05, Math.max(0.01, Math.floor(available / 794 * 100) / 100));
}
