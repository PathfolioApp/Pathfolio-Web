const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireAdmin = require('../../shared/requireAdmin');
const content = require('./adminContent.service');
const cloudinary = require('cloudinary').v2;
const config = require('../../config');
const users = require('./adminUser.service');
const jdAnalyzer = require('./jdAnalyzer.service');
const studentSearch = require('./studentSearch.service');
const shares = require('../recruiters/recruiterShare.service');
const auditLog = require('../../shared/auditLog.service');
const placementPolicy = require('./placementPolicy.service');

router.use(authenticate, requireAdmin);

const send = async (res, action) => { try { res.json({ success: true, ...(await action()) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } };

router.get('/me', (req, res) => {
  res.json({ success: true, admin: { id: req.student.id, isAdmin: true } });
});

router.get('/users', (req, res) => send(res, async () => ({ users: await users.list() })));
router.get('/overview', (req, res) => send(res, async () => ({ overview: await users.overview(), jobs: await content.jobs(), companies: await content.companies(), applications: await content.applications() })));
router.post('/users', (req, res) => send(res, async () => ({ user: await users.create(req.body) })));
router.post('/users/import', (req, res) => send(res, async () => ({ summary: await users.importRows(req.body.rows) })));
router.patch('/users/:id/role', (req, res) => send(res, async () => ({ user: await users.setRole(req.params.id, req.body.role, req.student.id) })));
router.patch('/users/:id/block', (req, res) => send(res, async () => ({ user: await users.setBlocked(req.params.id, Boolean(req.body.blocked), req.student.id) })));
router.delete('/users/:id', (req, res) => send(res, async () => ({ deleted: await users.deleteAccount(req.params.id, req.student.id) })));

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

// ---------------------------------------------------------------------------
// Job posts & approval workflow (recruiter → admin → publish)
// ---------------------------------------------------------------------------
router.get('/job-posts', (req, res) => send(res, async () => ({ jobPosts: await content.jobs(req.query.status) })));
router.post('/job-posts', (req, res) => send(res, async () => ({ jobPost: await content.createJob(req.body, req.student.id) })));
router.patch('/job-posts/:id', (req, res) => send(res, async () => ({ jobPost: await content.updateJob(req.params.id, req.body, { editorId: req.student.id }) })));
router.get('/job-posts/:id', (req, res) => send(res, async () => ({ jobPost: await content.getJobPost(req.params.id) })));
// Review a pending job: approve / reject with an optional note.
router.post('/job-posts/:id/review', (req, res) => send(res, async () => ({ jobPost: await content.reviewJob(req.params.id, req.student.id, { decision: req.body.decision, note: req.body.note }) })));
// Publish is admin-only; requires prior approval unless the admin created the job.
router.post('/job-posts/:id/publish', (req, res) => send(res, async () => ({ jobPost: await content.publishJob(req.params.id, req.student.id) })));
router.post('/job-posts/:id/unpublish', (req, res) => send(res, async () => ({ jobPost: await content.unpublishJob(req.params.id) })));
router.post('/job-posts/:id/reopen', (req, res) => send(res, async () => ({ jobPost: await content.reopenJob(req.params.id) })));
router.post('/jd/analyze', (req, res) => send(res, async () => jdAnalyzer.analyze(req.body)));
router.get('/applications', (req, res) => send(res, async () => ({ applications: await content.applications(req.query.jobPostId) })));
router.patch('/applications/:id', (req, res) => send(res, async () => ({ application: await content.updateApplication(req.params.id, req.body) })));

// ---------------------------------------------------------------------------
// Placement upgrade policy & bracket configuration
// ---------------------------------------------------------------------------
router.get('/placement-policy', (req, res) => send(res, async () => ({ policy: await placementPolicy.getPolicy() })));
router.put('/placement-policy', (req, res) => send(res, async () => ({ policy: await placementPolicy.updatePolicy(req.body, req.student.id) })));

// ---------------------------------------------------------------------------
// Student search & discovery (admin-only by design, recruiters have no
// equivalent endpoint anywhere in the API).
// ---------------------------------------------------------------------------
router.get('/students', (req, res) => send(res, async () => studentSearch.search(req.query)));
router.get('/students/:id', (req, res) => send(res, async () => ({ student: await studentSearch.getStudentDetail(req.params.id) })));

// ---------------------------------------------------------------------------
// Recruiter shares (student shortlists)
// ---------------------------------------------------------------------------
router.get('/shares', (req, res) => send(res, async () => ({ shares: await shares.listForAdmin() })));
router.post('/shares', (req, res) => send(res, async () => ({ share: await shares.createShare({ ...req.body, createdBy: req.student.id }) })));
router.get('/recruiters', (req, res) => send(res, async () => ({ recruiters: await users.list().then(list => list.filter(user => user.role === 'recruiter')) })));

// Audit trail for administrative and workflow events.
router.get('/logs', (req, res) => send(res, async () => ({ logs: await auditLog.list(req.query), actions: await auditLog.actions() })));

module.exports = router;
