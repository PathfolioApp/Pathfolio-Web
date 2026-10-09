/**
 * Single API access point for the whole frontend.
 *
 * - VITE_API_BASE_URL lets the app be hosted separately from the API
 *   (empty = same origin, requests stay relative like `/api/...`).
 * - VITE_API_KEY is the shared application key the backend requires in the
 *   `X-API-Key` header whenever API_KEY is configured on the server. It is a
 *   public-web application key, not a user secret; real authorization still
 *   happens per user through the pf_session cookie on every route.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = `${RAW_BASE}/api`;
const API_KEY = (import.meta.env.VITE_API_KEY || '').trim();

/**
 * Resolve a path to an absolute API URL. Accepts both styles used across the
 * codebase: full paths starting with `/api/...` and endpoint-only paths like
 * `/login` or `/jobs` that callers prepend their module base to.
 */
export function apiUrl(path) {
  if (!path.startsWith('/api/')) return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  return `${RAW_BASE}${path}`;
}

/** Headers every API request should carry (extra headers win on conflict). */
export function apiHeaders(extra = {}) {
  return { ...(API_KEY ? { 'X-API-Key': API_KEY } : {}), ...extra };
}
