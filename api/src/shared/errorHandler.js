const log = require('./logger');
const { isTransientDbError } = require('./db');

function errorHandler(err, req, res, next) {
  // A recycled MySQL socket is a transport hiccup, not a bug and not a client
  // fault. 503 tells the caller to retry, where a 500 would read as a broken
  // endpoint. Only for socket-level codes - SQL errors (ER_*) keep their own
  // status and stay 500.
  const transientDb = isTransientDbError(err);
  const statusCode = transientDb ? 503 : err.statusCode || 500;

  // Never log raw body content that could contain sensitive family context
  // only metadata: route, method, status, and the driver error code if any.
  const isServerError = !err.statusCode || err.statusCode >= 500;
  const entry = `${req.method} ${req.originalUrl} -> ${statusCode}: ${log.describeError(err)}`;

  if (transientDb) {
    // Expected under load / flaky network: one line, no stack, no alert noise.
    log.db.warn(`Recoverable database transport failure: ${entry}`);
  } else if (isServerError) {
    // Unexpected: keep a short stack trace for debugging.
    log.api.error(entry);
    if (err.stack) log.api.error(...log.stack(err).slice(0, 4));
  } else {
    // Expected client/domain errors (validation, 404, authz): one line, no stack.
    log.api.warn(entry);
  }

  const message = transientDb
    ? 'The service is briefly unreachable. Please retry in a moment.'
    : err.statusCode && err.statusCode < 500
      // Curated domain errors (validation, authz, not-found) keep their copy.
      ? (err.message || 'The request could not be completed.')
      // Unexpected 5xx: details stay in the log; internals never reach the UI.
      : (process.env.NODE_ENV === 'development' ? (err.message || 'An unexpected error occurred on the server.') : 'An unexpected error occurred on the server. Please try again.');
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
