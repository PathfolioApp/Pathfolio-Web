/* Final round audit: legacy student-list share datetime fix, user detail
 * dossier endpoint, and em-dash-free responses. Runs against the live
 * volatile-mode server on :5199. */
const BASE = 'http://localhost:5199';
let cookie = '';

// Load api/.env so requests carry the API key the target server requires.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(process.env.API_KEY ? { 'X-API-Key': process.env.API_KEY } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function main() {
  const results = { pass: 0, fail: [] };
  const check = (name, condition, extra = '') => {
    if (condition) results.pass += 1;
    else results.fail.push(`${name}${extra ? ` - ${extra}` : ''}`);
  };

  const signin = await call('POST', '/api/auth/login', { email: 'e2eadmin@kiit.ac.in', password: 'Recruit#2026' });
  check('admin sign-in', signin.status === 200);

  // Create a recruiter + a student so the legacy share path has real targets.
  const stamp = Date.now();
  const recruiter = await call('POST', '/api/admin/users', { fullName: 'Detail Recruiter', email: `rec${stamp}@test.dev`, password: 'Passw0rd!x', role: 'recruiter', department: 'Talent', batchYear: 'Ops' });
  check('recruiter created', recruiter.status === 200 && recruiter.data.user?.id, JSON.stringify(recruiter.data).slice(0, 100));
  const student = await call('POST', '/api/admin/users', { fullName: 'Detail Student', email: `stu${stamp}@test.dev`, password: 'Passw0rd!x', role: 'student', department: 'CSE', batchYear: '2027', rollNumber: `R${stamp}` });
  check('student created', student.status === 200 && student.data.user?.id);
  const recruiterId = recruiter.data.user?.id;
  const studentId = student.data.user?.id;

  // THE REGRESSION: sharing a student list used to fail with
  // "Incorrect datetime value: '0000-00-00 00:00:00' for column 'created_at'".
  const share = await call('POST', '/api/admin/shares', { recruiterId, studentIds: [studentId], note: 'datetime regression check' });
  check('student list share succeeds (datetime fix)', share.status === 200 && share.data.share?.id, JSON.stringify(share.data).slice(0, 140));

  const recruiterShares = await call('GET', '/api/admin/shares');
  check('share listed for admin', recruiterShares.status === 200 && recruiterShares.data.shares?.length >= 1);

  // New user-detail dossier endpoint.
  const detail = await call('GET', `/api/admin/users/${studentId}`);
  check('user detail endpoint responds', detail.status === 200 && detail.data.user, JSON.stringify(detail.data).slice(0, 100));
  const dossier = detail.data.user || {};
  check('dossier has application stats', typeof dossier.applicationsCount === 'number' && Array.isArray(dossier.applicationHistory));
  check('dossier has resume + share context', typeof dossier.resumeCount === 'number' && Array.isArray(dossier.recruiterActivity));
  check('dossier has skills + portfolio', Array.isArray(dossier.topSkills) && Array.isArray(dossier.recentProjects));

  const recruiterDetail = await call('GET', `/api/admin/users/${recruiterId}`);
  check('recruiter dossier also resolves', recruiterDetail.status === 200 && recruiterDetail.data.user?.role === 'recruiter');

  const missing = await call('GET', '/api/admin/users/does-not-exist');
  check('unknown user 404s', missing.status === 404);

  // Em-dash audit on API responses: no U+2014 should reach the client.
  const timeline = await call('GET', '/api/admin/recruitment/engagements');
  const flat = JSON.stringify(timeline.data) + JSON.stringify(detail.data);
  check('no em-dash in API responses', !flat.includes('\u2014'));

  console.log(`\nFINAL AUDIT - PASS: ${results.pass}, FAIL: ${results.fail.length}`);
  results.fail.forEach(name => console.log(`  x ${name}`));
  process.exit(results.fail.length ? 1 : 0);
}

main().catch(error => { console.error('CRASH:', error); process.exit(1); });
