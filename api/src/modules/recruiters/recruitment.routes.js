const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireRecruiter = require('../../shared/requireRecruiter');
const recruitment = require('../admin/recruitment.service');
const store = require('../admin/recruitmentStore');
const adminContentStore = require('../admin/adminContentStore');
const studentStore = require('../students/studentStore');
const resumeStore = require('../resumes/resumeStore');
const auditLog = require('../../shared/auditLog.service');

/**
 * Recruitment Intelligence routes (company / recruiter side).
 * Mounted at /api/recruiter/recruitment alongside the existing recruiter API.
 */
router.use(authenticate, requireRecruiter);

const send = async (res, action) => { try { res.json({ success: true, ...(await action()) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } };

router.get('/engagements', (req, res) => send(res, async () => {
  const engagements = await store.listEngagements({});
  const companies = await adminContentStore.listCompanies();
  const companyById = new Map(companies.map(company => [company.id, company]));
  const myToken = tokenOf(req.student);
  const mine = engagements.filter(engagement => {
    const company = companyById.get(engagement.companyId);
    const companyToken = tokenOfName(company?.name || '');
    return companyToken.length >= 4 && myToken.includes(companyToken);
  });
  const messageCounts = await Promise.all(mine.map(engagement => store.listMessages(engagement.id)));
  return {
    engagements: mine.map((engagement, index) => ({
      id: engagement.id,
      title: engagement.title,
      companyName: companyById.get(engagement.companyId)?.name || '',
      status: engagement.status,
      statusLabel: recruitment.STATUS_LABELS[engagement.status] || engagement.status,
      provisional: engagement.provisional,
      proposedStart: engagement.proposedStart,
      proposedEnd: engagement.proposedEnd,
      confirmedStart: engagement.confirmedStart,
      confirmedEnd: engagement.confirmedEnd,
      roles: engagement.roles,
      messageCount: messageCounts[index].length,
      updatedAt: engagement.updatedAt
    }))
  };
}));

router.get('/engagements/:id', (req, res) => send(res, async () => {
  const engagement = await assertCompanyEngagement(req);
  const messages = await store.listMessages(engagement.id);
  const company = await adminContentStore.getCompany(engagement.companyId);
  const shares = (await store.listShares({ engagementId: engagement.id })).filter(share => share.status !== 'revoked');
  const shareSummaries = [];
  for (const share of shares) {
    // Access-level aware projection for the company timeline sidebar.
    const student = await studentStore.getStudentById(share.studentId);
    shareSummaries.push({
      shareId: share.id,
      role: share.roleTitle,
      accessLevel: share.accessLevel,
      status: share.status,
      companyResponse: share.companyResponse,
      respondedAt: share.respondedAt,
      candidate: share.accessLevel === 'summary'
        ? { initials: initialsOf(student?.personal?.fullName), department: student?.academic?.department || '' }
        : { fullName: student?.personal?.fullName || '', department: student?.academic?.department || '', cgpa: student?.academic?.cgpa ?? null }
    });
  }
  return {
    engagement: {
      id: engagement.id,
      title: engagement.title,
      companyName: company?.name || '',
      status: engagement.status,
      statusLabel: recruitment.STATUS_LABELS[engagement.status] || engagement.status,
      provisional: engagement.provisional,
      proposedStart: engagement.proposedStart,
      proposedEnd: engagement.proposedEnd,
      confirmedStart: engagement.confirmedStart,
      confirmedEnd: engagement.confirmedEnd,
      roles: engagement.roles,
      jobDescription: engagement.jobDescription,
      proposalNote: engagement.proposalNote
    },
    messages: messages.map(message => ({
      id: message.id,
      senderRole: message.senderRole,
      senderName: message.senderName,
      body: message.body,
      attachments: message.attachments,
      kind: message.kind,
      createdAt: message.createdAt
    })),
    candidates: shareSummaries
  };
}));

router.post('/engagements/:id/respond', (req, res) => send(res, async () => {
  const engagement = await assertCompanyEngagement(req);
  return { engagement: await recruitment.companyRespond(engagement.id, req.student.id, req.body) };
}));

router.post('/engagements/:id/messages', (req, res) => send(res, async () => {
  const engagement = await assertCompanyEngagement(req);
  return { message: await recruitment.postMessage(engagement.id, 'company', req.student.id, req.body) };
}));

router.get('/engagements/:id/summary', (req, res) => send(res, async () => {
  const engagement = await assertCompanyEngagement(req);
  return { summary: await recruitment.summarizeCommunication(engagement.id) };
}));

// Student-controlled resume policy: the student picks which resume to submit.
router.post('/shares/:id/select-resume', (req, res) => send(res, async () => {
  const share = await store.getShare(req.params.id);
  if (!share) { const error = new Error('Share not found.'); error.statusCode = 404; throw error; }
  if (share.policyMode !== 'student_controlled') {
    throw { statusCode: 403, message: 'Resume selection is controlled by the university for this share.' };
  }
  const resume = await resumeStore.findOwnedResume(req.student.id, req.body.resumeId);
  if (!resume) throw { statusCode: 404, message: 'Resume not found.' };
  const updated = await store.saveShare({ ...share, resumeId: String(resume.id), updatedAt: new Date().toISOString() });
  await auditLog.record({ actorId: req.student.id, action: 'recruitment.resume.selected', entityType: 'recruitment_share', entityId: share.id, entityLabel: resume.filename, detail: 'Student selected their resume.' });
  return { share: updated };
}));

// Candidate list for the company (access-level enforced, logged on open).
router.get('/candidates', (req, res) => send(res, async () => {
  const shares = await store.listShares({});
  const companies = await adminContentStore.listCompanies();
  const companyById = new Map(companies.map(company => [company.id, company]));
  const myToken = tokenOf(req.student);
  const mine = [];
  for (const share of shares) {
    const companyToken = tokenOfName(companyById.get(share.companyId)?.name || '');
    const addressed = share.recruiterId === req.student.id || (companyToken.length >= 4 && myToken.includes(companyToken));
    if (!addressed) continue;
    const student = await studentStore.getStudentById(share.studentId);
    mine.push({
      shareId: share.id,
      status: share.status,
      accessLevel: share.accessLevel,
      role: share.roleTitle,
      engagementId: share.engagementId,
      companyResponse: share.companyResponse,
      companyResponseNote: share.companyResponseNote,
      sharedAt: share.createdAt,
      revoked: share.status === 'revoked',
      candidate: share.status === 'revoked'
        ? { fullName: 'Access revoked' }
        : share.accessLevel === 'summary'
          ? { initials: initialsOf(student?.personal?.fullName), department: student?.academic?.department || '', batchYear: student?.academic?.batchYear || '' }
          : { fullName: student?.personal?.fullName || '', department: student?.academic?.department || '', batchYear: student?.academic?.batchYear || '', cgpa: student?.academic?.cgpa ?? null, rollNumber: student?.academic?.rollNumber || '' }
    });
  }
  return { shares: mine.sort((a, b) => new Date(b.sharedAt) - new Date(a.sharedAt)) };
}));

router.get('/shared-candidates/:shareId', (req, res) => send(res, async () => recruitment.getShareForRecruiter(req.params.shareId, req.student.id)));
router.post('/shared-candidates/:shareId/feedback', (req, res) => send(res, async () => ({ share: await recruitment.recordShareFeedback(req.params.shareId, req.student.id, req.body) })));

// ------------------------------------------------------------------ helpers

function tokenOf(user) {
  return [user?.personal?.fullName, user?.personal?.email].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function tokenOfName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function initialsOf(name) {
  return String(name || 'S').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

async function assertCompanyEngagement(req) {
  const engagement = await store.getEngagement(req.params.id);
  if (!engagement) { const error = new Error('Recruitment engagement not found.'); error.statusCode = 404; throw error; }
  const company = await adminContentStore.getCompany(engagement.companyId);
  const companyToken = tokenOfName(company?.name || '');
  const myToken = tokenOf(req.student);
  if (!(companyToken.length >= 4 && myToken.includes(companyToken))) {
    throw { statusCode: 403, message: 'This recruitment engagement is not addressed to your company.' };
  }
  return engagement;
}

module.exports = router;
