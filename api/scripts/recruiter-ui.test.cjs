// Real recruiter components against a local synthetic API; no database or AI calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
const esbuild = require(path.join(root, 'frontend/node_modules/esbuild'));

test('recruiter views and workflows fit mobile, tablet, and desktop', { timeout: 180_000 }, async t => {
  const output = path.join(root, 'tmp/recruiter-review'); fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import {RecruiterPage} from './modules/recruiter/RecruiterPage';import {RecruiterLayout} from './layouts/RecruiterLayout/RecruiterLayout';import './styles/global.css';import './components/layout/Header.css';
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/recruiter' element={<RecruiterLayout/>}><Route index element={<RecruiterPage/>}/><Route path=':tab' element={<RecruiterPage/>}/></Route></Routes></BrowserRouter>);`, resolveDir: path.join(root, 'frontend/src'), loader: 'jsx' },
    bundle: true, jsx: 'automatic', outfile: path.join(output, 'app.js'), define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'fixture-auth', setup(build) {
      build.onResolve({ filter: /providers\/AuthProvider(?:\.jsx)?$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
      build.onResolve({ filter: /ui\/NotificationPanel(?:\.jsx)?$/ }, () => ({ path: 'notifications', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'auth'
        ? `const student={id:'recruiter-test',role:'recruiter',isAdmin:true,personal:{fullName:'Kavya Mehta',email:'recruiter@example.test'}};export const useAuth=()=>({student,logout:async()=>{},refresh:async()=>{}});`
        : `export const NotificationPanel=()=>null;` }));
    } }],
  });
  const now = '2026-10-20T09:00:00Z';
  const company = { id: 'company-1', name: 'Example Engineering & Research Technologies' };
  const job = { id: 'job-1', companyName: company.name, title: 'Software Engineer — Backend Platforms & Infrastructure', description: 'Build reliable services with Java, SQL and cloud platforms.', location: 'Bengaluru, India', workMode: 'Hybrid', employmentType: 'Full-time', applicationUrl: '', status: 'draft', salaryCurrency: 'INR', salaryMin: 800000, salaryMax: 1200000, requiredSkills: ['Java', 'Cloud infrastructure and distributed systems'], eligibility: { minCgpa: 7 }, createdAt: now, updatedAt: now };
  const student = { id: 'student-1', fullName: 'Aarav Chandrakant Sharma', rollNumber: '23000001', department: 'Computer Science & Engineering', cgpa: 8.6, resumeUrl: '/fixture-resume', interests: { passions: [{ name: 'Distributed systems and infrastructure', proficiency: 'advanced' }] }, achievements: [{ title: 'Campus innovation challenge finalist' }], internships: [{ role: 'Backend Engineer', companyName: company.name }] };
  const share = { id: 'share-1', status: 'shared', students: [student], job, note: 'Please review these candidates for the upcoming engineering drive.', createdAt: now, feedback: [] };
  const engagement = { id: 'engagement-1', title: 'Campus engineering recruitment drive — backend and infrastructure teams', status: 'proposed', provisional: true, roles: [job.title], proposedStart: now, proposedEnd: now, proposalNote: 'Please confirm the dates and share your interview requirements.', messageCount: 1 };
  const calls = []; let failOverview = false; let failSave = false; let empty = false;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => {
        const pathname = new URL(req.url, 'http://fixture').pathname;
        calls.push({ pathname, method: req.method, body: body ? JSON.parse(body) : null });
        res.setHeader('Content-Type', 'application/json');
        if ((failOverview && pathname.endsWith('/overview')) || (failSave && req.method === 'POST' && pathname === '/api/recruiter/jobs')) {
          res.statusCode = 400; return res.end(JSON.stringify({ success: false, message: 'Fixture request failed. Please try again.' }));
        }
        const data = { success: true, companies: [company], jobPosts: empty ? [] : [job, { ...job, id: 'job-2', status: 'published' }, { ...job, id: 'job-3', status: 'rejected', reviewNote: 'Please include the interview process.' }],
          overview: { totalJobs: 3, published: 1, pendingApproval: 0, totalApplications: 12, sharedCandidates: 1, last7Days: 4 },
          shares: empty ? [] : [share], share, engagements: empty ? [] : [engagement], engagement,
          messages: [{ id: 'message-1', senderRole: 'university', senderName: 'Campus Placement Coordinator', kind: 'message', body: 'Please confirm availability. https://example.test/' + 'long-path-'.repeat(15), createdAt: now }],
          candidates: [{ shareId: share.id, candidate: student, accessLevel: 'profile', status: 'shared' }],
          history: { company, sentiment: 'positive', sentimentLabel: 'Growing campus partnership', totalHires: 24, hiresByYear: [{ year: 2025, hires: 20 }], drivesCompleted: 2, jobPosts: 3, candidatesShared: 10, recentDrives: [{ id: 'drive-1', title: engagement.title, year: 2025, statusLabel: 'Completed' }] },
          summary: { summary: 'Confirm dates and review shared candidates.' }, jobPost: { ...job, ...(body ? JSON.parse(body) : {}), status: 'pending_approval' },
        };
        if (req.method !== 'GET') {
          const allowed = pathname === '/api/recruiter/jobs' || pathname === '/api/recruiter/jobs/job-1' || pathname === '/api/recruiter/jobs/job-1/submit' || pathname === '/api/recruiter/shared-candidates/share-1/feedback' || /^\/api\/recruiter\/recruitment\/engagements\/engagement-1\/(respond|messages)$/.test(pathname);
          if (!allowed) { res.statusCode = 400; return res.end(JSON.stringify({ success: false, message: 'Unexpected fixture write' })); }
          if (pathname.endsWith('/feedback')) data.share = { ...share, feedback: [{ ...JSON.parse(body) }] };
        }
        res.end(JSON.stringify(data));
      }); return;
    }
    if (req.url === '/app.js' || req.url === '/app.css') { res.setHeader('Content-Type', req.url.endsWith('css') ? 'text/css' : 'application/javascript'); return res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true); page.on('request', request => request.url().startsWith(base) ? request.continue() : request.abort());
  const idle = () => page.waitForNetworkIdle({ idleTime: 100, timeout: 10_000 });
  const visit = async tab => { await page.goto(`${base}/recruiter/${tab}`, { waitUntil: 'load' }); await idle(); };
  async function clickText(text, selector = 'button') {
    const handle = await page.evaluateHandle((text, selector) => [...document.querySelectorAll(selector)].find(e => e.textContent.includes(text)), text, selector);
    assert.ok(handle.asElement(), `Missing control: ${text}`); await handle.asElement().click(); await idle();
  }
  async function fit(label) {
    const bounds = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('.pf-recruiter-page *, .pf-recruiter-overlay *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2).slice(0, 6).map(e => e.className) }));
    assert.ok(bounds.scrollWidth <= bounds.width + 1, `${label}: ${JSON.stringify(bounds)}`);
    assert.deepEqual(errors, [], label);
    if (process.env.RECRUITER_UI_ARTIFACTS) await page.screenshot({ path: path.join(output, `${label.replace(/[^a-z0-9-]/gi, '-')}.png`), fullPage: true });
  }
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 850 });
    for (const tab of ['overview', 'jobs', 'candidates', 'recruitment']) {
      await visit(tab); assert.ok(await page.$('h1')); await fit(`${tab}-${width}`);
      if (tab === 'jobs') {
        await clickText('New post'); await fit(`composer-${width}`);
        const dialog = await page.$eval('.pf-recruiter-overlay .pf-modal-container', e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, height: r.height, width: innerWidth, viewport: innerHeight }; });
        assert.ok(dialog.left >= 0 && dialog.right <= dialog.width + 1 && dialog.height <= dialog.viewport, JSON.stringify(dialog));
        const submit = await page.$('.pf-recruiter-job-form-actions button[type=submit]'); await submit.scrollIntoView();
        assert.ok(await submit.isIntersectingViewport(), 'Job submit must be reachable'); await page.keyboard.press('Escape');
      }
      if (tab === 'candidates') { await page.click('.pf-shared-card__header'); await idle(); await fit(`candidate-feedback-${width}`); }
      if (tab === 'recruitment') {
        await page.click('.pf-shared-card__header'); await idle(); await fit(`conversation-${width}`);
        assert.equal(await page.$('.pf-rec-history'), null, 'Conversation should replace the proposal list');
        assert.equal(await page.evaluate(() => scrollY), 0, 'Conversation should open at the top');
        await clickText('All proposals'); assert.ok(await page.$('.pf-rec-history'));
      }
    }
    t.diagnostic(`Checked all four views, composer, feedback, and conversation at ${width}px`);
  }
  assert.ok(calls.every(call => call.method === 'GET'), 'Viewport checks must not mutate records');
  await page.setViewport({ width: 812, height: 375 });
  await visit('jobs'); await clickText('New post'); await fit('composer-landscape');
  const landscapeSubmit = await page.$('.pf-recruiter-job-form-actions button[type=submit]'); await landscapeSubmit.scrollIntoView();
  assert.ok(await landscapeSubmit.isIntersectingViewport(), 'Submit remains reachable on a short landscape screen'); await page.keyboard.press('Escape');
  await page.setViewport({ width: 375, height: 740 });
  await visit('jobs'); await clickText('New post');
  for (const [selector, value] of [['input[list]', 'Example Technologies'], ['input[placeholder="e.g. Frontend Engineer"]', 'Backend Engineer'], ['textarea', 'Build reliable services and collaborate with campus engineers.']]) await page.type(`.pf-recruiter-job-form ${selector}`, value, { delay: 25 });
  failSave = true; await page.click('.pf-recruiter-job-form-actions button[type=submit]'); await idle();
  assert.ok(await page.$('.pf-recruiter-overlay [role=alert]'), 'Save error must be visible inside the composer');
  assert.equal(await page.$eval('input[list]', e => e.value), 'Example Technologies');
  failSave = false; await page.click('.pf-recruiter-job-form-actions button[type=submit]'); await idle();
  assert.equal(await page.$('.pf-recruiter-overlay'), null); assert.ok(await page.$('[role=status]'));
  const created = calls.find(call => call.method === 'POST' && call.pathname === '/api/recruiter/jobs');
  assert.equal(created.body.companyName, 'Example Technologies'); assert.equal(created.body.title, 'Backend Engineer'); assert.equal(created.body.submit, true);
  await clickText('Edit'); await page.click('.pf-recruiter-job-form-actions button[type=submit]'); await idle();
  assert.ok(calls.some(call => call.method === 'PATCH' && call.pathname === '/api/recruiter/jobs/job-1'));
  await clickText('Submit for approval'); assert.ok(calls.some(call => call.pathname.endsWith('/job-1/submit')));
  await visit('candidates'); await page.click('.pf-shared-card__header'); await idle();
  await page.select('.pf-shared-student__feedback select', 'shortlisted'); await page.type('.pf-shared-student__feedback input', 'Strong backend experience', { delay: 25 });
  await page.click('.pf-shared-student__feedback button'); await idle();
  const feedback = calls.find(call => call.pathname.endsWith('/feedback') && call.method === 'POST');
  assert.equal(feedback.body.status, 'shortlisted'); assert.equal(feedback.body.feedback, 'Strong backend experience'); assert.equal(feedback.body.studentId, student.id);
  await visit('recruitment'); await page.click('.pf-shared-card__header'); await idle();
  await page.type('form.pf-rec-respond textarea', 'Please share the schedule.', { delay: 25 }); await page.click('form.pf-rec-respond button'); await idle();
  assert.equal(calls.find(call => call.method === 'POST' && call.pathname.endsWith('/messages')).body.body, 'Please share the schedule.');
  await clickText('Request other dates'); assert.equal(calls.find(call => call.pathname.endsWith('/respond')).body.response, 'reschedule_requested');
  await clickText('Summarise conversation'); assert.ok(await page.$('.pf-rec-ai-summary')); await fit('summary-mobile');
  failOverview = true; await visit('overview'); assert.ok(await page.$('[role=alert]')); failOverview = false; await clickText('Try again'); assert.ok(await page.$('.pf-stat-card'));
  empty = true;
  for (const tab of ['jobs', 'candidates', 'recruitment']) { await visit(tab); await fit(`empty-${tab}`); }
  assert.deepEqual(errors, []);
});
