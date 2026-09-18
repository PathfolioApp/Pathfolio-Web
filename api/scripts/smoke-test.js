const assert = require('node:assert/strict');

const baseUrl = process.env.API_URL || 'http://localhost:5000/api';
const uniqueId = Date.now().toString();
const username = `postman_${uniqueId.slice(-10)}`;
const email = `${username}@kiit.ac.in`;
const password = 'TestPassword123';
const newPassword = 'NewTestPassword123';
let cookie = '';

async function request(path, options = {}, includeCookie = true) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
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
  personal: { fullName: 'Automated Test User', age: 21, email, username, ...overrides.personal },
  academic: {
    rollNumber: '23051234',
    department: 'Computer Science & Engineering',
    batchYear: '2023 - 2027',
    ...overrides.academic
  },
  interests: { hobbies: ['Reading'], passions: ['Artificial Intelligence'] },
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

  result = await request('/onboarding/check-username', {
    method: 'POST',
    body: JSON.stringify({ username })
  });
  expectStatus(result.response, 200, 'username check');
  assert.equal(result.body.available, true);
  console.log('PASS username check');

  result = await request('/onboarding/verify-roll-number', {
    method: 'POST',
    body: JSON.stringify({ rollNumber: '23051234' })
  });
  expectStatus(result.response, 200, 'roll number check');
  assert.equal(result.body.valid, true);
  console.log('PASS roll number check');

  await expectRegistrationRejected('missing full name', { personal: { fullName: '' } });
  await expectRegistrationRejected('invalid age', { personal: { age: 14 } });
  await expectRegistrationRejected('invalid institutional email', { personal: { email: 'invalid@example.com' } });
  await expectRegistrationRejected('short password', { credentials: { password: 'short', confirmPassword: 'short' } });
  await expectRegistrationRejected('mismatched passwords', { credentials: { confirmPassword: 'DifferentPassword123' } });

  result = await request('/onboarding/register', {
    method: 'POST',
    body: JSON.stringify(registrationPayload())
  });
  expectStatus(result.response, 201, 'registration');
  assert.ok(result.body.data.id);
  const studentId = result.body.data.id;
  assert.ok(cookie, 'registration did not create a session cookie');
  console.log(`PASS registration (${result.body.data.id})`);

  await expectRegistrationRejected('duplicate email', {
    personal: { email, username: `other_${uniqueId.slice(-8)}` }
  });
  await expectRegistrationRejected('duplicate username', {
    personal: { email: `other_${uniqueId}@kiit.ac.in` }
  });

  result = await request('/auth/me');
  expectStatus(result.response, 200, 'auth me');
  assert.equal(result.body.student.personal.email, email);
  assert.equal(result.body.student.passwordHash, undefined);
  console.log('PASS auth me');

  result = await request('/profile');
  expectStatus(result.response, 200, 'profile');
  assert.equal(result.body.student.personal.username, username);
  console.log('PASS profile');

  result = await request('/profile/personal', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: 'Updated Automated User', age: 22 })
  });
  expectStatus(result.response, 200, 'personal profile update');
  assert.equal(result.body.student.personal.fullName, 'Updated Automated User');
  console.log('PASS personal profile update');

  result = await request('/profile/interests', {
    method: 'PATCH',
    body: JSON.stringify({ hobbies: ['Chess', 'Chess', ' Reading '] })
  });
  expectStatus(result.response, 200, 'interests update');
  assert.deepEqual(result.body.student.interests.hobbies, ['Chess', 'Reading']);
  console.log('PASS interests update');

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

  result = await request('/profile/academic', {
    method: 'PATCH',
    body: JSON.stringify({ department: '', batchYear: '' })
  });
  expectStatus(result.response, 400, 'invalid academic update');
  console.log('PASS invalid academic update rejected');

  result = await request('/profile/achievements', {
    method: 'POST',
    body: JSON.stringify({ title: 'Automated Test Achievement', category: 'Project', year: '2026' })
  });
  expectStatus(result.response, 200, 'achievement create');
  const achievementId = result.body.student.achievements.at(-1).id;
  assert.ok(achievementId);
  console.log('PASS achievement create');

  result = await request(`/profile/achievements/${achievementId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Updated Automated Achievement' })
  });
  expectStatus(result.response, 200, 'achievement update');
  assert.equal(result.body.student.achievements.at(-1).title, 'Updated Automated Achievement');
  console.log('PASS achievement update');

  result = await request(`/profile/achievements/${achievementId}`, { method: 'DELETE' });
  expectStatus(result.response, 200, 'achievement delete');
  assert.equal(result.body.student.achievements.some(item => item.id === achievementId), false);
  console.log('PASS achievement delete');

  result = await request('/profile/achievements/nonexistent-achievement', { method: 'DELETE' });
  expectStatus(result.response, 404, 'nonexistent achievement delete');
  console.log('PASS nonexistent achievement delete rejected');

  result = await request('/notifications');
  expectStatus(result.response, 200, 'notifications');
  assert.ok(Array.isArray(result.body.notifications));
  assert.equal(result.body.notifications[0].type, 'account');
  console.log('PASS notifications');

  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: 'WrongPassword123', newPassword })
  });
  expectStatus(result.response, 400, 'wrong current password');
  console.log('PASS wrong current password rejected');

  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: password, newPassword: 'short' })
  });
  expectStatus(result.response, 400, 'short new password');
  console.log('PASS short new password rejected');

  result = await request('/settings/security/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: password, newPassword })
  });
  expectStatus(result.response, 200, 'password change');
  console.log('PASS password change');

  result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
  expectStatus(result.response, 401, 'old password after change');
  console.log('PASS old password rejected after change');

  result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: newPassword })
  }, false);
  expectStatus(result.response, 200, 'new password login');
  assert.ok(cookie, 'new password login did not create a session cookie');
  console.log('PASS new password login');

  result = await request('/auth/logout', { method: 'POST' });
  expectStatus(result.response, 200, 'logout');
  console.log('PASS logout');

  result = await request('/profile', {}, false);
  expectStatus(result.response, 401, 'unauthenticated profile');
  console.log('PASS unauthenticated profile blocked');

  result = await request('/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({ studentId })
  }, false);
  expectStatus(result.response, 401, 'unauthenticated onboarding completion');
  console.log('PASS unauthenticated onboarding completion blocked');

  console.log('\nAll smoke tests passed.');
}

run().catch(error => {
  console.error(`\nSMOKE TEST FAILED: ${error.message}`);
  process.exitCode = 1;
});
