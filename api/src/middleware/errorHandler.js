function errorHandler(err, req, res, next) {
  // Never log raw body that could contain sensitive family context
  console.error('[API Error]:', {
    message: err.message,
    path: req.originalUrl,
    method: req.method
  });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred on the server.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
