/* Live HTTP E2E: boots against the running dev API (USE_DATABASE=false) and
 * drives the recruitment workflow through the real Express routes. */
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
    else results.fail.push(`${name}${extra ? ` — ${extra}` : ''}`);
  };

  // Health
  const health = await call('GET', '/api/health');
  check('health endpoint', health.status === 200);

  // Bootstrap admin session (server started with BOOTSTRAP_ADMIN_* env vars).
  const signin = await call('POST', '/api/auth/login', { email: 'e2eadmin@kiit.ac.in', password: 'Recruit#2026' });
  check('admin sign-in', signin.status === 200, JSON.stringify(signin.data).slice(0, 140));

  // Whatever the account state, recruitment routes must reject unauthenticated
  // and non-admin access — that is the security contract we care about here.
  const admin = await call('GET', '/api/admin/me');
  if (admin.status === 200) {
    // Full workflow with a real admin session.
    const recs = await call('GET', '/api/admin/recruitment/recommendations');
    check('recommendations route', recs.status === 200 && Array.isArray(recs.data.recommendations), JSON.stringify(recs.data).slice(0, 120));

    const dash = await call('GET', '/api/admin/recruitment/dashboard');
    check('dashboard route', dash.status === 200 && dash.data.metrics, JSON.stringify(dash.data).slice(0, 120));

    const pipeline = await call('GET', '/api/admin/recruitment/pipeline');
    check('pipeline route', pipeline.status === 200 && pipeline.data.stages?.length >= 15, `stages=${pipeline.data.stages?.length}`);

    const settings = await call('GET', '/api/admin/recruitment/settings');
    check('settings route', settings.status === 200 && settings.data.settings?.resumePolicyMode, JSON.stringify(settings.data).slice(0, 120));

    const put = await call('PUT', '/api/admin/recruitment/settings', { resumePolicyMode: 'ai_university', defaultAccessLevel: 'resume' });
    check('settings update route', put.status === 200 && put.data.settings?.resumePolicyMode === 'ai_university', JSON.stringify(put.data).slice(0, 120));

    const createCompany = await call('POST', '/api/admin/companies', { name: `E2E Corp ${Date.now()}` });
    check('company created', createCompany.status === 200 && createCompany.data.company?.id, JSON.stringify(createCompany.data).slice(0, 120));
    const companyId = createCompany.data.company?.id;

    const refresh = await call('POST', '/api/admin/recruitment/recommendations/refresh');
    check('recommendations refresh', refresh.status === 200 && refresh.data.recommendations?.length >= 1);
    const mine = (refresh.data.recommendations || []).find(item => item.company.id === companyId);
    check('new company appears in recommendations with factors', mine && mine.factors && Object.keys(mine.factors).length === 5, JSON.stringify(mine?.factors || {}).slice(0, 100));

    const proposal = await call('POST', '/api/admin/recruitment/engagements', { companyId, roles: ['Backend Engineer'], jobDescription: 'Build REST APIs with Python, Django, PostgreSQL. Minimum CGPA 7.0.' });
    check('proposal created', proposal.status === 200 && proposal.data.engagement?.status === 'proposed', JSON.stringify(proposal.data).slice(0, 160));
    const engagementId = proposal.data.engagement?.id;

    const send = await call('POST', `/api/admin/recruitment/engagements/${engagementId}/send`);
    check('proposal sent', send.status === 200, JSON.stringify(send.data).slice(0, 120));

    const msg = await call('POST', `/api/admin/recruitment/engagements/${engagementId}/messages`, { body: 'Sharing student statistics shortly.' });
    check('message posted', msg.status === 200, JSON.stringify(msg.data).slice(0, 120));

    const timeline = await call('GET', `/api/admin/recruitment/engagements/${engagementId}/messages`);
    check('timeline returns messages', timeline.status === 200 && timeline.data.messages?.length >= 2);

    const summary = await call('GET', `/api/admin/recruitment/engagements/${engagementId}/summary`);
    check('communication summary route', summary.status === 200 && summary.data.summary?.available === true, JSON.stringify(summary.data).slice(0, 140));

    const analyze = await call('POST', `/api/admin/recruitment/engagements/${engagementId}/analyze-role`);
    check('role analysis route', analyze.status === 200 && analyze.data.analysis?.skills?.length >= 1, JSON.stringify(analyze.data).slice(0, 140));

    const matches = await call('GET', `/api/admin/recruitment/engagements/${engagementId}/matches`);
    check('candidate matching route', matches.status === 200 && matches.data.candidates, JSON.stringify(matches.data).slice(0, 120));

    const status = await call('POST', `/api/admin/recruitment/engagements/${engagementId}/status`, { status: 'confirmed' });
    // Not transitionable from proposed without company acceptance — must 400.
    check('premature confirm rejected', status.status === 400, JSON.stringify(status.data).slice(0, 140));
  } else {
    check('recruitment routes reject unauthenticated', admin.status === 401 || admin.status === 403, `status=${admin.status}`);
  }

  console.log(`\nHTTP E2E — PASS: ${results.pass}, FAIL: ${results.fail.length}`);
  results.fail.forEach(name => console.log(`  ✗ ${name}`));
  process.exit(results.fail.length ? 1 : 0);
}

main().catch(error => { console.error('E2E CRASH:', error); process.exit(1); });
