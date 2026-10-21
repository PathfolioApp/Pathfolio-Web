const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, Date, console, require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; }
  });
  return module.exports;
}
const fixtureStudent = { id: 'student-a', personal: { fullName: 'Test Student', email: 'test@example.com' }, academic: { cgpa: 8, department: 'CSE', batchYear: '2027' }, interests: {} };
function fixture(count = 30) {
  const calls = { jobs: 0, applications: 0, policy: 0, offers: 0, student: 0 };
  const jobs = Array.from({ length: count }, (_, i) => ({ id: `job-${i}`, title: `Role ${i}`, salaryMax: 1000000, eligibility: { minCgpa: 7 }, status: 'published' }));
  const applications = []; const pastJobs = [];
  const store = {
    listJobPosts: async status => { calls.jobs++; assert.equal(status, 'published'); return jobs; },
    listStudentApplications: async id => { calls.applications++; return applications.filter(a => a.studentId === id); },
    listApplications: async () => assert.fail('Must not read campus-wide applications'),
    getPlacementPolicy: async () => { calls.policy++; return { enabled: true, upgradeMultiplier: 1.5, maxOffersAllowed: 2, brackets: [{ id: 'standard', name: 'Standard', minLpa: 0, maxLpa: 7 }, { id: 'dream', name: 'Dream', minLpa: 7.0001, maxLpa: 14 }, { id: 'super', name: 'Super', minLpa: 14.0001, maxLpa: null }] }; },
    getJobPostsByIds: async ids => { if (ids.length) calls.offers++; return [...jobs, ...pastJobs].filter(j => ids.includes(j.id)); }
  };
  const policy = load('modules/admin/placementPolicy.service.js', { './adminContentStore': store });
  const service = load('modules/admin/adminContent.service.js', {
    './adminContentStore': store, '../students/studentStore': { getStudentById: async () => { calls.student++; return fixtureStudent; } },
    '../../shared/auditLog.service': {}, './placementPolicy.service': policy, '../resumes/resumeStore': { findOwnedResume: async () => ({ id: 'resume-1', filename: 'resume.pdf' }) }
  });
  return { service, policy, store, jobs, applications, pastJobs, calls };
}
test('100 opportunities load with one shared policy/application context and no extra profile query', async () => {
  const f = fixture(100); const result = await f.service.publishedJobsForStudent(fixtureStudent.id, fixtureStudent);
  assert.equal(result.length, 100); assert.ok(result.every(j => j.eligibility.meetsAll));
  assert.deepEqual(f.calls, { jobs: 1, applications: 1, policy: 1, offers: 0, student: 0 });
});
test('selected offers from unpublished jobs are fetched once and preserve eligibility rules', async () => {
  const f = fixture(40); f.pastJobs.push({ id: 'old-role', salaryMax: 600000, companyName: 'Past employer' });
  f.applications.push({ id: 'offer', studentId: fixtureStudent.id, jobPostId: 'old-role', status: 'selected' });
  f.jobs[0].salaryMax = 800000; f.jobs[1].salaryMax = 600000;
  const result = await f.service.publishedJobsForStudent(fixtureStudent.id, fixtureStudent);
  assert.equal(result[0].eligibility.meetsAll, false); assert.ok(result[0].eligibility.issues.some(i => i.includes('1.5x')));
  assert.equal(result[1].eligibility.meetsAll, false); assert.ok(result[1].eligibility.issues.some(i => i.includes('same or lower')));
  assert.equal(result[2].eligibility.meetsAll, true); assert.equal(f.calls.offers, 1); assert.equal(f.calls.policy, 1);
});
test('single-job checks still reload fresh policy/offer data, including the maximum-offer rule', async () => {
  const f = fixture(2);
  assert.equal((await f.policy.evaluateUpgradeEligibility(fixtureStudent.id, f.jobs[0])).eligible, true);
  f.applications.push(...f.jobs.map((j, i) => ({ id: `app-${i}`, studentId: fixtureStudent.id, jobPostId: j.id, status: 'selected' })));
  const result = await f.policy.evaluateUpgradeEligibility(fixtureStudent.id, { salaryMax: 2500000 });
  assert.equal(result.eligible, false); assert.ok(result.issues[0].includes('maximum allowed campus offers')); assert.equal(f.calls.policy, 2);
});
test('applied status and academic eligibility remain accurate for each job', async () => {
  const f = fixture(2); f.jobs[1].eligibility.minCgpa = 9;
  f.applications.push({ id: 'mine', jobPostId: 'job-0', studentId: fixtureStudent.id, status: 'shortlisted' }, { id: 'other', jobPostId: 'job-1', studentId: 'another-student', status: 'applied' });
  const jobs = await f.service.publishedJobsForStudent(fixtureStudent.id, fixtureStudent);
  assert.equal(jobs[0].application.id, 'mine'); assert.equal(jobs[0].hasApplied, true);
  assert.equal(jobs[1].hasApplied, false); assert.equal(jobs[1].eligibility.meetsAll, false);
});
test('no published jobs avoids unnecessary policy and offer work', async () => {
  const f = fixture(0); assert.equal((await f.service.publishedJobsForStudent(fixtureStudent.id, fixtureStudent)).length, 0);
  assert.equal(f.calls.policy, 0); assert.equal(f.calls.offers, 0);
});

function makeStore() {
  return load('modules/admin/adminContentStore.js', { crypto, '../../config': {}, '../../shared/db': { withRetry: fn => fn() } });
}
test('student application SQL is scoped, parameterized and ordered; empty batches never query', async () => {
  const store = makeStore(); const queries = [];
  store.pool = { execute: async (sql, params) => { queries.push({ sql, params }); return [[], []]; } };
  await store.listStudentApplications('student-a'); await store.getJobPostsByIds([]);
  assert.equal(queries.length, 1); assert.match(queries[0].sql, /WHERE student_id=\? ORDER BY created_at DESC/); assert.equal(queries[0].params[0], 'student-a');
  await store.getJobPostsByIds(['job-a', 'job-a', 'job-b']); assert.equal(queries.length, 2);
  assert.equal(queries[1].params.length, 2); assert.match(queries[1].sql, /WHERE j.id IN \(\?,\?\)/);
});
test('SQL statistics return aggregate counts without fetching student profiles or application snapshots', async () => {
  const store = makeStore(); const queries = [];
  store.pool = { execute: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('WHERE student_id=?')) return [[{ applications: 3, shortlisted: '1', interviews: null, selected: '1', rejected: 0 }], []];
    if (sql.includes('totalApplications')) return [[{ totalApplications: '12', offers: '2' }], []];
    if (sql.includes('activeOpportunities')) return [[{ activeOpportunities: '5' }], []];
    if (sql.includes('FROM students')) return [[{ students: '4' }], []];
    return [[{ companyName: 'Company', applications: '3', selected: '1' }], []];
  } };
  const stats = await store.getPlacementStats('student-a');
  assert.equal(stats.me.applications, 3); assert.equal(stats.me.interviews, 0); assert.equal(stats.me.activeOpportunities, 5);
  assert.equal(stats.cohort.applicationRate, 3); assert.equal(stats.cohort.offers, 2); assert.equal(stats.perCompany[0].selected, 1);
  assert.equal(queries.length, 5); assert.ok(queries.every(q => !q.sql.includes('SELECT *') && !q.sql.includes('profile_snapshot')));
});
test('volatile student application reads also exclude other students', async () => {
  const store = makeStore(); const date = '2026-10-21T00:00:00Z';
  store.applications.set('mine', { id: 'mine', studentId: 'a', createdAt: date, updatedAt: date });
  store.applications.set('other', { id: 'other', studentId: 'b', createdAt: date, updatedAt: date });
  const result = await store.listStudentApplications('a'); assert.equal(result.length, 1); assert.equal(result[0].id, 'mine');
});

function readHelper() {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/modules/student/placements/placementReads.js'), 'utf8').replace('export function', 'function');
  const context = vm.createContext({}); vm.runInContext(source, context); return context.placementRead;
}
test('simultaneous client reads share a request, but completed reads are never cached', async () => {
  const read = readHelper(); let calls = 0;
  const fetch = async () => { calls++; return { success: true }; };
  const first = read('student-a', '/opportunities', fetch), second = read('student-a', '/opportunities', fetch);
  assert.equal(first, second); await Promise.all([first, second]); assert.equal(calls, 1);
  await read('student-a', '/opportunities', fetch); assert.equal(calls, 2);
});
test('in-flight reads are isolated by student and failed reads can be retried', async () => {
  const read = readHelper(); let calls = 0;
  const fetch = async () => { calls++; return {}; };
  await Promise.all([read('a', '/opportunities', fetch), read('b', '/opportunities', fetch)]); assert.equal(calls, 2);
  await assert.rejects(read('a', '/opportunities', async () => { throw new Error('offline'); }));
  await read('a', '/opportunities', fetch); assert.equal(calls, 3);
});


test('missing scores and department cannot be interpreted as zero or a matching department', () => {
  const { service } = fixture(1);
  const criteria = { eligibility: { minCgpa: 0, minTenthPercentage: 0, minTwelfthPercentage: 0, allowedDepartments: ['CSE'] } };
  for (const empty of [null, '', undefined]) {
    const issues = service.checkEligibility({ academic: { cgpa: empty, tenthPercentage: empty, twelfthPercentage: empty, department: empty } }, criteria);
    assert.equal(issues.length, 4); assert.match(issues[0], /not on record/);
  }
  assert.equal(service.checkEligibility({ academic: { cgpa: 0, tenthPercentage: 0, twelfthPercentage: 0, department: 'CSE' } }, criteria).length, 0);
});

test('employer questions are required and submitted answers are saved with the application', async () => {
  const f = fixture(1);
  f.jobs[0].status = 'published';
  f.jobs[0].applicationForm = { fields: [{ id: 'reason', label: 'Why this role?', type: 'textarea', required: true }, { id: 'portfolio', label: 'Portfolio', type: 'url', required: false }] };
  f.store.getJobPost = async () => f.jobs[0]; f.store.findApplication = async () => null;
  f.store.saveApplication = async app => app;
  await assert.rejects(f.service.apply('job-0', fixtureStudent.id, { resumeId: 'resume-1', answers: {} }), /Why this role.*required/);
  const result = await f.service.apply('job-0', fixtureStudent.id, { resumeId: 'resume-1', answers: { reason: '  I enjoy building tools.  ', portfolio: 'https://example.com', undeclared: 'ignore' } });
  assert.equal(result.answers.reason, 'I enjoy building tools.'); assert.equal(result.answers.portfolio, 'https://example.com'); assert.equal(result.answers.undeclared, undefined);
});

test('expired and duplicate applications remain blocked by fresh server checks', async () => {
  const f = fixture(1); f.jobs[0].status = 'published'; f.jobs[0].applicationDeadline = '2000-01-01T00:00:00Z';
  f.store.getJobPost = async () => f.jobs[0];
  await assert.rejects(f.service.apply('job-0', fixtureStudent.id, {}), /deadline/);
  f.jobs[0].applicationDeadline = null; f.store.findApplication = async () => ({ id: 'existing' });
  await assert.rejects(f.service.apply('job-0', fixtureStudent.id, {}), /already applied/);
});

test('browse status prioritizes applications and expiry, then distinguishes missing records from cutoffs', async () => {
  const { opportunityState } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  const now = Date.parse('2026-10-21T00:00:00Z');
  assert.equal(opportunityState({ application: { status: 'shortlisted' }, deadlinePassed: true }, {}, now).label, 'Shortlisted');
  assert.equal(opportunityState({ applicationDeadline: '2026-10-20', eligibility: { meetsAll: true } }, {}, now).key, 'closed');
  assert.equal(opportunityState({ eligibility: { minCgpa: 7, meetsAll: false } }, { academic: { cgpa: null } }, now).key, 'missing');
  assert.equal(opportunityState({ eligibility: { minCgpa: 7, meetsAll: false } }, { academic: { cgpa: 6 } }, now).key, 'ineligible');
});

test('search and filters combine and sorting leaves source data unchanged', async () => {
  const { filterOpportunities } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  const jobs = [{ id: 'a', title: 'Engineer', companyName: 'Acme', requiredSkills: ['React'], workMode: 'remote', employmentType: 'internship', eligibility: { meetsAll: true }, createdAt: '2026-10-10' }, { id: 'b', title: 'Designer', companyName: 'Studio', applicationDeadline: '2099-01-01', createdAt: '2026-10-20' }];
  assert.deepEqual(filterOpportunities(jobs, { query: 'acme react', mode: 'remote', role: 'internship', status: 'eligible' }).map(j => j.id), ['a']);
  assert.deepEqual(filterOpportunities(jobs, { sort: 'newest' }).map(j => j.id), ['b', 'a']);
  assert.deepEqual(filterOpportunities(jobs, { sort: 'deadline' }).map(j => j.id), ['b', 'a']);
  assert.deepEqual(jobs.map(j => j.id), ['a', 'b']);
});


test('application search combines company, role and status while preserving source order', async () => {
  const { filterApplications } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  const applications = [
    { id: 'a', status: 'shortlisted', job: { title: 'Software Engineer', companyName: 'Acme' }, appliedAt: '2026-10-01', updatedAt: '2026-10-20' },
    { id: 'b', status: 'rejected', job: null, appliedAt: '2026-10-10' },
    { id: 'c', status: 'applied', job: { title: 'Designer', companyName: 'Acme' }, appliedAt: '2026-10-12', updatedAt: '2026-10-12' }
  ];
  assert.deepEqual(filterApplications(applications, { query: 'ACME engineer', status: 'shortlisted' }).map(app => app.id), ['a']);
  assert.equal(filterApplications(applications, { query: 'engineer', status: 'rejected' }).length, 0);
  assert.deepEqual(filterApplications(applications, { sort: 'updated' }).map(app => app.id), ['a', 'c', 'b']);
  assert.deepEqual(filterApplications(applications).map(app => app.id), ['c', 'b', 'a']);
  assert.deepEqual(applications.map(app => app.id), ['a', 'b', 'c']);
});

test('application history uses recorded events and never invents intermediate stages or submission dates', async () => {
  const { applicationUpdates, applicationMessages } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  assert.deepEqual(applicationUpdates({ status: 'rejected' }), []);
  const updates = applicationUpdates({ status: 'rejected', createdAt: '2026-10-01', updatedAt: '2026-10-20' });
  assert.equal(updates.length, 2); assert.equal(updates[0].label, 'Application submitted'); assert.match(updates[1].label, /Not selected/);
  assert.ok(!updates.some(event => /interview|shortlist/i.test(event.label)));
  const timeline = [{ label: 'Recorded custom update', at: '2026-10-02' }];
  assert.equal(applicationUpdates({ timeline }), timeline);
  assert.doesNotMatch(applicationMessages.shortlisted.description, /scheduled|confirmed/i);
  assert.doesNotMatch(applicationMessages.selected.description, /offer confirmed/i);
});


test('unknown backlog and gap counts do not satisfy a zero maximum; recorded zero does', async () => {
  const { service } = fixture(1);
  const criteria = { maxActiveBacklogs: 0, maxHistoricalBacklogs: 0, maxGapYears: 0 };
  const { academicComparisons, opportunityState } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  for (const blank of [undefined, null, '', '   ']) {
    const student = { academic: { activeBacklogs: blank, historicalBacklogs: blank, gapYears: blank } };
    const issues = service.checkEligibility(student, { eligibility: criteria });
    assert.equal(issues.length, 3); assert.ok(issues.every(issue => issue.includes('not on record')));
    const rows = academicComparisons(student, criteria).filter(row => ['activeBacklogs', 'historicalBacklogs', 'gapYears'].includes(row.id));
    assert.ok(rows.every(row => row.state === 'missing' && row.actual === 'Not recorded'));
    assert.equal(opportunityState({ eligibility: { ...criteria, issues, meetsAll: false } }, student).key, 'missing');
  }
  const student = { academic: { activeBacklogs: 0, historicalBacklogs: 0, gapYears: 0 } };
  assert.equal(service.checkEligibility(student, { eligibility: criteria }).length, 0);
  assert.ok(academicComparisons(student, criteria).filter(row => ['activeBacklogs', 'historicalBacklogs', 'gapYears'].includes(row.id)).every(row => row.state === 'met' && row.actual === '0'));
});

test('every academic rule has a comparison, including zero cutoffs and unrestricted fields', async () => {
  const { academicComparisons } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  const { service } = fixture(1);
  const student = { academic: { cgpa: 0, tenthPercentage: 0, twelfthPercentage: 0, activeBacklogs: 1, historicalBacklogs: 2, gapYears: 0.5, department: 'CSE', batchYear: '2027' } };
  const criteria = { minCgpa: 0, minTenthPercentage: 0, minTwelfthPercentage: 0, maxActiveBacklogs: 0, maxHistoricalBacklogs: 1, maxGapYears: 0, allowedDepartments: ['CSE'], allowedBatches: ['2027'] };
  const rows = academicComparisons(student, criteria);
  assert.equal(rows.length, 8); assert.equal(rows.filter(row => row.state === 'unmet').length, 3);
  assert.equal(service.checkEligibility(student, { eligibility: criteria }).length, 3);
  assert.equal(rows[0].requirement, 'Minimum 0');
  assert.ok(academicComparisons({}, {}).every(row => row.state === 'unrestricted' && row.actual === 'Not recorded'));
  assert.equal(service.checkEligibility({}, { eligibility: {} }).length, 0);
});


test('compensation labels stay consistent across role cards and overview without inventing pay or currency units', async () => {
  const { compensationLabel } = await import('../../frontend/src/modules/student/placements/placementModel.mjs');
  assert.equal(compensationLabel({}), '');
  assert.equal(compensationLabel({ salaryMin: '', salaryMax: 'invalid' }), '');
  assert.equal(compensationLabel({ salaryMin: 700000, salaryMax: 900000 }), '₹7L – ₹9L');
  assert.equal(compensationLabel({ salaryMax: 700000 }), '₹7L');
  assert.equal(compensationLabel({ salaryMin: 7, salaryMax: 9 }), '₹7 – ₹9');
  assert.equal(compensationLabel({ salaryCurrency: 'USD', salaryMin: 100000 }), 'USD 1,00,000');
});
