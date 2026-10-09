/**
 * Minimal structured logger for PathfolioApp.
 *
 * Design goals:
 * - Zero dependencies: plain console methods, no transport, no config.
 * - Leveled: debug < info < warn < error. `LOG_LEVEL` env var overrides.
 * - Scoped: pass a scope for context, e.g. `log.scoped('auth').error(...)`
 *   or the shortcut helpers `log.auth.info(...)`.
 * - Human-friendly in development (timestamp + level tag + scope), while
 *   remaining a single greppable line per event for production log drains.
 *
 * Every line looks like:
 *   2026-09-29T18:31:02.441Z [info ] [api   ] Server listening on port 5000
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// Allows silencing noisy modules without touching their code, e.g.
// LOG_IGNORE=proxy,morgan npm run dev:api
const ignoredScopes = new Set(
  String(process.env.LOG_IGNORE || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

const currentLevel = () => {
  const requested = String(process.env.LOG_LEVEL || '').toLowerCase();
  if (LEVELS[requested]) return LEVELS[requested];
  // In tests you usually want silence unless something goes wrong.
  return process.env.NODE_ENV === 'test' ? LEVELS.warn : LEVELS.debug;
};

function padScope(scope) {
  return (scope || 'app').toLowerCase().padEnd(6, ' ').slice(0, 6);
}

function write(stream, level, scope, args) {
  const timestamp = new Date().toISOString();
  const tag = `[${level.padEnd(5, ' ')}]`;
  stream(tag, timestamp, `[${padScope(scope)}]`, ...args);
}

function makeScope(scope) {
  const emit = level => (...args) => {
    if (LEVELS[level] < currentLevel()) return;
    if (ignoredScopes.has(String(scope).toLowerCase())) return;
    const stream = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    write(stream, level, scope, args);
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
}

const log = makeScope('app');

// Named scope shortcuts, so call sites read naturally:
//   log.db.info('Connected');  log.api.error('Request failed');
log.api = makeScope('api');
log.db = makeScope('db');
log.auth = makeScope('auth');
log.rate = makeScope('rate');
log.mail = makeScope('mail');
log.share = makeScope('share');
log.rt = makeScope('rt');
log.admin = makeScope('admin');
log.storage = makeScope('storage');
log.startup = makeScope('startup');

/**
 * Best-effort extraction of the useful part of an error for one-line logs:
 * message plus the driver error code (ECONNREFUSED, ER_ACCESS_DENIED_ERROR…)
 * when present. Falls back to the full error for unexpected shapes.
 */
log.describeError = error => {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  const parts = [error.message || String(error)];
  if (error.code && error.code !== error.message) parts.push(`code=${error.code}`);
  if (error.errno && error.errno !== error.code) parts.push(`errno=${error.errno}`);
  return parts.join(' ');
};

/**
 * Compact error summary that keeps the stack visible but readable.
 * Returns an array so callers can spread it: log.db.error(...log.stack(err)).
 */
log.stack = error => {
  if (error && error.stack) {
    const firstLine = String(error.stack).split('\n')[0];
    return [firstLine, ...(String(error.stack).split('\n').slice(1, 4))];
  }
  return [log.describeError(error)];
};

module.exports = log;
