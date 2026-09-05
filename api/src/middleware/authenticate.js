const auth = require('../services/auth.service');
module.exports = async (req, res, next) => {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('pf_session='))?.slice(11);
  const student = await auth.getStudentForSession(token);
  if (!student) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  req.student = student; next();
};
