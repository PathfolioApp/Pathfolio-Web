const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const content = require('../services/adminContent.service');
const cloudinary = require('cloudinary').v2;
const config = require('../config');
const users = require('../services/adminUser.service');
const jdAnalyzer = require('../services/jdAnalyzer.service');

router.use(authenticate, requireAdmin);

const send = async (res, action) => { try { res.json({ success: true, ...(await action()) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } };

router.get('/me', (req, res) => {
  res.json({ success: true, admin: { id: req.student.id, isAdmin: true } });
});

router.get('/users', (req, res) => send(res, async () => ({ users: await users.list() })));
router.post('/users', (req, res) => send(res, async () => ({ user: await users.create(req.body) })));
router.post('/users/import', (req, res) => send(res, async () => ({ summary: await users.importRows(req.body.rows) })));
router.patch('/users/:id/role', (req, res) => send(res, async () => ({ user: await users.setRole(req.params.id, req.body.role) })));

router.post('/uploads/signature', (req, res) => {
  if (!config.cloudinary.configured) return res.status(503).json({ success: false, message: 'Cloudinary is not configured on the API.' });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = config.cloudinary.uploadFolder;
  const accessMode = 'public';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder, access_mode: accessMode }, config.cloudinary.apiSecret);
  res.json({ success: true, cloudName: config.cloudinary.cloudName, apiKey: config.cloudinary.apiKey, timestamp, folder, accessMode, signature });
});

router.get('/companies', (req, res) => send(res, async () => ({ companies: await content.companies() })));
router.post('/companies/import', (req, res) => send(res, async () => ({ summary: await content.importCompanies(req.body.rows, req.student.id) })));
router.post('/companies', (req, res) => send(res, async () => ({ company: await content.createCompany(req.body, req.student.id) })));
router.patch('/companies/:id', (req, res) => send(res, async () => ({ company: await content.updateCompany(req.params.id, req.body) })));
router.delete('/companies/:id', (req, res) => send(res, async () => ({ company: await content.archiveCompany(req.params.id) })));
router.get('/job-posts', (req, res) => send(res, async () => ({ jobPosts: await content.jobs(req.query.status) })));
router.post('/job-posts', (req, res) => send(res, async () => ({ jobPost: await content.createJob(req.body, req.student.id) })));
router.patch('/job-posts/:id', (req, res) => send(res, async () => ({ jobPost: await content.updateJob(req.params.id, req.body) })));
router.post('/job-posts/:id/publish', (req, res) => send(res, async () => ({ jobPost: await content.publishJob(req.params.id) })));
router.post('/job-posts/:id/unpublish', (req, res) => send(res, async () => ({ jobPost: await content.unpublishJob(req.params.id) })));
router.post('/jd/analyze', (req, res) => send(res, async () => jdAnalyzer.analyze(req.body)));
router.get('/applications', (req, res) => send(res, async () => ({ applications: await content.applications(req.query.jobPostId) })));
router.patch('/applications/:id', (req, res) => send(res, async () => ({ application: await content.updateApplication(req.params.id, req.body) })));

module.exports = router;