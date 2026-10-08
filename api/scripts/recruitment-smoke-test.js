/* Recruitment workflow smoke test (no DB): exercises priority scoring, proposal
 * lifecycle, transitions, and share logic against volatile in-memory stores. */
process.env.USE_DATABASE = 'false';
delete process.env.DB_HOST;

const path = require('path');
const root = path.join(__dirname, '..');
const recruitment = require(path.join(root, 'src/modules/admin/recruitment.service'));
const recruitmentPriority = require(path.join(root, 'src/modules/admin/recruitmentPriority.service'));
const store = require(path.join(root, 'src/modules/admin/recruitmentStore'));
const adminContent = require(path.join(root, 'src/modules/admin/adminContent.service'));
const studentStore = require(path.join(root, 'src/modules/students/studentStore'));

async function main() {
  const results = { pass: [], fail: [] };
  const check = (name, condition, extra = '') => {
    if (condition) results.pass.push(name);
    else results.fail.push(`${name}${extra ? ` — ${extra}` : ''}`);
  };

  // Seed: one company + a few students with skills.
  const company = await adminContent.createCompany({ name: 'SmokeTest Corp', website: 'https://smoke.test', description: 'smoke' }, 'admin1');
  for (let i = 0; i < 3; i++) {
    await studentStore.saveStudent({
      id: `stu_${i}`,
      personal: { fullName: `Student ${i}`, email: `stu${i}@x.test` },
      academic: { rollNumber: `R${i}`, department: 'Computer Science', cgpa: 8 + i * 0.3, batchYear: '2027' },
      interests: { passions: [{ name: 'Python' }], hobbies: [{ name: 'SQL' }] },
      projects: [{ projectName: `Proj ${i}`, technologies: ['Python', 'Django', 'PostgreSQL'], description: 'backend api work with rest apis' }],
      internships: [{ role: 'Backend Intern', companyName: 'ACME', skills: ['Python', 'REST APIs'] }],
      onboarding: { completed: true },
      createdAt: new Date().toISOString()
    });
  }

  // 1. Recommendations generate deterministically with factors.
  const recs = await recruitmentPriority.generateRecommendations({ persist: true });
  check('recommendations generated', recs.length >= 1);
  const rec = recs.find(item => item.company.id === company.id);
  check('company scored', rec && typeof rec.score === 'number', `score=${rec?.score}`);
  check('factors present with earned/max', rec && Object.values(rec.factors).every(f => typeof f.earned === 'number' && typeof f.max === 'number' && f.detail), JSON.stringify(rec?.factors));
  check('source labelled', rec && ['ai', 'deterministic'].includes(rec.source), rec?.source);
  check('score in range', rec && rec.score >= 0 && rec.score <= 100, String(rec?.score));

  // 2. Proposal preview + creation: provisional, never auto-confirmed.
  const preview = await recruitment.buildProposalPreview({ companyId: company.id, roles: ['Backend Engineer'] });
  check('preview marks provisional', preview.provisional === true);
  const engagement = await recruitment.createProposal({ companyId: company.id, roles: ['Backend Engineer'], jobDescription: 'Build REST APIs with Python, Django, PostgreSQL, Docker and AWS. Minimum CGPA of 7.0. Backend engineer to design and develop services.' }, 'admin1');
  check('created as proposed', engagement.status === 'proposed');
  check('provisional flag true', engagement.provisional === true);
  const messages = await recruitment.getTimeline(engagement.id);
  check('proposal message recorded', messages.length === 1 && messages[0].kind === 'proposal');

  // 3. Invalid transitions rejected.
  let threw = false;
  try { await recruitment.companyRespond(engagement.id, 'rec1', { response: 'confirmed' }); } catch { threw = true; }
  check('company cannot jump straight to confirmed', threw);
  threw = false;
  try { await recruitment.companyRespond(engagement.id, 'rec1', { response: 'bogus' }); } catch { threw = true; }
  check('bogus response rejected', threw);

  // 4. Negotiation flow: reschedule → under_discussion → accepted → confirmed.
  await recruitment.companyRespond(engagement.id, 'rec1', { response: 'reschedule_requested', proposedStart: '2026-11-02', proposedEnd: '2026-11-06', message: 'Please move to November.' });
  updated = await store.getEngagement(engagement.id);
  check('reschedule recorded', updated.status === 'reschedule_requested' && String(updated.proposedStart || '').slice(0, 10) === '2026-11-02', `status=${updated.status} start=${updated.proposedStart}`);
  await recruitment.companyRespond(engagement.id, 'rec1', { response: 'under_discussion', message: 'November could work, discussing internally.' });
  await recruitment.universityUpdateStatus(engagement.id, 'admin1', { status: 'accepted' });
  updated = await store.getEngagement(engagement.id);
  check('accepted', updated.status === 'accepted');
  await recruitment.universityUpdateStatus(engagement.id, 'admin1', { status: 'confirmed', message: 'Confirming November window.' });
  updated = await store.getEngagement(engagement.id);
  check('confirmed only after explicit action', updated.status === 'confirmed' && updated.provisional === false);
  check('confirmed dates set', Boolean(updated.confirmedStart));

  // 5. Role analysis + candidate matching reuse the JD analyser.
  const analysis = await recruitment.analyzeEngagementRole(engagement.id, 'admin1');
  check('role analysis extracted skills', analysis.analysis.skills.includes('Python'), analysis.analysis.skills.join(','));
  const matches = await recruitment.matchCandidates(engagement.id);
  check('candidates matched from real students', matches.candidates.length === 3, String(matches.candidates.length));
  check('match includes eligibility reasons', matches.candidates.every(c => Array.isArray(c.reasons)));

  // 6. Resume recommendation from parsed content (no resumes yet → graceful).
  const resumeRec = await recruitment.recommendResumes(engagement.id, 'stu_0');
  check('resume recommendation graceful without resumes', resumeRec.resumes.length === 0 && resumeRec.note);

  // 7. Candidate brief — works with or without AI configured.
  const brief = await recruitment.generateCandidateBrief(engagement.id, 'stu_0');
  check('brief generated', brief.available === true && ['ai', 'fallback'].includes(brief.generatedBy), brief.generatedBy);
  check('brief only uses profile data', /Computer Science|2027|8/.test(brief.academicProfile) || brief.academicProfile.includes('Student 0'), brief.academicProfile);

  // 8. Share a candidate (university controlled policy default).
  const share = await recruitment.shareCandidate({ engagementId: engagement.id, studentId: 'stu_0' }, 'admin1');
  check('share created', Boolean(share.id) && share.companyId === company.id);
  check('share policy recorded', share.policyMode === 'university_controlled');
  check('share approvedBy set under university policy', share.approvedBy === 'admin1');

  // 9. Communication summary — grounded in stored messages only.
  const timeline = await recruitment.getTimeline(engagement.id);
  check('timeline grew with system events', timeline.length >= 2);
  const summary = await recruitment.summarizeCommunication(engagement.id);
  check('summary available', summary.available === true && ['ai', 'fallback'].includes(summary.generatedBy), summary.generatedBy);
  check('summary mentions real content', summary.summary.length > 10);

  // 10. Dashboard metrics.
  const dash = await recruitment.getDashboard();
  check('dashboard counts engagement states', typeof dash.metrics.confirmedDrives === 'number' && dash.metrics.confirmedDrives >= 1, JSON.stringify(dash.metrics));

  // 11. Access control: unauthorized recruiter blocked; authorized can read.
  const users = await studentStore.listStudents();
  const outsider = users.find(u => u.id === 'stu_1');
  threw = false;
  try { await recruitment.getShareForRecruiter(share.id, outsider.id); } catch (e) { threw = e.statusCode === 403 || e.statusCode === 404; }
  check('non-company recruiter blocked from share', threw);

  console.log(`\nPASS: ${results.pass.length}`);
  results.pass.forEach(name => console.log(`  ✓ ${name}`));
  if (results.fail.length) {
    console.log(`FAIL: ${results.fail.length}`);
    results.fail.forEach(name => console.log(`  ✗ ${name}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(error => { console.error('SMOKE CRASH:', error); process.exit(1); });
