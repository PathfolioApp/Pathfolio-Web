const auth = require('../services/auth.service');
module.exports = async (req, res, next) => {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('pf_session='))?.slice(11);
  const student = await auth.getStudentForSession(token);
  if (!student) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  if (student.blocked) return res.status(403).json({ success: false, message: 'This account has been blocked. Please contact your PathfolioApp administrator.' });
  req.student = student; next();
};
