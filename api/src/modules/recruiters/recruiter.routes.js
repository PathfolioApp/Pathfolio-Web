const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireRecruiter = require('../../shared/requireRecruiter');
const recruiter = require('./recruiter.service');

router.use(authenticate, requireRecruiter);
router.get('/students', async (req, res) => {
  try {
    const students = await recruiter.search(req.query);
    res.json({ success: true, students });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

module.exports = router;