const { renderResumePdf } = require('./resumePdf.service');
const { sanitizeFilename } = require('./resumeValidation');
const log = require('../../shared/logger');

async function exportPdf(req, res, next) {
  try {
    const filename = sanitizeFilename(req.body?.filename || 'Resume.pdf');
    const pdf = await renderResumePdf(req.body?.html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.attachment(filename);
    res.send(pdf);
  } catch (error) {
    if (error.statusCode === 503) res.setHeader('Retry-After', '3');
    if (error.statusCode === 503 || error.statusCode === 504) {
      log.api.warn('[Resume PDF] Export unavailable.', { status: error.statusCode, reason: error.message });
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

module.exports = { exportPdf };
