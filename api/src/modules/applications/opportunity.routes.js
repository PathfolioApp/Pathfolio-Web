const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const content = require('../admin/adminContent.service');
const contentStore = require('../admin/adminContentStore');
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

/** The signed-in student's own applications with status timeline. */
router.get('/mine', async (req, res) => {
  try {
    const all = await contentStore.listApplications();
    const mine = all.filter(a => a.studentId === req.student.id);
    const applications = [];
    for (const app of mine) {
      let job = null;
      try { job = await contentStore.getJobPost(app.jobPostId); } catch { /* job may be archived */ }
      const history = [
        { status: 'applied', at: app.createdAt, label: 'Application submitted' },
        ...(app.updatedAt && app.updatedAt !== app.createdAt ? [{ status: app.status, at: app.updatedAt, label: `Status updated to ${app.status}` }] : [])
      ];
      applications.push({
        id: app.id,
        jobPostId: app.jobPostId,
        status: app.status,
        appliedAt: app.createdAt,
        updatedAt: app.updatedAt,
        job: job ? { id: job.id, title: job.title, companyName: job.companyName || '', employmentType: job.employmentType || '', workMode: job.workMode || '', salaryRange: job.salaryRange || '' } : null,
        timeline: history
      });
    }
    applications.sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));
    res.json({ success: true, applications });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

/** Timeline for one specific application (per-event detail). */
router.get('/mine/:id/timeline', async (req, res) => {
  try {
    const all = await contentStore.listApplications();
    const app = all.find(a => a.id === req.params.id && a.studentId === req.student.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    let job = null;
    try { job = await contentStore.getJobPost(app.jobPostId); } catch { /* archived */ }
    const auditService = require('../../shared/auditLog.service');
    const audit = auditService.list ? await auditService.list({ entity: 'application', search: app.id, limit: 60 }) : [];
    const events = audit
      .filter(entry => entry.entityId === app.id)
      .map(entry => ({ at: entry.createdAt, action: entry.action, detail: entry.detail, actor: entry.actorName || 'Placement team' }));
    res.json({
      success: true,
      timeline: {
        id: app.id,
        status: app.status,
        job: job ? { title: job.title, companyName: job.companyName || '' } : null,
        events: events.length ? events : [
          { at: app.createdAt, action: 'application.created', detail: 'Application submitted', actor: 'You' },
          ...(app.updatedAt !== app.createdAt ? [{ at: app.updatedAt, action: 'application.status', detail: `Moved to ${app.status}`, actor: 'Placement team' }] : [])
        ]
      }
    });
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

/** Aggregate, privacy-safe placement statistics for the signed-in student. */
router.get('/stats', async (req, res) => {
  try {
    const all = await contentStore.listApplications();
    const jobs = await contentStore.listJobPosts();
    const students = await studentStore.listStudents();
    const studentPool = students.filter(s => !s.isAdmin && !s.isRecruiter);
    const mine = all.filter(a => a.studentId === req.student.id);
    const published = jobs.filter(j => j.status === 'published');
    const byStatus = count => mine.filter(a => a.status === count).length;
    const perCompany = {};
    for (const app of all) {
      const job = jobs.find(j => j.id === app.jobPostId);
      if (!job) continue;
      const key = job.companyName || 'Unknown';
      perCompany[key] = perCompany[key] || { applications: 0, selected: 0 };
      perCompany[key].applications += 1;
      if (app.status === 'selected') perCompany[key].selected += 1;
    }
    res.json({
      success: true,
      stats: {
        me: {
          applications: mine.length,
          shortlisted: byStatus('shortlisted'),
          interviews: byStatus('interview'),
          selected: byStatus('selected'),
          rejected: byStatus('rejected'),
          activeOpportunities: published.length
        },
        cohort: {
          students: studentPool.length,
          totalApplications: all.length,
          applicationRate: studentPool.length ? Math.round(all.length / studentPool.length * 10) / 10 : 0,
          offers: all.filter(a => a.status === 'selected').length
        },
        perCompany: Object.entries(perCompany)
          .map(([companyName, data]) => ({ companyName, ...data }))
          .sort((a, b) => b.applications - a.applications)
          .slice(0, 8)
      }
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

/** Saved placement-portal searches (per student, stored on the student row). */
router.get('/saved-searches', async (req, res) => {
  try {
    const student = await studentStore.getStudentById(req.student.id);
    res.json({ success: true, savedSearches: (student.savedSearches || []) });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

router.post('/saved-searches', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 60);
    const query = req.body.query && typeof req.body.query === 'object' ? req.body.query : {};
    if (!name) return res.status(400).json({ success: false, message: 'A name is required for the saved search.' });
    const student = await studentStore.getStudentById(req.student.id);
    const savedSearches = student.savedSearches || [];
    if (savedSearches.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'A saved search with this name already exists.' });
    }
    const entry = { id: `ss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, query, createdAt: new Date().toISOString() };
    student.savedSearches = [...savedSearches, entry].slice(-12);
    await studentStore.saveStudent(student);
    res.status(201).json({ success: true, savedSearch: entry });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

router.delete('/saved-searches/:id', async (req, res) => {
  try {
    const student = await studentStore.getStudentById(req.student.id);
    const before = (student.savedSearches || []).length;
    student.savedSearches = (student.savedSearches || []).filter(s => s.id !== req.params.id);
    await studentStore.saveStudent(student);
    res.json({ success: true, deleted: before !== student.savedSearches.length });
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