/**
 * Rate limiting middleware (zero-dependency, in-memory).
 *
 * Fixed-window counters per key (IP or IP+email), with a periodic sweep so
 * stale windows do not accumulate. Designed for the single-process Express
 * deployment; if the API ever scales horizontally, swap the store for Redis.
 *
 * Usage:
 *   const limiter = rateLimit({ windowMs: 60000, max: 10, keyBy: req => String(req.body?.email || '') });
 *   router.post('/login', limiter, handler);
 *
 * When the window is exceeded the middleware answers 429 with a JSON body
 * matching the API's error envelope, plus standard RateLimit headers.
 */
const log = require('./logger');

const buckets = new Map(); // key -> { count, resetAt }
let lastSweep = Date.now();

function sweep(now, windowMs) {
  // Sweep at most once per window to keep the map bounded.
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {object} options
 * @param {number} [options.windowMs=60000] Sliding-window length.
 * @param {number} [options.max=10] Max requests per window per key.
 * @param {(req: any) => string} [options.keyBy] Extra key material (e.g. email).
 * @param {string} [options.message='Too many requests...'] Rejection message.
 */
function rateLimit({ windowMs = 60_000, max = 10, keyBy, message = 'Too many requests. Please slow down and try again shortly.' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    sweep(now, windowMs);
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const extra = keyBy ? String(keyBy(req) || '') : '';
    const key = `${ip}|${extra}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(max - bucket.count, 0);
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', retryAfter);
    if (bucket.count > max) {
      res.setHeader('Retry-After', retryAfter);
      log.rate.warn(`Rate limited ${key} (${bucket.count}/${max} in window)`);
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
}

/** Test/dev helper: clear every counter. */
rateLimit.clear = () => buckets.clear();

module.exports = rateLimit;
