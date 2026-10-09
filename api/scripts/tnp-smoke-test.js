const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.USE_DATABASE = 'false';

const app = require('../src/app');
const studentStore = require('../src/modules/students/studentStore');
const contentStore = require('../src/modules/admin/adminContentStore');

const unique = Date.now().toString();
const ids = { admin: `admin_${unique}`, student: `student_${unique}`, recruiter: `recruiter_${unique}` };

async function request(baseUrl, path, options = {}, cookie) {
  const headers = { 'Content-Type': 'application/json', ...(process.env.API_KEY ? { 'X-API-Key': process.env.API_KEY } : {}), ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function expectStatus(response, expected, label) { assert.equal(response.status, expected, `${label}: expected ${expected}, received ${response.status}`); }
function studentRecord(id, email, isAdmin, isRecruiter = false) {
  return {
    id, isAdmin: Boolean(isAdmin), isRecruiter,
    personal: { fullName: isAdmin ? 'TnP Admin' : isRecruiter ? 'Test Recruiter' : 'Test Applicant', email },
    academic: { rollNumber: isAdmin ? `ADM-${id.slice(-6)}` : `2024T${id.slice(-6)}`, department: 'Computer Science & Engineering', batchYear: '2023 - 2027' },
    interests: { hobbies: [{ name: 'Chess', proficiency: 'beginner', reason: '' }], passions: [] },
    achievements: [], familyContext: { details: '', consentGiven: false },
    profileSettings: { visibility: 'private' }, onboarding: { completed: true },
    status: 'active_onboarded', createdAt: new Date().toISOString()
  };
}

async function run() {
  await studentStore.initialize();
  await contentStore.initialize();
  const admin = await studentStore.saveStudent(studentRecord(ids.admin, `admin_${unique}@kiit.ac.in`, true));
  const student = await studentStore.saveStudent(studentRecord(ids.student, `student_${unique}@kiit.ac.in`, false));
  const recruiter = await studentStore.saveStudent(studentRecord(ids.recruiter, `recruiter_${unique}@kiit.ac.in`, false, true));
  const adminCookie = `pf_session=${await studentStore.createSession(admin.id)}`;
  const studentCookie = `pf_session=${await studentStore.createSession(student.id)}`;
  const recruiterCookie = `pf_session=${await studentStore.createSession(recruiter.id)}`;
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    let result = await request(baseUrl, '/admin/uploads/signature', { method: 'POST' }, adminCookie);
    expectStatus(result.response, 200, 'upload signature');
    assert.ok(result.body.signature, 'should return a signature');
    assert.equal(result.body.accessMode, 'public', 'should force public access mode for attachments');
    console.log('PASS cloudinary signature and ACL config');

    result = await request(baseUrl, '/admin/companies/import', { method: 'POST', body: JSON.stringify({ rows: [{ name: 'Acme Systems', website: 'https://acme.example', logo_url: 'https://acme.example/logo.png' }, { name: 'Acme Systems' }, { website: 'https://missing.example' }] }) }, adminCookie);
    expectStatus(result.response, 200, 'company import');
    assert.equal(result.body.summary.imported, 1);
    assert.equal(result.body.summary.duplicates, 1);
    assert.equal(result.body.summary.errors.length, 1);
    const importedCompany = result.body.summary.companies[0];
    assert.equal(importedCompany.logoUrl, 'https://acme.example/logo.png', 'imported company should have logoUrl');
    console.log('PASS company import summary (with logo)');

    result = await request(baseUrl, '/admin/companies', { method: 'POST', body: JSON.stringify({ name: 'Orbit Labs', website: 'https://orbit.example', logoUrl: 'https://orbit.example/logo.png', logoPublicId: 'pathfolio/tnp/orbit-logo' }) }, adminCookie);
    expectStatus(result.response, 200, 'company create');
    assert.ok(result.body.company.id);
    assert.equal(result.body.company.logoUrl, 'https://orbit.example/logo.png', 'created company should have logoUrl');
    assert.equal(result.body.company.logoPublicId, 'pathfolio/tnp/orbit-logo', 'created company should have logoPublicId');
    console.log('PASS company create (with logo)');

    // --- Job approval workflow: recruiter submits → admin approves → publishes
    result = await request(baseUrl, '/recruiter/jobs', { method: 'POST', body: JSON.stringify({ companyId: importedCompany.id, title: 'Graduate Software Engineer', description: 'Build product experiences with our engineering team.', applicationForm: { fields: [{ id: 'department', label: 'Department', type: 'text', required: true }] }, attachments: [{ name: 'Role brief', url: 'https://acme.example/role.pdf', type: 'application/pdf' }], submit: true }) }, recruiterCookie);
    expectStatus(result.response, 200, 'recruiter job create + submit');
    const job = result.body.jobPost;
    assert.equal(job.status, 'pending_approval', 'submitted job must be pending admin approval');
    assert.equal(job.applicationForm.fields[0].id, 'department');
    console.log('PASS recruiter job submission enters admin approval');

    // A pending job must NOT be visible to students yet
    result = await request(baseUrl, '/opportunities', {}, studentCookie);
    expectStatus(result.response, 200, 'student opportunities before publish');
    assert.equal(result.body.jobPosts.some(post => post.id === job.id), false, 'pending job must not be visible to students');
    console.log('PASS pending job hidden from students');

    // Recruiters cannot publish directly
    result = await request(baseUrl, `/recruiter/jobs/${job.id}/publish`, { method: 'POST' }, recruiterCookie);
    expectStatus(result.response, 404, 'recruiter direct publish removed');
    console.log('PASS recruiter cannot publish directly');

    // Admin reviews: reject first, then approve
    result = await request(baseUrl, `/admin/job-posts/${job.id}/review`, { method: 'POST', body: JSON.stringify({ decision: 'reject', note: 'Please add salary range.' }) }, adminCookie);
    expectStatus(result.response, 200, 'admin reject');
    assert.equal(result.body.jobPost.status, 'rejected');
    assert.equal(result.body.jobPost.reviewNote, 'Please add salary range.');
    const rejectNotification = (await studentStore.getNotifications(recruiter.id)).find(notification => notification.type === 'job');
    assert.ok(rejectNotification, 'rejection did not notify the recruiter');
    console.log('PASS admin rejects job with note (recruiter notified)');

    // Recruiter revises and resubmits
    result = await request(baseUrl, `/recruiter/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify({ salaryMin: 600000, salaryMax: 900000, submit: true }) }, recruiterCookie);
    expectStatus(result.response, 200, 'recruiter revise + resubmit');
    assert.equal(result.body.jobPost.status, 'pending_approval');
    console.log('PASS recruiter revises and resubmits for approval');

    result = await request(baseUrl, `/admin/job-posts/${job.id}/review`, { method: 'POST', body: JSON.stringify({ decision: 'approve' }) }, adminCookie);
    expectStatus(result.response, 200, 'admin approve after resubmission');
    assert.equal(result.body.jobPost.status, 'approved');
    console.log('PASS admin approves job');

    result = await request(baseUrl, `/admin/job-posts/${job.id}/publish`, { method: 'POST' }, adminCookie);
    expectStatus(result.response, 200, 'job publish');
    assert.equal(result.body.jobPost.status, 'published');
    const opportunityNotification = (await studentStore.getNotifications(student.id)).find(notification => notification.type === 'opportunity');
    assert.ok(opportunityNotification, 'publishing did not create a student notification');
    console.log('PASS admin publishes approved job with student notification');

    // Student applies
    result = await request(baseUrl, `/opportunities/${job.id}/applications`, { method: 'POST', body: JSON.stringify({ answers: { department: 'Computer Science & Engineering' } }) }, studentCookie);
    expectStatus(result.response, 201, 'student application');
    const application = result.body.application;
    assert.equal(application.profileSnapshot.email, student.personal.email);
    assert.equal(application.profileSnapshot.username, undefined, 'snapshot must not include username');
    console.log('PASS student application API');

    // Duplicate application blocked
    result = await request(baseUrl, `/opportunities/${job.id}/applications`, { method: 'POST', body: JSON.stringify({ answers: { department: 'Computer Science & Engineering' } }) }, studentCookie);
    expectStatus(result.response, 400, 'duplicate application rejected');
    console.log('PASS duplicate application prevented');

    result = await request(baseUrl, '/admin/applications', {}, adminCookie);
    expectStatus(result.response, 200, 'admin applications');
    assert.equal(result.body.applications.length, 1);
    console.log('PASS admin application review');

    result = await request(baseUrl, `/admin/applications/${application.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'shortlisted', internalNote: 'Strong profile.' }) }, adminCookie);
    expectStatus(result.response, 200, 'application status update');
    assert.equal(result.body.application.status, 'shortlisted');
    const statusNotification = (await studentStore.getNotifications(student.id)).find(notification => notification.type === 'application');
    assert.ok(statusNotification, 'status update did not create a student notification');
    console.log('PASS applicant status update and notification');

    // --- Admin student search + share with recruiter -----------------------
    result = await request(baseUrl, '/admin/students?skills=Chess', {}, adminCookie);
    expectStatus(result.response, 200, 'admin student search');
    assert.ok(result.body.students.some(entry => entry.id === student.id), 'search should find the student by skill');
    console.log('PASS admin student search by skill');

    result = await request(baseUrl, '/admin/students?minCgpa=9.5', {}, adminCookie);
    expectStatus(result.response, 200, 'admin student search by cgpa');
    assert.equal(result.body.students.some(entry => entry.id === student.id), false, 'student without CGPA should not match high CGPA filter');
    console.log('PASS admin student search filters by CGPA');

    result = await request(baseUrl, '/admin/shares', { method: 'POST', body: JSON.stringify({ recruiterId: recruiter.id, jobPostId: job.id, studentIds: [student.id], note: 'Strong chess-driven problem solver.' }) }, adminCookie);
    expectStatus(result.response, 200, 'admin share creation');
    const share = result.body.share;
    assert.equal(share.studentIds.length, 1);
    console.log('PASS admin shares student with recruiter');

    // Recruiter sees only the shared candidate, with whitelisted fields
    result = await request(baseUrl, '/recruiter/shared-candidates', {}, recruiterCookie);
    expectStatus(result.response, 200, 'recruiter shared candidates list');
    assert.equal(result.body.shares.length, 1);
    assert.equal(result.body.shares[0].id, share.id);
    console.log('PASS recruiter sees the share');

    result = await request(baseUrl, `/recruiter/shared-candidates/${share.id}`, {}, recruiterCookie);
    expectStatus(result.response, 200, 'recruiter shared candidate detail');
    assert.equal(result.body.share.status, 'viewed', 'opening a share marks it viewed');
    assert.equal(result.body.share.students.length, 1);
    const shared = result.body.share.students[0];
    assert.equal(shared.fullName, 'Test Applicant');
    assert.equal(shared.email, null, 'private students must not expose email to recruiters');
    assert.equal(shared.familyContext, undefined);
    assert.equal(shared.passwordHash, undefined);
    assert.ok(result.body.share.job, 'share should include the associated job');
    console.log('PASS recruiter views whitelisted shared profile');

    // Feedback transitions the share status
    result = await request(baseUrl, `/recruiter/shared-candidates/${share.id}/feedback`, { method: 'POST', body: JSON.stringify({ studentId: student.id, status: 'interested', feedback: 'Great fit for our platform team.' }) }, recruiterCookie);
    expectStatus(result.response, 200, 'recruiter feedback');
    assert.equal(result.body.share.status, 'feedback');
    console.log('PASS recruiter feedback recorded');

    // The student themself must not read recruiter shares
    result = await request(baseUrl, '/recruiter/shared-candidates', {}, studentCookie);
    expectStatus(result.response, 403, 'student blocked from recruiter shares');
    console.log('PASS student blocked from recruiter shared candidates');

    console.log('\nTnP workflow smoke test passed.');
  } finally {
    server.close();
  }
}

run().catch(error => { console.error(`\nTnP WORKFLOW SMOKE TEST FAILED: ${error.message}`); process.exitCode = 1; });
