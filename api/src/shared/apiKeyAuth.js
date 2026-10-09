/**
 * Shared API-key gate: authenticates the frontend (or any machine client)
 * against the API when the two are hosted separately.
 *
 * Behaviour
 * - Clients present the shared secret in the `X-API-Key` header. An
 *   `Authorization: Bearer <key>` header is also accepted so curl, Postman
 *   and server-to-server callers work without special tooling.
 * - When API_KEY is unset the gate is fully transparent: local and volatile
 *   (USE_DATABASE=false) development keeps working with zero configuration.
 * - `OPTIONS` preflights pass through (the cors middleware answers them) and
 *   `GET /api/health` stays open for uptime probes and orchestration checks.
 * - Comparison is constant-time per candidate key, so response timing does
 *   not leak the secret.
 *
 * This gate authenticates the APPLICATION, not the user. Per-user
 * authorization still happens downstream via the pf_session cookie and the
 * authenticate/requireAdmin/requireRecruiter middleware chain.
 */
const crypto = require('crypto');
const config = require('../config');

/** Length-safe constant-time comparison; returns false on any mismatch. */
function secureEquals(presented, expected) {
  const a = Buffer.from(String(presented), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function presentedKey(req) {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const authorization = req.headers['authorization'];
  if (typeof authorization === 'string') {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  // EventSource cannot set custom headers; the SSE stream legitimately passes
  // the key as a query parameter (see notification.routes.js sseKeyGate).
  if (typeof req.query.apiKey === 'string' && req.query.apiKey.trim()) return req.query.apiKey.trim();
  return null;
}

function apiKeyAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  // Healthcheck stays open: uptime probes never carry the secret.
  if (req.method === 'GET' && req.path === '/api/health') return next();

  const allowedKeys = config.apiKeys;
  if (!allowedKeys.length) return next(); // auth disabled (local development)

  const presented = presentedKey(req);
  if (presented && allowedKeys.some(expected => secureEquals(presented, expected))) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Invalid or missing API key. Send the shared key in the X-API-Key header.'
  });
}

module.exports = apiKeyAuth;
