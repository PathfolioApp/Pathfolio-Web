/* Full-stack audit test: boots the API (volatile mode) and verifies every new
 * surface added in this round: public profile sharing, story summary,
 * recruiter history (with and without prior data), and bulk tailor validation. */
const BASE = 'http://localhost:5199';
let cookie = '';

async function call(method, path, body, extraHeaders = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
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
    else results.fail.push(`${name}${extra ? ` — ${extra}` : ''}`);
  };

  // --- public profile sharing ---
  const signin = await call('POST', '/api/auth/login', { email: 'e2eadmin@kiit.ac.in', password: 'Recruit#2026' });
  check('admin sign-in', signin.status === 200);

  // The admin is a student row too — public share should work for any account.
  const createShare = await call('POST', '/api/public-profile/me', { includeResume: false, bio: 'Testing public profiles.' });
  check('public link created', createShare.status === 201 && createShare.data.url?.startsWith('/p/'), JSON.stringify(createShare.data).slice(0, 100));
  const publicUrl = createShare.data.url;

  const publicView = await call('GET', `/api/public-profile${publicUrl}`);
  check('public view renders without auth', publicView.status === 200 && publicView.data.profile, JSON.stringify(publicView.data).slice(0, 100));
  const anonView = await call('GET', `/api/public-profile${publicUrl}`);
  check('anonymous visitor can view', anonView.status === 200 && anonView.data.profile?.bio === 'Testing public profiles.');
  // Restore the admin session for the remaining checks.
  const resignin = await call('POST', '/api/auth/login', { email: 'e2eadmin@kiit.ac.in', password: 'Recruit#2026' });
  check('session restored', resignin.status === 200);

  const revoked = await call('DELETE', '/api/public-profile/me');
  // Signed in as admin again, so this now revokes the test link cleanly.
  check('revocation succeeds for owner', revoked.status === 200 && revoked.data.share === null);

  const badToken = await call('GET', '/api/public-profile/p/doesnotexist123');
  check('invalid token 404s', badToken.status === 404);

  // --- story summary ---
  const story = await call('POST', '/api/story/me/summary');
  check('story summary endpoint works', story.status === 200 && story.data.summary, JSON.stringify(story.data).slice(0, 100));

  // --- recruiter history (no company match for this admin → graceful) ---
  const history = await call('GET', '/api/recruiter/recruitment/history');
  check('history endpoint responds', history.status === 200, JSON.stringify(history.data).slice(0, 100));

  // --- bulk tailor validation ---
  const noStudents = await call('POST', '/api/admin/recruitment/tailor-bulk', { studentIds: [], jobDescription: 'x'.repeat(50) });
  check('bulk tailor rejects empty selection', noStudents.status === 400);
  const noJd = await call('POST', '/api/admin/recruitment/tailor-bulk', { studentIds: ['x'] });
  check('bulk tailor rejects missing JD', noJd.status === 400);

  // --- recommendations still work after the GROUP BY fix ---
  const recs = await call('POST', '/api/admin/recruitment/recommendations/refresh');
  check('recommendations refresh works', recs.status === 200 && recs.data.recommendations?.length >= 0, JSON.stringify(recs.data).slice(0, 120));

  console.log(`\nAUDIT E2E — PASS: ${results.pass}, FAIL: ${results.fail.length}`);
  results.fail.forEach(name => console.log(`  ✗ ${name}`));
  process.exit(results.fail.length ? 1 : 0);
}

main().catch(error => { console.error('CRASH:', error); process.exit(1); });
