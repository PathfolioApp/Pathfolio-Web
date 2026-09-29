const auth = require('../modules/auth/auth.service');
const log = require('./logger');
const { isTransientDbError } = require('./db');

/**
 * Session gate for every protected route.
 *
 * The explicit try/catch matters: this middleware runs on *every* authenticated
 * request, so it is the most likely place for a database socket to be recycled
 * mid-flight. Reporting 503 ("try again") for a transport blip keeps the
 * difference honest — a 401 would log the user out for a server-side hiccup.
 */
module.exports = async (req, res, next) => {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('pf_session='))?.slice(11);
  let student;
  try {
    student = await auth.getStudentForSession(token);
  } catch (error) {
    if (isTransientDbError(error)) {
      log.db.warn(`Session lookup hit a dropped database connection (${log.describeError(error)}); answering 503.`);
      return res.status(503).json({ success: false, message: 'The service is briefly unreachable. Please retry in a moment.' });
    }
    return next(error);
  }
  if (!student) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  if (student.blocked) return res.status(403).json({ success: false, message: 'This account has been blocked. Please contact your PathfolioApp administrator.' });
  req.student = student; next();
};
