const store = require('./recruitmentStore');
const adminContentStore = require('./adminContentStore');
const adminContent = require('./adminContent.service');
const studentStore = require('../students/studentStore');
const resumeStore = require('../resumes/resumeStore');
const jdAnalyzer = require('./jdAnalyzer.service');
const recruitmentPriority = require('./recruitmentPriority.service');
const auditLog = require('../../shared/auditLog.service');
const aiGateway = require('../../shared/aiGateway.service');

/**
 * Recruitment engagement / drive service.
 *
 * The full lifecycle: proposal → company response → negotiation → confirmed →
 * JD analysis → candidate matching → resume selection → sharing → feedback →
 * outcome. Every state change is audited through the shared audit log and the
 * proposed date is ALWAYS provisional until the company explicitly accepts
 * (requirement #3/#4: never auto-confirm from an AI or university suggestion).
 */

const STATUSES = ['proposed', 'under_discussion', 'accepted', 'rejected', 'reschedule_requested', 'confirmed', 'cancelled', 'completed'];

const STATUS_LABELS = {
  proposed: 'Proposed',
  under_discussion: 'Under discussion',
  accepted: 'Accepted',
  rejected: 'Rejected',
  reschedule_requested: 'Reschedule requested',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

const PIPELINE_STAGES = [
  { id: 'identified', label: 'Company identified' },
  { id: 'recommended', label: 'AI recommends outreach' },
  { id: 'university_approved', label: 'University approved' },
  { id: 'proposal_sent', label: 'Recruitment proposal sent' },
  { id: 'company_responded', label: 'Company responded' },
  { id: 'date_negotiated', label: 'Date negotiated' },
  { id: 'confirmed', label: 'Recruitment confirmed' },
  { id: 'jd_analyzed', label: 'Role/JD analysed' },
  { id: 'students_identified', label: 'Eligible students identified' },
  { id: 'candidates_matched', label: 'AI candidate matching' },
  { id: 'resume_selected', label: 'Resume selected' },
  { id: 'university_approval', label: 'University approval' },
  { id: 'candidates_shared', label: 'Candidates shared' },
  { id: 'company_review', label: 'Company review' },
  { id: 'shortlist', label: 'Shortlist' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'outcome', label: 'Final recruitment outcome' }
];

const ACCESS_LEVELS = ['summary', 'profile', 'resume', 'full'];
const RESUME_POLICY_MODES = ['student_controlled', 'university_controlled', 'ai_university'];
const FEEDBACK_TYPES = ['interested', 'shortlisted', 'rejected', 'interview_requested', 'needs_more_info'];

const clean = value => String(value || '').trim();
const notFound = label => { const error = new Error(`${label} not found.`); error.statusCode = 404; return error; };
const dateOnly = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

// ----------------------------------------------------------- resume policy config

const DEFAULT_RECRUITMENT_SETTINGS = {
  resumePolicyMode: 'university_controlled', // student_controlled | university_controlled | ai_university
  defaultAccessLevel: 'profile',
  maxSharesPerEngagement: 100
};

async function getRecruitmentSettings() {
  const policy = await adminContentStore.getPlacementPolicy();
  return { ...DEFAULT_RECRUITMENT_SETTINGS, ...(policy.recruitment || {}) };
}

async function updateRecruitmentSettings(input, adminId) {
  const current = await adminContentStore.getPlacementPolicy();
  const recruitment = { ...(current.recruitment || {}) };
  if (input.resumePolicyMode !== undefined) {
    if (!RESUME_POLICY_MODES.includes(clean(input.resumePolicyMode))) throw new Error('Invalid resume policy mode.');
    recruitment.resumePolicyMode = clean(input.resumePolicyMode);
  }
  if (input.defaultAccessLevel !== undefined) {
    if (!ACCESS_LEVELS.includes(clean(input.defaultAccessLevel))) throw new Error('Invalid access level.');
    recruitment.defaultAccessLevel = clean(input.defaultAccessLevel);
  }
  const saved = await adminContentStore.savePlacementPolicy({ ...current, recruitment }, adminId);
  await auditLog.record({
    actorId: adminId,
    action: 'recruitment.settings.updated',
    entityType: 'placement_policy',
    entityId: 'default',
    entityLabel: 'Recruitment settings',
    detail: `Resume policy: ${recruitment.resumePolicyMode}; default access: ${recruitment.defaultAccessLevel}.`
  });
  return saved.recruitment || recruitment;
}

// ------------------------------------------------------------------- engagements

async function createProposal(input, adminId) {
  const company = await adminContentStore.getCompany(clean(input.companyId));
  if (!company || company.status === 'archived') throw notFound('Company');
  const title = clean(input.title) || `${company.name} recruitment drive`;
  const proposedStart = dateOnly(input.proposedStart) || defaultWindowStart();
  const proposedEnd = dateOnly(input.proposedEnd) || defaultWindowEnd(proposedStart);
  const roles = (Array.isArray(input.roles) ? input.roles : []).map(clean).filter(Boolean).slice(0, 10);
  const engagement = await store.saveEngagement({
    companyId: company.id,
    title,
    status: 'proposed',
    roles,
    jobDescription: clean(input.jobDescription),
    eligibility: input.eligibility || null,
    proposedStart,
    proposedEnd,
    provisional: true,
    proposalNote: clean(input.proposalNote),
    companyContact: clean(input.companyContact),
    createdBy: adminId,
    pipelineStage: 'university_approved'
  });
  const sender = await studentStore.getStudentById(adminId);
  await store.addMessage({
    engagementId: engagement.id,
    companyId: company.id,
    senderRole: 'university',
    senderId: adminId,
    senderName: sender?.personal?.fullName || 'Placement team',
    recipientRole: 'company',
    body: clean(input.proposalNote) || `Recruitment proposal: ${title}. Proposed window ${formatRange(proposedStart, proposedEnd)} (provisional). Suggested roles: ${roles.join(', ') || 'to be discussed'}.`,
    kind: 'proposal',
    systemMeta: { proposedStart, proposedEnd, roles, provisional: true }
  });
  await auditLog.record({
    actorId: adminId,
    action: 'recruitment.proposal.created',
    entityType: 'recruitment_engagement',
    entityId: engagement.id,
    entityLabel: title,
    detail: `Provisional proposal for ${company.name}, window ${formatRange(proposedStart, proposedEnd)}.`
  });
  return engagement;
}

function defaultWindowStart() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function defaultWindowEnd(startIso) {
  const date = new Date(startIso);
  date.setDate(date.getDate() + 5);
  return date.toISOString().slice(0, 10);
}

function formatRange(start, end) {
  const format = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(start)} - ${format(end)}`;
}

/** Generate the provisional proposal text the UI renders for confirmation. */
async function buildProposalPreview(input) {
  const company = await adminContentStore.getCompany(clean(input.companyId));
  if (!company || company.status === 'archived') throw notFound('Company');
  const priority = await recruitmentPriority.generateRecommendations({ persist: false });
  const mine = priority.find(item => item.company.id === company.id) || null;
  const proposedStart = dateOnly(input.proposedStart) || defaultWindowStart();
  const proposedEnd = dateOnly(input.proposedEnd) || defaultWindowEnd(proposedStart);
  const roles = (Array.isArray(input.roles) && input.roles.length ? input.roles : (mine?.derived?.demandSkills?.slice(0, 3) || [])).map(clean).filter(Boolean).slice(0, 8);
  return {
    company: { id: company.id, name: company.name, logoUrl: company.logoUrl || '' },
    title: clean(input.title) || `${company.name} recruitment drive`,
    roles,
    proposedStart,
    proposedEnd,
    provisional: true,
    eligibleStudents: mine?.derived?.eligibleStudents ?? null,
    strongMatches: mine?.derived?.strongMatches ?? null,
    priorityScore: mine?.score ?? null,
    recommendation: mine?.recommendationLabel || null,
    note: 'The proposed dates are provisional. They become a confirmed recruitment date only when the company accepts.'
  };
}

async function sendProposal(engagementId, adminId) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  if (engagement.status !== 'proposed') throw new Error('Only a proposal in draft/proposed state can be sent.');
  const sender = await studentStore.getStudentById(adminId);
  const message = await store.addMessage({
    engagementId,
    companyId: engagement.companyId,
    senderRole: 'university',
    senderId: adminId,
    senderName: sender?.personal?.fullName || 'Placement team',
    recipientRole: 'company',
    body: `Recruitment proposal sent: ${engagement.title}. Proposed window ${formatRange(engagement.proposedStart, engagement.proposedEnd)} (provisional).`,
    kind: 'proposal_sent',
    systemMeta: { proposedStart: engagement.proposedStart, proposedEnd: engagement.proposedEnd, provisional: true }
  });
  await auditLog.record({
    actorId: adminId,
    action: 'recruitment.proposal.sent',
    entityType: 'recruitment_engagement',
    entityId: engagement.id,
    entityLabel: engagement.title,
    detail: 'Proposal sent to the company; date remains provisional until accepted.'
  });
  await notifyRecruitersForCompany(engagement.companyId, {
    title: `Recruitment proposal from the placement team`,
    message: `${engagement.title}: proposed window ${formatRange(engagement.proposedStart, engagement.proposedEnd)} (provisional). Open Recruitment to respond.`
  });
  return { engagement, message };
}

async function notifyRecruitersForCompany(companyId, notification) {
  const students = await studentStore.listStudents();
  const recruiters = students.filter(student => student.isRecruiter && !student.blocked);
  const company = await adminContentStore.getCompany(companyId);
  const companyToken = (company?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matched = recruiters.filter(recruiter => {
    const haystack = [recruiter.personal?.fullName, recruiter.personal?.email].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
    return companyToken.length >= 4 && haystack.includes(companyToken);
  });
  // Fall back to notifying all recruiters when no name-matched account exists
  // (single-tenant TnP deployments usually have one company account per firm).
  const targets = matched.length ? matched : recruiters;
  await Promise.all(targets.map(recruiter => studentStore.createNotification(recruiter.id, notification)));
}

const ALLOWED_TRANSITIONS = {
  proposed: ['under_discussion', 'accepted', 'rejected', 'reschedule_requested', 'cancelled', 'confirmed'],
  under_discussion: ['accepted', 'rejected', 'reschedule_requested', 'cancelled', 'confirmed'],
  accepted: ['confirmed', 'reschedule_requested', 'cancelled'],
  reschedule_requested: ['under_discussion', 'confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  rejected: ['proposed'],
  cancelled: ['proposed']
};

async function companyRespond(engagementId, recruiterId, input) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const response = clean(input.response);
  if (!['accepted', 'rejected', 'reschedule_requested', 'under_discussion'].includes(response)) {
    throw new Error('Response must be accepted, rejected, reschedule_requested or under_discussion.');
  }
  const allowed = ALLOWED_TRANSITIONS[engagement.status] || [];
  if (!allowed.includes(response)) {
    throw new Error(`Cannot move from ${STATUS_LABELS[engagement.status]} to ${STATUS_LABELS[response]}.`);
  }
  const recruiter = await studentStore.getStudentById(recruiterId);
  const proposedStart = dateOnly(input.proposedStart) || engagement.proposedStart;
  const proposedEnd = dateOnly(input.proposedEnd) || engagement.proposedEnd;
  const updates = { status: response };
  if (response === 'reschedule_requested' && input.proposedStart) {
    updates.proposedStart = proposedStart;
    updates.proposedEnd = proposedEnd;
  }
  const updated = await store.saveEngagement({ ...engagement, ...updates, pipelineStage: response === 'accepted' ? 'company_responded' : (response === 'reschedule_requested' ? 'date_negotiated' : engagement.pipelineStage) });
  await store.addMessage({
    engagementId,
    companyId: engagement.companyId,
    senderRole: 'company',
    senderId: recruiterId,
    senderName: recruiter?.personal?.fullName || 'Company recruiter',
    recipientRole: 'university',
    body: clean(input.message) || `Company response: ${STATUS_LABELS[response]}.`,
    kind: 'company_response',
    systemMeta: { response, proposedStart: updates.proposedStart, proposedEnd: updates.proposedEnd }
  });
  await auditLog.record({
    actorId: recruiterId,
    action: 'recruitment.company.responded',
    entityType: 'recruitment_engagement',
    entityId: engagement.id,
    entityLabel: engagement.title,
    detail: `Company response: ${STATUS_LABELS[response]}${input.proposedStart ? `; requested window ${formatRange(proposedStart, proposedEnd)}` : ''}.`
  });
  await studentStore.createNotification(engagement.createdBy, {
    title: `Company responded: ${STATUS_LABELS[response]}`,
    message: `${engagement.title}: the company responded ${STATUS_LABELS[response]}.`,
    type: 'recruitment'
  });
  return updated;
}

async function universityUpdateStatus(engagementId, adminId, input) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const nextStatus = clean(input.status);
  if (!STATUSES.includes(nextStatus)) throw new Error('Invalid status.');
  const allowed = ALLOWED_TRANSITIONS[engagement.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Cannot move from ${STATUS_LABELS[engagement.status]} to ${STATUS_LABELS[nextStatus]}.`);
  }
  const updates = { status: nextStatus };
  let detail = '';
  if (nextStatus === 'confirmed') {
    updates.confirmedStart = dateOnly(input.confirmedStart) || engagement.proposedStart;
    updates.confirmedEnd = dateOnly(input.confirmedEnd) || engagement.proposedEnd;
    updates.provisional = false;
    detail = `Recruitment CONFIRMED for ${formatRange(updates.confirmedStart, updates.confirmedEnd)}.`;
  } else if (nextStatus === 'under_discussion' && input.proposedStart) {
    updates.proposedStart = dateOnly(input.proposedStart);
    updates.proposedEnd = dateOnly(input.proposedEnd);
    detail = `Proposed window updated to ${formatRange(updates.proposedStart, updates.proposedEnd)}; awaiting company acceptance.`;
  } else if (nextStatus === 'completed') {
    updates.finalOutcome = clean(input.finalOutcome) || 'completed';
    detail = `Drive marked completed. Outcome: ${updates.finalOutcome}.`;
  } else if (nextStatus === 'cancelled') {
    updates.finalOutcome = clean(input.finalOutcome) || 'cancelled';
    detail = clean(input.finalOutcome) ? `Cancelled: ${updates.finalOutcome}.` : 'Recruitment cancelled.';
  }
  const updated = await store.saveEngagement({ ...engagement, ...updates, pipelineStage: nextStatus === 'confirmed' ? 'confirmed' : (nextStatus === 'completed' ? 'outcome' : engagement.pipelineStage) });
  const sender = await studentStore.getStudentById(adminId);
  await store.addMessage({
    engagementId,
    companyId: engagement.companyId,
    senderRole: 'university',
    senderId: adminId,
    senderName: sender?.personal?.fullName || 'Placement team',
    recipientRole: 'company',
    body: clean(input.message) || detail || `Status updated: ${STATUS_LABELS[nextStatus]}.`,
    kind: nextStatus === 'confirmed' ? 'confirmation' : 'status_change',
    systemMeta: { status: nextStatus, confirmedStart: updated.confirmedStart, confirmedEnd: updated.confirmedEnd }
  });
  await auditLog.record({
    actorId: adminId,
    action: nextStatus === 'confirmed' ? 'recruitment.confirmed' : nextStatus === 'cancelled' ? 'recruitment.cancelled' : nextStatus === 'completed' ? 'recruitment.completed' : 'recruitment.status.changed',
    entityType: 'recruitment_engagement',
    entityId: engagement.id,
    entityLabel: engagement.title,
    detail: detail || `Status: ${STATUS_LABELS[nextStatus]}.`
  });
  await notifyRecruitersForCompany(engagement.companyId, {
    title: `Recruitment update: ${STATUS_LABELS[nextStatus]}`,
    message: `${engagement.title}: ${detail || `status is now ${STATUS_LABELS[nextStatus]}.`}`,
    type: 'recruitment'
  });
  return updated;
}

// ---------------------------------------------------------------- communication

async function postMessage(engagementId, senderRole, senderId, input) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const body = clean(input.body);
  if (!body) throw new Error('Message body is required.');
  const sender = await studentStore.getStudentById(senderId);
  const attachments = (Array.isArray(input.attachments) ? input.attachments : [])
    .map(item => ({ name: clean(item.name).slice(0, 180), url: clean(item.url), type: clean(item.type) || 'link' }))
    .filter(item => item.name && item.url)
    .slice(0, 5);
  const message = await store.addMessage({
    engagementId,
    companyId: engagement.companyId,
    senderRole,
    senderId,
    senderName: sender?.personal?.fullName || (senderRole === 'university' ? 'Placement team' : 'Company recruiter'),
    recipientRole: senderRole === 'university' ? 'company' : 'university',
    body: body.slice(0, 4000),
    attachments,
    kind: 'message'
  });
  await auditLog.record({
    actorId: senderId,
    action: 'recruitment.message.sent',
    entityType: 'recruitment_engagement',
    entityId: engagementId,
    entityLabel: engagement.title,
    detail: `${senderRole === 'university' ? 'University' : 'Company'} message posted${attachments.length ? ` with ${attachments.length} attachment(s)` : ''}.`
  });
  if (senderRole === 'university') {
    await notifyRecruitersForCompany(engagement.companyId, { title: 'New message from the placement team', message: body.slice(0, 140), type: 'recruitment' });
  } else {
    await studentStore.createNotification(engagement.createdBy, { title: 'New message from the company', message: body.slice(0, 140), type: 'recruitment' });
  }
  return message;
}

async function getTimeline(engagementId) {
  return store.listMessages(engagementId);
}

// ----------------------------------------------------- AI communication summary

async function summarizeCommunication(engagementId) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const messages = await store.listMessages(engagementId);
  if (!messages.length) {
    return { available: false, summary: '', pending: [], completed: [], generatedBy: 'none', note: 'No communication recorded yet.' };
  }
  const transcript = messages.map(message =>
    `${new Date(message.createdAt).toISOString().slice(0, 10)} ${message.senderRole === 'university' ? 'TPO' : 'COMPANY'}: ${message.body}${message.attachments?.length ? ` [attachments: ${message.attachments.map(a => a.name).join(', ')}]` : ''}`
  ).join('\n');

  const ai = await aiGateway.generateJson({
    systemPrompt: 'You summarise university-company recruitment communication. Use ONLY facts present in the transcript. Never invent messages, dates or commitments.',
    schemaHint: '{"summary":"2-3 sentence factual summary","pending":[{"owner":"TPO|Company","action":"string"}],"completed":["string"]}',
    userPrompt: `Recruitment: ${engagement.title}. Status: ${STATUS_LABELS[engagement.status]}. Transcript (oldest first):\n${transcript.slice(0, 12000)}`,
    temperature: 0.1
  });

  if (ai && typeof ai.summary === 'string') {
    return {
      available: true,
      summary: String(ai.summary).slice(0, 900),
      pending: (Array.isArray(ai.pending) ? ai.pending : []).slice(0, 8).map(item => ({
        owner: ['TPO', 'Company'].includes(item?.owner) ? item.owner : 'TPO',
        action: String(item?.action || '').slice(0, 200)
      })).filter(item => item.action),
      completed: (Array.isArray(ai.completed) ? ai.completed : []).slice(0, 8).map(item => String(item).slice(0, 200)).filter(Boolean),
      generatedBy: 'ai'
    };
  }

  // Deterministic fallback built from REAL stored messages only.
  return {
    available: true,
    summary: `${messages.length} message${messages.length === 1 ? '' : 's'} exchanged on "${engagement.title}". Latest: ${messages[messages.length - 1].senderRole === 'university' ? 'TPO' : 'Company'} - "${messages[messages.length - 1].body.slice(0, 180)}". Status: ${STATUS_LABELS[engagement.status]}${engagement.provisional ? ' (dates provisional until company acceptance)' : ''}.`,
    pending: buildDeterministicPending(messages, engagement),
    completed: [],
    generatedBy: 'fallback',
    note: 'AI summary unavailable - showing a factual summary of stored messages.'
  };
}

function buildDeterministicPending(messages, engagement) {
  const pending = [];
  if (['proposed', 'under_discussion', 'reschedule_requested'].includes(engagement.status)) {
    pending.push({ owner: 'Company', action: `Confirm or negotiate the proposed window (${formatRange(engagement.proposedStart, engagement.proposedEnd)})` });
  }
  const last = messages[messages.length - 1];
  if (last?.senderRole === 'company') pending.push({ owner: 'TPO', action: `Respond to the company's latest message: "${last.body.slice(0, 100)}"` });
  else if (last?.senderRole === 'university') pending.push({ owner: 'Company', action: `Reply to the placement team's latest message: "${last.body.slice(0, 100)}"` });
  return pending.slice(0, 4);
}

// -------------------------------------------------------------- JD & role analysis

async function analyzeEngagementRole(engagementId, adminId) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  if (!clean(engagement.jobDescription) || engagement.jobDescription.length < 20) {
    throw new Error('Add a job description (at least a few sentences) to the engagement first.');
  }
  const analysis = jdAnalyzer.analyzeOnly({ jobDescription: engagement.jobDescription, jobTitle: (engagement.roles || [])[0] || engagement.title });
  const updated = await store.saveEngagement({ ...engagement, roleAnalysis: analysis, pipelineStage: ['jd_analyzed', 'students_identified', 'candidates_matched', 'resume_selected', 'university_approval', 'candidates_shared', 'company_review', 'shortlist', 'interview', 'offer', 'outcome'].includes(engagement.pipelineStage) ? engagement.pipelineStage : 'jd_analyzed' });
  await auditLog.record({
    actorId: adminId,
    action: 'recruitment.role.analyzed',
    entityType: 'recruitment_engagement',
    entityId: engagement.id,
    entityLabel: engagement.title,
    detail: `Role analysed: ${analysis.skills.length} skills, min CGPA ${analysis.minCgpa ?? 'n/a'}.`
  });
  return { engagement: updated, analysis };
}

// ------------------------------------------------------------- candidate matching

async function matchCandidates(engagementId, { limit = 50 } = {}) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const jobDescription = clean(engagement.jobDescription);
  if (jobDescription.length < 20) {
    throw new Error('Add a job description to the engagement before running candidate matching.');
  }
  // Reuse the existing JD analyser end-to-end: same scoring, same eligibility
  // flags, same semantic embedding path. No duplicated matching logic.
  const { candidates, stats, analysis } = await jdAnalyzer.analyze({ jobDescription, jobTitle: (engagement.roles || [])[0] || engagement.title, limit });
  const existingShares = await store.listShares({ engagementId });
  const sharedIds = new Set(existingShares.filter(share => share.status !== 'revoked').map(share => share.studentId));
  return {
    engagement: { id: engagement.id, title: engagement.title, roles: engagement.roles, status: engagement.status },
    analysis,
    stats,
    candidates: candidates.map(candidate => ({ ...candidate, alreadyShared: sharedIds.has(candidate.id) })),
    aiLabel: 'AI-generated analysis - decision support only, never an automatic hiring decision.'
  };
}

// ------------------------------------------------------------------ resume ranking

/**
 * Rank a student's resumes against an engagement's job description. Purely
 * deterministic: skill overlap from the parsed resume content (requirement #11:
 * recommendation must be based on actual resume content).
 */
async function recommendResumes(engagementId, studentId) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const student = await studentStore.getStudentById(studentId);
  if (!student) throw notFound('Student');
  const resumes = await resumeStore.list(studentId);
  if (!resumes.length) return { resumes: [], recommendation: null, note: 'This student has no resumes on file yet.' };
  const requiredSkills = engagement.roleAnalysis?.skills?.length
    ? engagement.roleAnalysis.skills
    : jdAnalyzer.detectSkillsPublic(clean(engagement.jobDescription));
  const skillSet = new Set(requiredSkills.map(skill => skill.toLowerCase()));
  const ranked = resumes.map(resume => {
    const skills = extractResumeSkills(resume);
    const matched = requiredSkills.filter(skill => skills.has(skill.toLowerCase()));
    const score = requiredSkills.length ? Math.round((matched.length / requiredSkills.length) * 100) : (resume.isDefault ? 60 : 40);
    return {
      resumeId: resume.id,
      filename: resume.filename,
      category: resume.category || 'General',
      isDefault: Boolean(resume.isDefault),
      score: Math.min(100, score + (resume.isDefault ? 2 : 0)),
      matchedSkills: matched.slice(0, 10),
      missingSkills: requiredSkills.filter(skill => !skills.has(skill.toLowerCase())).slice(0, 8),
      extracted: Boolean(resume.extractedData || resume.analysis)
    };
  }).sort((a, b) => b.score - a.score);
  return {
    resumes: ranked,
    recommendation: ranked[0] ? { resumeId: ranked[0].resumeId, filename: ranked[0].filename, score: ranked[0].score, reason: `Covers ${ranked[0].matchedSkills.length}/${requiredSkills.length || 0} role skills from its parsed content` } : null,
    roleSkills: requiredSkills.slice(0, 12)
  };
}

function extractResumeSkills(resume) {
  const skills = new Set();
  const extracted = resume.extractedData;
  if (extracted?.skills) {
    for (const group of Object.values(extracted.skills)) {
      if (Array.isArray(group)) for (const skill of group) skills.add(String(skill).toLowerCase());
    }
  }
  if (resume.analysis?.skills) {
    const analysisSkills = resume.analysis.skills;
    if (Array.isArray(analysisSkills)) for (const skill of analysisSkills) skills.add(String(skill).toLowerCase());
  }
  for (const tag of resume.tags || []) skills.add(String(tag).toLowerCase());
  const text = [extracted?.summary?.text, ...(extracted?.projects || []).map(p => `${p.title} ${p.technologies}`)].filter(Boolean).join(' ').toLowerCase();
  if (text) for (const skill of jdAnalyzer.detectSkillsPublic(text)) skills.add(skill.toLowerCase());
  return skills;
}

// ------------------------------------------------------------------- AI candidate brief

/**
 * Generate a professional candidate brief from the student's VERIFIED profile
 * and resume only. Requirement #10: university reviews the brief before
 * sharing; requirement #23: only data the university chose to expose.
 */
async function generateCandidateBrief(engagementId, studentId, { resumeId = null } = {}) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const student = await studentStore.getStudentById(studentId);
  if (!student) throw notFound('Student');
  const resumes = await resumeStore.list(studentId);
  const resume = resumeId ? resumes.find(item => String(item.id) === String(resumeId)) : (resumes.find(item => item.isDefault) || resumes[0]) || null;

  const academic = student.academic || {};
  const facts = {
    name: student.personal?.fullName || 'Student',
    rollNumber: academic.rollNumber || student.rollNumber || '',
    department: academic.department || '',
    batchYear: academic.batchYear || '',
    cgpa: academic.cgpa ?? null,
    interests: [...(student.interests?.passions || []), ...(student.interests?.hobbies || [])].map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).slice(0, 8),
    achievements: (student.achievements || []).map(item => ({ title: item.title, year: item.year })).slice(0, 6),
    internships: (student.internships || []).map(item => ({ role: item.role, company: item.companyName, skills: item.skills || [] })).slice(0, 5),
    projects: (student.projects || []).map(item => ({ name: item.projectName, technologies: Array.isArray(item.technologies) ? item.technologies : [], description: String(item.description || '').slice(0, 200) })).slice(0, 5),
    resumeSkills: resume ? [...extractResumeSkills(resume)].slice(0, 25) : [],
    resumeFilename: resume?.filename || null
  };
  const roleSkills = engagement.roleAnalysis?.skills || jdAnalyzer.detectSkillsPublic(clean(engagement.jobDescription));

  const ai = await aiGateway.generateJson({
    systemPrompt: 'You write concise professional candidate briefs for university placement teams. Use ONLY the provided verified profile data. Never invent skills, projects, experience, numbers or employers. If a section has no data, return an empty array for it.',
    schemaHint: '{"academicProfile":"1-2 sentences","technicalStrengths":["skill"],"relevantProjects":["1-sentence project summary"],"experience":["1-sentence experience summary"],"roleMatch":"1-2 sentences comparing the candidate to the role","potentialGaps":["string"]}',
    userPrompt: `Role: ${(engagement.roles || [])[0] || engagement.title}. Role skills: ${roleSkills.join(', ') || 'not specified'}.\n\nVERIFIED PROFILE DATA:\n${JSON.stringify(facts)}`,
    temperature: 0.2
  });

  if (ai && typeof ai.academicProfile === 'string') {
    return {
      available: true,
      generatedBy: 'ai',
      academicProfile: String(ai.academicProfile).slice(0, 600),
      technicalStrengths: (Array.isArray(ai.technicalStrengths) ? ai.technicalStrengths : []).slice(0, 10).map(item => String(item).slice(0, 80)),
      relevantProjects: (Array.isArray(ai.relevantProjects) ? ai.relevantProjects : []).slice(0, 6).map(item => String(item).slice(0, 240)),
      experience: (Array.isArray(ai.experience) ? ai.experience : []).slice(0, 6).map(item => String(item).slice(0, 240)),
      roleMatch: String(ai.roleMatch || '').slice(0, 600),
      potentialGaps: (Array.isArray(ai.potentialGaps) ? ai.potentialGaps : []).slice(0, 6).map(item => String(item).slice(0, 200)),
      sourceNote: 'Generated from the student\'s verified profile and resume data only.'
    };
  }

  // Deterministic fallback: composed purely from stored profile fields.
  const strengths = facts.resumeSkills.length ? facts.resumeSkills.slice(0, 8) : facts.interests.slice(0, 6);
  return {
    available: true,
    generatedBy: 'fallback',
    academicProfile: `${facts.name}${facts.department ? `, ${facts.department}` : ''}${facts.batchYear ? ` (${facts.batchYear})` : ''}${facts.cgpa ? `, CGPA ${facts.cgpa}` : ''}.`,
    technicalStrengths: strengths,
    relevantProjects: facts.projects.map(project => `${project.name}${project.technologies.length ? ` (${project.technologies.slice(0, 5).join(', ')})` : ''}`),
    experience: facts.internships.map(internship => `${internship.role} at ${internship.company}`),
    roleMatch: roleSkills.length
      ? `Profile references ${roleSkills.filter(skill => facts.resumeSkills.concat(facts.interests.map(i => i.toLowerCase())).includes(skill.toLowerCase())).length}/${roleSkills.length} of the role's required skills.`
      : 'Role skills not yet analysed; match not assessed.',
    potentialGaps: [],
    sourceNote: 'AI summary unavailable - composed directly from the verified profile fields.'
  };
}

// ------------------------------------------------------------------ candidate sharing

async function shareCandidate(input, adminId) {
  const engagement = input.engagementId ? await store.getEngagement(input.engagementId) : null;
  if (input.engagementId && !engagement) throw notFound('Recruitment engagement');
  const company = await adminContentStore.getCompany(clean(input.companyId || engagement?.companyId));
  if (!company || company.status === 'archived') throw notFound('Company');
  const student = await studentStore.getStudentById(clean(input.studentId));
  if (!student || student.isAdmin || student.isRecruiter) throw notFound('Student');
  const recruiter = await resolveRecruiterForCompany(company);
  const settings = await getRecruitmentSettings();

  const policyMode = clean(input.policyMode) || settings.resumePolicyMode;
  if (!RESUME_POLICY_MODES.includes(policyMode)) throw new Error('Invalid resume policy mode.');
  const accessLevel = clean(input.accessLevel) || settings.defaultAccessLevel;
  if (!ACCESS_LEVELS.includes(accessLevel)) throw new Error('Invalid access level.');

  let approvedBy = null;
  let approvedByName = null;
  if (policyMode !== 'student_controlled') {
    approvedBy = adminId;
    const admin = await studentStore.getStudentById(adminId);
    approvedByName = admin?.personal?.fullName || 'Placement team';
  }
  if (policyMode === 'student_controlled') {
    // University initiates the share but the student picks the resume; still
    // record who released it. The student-facing resume choice happens in the
    // student portal notification.
    approvedBy = adminId;
    const admin = await studentStore.getStudentById(adminId);
    approvedByName = admin?.personal?.fullName || 'Placement team';
  }

  let resumeId = clean(input.resumeId) || null;
  let aiBrief = clean(input.aiBrief) || null;
  let aiMatch = input.aiMatch || null;
  if (policyMode === 'ai_university' && engagement) {
    const recommendation = await recommendResumes(engagement.id, student.id);
    if (recommendation.recommendation && !resumeId) resumeId = recommendation.recommendation.resumeId;
    aiMatch = aiMatch || (recommendation.recommendation ? { score: recommendation.recommendation.score, reason: recommendation.recommendation.reason, matchedSkills: recommendation.resumes.find(item => String(item.resumeId) === String(resumeId))?.matchedSkills || [] } : null);
  }
  if (!aiBrief && engagement) {
    const brief = await generateCandidateBrief(engagement.id, student.id, { resumeId });
    aiBrief = JSON.stringify(brief).slice(0, 8000);
  }

  // Dedupe: one active share per student/company/engagement.
  const existing = (await store.listShares({ companyId: company.id, studentId: student.id }))
    .find(item => item.status !== 'revoked' && (!input.engagementId || item.engagementId === input.engagementId));
  if (existing) {
    const updated = await store.saveShare({
      ...existing,
      engagementId: input.engagementId || existing.engagementId,
      roleTitle: clean(input.roleTitle) || existing.roleTitle,
      resumeId: resumeId || existing.resumeId,
      accessLevel,
      aiBrief: aiBrief || existing.aiBrief,
      aiMatch: aiMatch || existing.aiMatch,
      approvedBy,
      approvedByName,
      policyMode,
      status: 'shared',
      updatedAt: new Date().toISOString()
    });
    return updated;
  }

  const admin = await studentStore.getStudentById(adminId);
  const share = await store.saveShare({
    engagementId: input.engagementId || null,
    companyId: company.id,
    recruiterId: recruiter?.id || 'pending',
    roleTitle: clean(input.roleTitle) || (engagement?.roles || [])[0] || engagement?.title || null,
    jobPostId: clean(input.jobPostId) || null,
    studentId: student.id,
    resumeId,
    accessLevel,
    aiBrief,
    aiMatch,
    approvedBy,
    approvedByName,
    sharedBy: adminId,
    sharedByName: admin?.personal?.fullName || 'Placement team',
    policyMode,
    status: 'shared'
  });
  await auditLog.record({
    actorId: adminId,
    action: 'recruitment.candidate.shared',
    entityType: 'recruitment_share',
    entityId: share.id,
    entityLabel: student.personal?.fullName || student.id,
    detail: `Shared with ${company.name} (access: ${accessLevel}, policy: ${policyMode}${share.resumeId ? ', resume approved' : ''}).`
  });
  if (recruiter) {
    await studentStore.createNotification(recruiter.id, {
      title: 'New candidate shared for review',
      message: `${student.personal?.fullName || 'A candidate'} was shared${engagement ? ` for "${engagement.title}"` : ''} with ${accessLevel} access.`,
      type: 'share'
    });
  }
  if (engagement) {
    await store.addMessage({
      engagementId: engagement.id,
      companyId: company.id,
      senderRole: 'university',
      senderId: adminId,
      senderName: admin?.personal?.fullName || 'Placement team',
      recipientRole: 'company',
      body: `Candidate shared for ${share.roleTitle || 'review'}: ${student.personal?.fullName || student.id} (${accessLevel} access).`,
      kind: 'candidate_shared',
      systemMeta: { shareId: share.id, accessLevel }
    });
  }
  await advancePipeline(engagement, 'candidates_shared');
  return share;
}

async function resolveRecruiterForCompany(company) {
  const users = await studentStore.listStudents();
  const recruiters = users.filter(user => user.isRecruiter && !user.blocked);
  const token = (company.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (token.length >= 4) {
    const match = recruiters.find(recruiter => [recruiter.personal?.fullName, recruiter.personal?.email].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '').includes(token));
    if (match) return match;
  }
  return recruiters[0] || null;
}

// --------------------------------------------------------------- resume policy enforcement

/**
 * Resolve which resume may be submitted for a share, respecting the configured
 * policy. Used by the share review endpoint before a share goes out (#12).
 */
async function resolveResumeForShare(shareId, { chosenResumeId = null, deciderId = null } = {}) {
  const share = await store.getShare(shareId);
  if (!share) throw notFound('Share');
  const settings = await getRecruitmentSettings();
  const mode = share.policyMode || settings.resumePolicyMode;
  if (mode === 'student_controlled') {
    if (!chosenResumeId) return { share, resumeId: share.resumeId, decidedBy: 'student', pendingStudentChoice: !share.resumeId };
    const resume = await resumeStore.findOwnedResume(share.studentId, chosenResumeId);
    if (!resume) throw notFound('Resume');
    const updated = await store.saveShare({ ...share, resumeId: String(chosenResumeId), status: share.status === 'shared' ? 'shared' : share.status });
    await auditLog.record({ actorId: share.studentId, action: 'recruitment.resume.selected', entityType: 'recruitment_share', entityId: shareId, entityLabel: resume.filename, detail: 'Student selected their resume (student-controlled policy).' });
    return { share: updated, resumeId: updated.resumeId, decidedBy: 'student' };
  }
  // university_controlled / ai_university: decider must be the placement team.
  if (!deciderId) throw { statusCode: 403, message: 'University approval is required under the configured resume policy.' };
  const resume = chosenResumeId ? await resumeStore.findOwnedResume(share.studentId, chosenResumeId) : null;
  if (chosenResumeId && !resume) throw notFound('Resume');
  const updated = await store.saveShare({ ...share, resumeId: resume ? String(resume.id) : share.resumeId, approvedBy: deciderId, approvedByName: (await studentStore.getStudentById(deciderId))?.personal?.fullName || 'Placement team' });
  await auditLog.record({ actorId: deciderId, action: 'recruitment.resume.approved', entityType: 'recruitment_share', entityId: shareId, entityLabel: resume?.filename || 'resume', detail: `University approved the resume under ${mode} policy.` });
  return { share: updated, resumeId: updated.resumeId, decidedBy: 'university' };
}

// ------------------------------------------------------------------ company access + feedback

/**
 * Recruiter-side view of a share. Enforces the access level and logs access
 * (requirement #23: resume access logged, info beyond level never leaks).
 */
async function getShareForRecruiter(shareId, recruiterId) {
  const share = await store.getShare(shareId);
  if (!share) throw notFound('Share');
  const recruiter = await studentStore.getStudentById(recruiterId);
  const company = await adminContentStore.getCompany(share.companyId);
  // Recruiters see only shares addressed to their company (name-matched) or
  // shares explicitly addressed to their recruiter account.
  const token = (company?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const recruiterToken = [recruiter?.personal?.fullName, recruiter?.personal?.email].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (share.recruiterId !== recruiterId && !(token.length >= 4 && recruiterToken.includes(token))) {
    throw { statusCode: 403, message: 'This share is not addressed to your company.' };
  }
  if (share.status === 'revoked') throw { statusCode: 403, message: 'Access to this candidate was revoked by the placement team.' };
  const student = await studentStore.getStudentById(share.studentId);
  const engagement = share.engagementId ? await store.getEngagement(share.engagementId) : null;
  const level = share.accessLevel;
  const base = {
    shareId: share.id,
    accessLevel: level,
    role: share.roleTitle,
    engagement: engagement ? { id: engagement.id, title: engagement.title, status: engagement.status } : null,
    sharedAt: share.createdAt,
    aiBrief: level !== 'summary' ? parseBrief(share.aiBrief) : { available: false, note: 'Available with profile access.' }
  };
  if (level === 'summary') {
    return { ...base, candidate: summaryProjection(student), note: 'Summary access: limited profile only.' };
  }
  if (level === 'profile') {
    return { ...base, candidate: profileProjection(student), note: 'Profile access: profile without resume.' };
  }
  // resume / full include the resume link and log the access.
  const resumes = await resumeStore.list(student.id);
  const chosen = share.resumeId ? resumes.find(item => String(item.id) === String(share.resumeId)) : (resumes.find(item => item.isDefault) || resumes[0]) || null;
  await store.saveShare({ ...share, status: share.status === 'shared' ? 'viewed' : share.status, accessedAt: new Date().toISOString(), accessCount: (share.accessCount || 0) + 1 });
  await auditLog.record({
    actorId: recruiterId,
    action: 'recruitment.candidate.accessed',
    entityType: 'recruitment_share',
    entityId: share.id,
    entityLabel: student?.personal?.fullName || share.studentId,
    detail: `Company opened the candidate (${level} access, view #${(share.accessCount || 0) + 1}).`
  });
  return {
    ...base,
    candidate: level === 'full' ? fullProjection(student, chosen) : profileProjection(student, chosen ? { resumeUrl: `/api/resumes/${chosen.id}/file?mode=view` } : null),
    resume: chosen ? { id: chosen.id, filename: chosen.filename, category: chosen.category, fileUrl: `/api/recruiter/shared-candidates/${share.id}/resume` } : null,
    note: level === 'full' ? 'Full access: complete shared profile and resume.' : 'Resume access: profile plus the selected resume.'
  };
}

function parseBrief(text) {
  if (!text) return { available: false };
  try { return JSON.parse(text); } catch { return { available: false, raw: String(text).slice(0, 400) }; }
}

function summaryProjection(student) {
  return {
    id: student.id,
    initials: (student.personal?.fullName || 'S').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    department: student.academic?.department || '',
    batchYear: student.academic?.batchYear || '',
    headline: student.personal?.headline || student.academic?.department || 'Student',
    topSkills: [...(student.interests?.passions || []), ...(student.interests?.hobbies || [])].map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).slice(0, 5)
  };
}

function profileProjection(student, extra = {}) {
  return {
    ...summaryProjection(student),
    fullName: student.personal?.fullName || '',
    cgpa: student.academic?.cgpa ?? null,
    rollNumber: student.academic?.rollNumber || '',
    interests: {
      passions: (student.interests?.passions || []).map(item => typeof item === 'string' ? item : { name: item.name, proficiency: item.proficiency }),
      hobbies: (student.interests?.hobbies || []).map(item => typeof item === 'string' ? item : { name: item.name, proficiency: item.proficiency })
    },
    achievements: (student.achievements || []).map(item => ({ title: item.title, category: item.category, description: item.description, year: item.year })),
    internships: (student.internships || []).map(item => ({ companyName: item.companyName, role: item.role, startDate: item.startDate, endDate: item.endDate, skills: item.skills || [], description: item.description })),
    projects: (student.projects || []).map(item => ({ projectName: item.projectName, projectType: item.projectType, technologies: item.technologies || [], description: item.description, projectUrl: item.projectUrl, repoUrl: item.repoUrl })),
    ...extra
  };
}

function fullProjection(student, resume) {
  const profile = profileProjection(student);
  return {
    ...profile,
    social: student.social || { linkedin: '', links: [] },
    certifications: resume?.extractedData?.certifications || [],
    education: resume?.extractedData?.education || [],
    resumeSkills: resume ? [...extractResumeSkills(resume)].slice(0, 30) : []
  };
}

async function recordShareFeedback(shareId, recruiterId, input) {
  const share = await store.getShare(shareId);
  if (!share) throw notFound('Share');
  const recruiter = await studentStore.getStudentById(recruiterId);
  const company = await adminContentStore.getCompany(share.companyId);
  const token = (company?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const recruiterToken = [recruiter?.personal?.fullName, recruiter?.personal?.email].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (share.recruiterId !== recruiterId && !(token.length >= 4 && recruiterToken.includes(token))) {
    throw { statusCode: 403, message: 'This share is not addressed to your company.' };
  }
  const response = clean(input.response);
  if (!FEEDBACK_TYPES.includes(response)) {
    throw new Error(`Response must be one of: ${FEEDBACK_TYPES.join(', ')}.`);
  }
  const note = clean(input.note).slice(0, 800);
  const updated = await store.saveShare({
    ...share,
    companyResponse: response,
    companyResponseNote: note,
    respondedAt: new Date().toISOString(),
    status: share.status === 'shared' ? 'feedback' : share.status
  });
  const student = await studentStore.getStudentById(share.studentId);
  await auditLog.record({
    actorId: recruiterId,
    action: 'recruitment.candidate.feedback',
    entityType: 'recruitment_share',
    entityId: share.id,
    entityLabel: student?.personal?.fullName || share.studentId,
    detail: `Company feedback: ${response}${note ? ` - "${note.slice(0, 120)}"` : ''}.`
  });
  await studentStore.createNotification(share.sharedBy, {
    title: 'Company feedback on a shared candidate',
    message: `${student?.personal?.fullName || 'A candidate'}: ${response.replace(/_/g, ' ')}${note ? ` - ${note.slice(0, 100)}` : ''}.`,
    type: 'share'
  });
  if (share.engagementId) {
    await store.addMessage({
      engagementId: share.engagementId,
      companyId: share.companyId,
      senderRole: 'company',
      senderId: recruiterId,
      senderName: recruiter?.personal?.fullName || 'Company recruiter',
      recipientRole: 'university',
      body: `Candidate feedback - ${student?.personal?.fullName || 'candidate'}: ${response.replace(/_/g, ' ')}${note ? `. Note: ${note}` : ''}.`,
      kind: 'feedback',
      systemMeta: { shareId: share.id, response }
    });
    const engagement = await store.getEngagement(share.engagementId);
    await advancePipeline(engagement, response === 'interview_requested' ? 'interview' : 'company_review');
  }
  return updated;
}

async function revokeShare(shareId, adminId, reason = '') {
  const share = await store.getShare(shareId);
  if (!share) throw notFound('Share');
  if (share.status === 'revoked') return share;
  const updated = await store.saveShare({ ...share, status: 'revoked', revokedAt: new Date().toISOString(), revokedBy: adminId });
  const student = await studentStore.getStudentById(share.studentId);
  await auditLog.record({
    actorId: adminId,
    action: 'recruitment.share.revoked',
    entityType: 'recruitment_share',
    entityId: shareId,
    entityLabel: student?.personal?.fullName || share.studentId,
    detail: reason ? `Access revoked: ${reason.slice(0, 140)}` : 'Company access to this candidate revoked.'
  });
  return updated;
}

async function advancePipeline(engagement, stageId) {
  if (!engagement) return;
  const order = PIPELINE_STAGES.map(stage => stage.id);
  const currentIndex = order.indexOf(engagement.pipelineStage);
  const nextIndex = order.indexOf(stageId);
  if (nextIndex > currentIndex) {
    await store.saveEngagement({ ...engagement, pipelineStage: stageId });
  }
}

// --------------------------------------------------------------------- admin reads

async function listEngagementsWithMeta(filter = {}) {
  const engagements = await store.listEngagements(filter);
  const companies = await adminContentStore.listCompanies();
  const companyById = new Map(companies.map(company => [company.id, company]));
  const shares = await store.listShares();
  const engagementIds = engagements.map(item => item.id);
  const latest = await store.latestMessageForEngagements(engagementIds);
  const allMessages = await Promise.all(engagementIds.map(id => store.listMessages(id)));
  const counts = new Map();
  allMessages.forEach((list, index) => counts.set(engagementIds[index], list.length));
  return engagements.map(engagement => {
    const company = companyById.get(engagement.companyId);
    return {
      ...engagement,
      companyName: company?.name || 'Unknown company',
      companyLogoUrl: company?.logoUrl || '',
      statusLabel: STATUS_LABELS[engagement.status] || engagement.status,
      messageCount: counts.get(engagement.id) || 0,
      lastMessageAt: latest.get(engagement.id)?.createdAt || null,
      sharedCount: shares.filter(share => share.engagementId === engagement.id && share.status !== 'revoked').length
    };
  });
}

async function getEngagementDetail(engagementId) {
  const engagement = await store.getEngagement(engagementId);
  if (!engagement) throw notFound('Recruitment engagement');
  const company = await adminContentStore.getCompany(engagement.companyId);
  const messages = await store.listMessages(engagementId);
  const shares = await store.listShares({ engagementId });
  const hydratedShares = await Promise.all(shares.map(async share => {
    const student = await studentStore.getStudentById(share.studentId);
    return {
      ...share,
      aiBriefParsed: parseBrief(share.aiBrief),
      studentName: student?.personal?.fullName || 'Unknown',
      studentRoll: student?.academic?.rollNumber || '',
      studentDepartment: student?.academic?.department || '',
      studentCgpa: student?.academic?.cgpa ?? null
    };
  }));
  return {
    engagement: {
      ...engagement,
      companyName: company?.name || 'Unknown company',
      companyLogoUrl: company?.logoUrl || '',
      statusLabel: STATUS_LABELS[engagement.status] || engagement.status
    },
    messages,
    shares: hydratedShares
  };
}

/**
 * Dashboard metrics for the recruitment intelligence overview (#17).
 */
async function getDashboard() {
  const [companies, engagements, shares, recruiters] = await Promise.all([
    adminContentStore.listCompanies(),
    store.listEngagements(),
    store.listShares(),
    studentStore.listStudents()
  ]);
  const pendingResponse = engagements.filter(item => ['proposed', 'under_discussion', 'reschedule_requested'].includes(item.status));
  const provisional = engagements.filter(item => item.status === 'proposed');
  const confirmed = engagements.filter(item => ['confirmed', 'completed'].includes(item.status));
  const awaitingApproval = shares.filter(share => share.policyMode !== 'student_controlled' && !share.resumeId && share.status === 'shared');
  const shared = shares.filter(share => share.status !== 'revoked');
  const pendingCompanyActions = engagements
    .filter(item => ['proposed', 'under_discussion', 'reschedule_requested'].includes(item.status))
    .map(item => ({
      engagementId: item.id,
      company: companies.find(company => company.id === item.companyId)?.name || 'Unknown company',
      title: item.title,
      action: item.status === 'proposed' ? 'Company has not responded to the proposal' : item.status === 'reschedule_requested' ? 'Company requested new dates - needs university response' : 'Company has not confirmed the proposed date'
    }));
  return {
    metrics: {
      companiesOnRecord: companies.length,
      provisionalDrives: provisional.length,
      pendingCompanyResponses: pendingResponse.length,
      confirmedDrives: confirmed.length,
      candidatesAwaitingApproval: awaitingApproval.length,
      candidatesShared: shared.length,
      pendingCompanyActions: pendingCompanyActions.length,
      recruiters: recruiters.filter(user => user.isRecruiter).length
    },
    pendingCompanyActions
  };
}

module.exports = {
  STATUSES,
  STATUS_LABELS,
  PIPELINE_STAGES,
  ACCESS_LEVELS,
  RESUME_POLICY_MODES,
  FEEDBACK_TYPES,
  getRecruitmentSettings,
  updateRecruitmentSettings,
  createProposal,
  buildProposalPreview,
  sendProposal,
  companyRespond,
  universityUpdateStatus,
  postMessage,
  getTimeline,
  summarizeCommunication,
  analyzeEngagementRole,
  matchCandidates,
  recommendResumes,
  generateCandidateBrief,
  shareCandidate,
  resolveResumeForShare,
  getShareForRecruiter,
  recordShareFeedback,
  revokeShare,
  listEngagementsWithMeta,
  getEngagementDetail,
  getDashboard
};
