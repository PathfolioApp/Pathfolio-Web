module.exports = (req, res, next) => {
  if (!req.student?.isRecruiter && !req.student?.isAdmin) {
    return res.status(403).json({ success: false, message: 'Recruiter access required.' });
  }

  next();
};