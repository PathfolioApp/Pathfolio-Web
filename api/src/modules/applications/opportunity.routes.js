const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const content = require('../admin/adminContent.service');
const studentStore = require('../students/studentStore');
const placementPolicy = require('../admin/placementPolicy.service');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    res.json({ success: true, jobPosts: await content.publishedJobsForStudent(req.student.id) });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

router.get('/:id/eligibility', async (req, res) => {
  try {
    const job = await content.getJobPost ? await content.getJobPost(req.params.id) : await require('../admin/adminContentStore').getJobPost(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const student = await studentStore.getStudentById(req.student.id);
    const upgradeCheck = await placementPolicy.evaluateUpgradeEligibility(req.student.id, job);
    const issues = content.checkEligibility(student, job, upgradeCheck);
    res.json({
      success: true,
      eligible: issues.length === 0,
      issues,
      upgradePolicy: upgradeCheck
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

router.post('/:id/applications', async (req, res) => {
  try {
    const payload = req.body || {};
    const application = await content.apply(req.params.id, req.student.id, payload);
    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

module.exports = router;