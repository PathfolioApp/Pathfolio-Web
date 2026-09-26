const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

router.use(authenticate, requireAdmin);

router.get('/me', (req, res) => {
  res.json({ success: true, admin: { id: req.student.id, isAdmin: true } });
});

module.exports = router;