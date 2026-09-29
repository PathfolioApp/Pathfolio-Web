const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireRecruiter = require('../../shared/requireRecruiter');
const content = require('../admin/adminContent.service');
const adminContentStore = require('../admin/adminContentStore');

router.use(authenticate, requireRecruiter);

const send = async (res, action) => { try { res.json({ success: true, ...(await action()) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } };
const notFound = label => { const error = new Error(`${label} not found.`); error.statusCode = 404; return error; };
const clean = value => String(value || '').trim();

/** Recruiters may only manage their own job posts. */
async function ownJob(req) {
  const job = await adminContentStore.getJobPost(req.params.id);
  if (!job) throw notFound('Job post');
  if (job.createdBy !== req.student.id) throw { statusCode: 403, message: 'You can only manage your own job posts.' };
  return job;
}

router.get('/companies', (req, res) => send(res, async () => ({ companies: await content.companies() })));
router.get('/overview', (req, res) => send(res, async () => {
  const jobs = (await adminContentStore.listJobPosts()).filter(job => job.createdBy === req.student.id);
  const allApplications = await adminContentStore.listApplications();
  const myJobIds = new Set(jobs.map(job => job.id));
  const applications = allApplications.filter(application => myJobIds.has(application.jobPostId));
  const statusCounts = { applied: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0 };
  applications.forEach(application => { statusCounts[application.status] = (statusCounts[application.status] || 0) + 1; });
  return {
    overview: {
      totalJobs: jobs.length,
      published: jobs.filter(job => job.status === 'published').length,
      drafts: jobs.filter(job => job.status === 'draft').length,
      totalApplications: applications.length,
      statusCounts,
      last7Days: applications.filter(application => Date.now() - new Date(application.createdAt).getTime() < 7 * 86400000).length,
      perJob: jobs.map(job => ({ id: job.id, title: job.title, status: job.status, companyName: job.companyName, applications: applications.filter(application => application.jobPostId === job.id).length })).sort((a, b) => b.applications - a.applications).slice(0, 6)
    }
  };
}));
router.get('/jobs', (req, res) => send(res, async () => ({ jobPosts: (await adminContentStore.listJobPosts(req.query.status)).filter(job => job.createdBy === req.student.id) })));

router.post('/jobs', (req, res) => send(res, async () => {
  const job = await content.createJob(req.body, req.student.id, { enforceAudience: true });
  if (req.body.publish) return { jobPost: await content.publishJob(job.id) };
  return { jobPost: job };
}));

router.patch('/jobs/:id', (req, res) => send(res, async () => {
  await ownJob(req);
  const job = await content.updateJob(req.params.id, req.body);
  if (req.body.publish) return { jobPost: await content.publishJob(job.id) };
  return { jobPost: job };
}));

router.delete('/jobs/:id', (req, res) => send(res, async () => {
  const job = await ownJob(req);
  await adminContentStore.archiveJobPost(job.id);
  return { jobPost: job };
}));

router.post('/jobs/:id/publish', (req, res) => send(res, async () => { await ownJob(req); return { jobPost: await content.publishJob(req.params.id) }; }));
router.post('/jobs/:id/unpublish', (req, res) => send(res, async () => { await ownJob(req); return { jobPost: await content.unpublishJob(req.params.id) }; }));
router.get('/jobs/:id/applications', (req, res) => send(res, async () => { await ownJob(req); return { applications: await adminContentStore.listApplications(req.params.id) }; }));

module.exports = router;
