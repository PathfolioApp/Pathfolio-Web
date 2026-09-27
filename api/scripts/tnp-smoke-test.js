const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.USE_DATABASE = 'false';

const app = require('../src/app');
const studentStore = require('../src/models/studentStore');
const contentStore = require('../src/models/adminContentStore');

const unique = Date.now().toString();
const ids = { admin: `admin_${unique}`, student: `student_${unique}` };

async function request(baseUrl, path, options = {}, cookie) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function expectStatus(response, expected, label) { assert.equal(response.status, expected, `${label}: expected ${expected}, received ${response.status}`); }
function studentRecord(id, email, isAdmin) { return { id, isAdmin, personal: { fullName: isAdmin ? 'TnP Admin' : 'Test Applicant', email, username: id }, academic: { rollNumber: '23051234', department: 'Computer Science & Engineering', batchYear: '2023 - 2027' }, interests: { hobbies: [], passions: [] }, achievements: [], familyContext: { details: '', consentGiven: false }, profileSettings: { visibility: 'private' }, onboarding: { completed: true }, status: 'active_onboarded', createdAt: new Date().toISOString() }; }

async function run() {
  await studentStore.initialize();
  await contentStore.initialize();
  const admin = await studentStore.saveStudent(studentRecord(ids.admin, `admin_${unique}@kiit.ac.in`, true));
  const student = await studentStore.saveStudent(studentRecord(ids.student, `student_${unique}@kiit.ac.in`, false));
  const adminCookie = `pf_session=${await studentStore.createSession(admin.id)}`;
  const studentCookie = `pf_session=${await studentStore.createSession(student.id)}`;
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

    result = await request(baseUrl, '/admin/job-posts', { method: 'POST', body: JSON.stringify({ companyId: importedCompany.id, title: 'Graduate Software Engineer', description: 'Build product experiences with our engineering team.', applicationForm: { fields: [{ id: 'department', label: 'Department', type: 'text', required: true }] }, attachments: [{ name: 'Role brief', url: 'https://acme.example/role.pdf', type: 'application/pdf' }] }) }, adminCookie);
    expectStatus(result.response, 200, 'job create');
    const job = result.body.jobPost;
    assert.equal(job.status, 'draft');
    assert.equal(job.applicationForm.fields[0].id, 'department');
    console.log('PASS job create and application fields');

    result = await request(baseUrl, `/admin/job-posts/${job.id}/publish`, { method: 'POST' }, adminCookie);
    expectStatus(result.response, 200, 'job publish');
    assert.equal(result.body.jobPost.status, 'published');
    const opportunityNotification = (await studentStore.getNotifications(student.id)).find(notification => notification.type === 'opportunity');
    assert.ok(opportunityNotification, 'publishing did not create a student notification');
    console.log('PASS job publish and notification');

    result = await request(baseUrl, `/opportunities/${job.id}/applications`, { method: 'POST', body: JSON.stringify({ answers: { department: 'Computer Science & Engineering' } }) }, studentCookie);
    expectStatus(result.response, 201, 'student application');
    const application = result.body.application;
    assert.equal(application.profileSnapshot.email, student.personal.email);
    console.log('PASS student application API');

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

    console.log('\nTnP workflow smoke test passed.');
  } finally {
    server.close();
  }
}

run().catch(error => { console.error(`\nTnP WORKFLOW SMOKE TEST FAILED: ${error.message}`); process.exitCode = 1; });
