const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireRecruiter = require('../middleware/requireRecruiter');
const recruiter = require('../services/recruiter.service');

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