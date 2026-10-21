const router = require('express').Router();
const auth = require('../../shared/authenticate');
const service = require('./story.service');
const log = require('../../shared/logger').api;
router.use(auth);

function respond(res, result) {
  const { status = 200, retryAfter, ...body } = result;
  res.setHeader('Cache-Control', 'private, no-store');
  if (retryAfter) res.setHeader('Retry-After', String(retryAfter));
  return res.status(status).json({ success: status < 400, ...body, ...(retryAfter ? { retryAfter } : {}) });
}
const unavailable = (res, error) => {
  log.warn('[Story AI] Storage or generation failed; returning 503.', JSON.stringify({ event: 'story_unavailable', code: error.code || 'storage_error' }));
  return res.status(503).json({ success: false, message: 'Your story is briefly unavailable. Please try again shortly.' });
};
router.get('/me/summary', async (req, res) => {
  try { return respond(res, await service.read(req.student)); }
  catch (error) { return unavailable(res, error); }
});
router.post('/me/summary', async (req, res) => {
  if (req.body?.regenerate !== undefined && typeof req.body.regenerate !== 'boolean') return res.status(400).json({ success: false, message: 'Regenerate must be true or false.' });
  try { return respond(res, await service.generate(req.student, req.body?.regenerate === true)); }
  catch (error) { return unavailable(res, error); }
});
module.exports = router;
