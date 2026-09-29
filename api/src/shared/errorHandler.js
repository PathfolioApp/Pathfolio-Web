const log = require('./logger');

function errorHandler(err, req, res, next) {
  // Never log raw body content that could contain sensitive family context —
  // only metadata: route, method, status, and the driver error code if any.
  const isServerError = !err.statusCode || err.statusCode >= 500;
  const entry = `${req.method} ${req.originalUrl} -> ${err.statusCode || 500}: ${log.describeError(err)}`;

  if (isServerError) {
    // Unexpected: keep a short stack trace for debugging.
    log.api.error(entry);
    if (err.stack) log.api.error(...log.stack(err).slice(0, 4));
  } else {
    // Expected client/domain errors (validation, 404, authz): one line, no stack.
    log.api.warn(entry);
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred on the server.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
