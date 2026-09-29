/**
 * Shared MySQL access helpers.
 *
 * Why this module exists
 * ----------------------
 * Every store used to build its own pool with `mysql.createPool({ ... })` and
 * no resilience settings, and nothing classified driver errors. On this
 * deployment — a *remote, shared* MySQL at sg1.potenfyr.in — the server
 * regularly drops pooled connections between requests:
 *
 *   Aborted_clients 257 / Connections 421   (SHOW GLOBAL STATUS)
 *
 * That is host-side, not misconfiguration: `wait_timeout` is 28800s, and
 * mysql2 already enables TCP keep-alive by default. The reset is what the host
 * does to idle sockets, and the API used to treat it as fatal.
 *
 * The actual outage cause was not the reset itself but what happened next: a
 * rejected query inside an `async` Express handler became an unhandled promise
 * rejection, which Node turns into a fatal uncaught exception (see
 * src/shared/asyncHandler.js). One recycled socket took the entire API down and
 * the Vite proxy started answering ECONNREFUSED on every route.
 *
 * So this module supplies the three things that turn that blip into a non-event:
 * `createPool` (one hardened pool config for all stores), `withRetry` (absorb a
 * single reset for idempotent reads), and `closeAllPools` (clean shutdown).
 * `isTransientDbError` is the shared definition of "the database blinked", used
 * by both request handling and shutdown.
 */

const mysql = require('mysql2/promise');
const config = require('../config');
const log = require('./logger');

/**
 * Socket/transport level failures. These are always worth one more attempt:
 * the server discards the dead connection from the pool, so the retry gets a
 * fresh socket. They are never SQL problems (those carry an `ER_*` code).
 */
const TRANSIENT_DB_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT'
]);

const TRANSIENT_MESSAGE = /socket hang up|connection (?:was )?(?:lost|closed|terminated)|server has gone away|no connection established/i;

const isTransientDbError = error =>
  Boolean(error) && (TRANSIENT_DB_CODES.has(error.code) || TRANSIENT_MESSAGE.test(String(error.message || '')));

/**
 * Run `fn`, retrying once when it fails on a dropped connection.
 *
 * Only for idempotent work (reads, `CREATE TABLE IF NOT EXISTS`). Retrying a
 * write after `ECONNRESET` is unsafe: the server may already have applied it,
 * so a retry can double-insert. Writes go through the pool directly.
 */
async function withRetry(fn, { retries = 1, delayMs = 50, label = 'query' } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries || !isTransientDbError(error)) throw error;
      log.db.warn(`${label}: ${log.describeError(error)} — retrying on a fresh connection (attempt ${attempt}/${retries}).`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

const livePools = new Set();

/**
 * Pool defaults tuned for a long-lived API process talking to a remote MySQL.
 * Per-store overrides only need to set `connectionLimit`.
 */
const POOL_DEFAULTS = {
  waitForConnections: true,
  connectionLimit: 10,
  // Do not fail fast when the pool is saturated; queue instead.
  queueLimit: 0,
  connectTimeout: 10000,
  // mysql2 enables keep-alive already; setting the delay explicitly (it
  // defaults to 0) makes the idle behaviour intentional rather than accidental.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Recycle idle sockets on a short timer. On a host that reaps idle
  // connections, a socket is far likelier to be alive when it is first handed
  // out than to survive until the next request needs it.
  idleTimeout: 30000,
  maxIdle: 10
};

function createPool(overrides = {}) {
  const connectionLimit = Number(overrides.connectionLimit || POOL_DEFAULTS.connectionLimit);
  const pool = mysql.createPool({
    ...POOL_DEFAULTS,
    ...overrides,
    host: overrides.host || config.db.host,
    port: overrides.port || config.db.port,
    user: overrides.user || config.db.user,
    password: overrides.password || config.db.password,
    database: overrides.database || config.db.name,
    connectionLimit,
    // maxIdle above connectionLimit would be meaningless.
    maxIdle: Math.min(Number(overrides.maxIdle || POOL_DEFAULTS.maxIdle), connectionLimit)
  });
  livePools.add(pool);
  return pool;
}

/** Close every pool created here. Used by graceful shutdown. */
async function closeAllPools() {
  const pools = [...livePools];
  livePools.clear();
  await Promise.allSettled(
    pools.map(pool => (typeof pool.end === 'function' ? pool.end() : undefined))
  );
}

module.exports = { createPool, withRetry, isTransientDbError, closeAllPools, POOL_DEFAULTS };
