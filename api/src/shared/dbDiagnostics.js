const log = require('./logger');

/**
 * Classify a MySQL startup failure and return actionable diagnostics.
 * Returns null for unrecognized error codes so callers can fall back to a
 * generic dump of the original error.
 */
function diagnoseDbError(error) {
  const code = error?.code || '';
  const errno = error?.errno;
  const full = String(error?.message || '');

  const hints = {
    ETIMEDOUT: [
      'The API could not open a TCP connection to the database host.',
      'Checks:',
      '  1. Is the DB host reachable from this machine/network? (firewall, VPN, security groups)',
      '  2. Is a local MySQL server actually running? (e.g. `mysqladmin ping` or check services)',
      '  3. Cloud DBs (PlanetScale/RDS/Neon for Postgres) usually need TLS or an IP allowlist.'
    ],
    ECONNREFUSED: [
      'Something is listening elsewhere: the host resolved, but nothing accepted the connection.',
      'Checks:',
      '  1. Is MySQL running on the expected port? (default 3306)',
      '  2. Does DB_PORT in api/.env match the server?',
      '  3. Is the DB behind SSH/Docker with a different exposed port?'
    ],
    ER_ACCESS_DENIED_ERROR: [
      'MySQL rejected the credentials.',
      'Checks:',
      '  1. Verify DB_USER and DB_PASSWORD in api/.env against the DB server.',
      '  2. Does the user have remote access (not just localhost)?',
      '  3. Special characters in the password may need URL-encoding.'
    ],
    ER_BAD_DB_ERROR: [
      'The database (schema) does not exist on that server.',
      'Fix: create it, e.g. `CREATE DATABASE pathfolio CHARACTER SET utf8mb4;` then update DB_NAME in api/.env.'
    ],
    ENOTFOUND: [
      'The DB hostname could not be resolved (DNS failure).',
      'Fix: check DB_HOST in api/.env for typos; verify the host exists.'
    ],
    EAI_AGAIN: [
      'Temporary DNS failure while resolving the DB host.',
      'Fix: retry, or check the machine/network DNS configuration.'
    ],
    ER_NOT_SUPPORTED_AUTH_MODE: [
      'The server requires an auth plugin this driver build does not ship.',
      'Fix: for local MySQL 8, set the user to use mysql_native_password, e.g.',
      '  ALTER USER \'<user>\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'<password>\';'
    ],
    HANDSHAKE_NO_SSL_SUPPORT: [
      'The server refused TLS; some managed MySQL providers require it.',
      'Fix: check the provider docs — an ssl config block may need to be added to the pool config.'
    ],
    PROTOCOL_CONNECTION_LOST: [
      'The connection dropped during startup handshake.',
      'Fix: check network stability; on managed DBs, confirm the instance is running and not paused.'
    ]
  };

  if (hints[code]) return { code, hints: hints[code], errno };

  // mysql2 sometimes wraps driver errors; try to recognize by message.
  if (/access denied/i.test(full)) return { code: code || 'ER_ACCESS_DENIED_ERROR', hints: hints.ER_ACCESS_DENIED_ERROR, errno };
  if (/timed out|timeout/i.test(full) && /connect/i.test(full)) return { code: code || 'ETIMEDOUT', hints: hints.ETIMEDOUT, errno };
  if (/unknown database/i.test(full)) return { code: 'ER_BAD_DB_ERROR', hints: hints.ER_BAD_DB_ERROR, errno };
  if (/getaddrinfo|ENOTFOUND|EAI_AGAIN/i.test(full)) return { code: 'ENOTFOUND', hints: hints.ENOTFOUND, errno };

  return null;
}

/** Print a startup banner explaining a DB failure and what to do about it. */
function reportDbFailure(scope, error, { host, port, database } = {}) {
  const target = `${host || 'unknown'}:${port || '?'} / ${database || 'no database'}`;
  log[scope] ? log[scope].error(`Cannot reach MySQL at ${target}. ${log.describeError(error)}`) : console.error(error);
  const diagnosis = diagnoseDbError(error);
  if (diagnosis) {
    diagnosis.hints.forEach(line => console.error('  ' + line));
    if (diagnosis.errno) console.error(`  (driver errno: ${diagnosis.errno})`);
  } else {
    log[scope].error('Unrecognized database error — full details:');
    log.stack(error).forEach(line => log[scope].error(line));
  }
}

module.exports = { diagnoseDbError, reportDbFailure };
