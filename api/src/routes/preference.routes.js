const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const studentStore = require('../models/studentStore');

const VALID = new Set(['all', 'minimal']);

/** Soft auth: attach the student when a session exists, but never reject visitors. */
const softAuthenticate = async (req, res, next) => {
  try { await authenticate(req, res, () => next()); }
  catch { next(); }
  // authenticate() responds 401 itself when no session; treat as anonymous.
  if (!res.headersSent) return next();
};

router.post('/', async (req, res) => {
  const choice = String(req.body?.choice || '');
  if (!VALID.has(choice)) return res.status(400).json({ success: false, message: 'Choice must be "all" or "minimal".' });
  // Record against the signed-in account when possible; otherwise accept silently.
  try {
    const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('pf_session='))?.slice(11);
    const auth = require('../services/auth.service');
    const student = await auth.getStudentForSession(token);
    if (student) await studentStore.saveConsentChoice(student.id, 'cookies', choice);
  } catch { /* anonymous visitors: nothing to persist server-side */ }
  return res.json({ success: true, choice });
});

router.get('/', softAuthenticate, (req, res) => {
  res.json({ success: true, choice: req.student?.consentChoices?.cookies || null });
});

module.exports = router;
