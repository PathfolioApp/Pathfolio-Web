const assert = require('node:assert/strict');

// Load api/.env so the requests below carry the same API key the server
// requires when API_KEY is configured (no-op in volatile/keyless runs).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const baseUrl = process.env.API_URL || 'http://localhost:5000/api';
const uniqueId = Date.now().toString();
const rollNumber = `2024T${uniqueId.slice(-6)}`;
const email = `${rollNumber.toLowerCase()}@kiit.ac.in`;
const password = 'TestPassword123';
const newPassword = 'NewTestPassword123';
let cookie = '';

async function request(path, options = {}, includeCookie = true) {
  const headers = { 'Content-Type': 'application/json', ...(process.env.API_KEY ? { 'X-API-Key': process.env.API_KEY } : {}), ...(options.headers || {}) };
  if (includeCookie && cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const body = await response.json();
  return { response, body };
}

function expectStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label}: expected ${expected}, received ${response.status}`);
}

const registrationPayload = (overrides = {}) => ({
  personal: { fullName: 'Automated Test User', dateOfBirth: '2005-06-15', email, ...overrides.personal },
  academic: {
    rollNumber,
    department: 'Computer Science & Engineering',
    batchYear: '2024 - 2028',
    ...overrides.academic
  },
  interests: {
    hobbies: [{ name: 'Photography', proficiency: 'intermediate', reason: 'I enjoy documenting places and people.' }],
    passions: [{ name: 'Artificial Intelligence', proficiency: 'exploring', reason: '' }]
  },
  achievements: [],
  familyContext: { details: '', consentGiven: false },
  credentials: { password, confirmPassword: password, ...overrides.credentials }
});

async function expectRegistrationRejected(label, overrides) {
  const result = await request('/onboarding/register', {
    method: 'POST',
    body: JSON.stringify(registrationPayload(overrides))
  }, false);
  expectStatus(result.response, 400, label);
  console.log(`PASS ${label}`);
}

async function run() {
  let result = await request('/health');
  expectStatus(result.response, 200, 'health');
  assert.equal(result.body.status, 'healthy');
  console.log('PASS health');

  // --- Onboarding: email-first flow -------------------------------------
  result = await request('/onboarding/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid@example.com' })
  });
  expectStatus(result.response, 200, 'invalid email format rejected');
  assert.equal(result.body.available, false);
  console.log('PASS invalid email format rejected');

  result = await request('/onboarding/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: '2024CS101@kiit.ac.in' })
  });
  expectStatus(result.response, 200, 'valid email accepted');
  assert.equal(result.body.available, true);
  assert.equal(result.body.rollNumber, '2024CS101');
  console.log('PASS valid email accepted with roll extraction');

  result = await request('/onboarding/verify-roll-number', {
    method: 'POST',
    body: JSON.stringify({ rollNumber })
  });
  expectStatus(result.response, 200, 'roll number check');
  assert.equal(result.body.valid, true);
  console.log('PASS roll number check');

  await expectRegistrationRejected('missing full name', { personal: { fullName: '' } });
  await expectRegistrationRejected('invalid institutional email', { personal: { email: 'invalid@example.com' } });
  await expectRegistrationRejected('roll mismatch with email', { academic: { rollNumber: '9999XX999' } });
  await expectRegistrationRejected('missing date of birth', { personal: { dateOfBirth: '' } });
  await expectRegistrationRejected('future date of birth', { personal: { dateOfBirth: '2099-01-01' } });
  await expectRegistrationRejected('implausible date of birth', { personal: { dateOfBirth: '1900-01-01' } });
  await expectRegistrationRejected('short password', { credentials: { password: 'short', confirmPassword: 'short' } });
  await expectRegistrationRejected('mismatched passwords', { credentials: { confirmPassword: 'DifferentPassword123' } });

  result = await request('/onboarding/register', {
    method: 'POST',
    body: JSON.stringify(registrationPayload())
  });
  expectStatus(result.response, 201, 'registration');
  assert.ok(result.body.data.id);
  assert.equal(result.body.data.academic.rollNumber, rollNumber);
  assert.equal(result.body.data.personal.dateOfBirth, '2005-06-15');
  const studentId = result.body.data.id;
  assert.ok(/^[0-9a-f-]{36}$/i.test(studentId), 'registration should produce a UUID id');
  assert.ok(cookie, 'registration did not create a session cookie');
  console.log(`PASS registration (${studentId})`);

  // Early duplicate detection via check-email
  result = await request('/onboarding/check-email', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  expectStatus(result.response, 200, 'duplicate email detected early');
  assert.equal(result.body.available, false);
  assert.equal(result.body.accountExists, true);
  console.log('PASS duplicate email detected early');

  // A different email whose roll maps to the same existing roll number
  result = await request('/onboarding/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: `${rollNumber.toLowerCase()}+variant@kiit.ac.in`.replace('+variant', 'x') })
  }).catch(() => ({}));
  // (email format may reject '+'; duplicate roll detection is covered below)

  await expectRegistrationRejected('duplicate email', { personal: {} });
  await expectRegistrationRejected('duplicate roll number', { personal: { email: `2024ZZ${uniqueId.slice(-4)}@kiit.ac.in` } });

  result = await request('/auth/me');
  expectStatus(result.response, 200, 'auth me');
  assert.equal(result.body.student.personal.email, email);
  assert.equal(result.body.student.isAdmin, false);
  assert.equal(result.body.student.passwordHash, undefined);
  assert.equal(result.body.student.personal.username, undefined);
  console.log('PASS auth me (no username exposed)');

  // --- Authorization boundaries -----------------------------------------
  result = await request('/admin/me');
  expectStatus(result.response, 403, 'non-admin admin route');
  console.log('PASS non-admin admin route blocked');

  result = await request('/admin/students?search=test');
  expectStatus(result.response, 403, 'non-admin student search blocked');
  console.log('PASS non-admin student search blocked');

  result = await request('/admin/shares', { method: 'POST', body: JSON.stringify({ recruiterId: 'x', studentIds: ['y'] }) });
  expectStatus(result.response, 403, 'non-admin share creation blocked');
  console.log('PASS non-admin share creation blocked');

  // The /recruiter/students talent-search route no longer exists. A student
  // caller is stopped by the recruiter role guard (403) before routing; a real
  // recruiter gets a 404 because the endpoint was removed entirely.
  result = await request('/recruiter/students?keywords=react');
  assert.ok([403, 404].includes(result.response.status), `recruiter talent search removed: expected 403/404, received ${result.response.status}`);
  console.log(`PASS recruiter talent search endpoint removed (${result.response.status})`);

  result = await request('/recruiter/shared-candidates');
  expectStatus(result.response, 403, 'student blocked from recruiter shares');
  console.log('PASS student blocked from recruiter shared candidates');

  result = await request('/opportunities');
  expectStatus(result.response, 200, 'student opportunities');
  assert.ok(Array.isArray(result.body.jobPosts));
  console.log('PASS student opportunities');

  result = await request('/profile');
  expectStatus(result.response, 200, 'profile');
  assert.equal(result.body.student.personal.username, undefined);
  assert.equal(result.body.student.academic.rollNumber, rollNumber);
  console.log('PASS profile');

  // Structured interests round-trip
  result = await request('/profile/interests', {
    method: 'PATCH',
    body: JSON.stringify({ hobbies: [{ name: 'Chess', proficiency: 'advanced', reason: 'Strategy practice' }] })
  });
  expectStatus(result.response, 200, 'structured interests update');
  assert.equal(result.body.student.interests.hobbies[0].name, 'Chess');
  assert.equal(result.body.student.interests.hobbies[0].proficiency, 'advanced');
  assert.equal(result.body.student.interests.hobbies[0].reason, 'Strategy practice');
  console.log('PASS structured interests update');

  // Legacy plain-string interests are still accepted and normalized
  result = await request('/profile/interests', {
    method: 'PATCH',
    body: JSON.stringify({ passions: ['Cybersecurity', 'Cybersecurity', ' Reading '] })
  });
  expectStatus(result.response, 200, 'legacy interests normalized');
  assert.equal(result.body.student.interests.passions.length, 2);
  assert.equal(result.body.student.interests.passions[0].proficiency, 'exploring');
  console.log('PASS legacy interests normalized');

  // DOB update on personal profile
  result = await request('/profile/personal', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'Updated Automated User', dateOfBirth: '2005-08-20' })
  });
  expectStatus(result.response, 200, 'personal profile update');
  assert.equal(result.body.student.personal.fullName, 'Updated Automated User');
  assert.equal(result.body.student.personal.dateOfBirth, '2005-08-20');
  console.log('PASS personal profile update (DOB)');

  // --- Projects Section CRUD & Validation -----------------------------
  result = await request('/profile/projects', {
    method: 'POST',
    body: JSON.stringify({
      projectName: 'Pathfolio Engine',
      projectType: 'Open Source',
      startDate: '2025-01-10',
      endDate: '2025-06-20',
      currentlyWorking: false,
      description: 'Distributed portfolio platform with microservices.',
      contributions: ['Designed R2 document vault', 'Engineered resilient session store'],
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Cloudflare R2'],
      projectUrl: 'https://pathfolio.dev',
      repoUrl: 'https://github.com/pathfolio/core',
      featured: true,
    })
  });
  expectStatus(result.response, 200, 'add project');
  assert.ok(Array.isArray(result.body.student.projects));
  const createdProject = result.body.student.projects.find(p => p.projectName === 'Pathfolio Engine');
  assert.ok(createdProject, 'created project should be present in student.projects');
  assert.equal(createdProject.featured, true);
  assert.equal(createdProject.technologies.length, 4);
  assert.equal(createdProject.contributions.length, 2);
  console.log('PASS add project');

  // Edit project
  result = await request(`/profile/projects/${createdProject.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      projectName: 'Pathfolio Engine Enterprise',
      featured: false,
    })
  });
  expectStatus(result.response, 200, 'edit project');
  const updatedProject = result.body.student.projects.find(p => p.id === createdProject.id);
  assert.equal(updatedProject.projectName, 'Pathfolio Engine Enterprise');
  assert.equal(updatedProject.featured, false);
  console.log('PASS edit project');

  // Delete project
  result = await request(`/profile/projects/${createdProject.id}`, {
    method: 'DELETE',
  });
  expectStatus(result.response, 200, 'delete project');
  assert.ok(!result.body.student.projects.some(p => p.id === createdProject.id));
  console.log('PASS delete project');

  result = await request('/profile/family-context', {
    method: 'PATCH',
    body: JSON.stringify({ details: 'Private family detail', consentGiven: false })
  });
  expectStatus(result.response, 400, 'family context without consent');
  console.log('PASS family context consent enforcement');

  result = await request('/profile/family-context', {
    method: 'PATCH',
    body: JSON.stringify({ details: 'Private family detail', consentGiven: true })
  });
  expectStatus(result.response, 200, 'family context with consent');
  assert.equal(result.body.student.familyContext.consentGiven, true);
  console.log('PASS family context with consent');

  result = await request('/settings/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ visibility: 'private', fieldVisibility: { interests: 'shareable' } })
  });
  expectStatus(result.response, 200, 'privacy settings update');
  assert.equal(result.body.student.profileSettings.visibility, 'private');
  console.log('PASS privacy settings update');

  // --- Password change & session lifecycle ------------------------------
  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: password, newPassword })
  });
  expectStatus(result.response, 200, 'password change');
  console.log('PASS password change');

  result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: newPassword }) }, false);
  expectStatus(result.response, 200, 'new password login');
  assert.ok(cookie, 'new password login did not create a session cookie');
  console.log('PASS new password login');

  result = await request('/auth/logout', { method: 'POST' });
  expectStatus(result.response, 200, 'logout');
  console.log('PASS logout');

  result = await request('/profile', {}, false);
  expectStatus(result.response, 401, 'unauthenticated profile');
  console.log('PASS unauthenticated profile blocked');

  console.log('\nAll smoke tests passed.');
}

run().catch(error => {
  console.error(`\nSMOKE TEST FAILED: ${error.message}`);
  process.exitCode = 1;
});
