const store = require('./recruitmentStore');
const adminContentStore = require('./adminContentStore');
const studentStore = require('../students/studentStore');
const jdAnalyzer = require('./jdAnalyzer.service');
const aiGateway = require('../../shared/aiGateway.service');
const auditLog = require('../../shared/auditLog.service');

/**
 * Explainable company priority scoring + AI outreach recommendation.
 *
 * Product principles enforced here:
 *  - The score is never a black box: every factor returns its points earned,
 *    its maximum, and the concrete evidence used (requirement #2, #19).
 *  - The score is deterministic from real stored data - counting students,
 *    engagements, messages. The LLM never invents the score; at most it maps
 *    factors to a recommendation tier with narrative reasons (#25, #26).
 *  - No AI configured? Everything still works; recommendation falls back to
 *    the deterministic tier mapping and is labelled "deterministic" (#22).
 */

const RECOMMENDATIONS = ['contact_now', 'contact_soon', 'monitor', 'low_priority'];

const RECOMMENDATION_LABELS = {
  contact_now: 'Contact now',
  contact_soon: 'Contact soon',
  monitor: 'Monitor',
  low_priority: 'Low priority'
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const FACTOR_DEFS = [
  { key: 'studentFit', label: 'Student fit', max: 35 },
  { key: 'historicalHiring', label: 'Historical hiring', max: 20 },
  { key: 'relationship', label: 'Relationship', max: 15 },
  { key: 'timing', label: 'Timing', max: 15 },
  { key: 'responseLikelihood', label: 'Response likelihood', max: 15 }
];

function daysSince(isoDate) {
  if (!isoDate) return null;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

/**
 * Compute the deterministic factor breakdown for one company. Every factor
 * carries {earned,max,detail} so the UI can render exactly why the score is
 * what it is (requirement #19: inspectable evidence).
 */
async function scoreCompany(company, context) {
  const { engagementsByCompany, messagesByCompany, sharesByCompany, students, jobPosts, users } = context;
  const companyId = company.id;
  const engagements = engagementsByCompany.get(companyId) || [];
  const messages = messagesByCompany.get(companyId) || [];
  const shares = sharesByCompany.get(companyId) || [];

  const studentSkills = context.studentSkillCache || null;
  const detail = [];
  const factors = {};
  const evidence = [];

  // ---------------------------------------------------------------- student fit
  // How many students would plausibly match this company's historical/known
  // hiring domains, using the SAME skill taxonomy the JD analyser uses.
  let studentFit = 0;
  const knownText = engagements
    .flatMap(engagement => [
      (engagement.roles || []).join(' '),
      engagement.roleAnalysis?.summary || '',
      engagement.roleAnalysis?.skills?.join(' ') || ''
    ])
    .filter(Boolean).join(' ');
  const companyJobs = jobPosts.filter(job => job.companyId === companyId && job.status !== 'archived');
  const jobSkillText = companyJobs.map(job => `${job.title} ${(job.requiredSkills || []).join(' ')} ${job.description?.slice(0, 400) || ''}`).join(' ');
  const demandSkills = jdAnalyzer.detectSkillsPublic(`${knownText} ${jobSkillText}`);
  const demandDomains = jdAnalyzer.detectDomainsPublic(`${knownText} ${jobSkillText}`.toLowerCase());

  let eligibleCount = 0;
  let strongMatches = 0;
  if (students.length) {
    for (const student of students) {
      const skillSet = studentSkills.get(student.id);
      if (!skillSet || !skillSet.size) continue;
      let overlap = 0;
      for (const skill of demandSkills) if (skillSet.has(skill)) overlap += 1;
      const cgpa = Number(student.academic?.cgpa);
      const academicallySound = Number.isFinite(cgpa) ? cgpa >= 6 : true;
      if (overlap > 0 && academicallySound) eligibleCount += 1;
      if (demandSkills.length >= 3 && overlap >= Math.max(2, Math.ceil(demandSkills.length * 0.4)) && academicallySound) strongMatches += 1;
    }
  }
  const fitRatio = students.length ? (eligibleCount / students.length) : 0;
  studentFit += Math.round(clamp(eligibleCount / 8, 0, 1) * 15); // volume of eligible students (15)
  studentFit += Math.round(clamp(strongMatches / 10, 0, 1) * 12); // strong candidate matches (12)
  studentFit += Math.round(fitRatio * 8); // breadth of fit across the batch (8)
  const fitMaxTotal = 35;
  studentFit = clamp(studentFit, 0, fitMaxTotal);
  factors.studentFit = {
    label: 'Student fit',
    max: fitMaxTotal,
    earned: studentFit,
    detail: `${eligibleCount} eligible student${eligibleCount === 1 ? '' : 's'}, ${strongMatches} strong match${strongMatches === 1 ? '' : 'es'} for ${demandSkills.slice(0, 5).join(', ') || 'the company\'s known hiring areas'}`
  };
  if (eligibleCount) evidence.push({ kind: 'students', label: `${eligibleCount} eligible students`, metric: eligibleCount });
  if (strongMatches) evidence.push({ kind: 'matches', label: `${strongMatches} strong candidate matches`, metric: strongMatches });

  // ------------------------------------------------------------ historical hiring
  let historical = 0;
  const completed = engagements.filter(engagement => ['confirmed', 'completed'].includes(engagement.status));
  if (completed.length) historical += clamp(completed.length * 7, 0, 12);
  const offersOrPlacements = shares.filter(share => ['shortlisted', 'interested'].includes(share.companyResponse));
  if (offersOrPlacements.length) historical += clamp(offersOrPlacements.length, 0, 4);
  historical += clamp(companyJobs.length * 1.5, 0, 4);
  historical = clamp(Math.round(historical), 0, 20);
  factors.historicalHiring = {
    label: 'Historical hiring',
    max: 20,
    earned: historical,
    detail: completed.length
      ? `${completed.length} previous recruitment drive${completed.length === 1 ? '' : 's'}, ${companyJobs.length} job post${companyJobs.length === 1 ? '' : 's'} on record`
      : `${companyJobs.length} job post${companyJobs.length === 1 ? '' : 's'} on record, no previous drives with the university yet`
  };
  if (completed.length) evidence.push({ kind: 'drives', label: `${completed.length} previous drive(s)`, metric: completed.length });

  // ------------------------------------------------------------------ relationship
  let relationship = 0;
  const inbound = messages.filter(message => message.senderRole === 'company').length;
  const outbound = messages.filter(message => message.senderRole === 'university').length;
  const totalMessages = messages.length;
  if (totalMessages >= 4) relationship += 6;
  else if (totalMessages >= 2) relationship += 3;
  if (inbound >= 2) relationship += 4;
  else if (inbound === 1) relationship += 2;
  if (shares.length) relationship += clamp(shares.length, 0, 5);
  relationship = clamp(Math.round(relationship), 0, 15);
  factors.relationship = {
    label: 'Relationship',
    max: 15,
    earned: relationship,
    detail: totalMessages
      ? `${totalMessages} message${totalMessages === 1 ? '' : 's'} exchanged (${inbound} from the company), ${shares.length} candidate share${shares.length === 1 ? '' : 's'}`
      : 'No recruitment communication yet - first contact'
  };
  if (totalMessages) evidence.push({ kind: 'messages', label: `${totalMessages} messages exchanged`, metric: totalMessages });

  // ---------------------------------------------------------------------- timing
  // Historical recruitment timing: drives historically starting in the current
  // month window score higher (seasonality), plus freshness of last contact.
  let timing = 0;
  const now = new Date();
  const month = now.getMonth();
  const sameMonthDrives = engagements.filter(engagement => {
    const start = engagement.proposedStart || engagement.confirmedStart;
    if (!start) return false;
    return new Date(start).getMonth() === month;
  });
  if (sameMonthDrives.length) timing += 6;
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  const daysSinceContact = daysSince(lastMessage?.createdAt);
  const daysSinceEngagement = daysSince(engagements[0]?.updatedAt);
  const referenceDate = daysSinceContact !== null ? daysSinceContact : daysSinceEngagement;
  if (referenceDate === null) timing += 7; // never contacted - good time to start
  else if (referenceDate <= 7) timing += 2; // just talked
  else if (referenceDate <= 30) timing += 4;
  else if (referenceDate <= 90) timing += 6;
  else timing += 7; // long silence - worth re-engaging
  timing = clamp(Math.round(timing), 0, 15);
  factors.timing = {
    label: 'Timing',
    max: 15,
    earned: timing,
    detail: referenceDate === null
      ? 'No prior contact on record - appropriate time for first outreach'
      : `Last communication ${referenceDate === 0 ? 'today' : `${referenceDate} day${referenceDate === 1 ? '' : 's'} ago`}${sameMonthDrives.length ? '; this month matches previous drive timing' : ''}`
  };
  if (referenceDate !== null && referenceDate > 30) evidence.push({ kind: 'recency', label: `No recent outreach (${referenceDate} days)`, metric: referenceDate });

  // --------------------------------------------------------- response likelihood
  let response = 0;
  const responses = engagements.map(engagement => engagement.status).filter(status => ['under_discussion', 'accepted', 'confirmed', 'completed'].includes(status));
  if (responses.length) response += clamp(responses.length * 4, 0, 8);
  if (inbound > 0) response += 4; // company has replied before
  const rejected = engagements.filter(engagement => engagement.status === 'rejected').length;
  if (rejected && !responses.length) response -= 3;
  if (engagements.length && !inbound) response -= 2; // proposals sent, company never answered
  response = clamp(Math.round(response), 0, 15);
  factors.responseLikelihood = {
    label: 'Response likelihood',
    max: 15,
    earned: response,
    detail: inbound
      ? `Company replied to ${inbound} of ${totalMessages} messages; ${responses.length} positive engagement response${responses.length === 1 ? '' : 's'}`
      : (engagements.length ? 'Proposals sent but no company reply yet' : 'No prior outreach to measure responsiveness')
  };

  const score = clamp(factors.studentFit.earned + factors.historicalHiring.earned + factors.relationship.earned + factors.timing.earned + factors.responseLikelihood.earned, 0, 100);
  return { companyId, score, factors, evidence, derived: { eligibleCount, strongMatches, demandSkills, demandDomains, totalMessages, inbound, completedDrives: completed.length } };
}

/** Map a deterministic score onto a recommendation tier without an LLM. */
function tierForScore(score, derived) {
  if (score >= 70) return 'contact_now';
  if (score >= 50) return 'contact_soon';
  if (score >= 30) return 'monitor';
  return 'low_priority';
}

/**
 * Generate (or refresh) recommendations for all active companies.
 * Returns a list sorted by score desc: {company, score, factors, recommendation,
 * reasons, source, recommendationId, aiEnhanced}.
 */
async function generateRecommendations({ actorId = null, persist = true } = {}) {
  // One student-table read serves both the candidate pool and recruiter accounts.
  const [companies, engagements, students, jobPosts] = await Promise.all([
    adminContentStore.listCompanies(),
    store.listEngagements(),
    studentStore.listStudents(),
    adminContentStore.listJobPosts()
  ]);
  const activeStudents = students.filter(student => !student.isAdmin && !student.isRecruiter && student.status !== 'suspended' && student.onboarding?.completed !== false);
  const recruiters = students.filter(student => student.isRecruiter);

  const engagementsByCompany = new Map();
  for (const engagement of engagements) {
    const list = engagementsByCompany.get(engagement.companyId) || [];
    list.push(engagement);
    engagementsByCompany.set(engagement.companyId, list);
  }
  const engagementIds = engagements.map(engagement => engagement.id);
  const messagesByCompany = new Map();
  const allMessages = await Promise.all(engagementIds.map(id => store.listMessages(id)));
  const messagesByEngagement = new Map();
  for (const list of allMessages) {
    for (const message of list) {
      const group = messagesByEngagement.get(message.engagementId) || [];
      group.push(message);
      messagesByEngagement.set(message.engagementId, group);
    }
  }
  // Compute per-company message stats from the FULL timeline so relationship
  // and response-likelihood factors reflect every stored message.
  const fullMessagesByCompany = new Map();
  for (const [engagementId, list] of messagesByEngagement) {
    const engagement = engagements.find(item => item.id === engagementId);
    if (!engagement) continue;
    const group = fullMessagesByCompany.get(engagement.companyId) || [];
    group.push(...list);
    fullMessagesByCompany.set(engagement.companyId, group);
  }
  for (const [companyId, list] of fullMessagesByCompany) {
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    messagesByCompany.set(companyId, list);
  }

  const shares = await store.listShares();
  const sharesByCompany = new Map();
  for (const share of shares) {
    const list = sharesByCompany.get(share.companyId) || [];
    list.push(share);
    sharesByCompany.set(share.companyId, list);
  }

  // Pre-compute every student's canonical skill set once (same taxonomy the JD
  // analyser uses) so company scoring is one Set lookup per student.
  const studentSkillCache = new Map();
  for (const student of activeStudents) {
    const text = jdAnalyzer.studentSkillTextPublic(student);
    studentSkillCache.set(student.id, new Set(jdAnalyzer.detectSkillsPublic(text)));
  }

  const context = {
    engagementsByCompany,
    messagesByCompany: fullMessagesByCompany,
    sharesByCompany,
    students: activeStudents,
    jobPosts,
    users: recruiters,
    studentSkillCache
  };

  const scored = [];
  for (const company of companies) {
    if (company.status === 'archived') continue;
    const result = await scoreCompany(company, context);
    scored.push({ company, ...result });
  }
  scored.sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name));

  // One batched AI call ranks/annotates; deterministic data stays the source of
  // truth. If AI is unavailable the deterministic tier is used and clearly
  // labelled (requirement #22: never fabricate AI results).
  const aiPayload = aiGateway.isConfigured()
    ? await aiGateway.generateJson({
        systemPrompt: 'You are a university placement strategist. Using ONLY the deterministic score factors provided for each company, assign each company a recruitment recommendation tier and at most 3 short evidence-based reasons. Never invent facts not present in the factors. Keep reasons under 120 characters.',
        schemaHint: '{"companies":[{"companyId":"string","recommendation":"contact_now|contact_soon|monitor|low_priority","reasons":["string"]}]}',
        userPrompt: JSON.stringify(scored.slice(0, 25).map(item => ({
          companyId: item.company.id,
          company: item.company.name,
          score: item.score,
          factors: Object.fromEntries(Object.entries(item.factors).map(([key, factor]) => [factor.label, `${factor.earned}/${factor.max}`])),
          evidence: item.derived
        }))),
        temperature: 0.2
      })
    : null;

  const aiById = new Map();
  if (aiPayload && Array.isArray(aiPayload.companies)) {
    for (const entry of aiPayload.companies) {
      if (entry?.companyId && RECOMMENDATIONS.includes(entry.recommendation)) {
        aiById.set(String(entry.companyId), entry);
      }
    }
  }

  const results = [];
  for (const item of scored) {
    const aiEntry = aiById.get(String(item.company.id));
    const recommendation = aiEntry?.recommendation || tierForScore(item.score, item.derived);
    const source = aiEntry ? 'ai' : 'deterministic';
    const reasons = (aiEntry?.reasons || []).map(reason => String(reason).slice(0, 160)).slice(0, 3);
    const factorReasons = Object.values(item.factors)
      .filter(factor => factor.earned >= factor.max * 0.6 && factor.earned > 0)
      .slice(0, 3)
      .map(factor => `${factor.label}: ${factor.detail}`);
    const finalReasons = reasons.length ? [...reasons, ...factorReasons].slice(0, 5) : factorReasons;

    const record = {
      companyId: item.company.id,
      score: item.score,
      recommendation,
      factors: item.factors,
      reasons: finalReasons,
      source,
      decision: null,
      decidedBy: null,
      decidedAt: null
    };
    let saved = null;
    if (persist) {
      saved = await store.saveRecommendation(record);
      await auditLog.record({
        actorId,
        action: 'recruitment.recommendation.generated',
        entityType: 'company',
        entityId: item.company.id,
        entityLabel: item.company.name,
        detail: `Priority ${item.score}/100 - ${RECOMMENDATION_LABELS[recommendation]} (${source}).`
      });
    }
    results.push({
      company: {
        id: item.company.id,
        name: item.company.name,
        website: item.company.website || '',
        logoUrl: item.company.logoUrl || '',
        description: item.company.description || ''
      },
      score: item.score,
      recommendation,
      recommendationLabel: RECOMMENDATION_LABELS[recommendation],
      factors: item.factors,
      reasons: finalReasons,
      source,
      evidence: item.evidence,
      derived: {
        eligibleStudents: item.derived.eligibleCount,
        strongMatches: item.derived.strongMatches,
        demandSkills: item.derived.demandSkills.slice(0, 8),
        demandDomains: item.derived.demandDomains,
        completedDrives: item.derived.completedDrives,
        messageCount: item.derived.totalMessages
      },
      recommendationId: saved?.id || null,
      generatedAt: saved?.generatedAt || null
    });
  }
  return results;
}

module.exports = {
  generateRecommendations,
  scoreCompany,
  tierForScore,
  RECOMMENDATIONS,
  RECOMMENDATION_LABELS,
  FACTOR_DEFS
};
