const router = require('express').Router();
const authenticate = require('../../shared/authenticate');
const requireAdmin = require('../../shared/requireAdmin');

/**
 * Recruitment Intelligence routes (university placement team side).
 * Mounted at /api/admin/recruitment; inherits the admin-only gate.
 */
const recruitment = require('./recruitment.service');
const recruitmentPriority = require('./recruitmentPriority.service');
const store = require('./recruitmentStore');
const adminContent = require('./adminContent.service');
const auditLog = require('../../shared/auditLog.service');

router.use(authenticate, requireAdmin);

const send = async (res, action) => { try { res.json({ success: true, ...(await action()) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } };
const notFound = label => { const error = new Error(`${label} not found.`); error.statusCode = 404; return error; };
const clean = value => String(value || '').trim();

// ------------------------------------------------------------------ planning & recommendations

router.get('/recommendations', (req, res) => send(res, async () => {
  const cached = await store.listRecommendations();
  if (req.query.refresh === 'true' || !cached.length) {
    const results = await recruitmentPriority.generateRecommendations({ actorId: req.student.id, persist: true });
    return { recommendations: results, fromCache: false };
  }
  // Serve the stored recommendation set (kept fresh via ?refresh=true).
  const companies = await adminContent.companies();
  const companyById = new Map(companies.map(company => [company.id, company]));
  const latestByCompany = new Map();
  for (const record of cached) {
    if (!latestByCompany.has(record.companyId)) latestByCompany.set(record.companyId, record);
  }
  const results = [...latestByCompany.values()]
    .filter(record => companyById.has(record.companyId))
    .sort((a, b) => b.score - a.score)
    .map(record => ({
      company: {
        id: record.companyId,
        name: companyById.get(record.companyId)?.name || 'Unknown company',
        website: companyById.get(record.companyId)?.website || '',
        logoUrl: companyById.get(record.companyId)?.logoUrl || '',
        description: companyById.get(record.companyId)?.description || ''
      },
      score: record.score,
      recommendation: record.recommendation,
      recommendationLabel: recruitmentPriority.RECOMMENDATION_LABELS[record.recommendation] || record.recommendation,
      factors: record.factors,
      reasons: record.reasons,
      source: record.source,
      evidence: Object.values(record.factors).map(factor => ({ kind: factor.label, label: factor.detail, metric: factor.earned })),
      recommendationId: record.id,
      generatedAt: record.generatedAt
    }));
  return { recommendations: results, fromCache: true };
}));

router.post('/recommendations/refresh', (req, res) => send(res, async () => ({ recommendations: await recruitmentPriority.generateRecommendations({ actorId: req.student.id, persist: true }) })));

router.get('/recommendations/:id', (req, res) => send(res, async () => {
  const record = await store.getRecommendation(req.params.id);
  if (!record) throw notFound('Recommendation');
  const company = await require('./adminContentStore').getCompany(record.companyId);
  return { recommendation: { ...record, companyName: company?.name || 'Unknown company' } };
}));

// Human override / accept / ignore - always audited (#20).
router.post('/recommendations/:id/decision', (req, res) => send(res, async () => {
  const record = await store.getRecommendation(req.params.id);
  if (!record) throw notFound('Recommendation');
  const decision = String(req.body.decision || '').trim();
  if (!['accepted', 'overridden', 'ignored'].includes(decision)) throw new Error('Decision must be accepted, overridden or ignored.');
  const reason = String(req.body.reason || '').trim().slice(0, 400);
  if (decision === 'overridden' && !reason) throw new Error('A reason is required when overriding an AI recommendation.');
  const updated = await store.saveRecommendation({
    ...record,
    decision,
    decidedBy: req.student.id,
    decisionReason: reason,
    decidedAt: new Date().toISOString()
  });
  const companies = await require('./adminContentStore').listCompanies();
  const company = companies.find(item => item.id === record.companyId);
  await auditLog.record({
    actorId: req.student.id,
    action: decision === 'accepted' ? 'recruitment.recommendation.accepted' : decision === 'overridden' ? 'recruitment.recommendation.overridden' : 'recruitment.recommendation.ignored',
    entityType: 'company',
    entityId: record.companyId,
    entityLabel: company?.name || record.companyId,
    detail: decision === 'overridden'
      ? `AI said "${recruitmentPriority.RECOMMENDATION_LABELS[record.recommendation]}" (${record.score}/100); TPO decision recorded: ${reason}`
      : `Recommendation "${recruitmentPriority.RECOMMENDATION_LABELS[record.recommendation]}" (${record.score}/100) ${decision}.`
  });
  return { recommendation: updated };
}));

// ------------------------------------------------------------------ settings (resume policy etc.)

router.get('/settings', (req, res) => send(res, async () => ({ settings: await recruitment.getRecruitmentSettings() })));
router.put('/settings', (req, res) => send(res, async () => ({ settings: await recruitment.updateRecruitmentSettings(req.body, req.student.id) })));

// ------------------------------------------------------------------ engagements (drives)

router.get('/engagements', (req, res) => send(res, async () => ({ engagements: await recruitment.listEngagementsWithMeta(req.query.companyId ? { companyId: req.query.companyId } : {}) })));
router.get('/engagements/:id', (req, res) => send(res, async () => recruitment.getEngagementDetail(req.params.id)));

router.post('/engagements/preview-proposal', (req, res) => send(res, async () => ({ proposal: await recruitment.buildProposalPreview(req.body) })));
router.post('/engagements', (req, res) => send(res, async () => ({ engagement: await recruitment.createProposal(req.body, req.student.id) })));
router.post('/engagements/:id/send', (req, res) => send(res, async () => ({ ...await recruitment.sendProposal(req.params.id, req.student.id) })));
router.post('/engagements/:id/status', (req, res) => send(res, async () => ({ engagement: await recruitment.universityUpdateStatus(req.params.id, req.student.id, req.body) })));

router.patch('/engagements/:id', (req, res) => send(res, async () => {
  const existing = await store.getEngagement(req.params.id);
  if (!existing) throw notFound('Recruitment engagement');
  const clean = value => String(value || '').trim();
  const updated = await store.saveEngagement({
    ...existing,
    title: req.body.title !== undefined ? clean(req.body.title) || existing.title : existing.title,
    roles: Array.isArray(req.body.roles) ? req.body.roles.map(clean).filter(Boolean).slice(0, 10) : existing.roles,
    jobDescription: req.body.jobDescription !== undefined ? clean(req.body.jobDescription) : existing.jobDescription,
    proposalNote: req.body.proposalNote !== undefined ? clean(req.body.proposalNote) : existing.proposalNote,
    proposedStart: req.body.proposedStart || existing.proposedStart,
    proposedEnd: req.body.proposedEnd || existing.proposedEnd,
    companyContact: req.body.companyContact !== undefined ? clean(req.body.companyContact) : existing.companyContact
  });
  await auditLog.record({ actorId: req.student.id, action: 'recruitment.proposal.edited', entityType: 'recruitment_engagement', entityId: updated.id, entityLabel: updated.title, detail: 'Proposal edited before/while pending.' });
  return { engagement: updated };
}));

router.delete('/engagements/:id', (req, res) => send(res, async () => {
  const existing = await store.getEngagement(req.params.id);
  if (!existing) throw notFound('Recruitment engagement');
  const updated = await store.saveEngagement({ ...existing, status: 'cancelled', finalOutcome: 'withdrawn by university' });
  await auditLog.record({ actorId: req.student.id, action: 'recruitment.cancelled', entityType: 'recruitment_engagement', entityId: updated.id, entityLabel: updated.title, detail: 'Proposal withdrawn by the university.' });
  return { engagement: updated };
}));

// ------------------------------------------------------------------ communication

router.get('/engagements/:id/messages', (req, res) => send(res, async () => ({ messages: await recruitment.getTimeline(req.params.id) })));
router.post('/engagements/:id/messages', (req, res) => send(res, async () => ({ message: await recruitment.postMessage(req.params.id, 'university', req.student.id, req.body) })));
router.get('/engagements/:id/summary', (req, res) => send(res, async () => ({ summary: await recruitment.summarizeCommunication(req.params.id) })));

// ------------------------------------------------------------------ roles, matching, resumes

router.post('/engagements/:id/analyze-role', (req, res) => send(res, async () => recruitment.analyzeEngagementRole(req.params.id, req.student.id)));
router.get('/engagements/:id/matches', (req, res) => send(res, async () => recruitment.matchCandidates(req.params.id, { limit: Number(req.query.limit) || 50 })));
router.get('/engagements/:id/resume-recommendation/:studentId', (req, res) => send(res, async () => recruitment.recommendResumes(req.params.id, req.params.studentId)));
router.get('/engagements/:id/brief/:studentId', (req, res) => send(res, async () => ({ brief: await recruitment.generateCandidateBrief(req.params.id, req.params.studentId, { resumeId: req.query.resumeId }) })));

// ------------------------------------------------------------------ candidate sharing

router.get('/shares', (req, res) => send(res, async () => ({ shares: await store.listShares(req.query.engagementId ? { engagementId: req.query.engagementId } : {}) })));
router.post('/shares', (req, res) => send(res, async () => ({ share: await recruitment.shareCandidate(req.body, req.student.id) })));
router.post('/shares/:id/approve-resume', (req, res) => send(res, async () => {
  const result = await recruitment.resolveResumeForShare(req.params.id, { chosenResumeId: req.body.resumeId || null, deciderId: req.student.id });
  return { share: result.share, decidedBy: result.decidedBy };
}));
router.post('/shares/:id/revoke', (req, res) => send(res, async () => ({ share: await recruitment.revokeShare(req.params.id, req.student.id, req.body.reason) })));

// ------------------------------------------------------------------ bulk resume tailoring

const resumeStore = require('../resumes/resumeStore');
const tailorResumeService = require('../resumes/tailorResume.service');

/**
 * Bulk on-the-fly resume tailoring for a JD: tailors one resume per selected
 * student using the EXISTING single-page ATS tailoring engine. Sequential by
 * design (the LLM calls are the bottleneck; parallel would trip rate limits),
 * with per-student error isolation so one failure never kills the batch.
 */
router.post('/tailor-bulk', (req, res) => send(res, async () => {
  const { studentIds = [], jobTitle = '', company = '', jobDescription = '' } = req.body || {};
  const ids = [...new Set((Array.isArray(studentIds) ? studentIds : []).map(id => clean(id)).filter(Boolean))].slice(0, 25);
  if (!ids.length) throw new Error('Select at least one student (max 25 per batch).');
  if (!jobDescription || String(jobDescription).trim().length < 40) throw new Error('A detailed job description is required (minimum 40 characters).');

  const results = [];
  for (const studentId of ids) {
    const student = await require('../students/studentStore').getStudentById(studentId);
    if (!student || student.isAdmin || student.isRecruiter) {
      results.push({ studentId, ok: false, error: 'Student not found' });
      continue;
    }
    try {
      const tailored = await tailorResumeService.tailorForJd(studentId, {
        jobTitle: clean(jobTitle) || undefined,
        company: clean(company) || undefined,
        jobDescription: String(jobDescription).trim()
      });
      const resume = await resumeStore.create(studentId, {
        filename: `${(student.personal?.fullName || 'candidate').replace(/\s+/g, '_')}_tailored.pdf`,
        filepath: '',
        driveLink: null,
        isCloud: false,
        tags: [],
        category: 'Tailored',
        analysis: { score: tailored.tailoredMeta?.matchScore ?? null, tailoredMeta: tailored.tailoredMeta, checkedAt: new Date().toISOString(), bulkTailored: true },
        extractedData: tailored.resumeData,
        isDefault: false
      });
      results.push({
        studentId,
        ok: true,
        studentName: student.personal?.fullName || studentId,
        resumeId: resume.id,
        matchScore: tailored.tailoredMeta?.matchScore ?? null,
        missingSkills: (tailored.tailoredMeta?.missingOrWeakSkills || []).slice(0, 6)
      });
      await auditLog.record({
        actorId: req.student.id,
        action: 'recruitment.resume.tailored',
        entityType: 'resume',
        entityId: String(resume.id),
        entityLabel: student.personal?.fullName || studentId,
        detail: `Bulk-tailored for ${clean(company) || 'a company'}${clean(jobTitle) ? ` - ${clean(jobTitle)}` : ''}.`
      });
    } catch (error) {
      results.push({ studentId, ok: false, error: error.message?.slice(0, 160) || 'Tailoring failed' });
    }
  }
  return {
    summary: { total: results.length, succeeded: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length },
    results
  };
}));

// ------------------------------------------------------------------ pipeline & dashboard

router.get('/pipeline', (req, res) => send(res, async () => ({ stages: recruitment.PIPELINE_STAGES })));
router.get('/dashboard', (req, res) => send(res, async () => recruitment.getDashboard()));

module.exports = router;
