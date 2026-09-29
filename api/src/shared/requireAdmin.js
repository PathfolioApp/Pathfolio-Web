module.exports = (req, res, next) => {
  if (!req.student?.isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  next();
};