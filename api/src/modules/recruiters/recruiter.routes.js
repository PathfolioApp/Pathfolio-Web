const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireRecruiter = require('../../shared/requireRecruiter');
const content = require('../admin/adminContent.service');
const shares = require('./recruiterShare.service');

router.use(authenticate, requireRecruiter);

const send = async (res, action) => { try { res.json({ success: true, ...(await action()) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } };
const notFound = label => { const error = new Error(`${label} not found.`); error.statusCode = 404; return error; };

/** Recruiters may only manage their own job posts. */
async function ownJob(req) {
  const job = await content.getJobPost(req.params.id);
  if (!job) throw notFound('Job post');
  if (job.createdBy !== req.student.id) throw { statusCode: 403, message: 'You can only manage your own job posts.' };
  return job;
}

router.get('/companies', (req, res) => send(res, async () => ({ companies: await content.companies() })));
router.get('/overview', (req, res) => send(res, async () => {
  const jobs = (await content.jobs()).filter(job => job.createdBy === req.student.id);
  const allApplications = await content.applications();
  const myJobIds = new Set(jobs.map(job => job.id));
  const applications = allApplications.filter(application => myJobIds.has(application.jobPostId));
  const statusCounts = { applied: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0 };
  applications.forEach(application => { statusCounts[application.status] = (statusCounts[application.status] || 0) + 1; });
  return {
    overview: {
      totalJobs: jobs.length,
      published: jobs.filter(job => job.status === 'published').length,
      drafts: jobs.filter(job => job.status === 'draft').length,
      pendingApproval: jobs.filter(job => job.status === 'pending_approval').length,
      approved: jobs.filter(job => job.status === 'approved').length,
      rejected: jobs.filter(job => job.status === 'rejected').length,
      totalApplications: applications.length,
      sharedCandidates: await shares.countForRecruiter(req.student.id),
      statusCounts,
      last7Days: applications.filter(application => Date.now() - new Date(application.createdAt).getTime() < 7 * 86400000).length,
      perJob: jobs.map(job => ({ id: job.id, title: job.title, status: job.status, companyName: job.companyName, applications: applications.filter(application => application.jobPostId === job.id).length })).sort((a, b) => b.applications - a.applications).slice(0, 6)
    }
  };
}));
router.get('/jobs', (req, res) => send(res, async () => ({ jobPosts: (await content.jobs(req.query.status)).filter(job => job.createdBy === req.student.id) })));

router.post('/jobs', (req, res) => send(res, async () => {
  const job = await content.createJob(req.body, req.student.id, { enforceAudience: true });
  // Recruiters never publish directly; optionally submit straight to admin review.
  if (req.body.submit) return { jobPost: await content.submitJobForApproval(job.id, req.student.id) };
  return { jobPost: job };
}));

router.patch('/jobs/:id', (req, res) => send(res, async () => {
  await ownJob(req);
  const job = await content.updateJob(req.params.id, req.body, { editorId: req.student.id });
  if (req.body.submit && ['draft', 'rejected'].includes(job.status)) return { jobPost: await content.submitJobForApproval(job.id, req.student.id) };
  return { jobPost: job };
}));

router.delete('/jobs/:id', (req, res) => send(res, async () => {
  const job = await ownJob(req);
  await content.archiveJobPost(job.id);
  return { jobPost: job };
}));

// Recruiter asks the admin to review/publish, they cannot publish directly.
router.post('/jobs/:id/submit', (req, res) => send(res, async () => { await ownJob(req); return { jobPost: await content.submitJobForApproval(req.params.id, req.student.id) }; }));

// Direct publish/unpublish endpoints were removed: publishing is admin-only.
router.get('/jobs/:id/applications', (req, res) => send(res, async () => { await ownJob(req); return { applications: await content.applications(req.params.id) }; }));

// ---------------------------------------------------------------------------
// Shared candidates, only students an admin explicitly shared with this
// recruiter. There is no route to search or list the broader student body.
// ---------------------------------------------------------------------------
router.get('/shared-candidates', (req, res) => send(res, async () => {
  const all = await shares.listForRecruiter(req.student.id);
  // Optional filters: name/company/department/skill + minimum CGPA.
  const q = String(req.query.search || '').toLowerCase().trim();
  const minCgpa = req.query.minCgpa !== undefined && req.query.minCgpa !== '' && !Number.isNaN(Number(req.query.minCgpa)) ? Number(req.query.minCgpa) : null;
  let filtered = all;
  if (q || minCgpa !== null) {
    filtered = all.filter(share => {
      const students = share.students || share.candidates || [];
      return students.some(student => {
        const name = String(student.fullName || student.personal?.fullName || '').toLowerCase();
        const dept = String(student.department || student.academic?.department || '').toLowerCase();
        const cgpa = Number(student.cgpa ?? student.academic?.cgpa ?? -1);
        const skills = [
          ...(student.skills || []),
          ...((student.interests?.passions || []).map(i => typeof i === 'string' ? i : i?.name || '')),
          ...((student.interests?.hobbies || []).map(i => typeof i === 'string' ? i : i?.name || ''))
        ].map(s => String(s).toLowerCase());
        if (minCgpa !== null && (Number.isNaN(cgpa) || cgpa < minCgpa)) return false;
        if (q && !(name.includes(q) || dept.includes(q) || skills.some(s => s.includes(q)))) return false;
        return true;
      });
    }).map(share => ({
      ...share,
      students: (share.students || share.candidates || []).filter(student => {
        const name = String(student.fullName || student.personal?.fullName || '').toLowerCase();
        const dept = String(student.department || student.academic?.department || '').toLowerCase();
        const cgpa = Number(student.cgpa ?? student.academic?.cgpa ?? -1);
        const skills = [...(student.skills || []), ...((student.interests?.passions || []).map(i => typeof i === 'string' ? i : i?.name || '')), ...((student.interests?.hobbies || []).map(i => typeof i === 'string' ? i : i?.name || ''))].map(s => String(s).toLowerCase());
        if (minCgpa !== null && (Number.isNaN(cgpa) || cgpa < minCgpa)) return false;
        if (q && !(name.includes(q) || dept.includes(q) || skills.some(s => s.includes(q)))) return false;
        return true;
      })
    }));
  }
  return { shares: filtered, total: all.length };
}));
router.get('/shared-candidates/:shareId', (req, res) => send(res, async () => ({ share: await shares.getForRecruiter(req.params.shareId, req.student.id) })));
router.post('/shared-candidates/:shareId/feedback', (req, res) => send(res, async () => ({ share: await shares.recordFeedback(req.params.shareId, req.student.id, req.body) })));

module.exports = router;
