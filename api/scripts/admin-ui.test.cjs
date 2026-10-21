// Source-level UI integration checks. Synthetic accounts + local mock API only.
// Requires frontend dependencies and Puppeteer's Chrome installation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
const esbuild = require(path.join(root, 'frontend/node_modules/esbuild'));

test('admin workspaces and dialogs remain usable across viewport sizes', { timeout: 180_000 }, async t => {
  const output = path.join(root, 'tmp/admin-review'); fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import {AdminPage} from './modules/admin/AdminPage';import {AdminLayout} from './layouts/AdminLayout/AdminLayout';import './styles/global.css';import './components/layout/Header.css';
      createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/admin' element={<AdminLayout/>}><Route path=':tab' element={<AdminPage/>}/></Route></Routes></BrowserRouter>);`, resolveDir: path.join(root, 'frontend/src'), loader: 'jsx' },
    bundle: true, jsx: 'automatic', outfile: path.join(output, 'app.js'), define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'fixture-auth', setup(build) {
      build.onResolve({ filter: /providers\/AuthProvider(?:\.jsx)?$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
      build.onResolve({ filter: /ui\/NotificationPanel(?:\.jsx)?$/ }, () => ({ path: 'notifications', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'auth'
        ? `const student={id:'admin-test',role:'admin',personal:{fullName:'Kavya Mehta',email:'admin@example.test'}};export const useAuth=()=>({student,logout:async()=>{},refresh:async()=>{}});`
        : `export const NotificationPanel=()=>null;` }));
    } }],
  });
  const now = '2026-10-20T09:00:00Z';
  const company = { id: 'company-1', name: 'Example Engineering & Research Technologies', website: 'https://example.test', description: 'Campus hiring partner with engineering and research opportunities.', createdAt: now };
  const student = { id: 'student-1', fullName: 'Aarav Chandrakant Sharma', email: 'aarav.sharma.with.a.long.address@example.test', rollNumber: '23000001', department: 'Computer Science & Engineering', batchYear: '2027', cgpa: 8.6, skills: ['Java', 'React', 'SQL'], passions: ['Research'], hobbies: [], status: 'active', role: 'student', activeBacklogs: 0, blocked: false };
  const job = { id: 'job-1', companyId: company.id, companyName: company.name, title: 'Software Engineer — Backend Platforms & Infrastructure', description: 'Build reliable services with Java, SQL and cloud platforms.', location: 'Bengaluru, India', status: 'published', salaryCurrency: 'INR', employmentType: 'Full-time', salaryMin: 800000, salaryMax: 1200000, eligibility: { minCgpa: 7, allowedBatches: ['2027'], allowedDepartments: ['CSE'] }, createdAt: now, updatedAt: now, attachments: [] };
  const application = { id: 'application-1', studentId: student.id, fullName: student.fullName, email: student.email, studentName: student.fullName, jobPostId: job.id, status: 'applied', createdAt: now, profileSnapshot: { personal: { fullName: student.fullName, email: student.email }, academic: { department: student.department, rollNumber: student.rollNumber, batchYear: '2027', cgpa: 8.6 }, projects: [], achievements: [], interests: {}, social: {} }, answers: {} };
  const engagement = { id: 'engagement-1', companyId: company.id, companyName: company.name, title: 'Campus engineering recruitment drive', roles: ['Backend Engineer'], status: 'proposed', proposedStart: now, proposedEnd: now, provisional: true, candidates: [], createdAt: now };
  const recommendation = { recommendationId: 'rec-1', company, score: 78, recommendation: 'contact_now', recommendationLabel: 'Contact now', factors: { demand: { label: 'Eligible campus talent', earned: 20, max: 25, detail: 'Students meet the recorded academic requirements.' } }, reasons: ['Relevant campus skills and previous engagement.'], source: 'deterministic' };
  const policy = { enabled: true, minCtcMultiplier: 1.5, maxOffersAllowed: 2, brackets: [{ id: 'standard', name: 'Standard', minLpa: 0, maxLpa: 7 }, { id: 'dream', name: 'Dream', minLpa: 7, maxLpa: 14 }] };
  const calls = []; let overviewFailure = false; let companyFailure = false;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => {
        const url = new URL(req.url, 'http://fixture'); calls.push({ path: url.pathname, method: req.method, body });
        res.setHeader('Content-Type', 'application/json');
        if (overviewFailure && url.pathname.endsWith('/overview')) { res.statusCode = 503; return res.end(JSON.stringify({ message: 'Fixture overview unavailable' })); }
        const data = { success: true, companies: [company], jobPosts: [job, { ...job, id: 'job-2', status: 'pending_approval' }], users: [student], applications: [application], students: [student], total: 1,
          overview: { total: 3, students: 1, recruiters: 1, recentSignups: 1 }, jobs: [job],
          shares: [{ id: 'share-1', recruiterName: 'Example Recruiter', studentCount: 1, companyName: company.name, jobTitle: job.title, status: 'shared', createdAt: now }],
          recruiters: [{ id: 'recruiter-1', fullName: 'Example Recruiter' }],
          logs: [{ id: 'log-1', actorName: 'Kavya Mehta', action: 'job.created', entityType: 'job', entityLabel: job.title, detail: 'A job post was created for the campus.', createdAt: now }], actions: ['job.created'],
          recommendations: [recommendation], fromCache: true, engagements: [engagement], policy,
          settings: { resumePolicyMode: 'university_controlled', defaultAccessLevel: 'profile' },
          metrics: { pendingCompanyResponses: 1, provisionalDrives: 1, confirmedDrives: 0, candidatesAwaitingApproval: 0, candidatesShared: 0, pendingCompanyActions: 0 }, pendingCompanyActions: [],
          stages: [{ id: 'applied', label: 'Applied' }, { id: 'selected', label: 'Selected' }],
          messages: [{ id: 'message-1', senderRole: 'university', kind: 'message', body: 'Please confirm your availability for the campus drive.', createdAt: now }],
          engagement, candidates: [], user: { ...student, personal: { fullName: student.fullName, email: student.email }, academic: { department: student.department }, achievements: [], projects: [], internships: [], interests: {}, profileSettings: {}, recruiterActivity: [], topSkills: ['Java'], applicationHistory: [], recentProjects: [], recentInternships: [], recentAchievements: [], applications: [], resumes: [], notifications: [], socialLinks: [], hobbies: [], passions: [] },
        };
        if (req.method !== 'GET') {
          // Only allow explicitly tested fixture writes. No live services are reachable.
          if (url.pathname === '/api/admin/companies') {
            if (companyFailure) { res.statusCode = 400; return res.end(JSON.stringify({ message: 'Fixture company save failed' })); }
            data.company = { ...company, ...JSON.parse(body) };
          }
          else if (url.pathname === '/api/admin/jd/analyze') Object.assign(data, {
            analysis: { role: 'Backend Engineer', skills: ['Java'], keywords: ['Backend'], domains: ['Software'], education: ['B.Tech'], responsibilities: ['Build services'], summary: 'Engineering role', source: 'deterministic' },
            stats: { evaluated: 1, strongMatches: 1, returned: 1 },
            candidates: [{ ...student, name: student.fullName, score: 85, matchedSkills: ['Java'], missingSkills: [], eligibilityFlags: [], academic: { cgpa: 8.6, department: 'Computer Science', rollNumber: student.rollNumber }, projects: [], internships: [], achievements: [], reasons: [], social: {} }],
          });
          else { res.statusCode = 400; return res.end(JSON.stringify({ message: `Unconfigured fixture write: ${url.pathname}` })); }
        }
        res.end(JSON.stringify(data));
      }); return;
    }
    if (req.url === '/app.js' || req.url === '/app.css') { res.setHeader('Content-Type', req.url.endsWith('css') ? 'text/css' : 'application/javascript'); return res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', event => { if (event.type() === 'error') console.log('Browser:', event.text()); });
  await page.setRequestInterception(true); page.on('request', r => r.url().startsWith(base) ? r.continue() : r.abort());
  async function visit(route) {
    await page.goto(base + route, { waitUntil: 'load' });
    await page.waitForNetworkIdle({ idleTime: 100, timeout: 10_000 });
  }
  const failures = [];
  async function fit(label) {
    assert.ok(await page.$('.pf-admin-page'), `${label}: workspace failed to render`);
    const result = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('.pf-admin-page *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed').slice(0, 6).map(e => e.className) }));
    if (result.content > result.width + 1) failures.push(`${label}: ${JSON.stringify(result)}`);
    if (process.env.ADMIN_UI_ARTIFACTS && ['application candidates', 'application detail', 'proposal drawer', 'student results', 'user dossier', 'JD ranked results'].includes(label)) {
      await page.screenshot({ path: path.join(output, label.replace(/ /g, '-') + '.png'), fullPage: true });
    }
  }
  async function clickText(text, selector = 'button') {
    const element = await page.evaluateHandle((text, selector) => [...document.querySelectorAll(selector)].find(e => e.textContent.trim().includes(text)), text, selector);
    assert.ok(element.asElement(), `Missing control: ${text}`); await element.asElement().click();
    await page.waitForNetworkIdle({ idleTime: 100 });
  }
  const tabs = ['overview', 'companies', 'jobs', 'applications', 'students', 'shares', 'recruitment', 'policy', 'users', 'logs', 'jd'];
  for (const width of (process.env.ADMIN_UI_FOCUS ? [] : [320, 375, 768, 1280])) {
    await page.setViewport({ width, height: 850, deviceScaleFactor: 1 });
    for (const tab of tabs) {
      await visit(`/admin/${tab}`);
      assert.ok(await page.$('h1'), `${tab}: ${await page.$eval('body', e => e.textContent.slice(-700))}; ${errors.join(';')}`); await fit(`${width} ${tab}`);
      if (tab === 'students' && width <= 768) {
        const search = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect();
          const field = rect('.pf-student-hero-bar__input-wrap');
          const submit = rect('.pf-student-hero-bar__submit');
          const filters = rect('.pf-student-filter-toggle');
          return { fieldHeight: field.height, formHeight: rect('.pf-student-hero-bar').height, actionOffset: Math.abs(submit.top - filters.top), gap: submit.top - field.bottom };
        });
        assert.ok(search.fieldHeight <= 55 && search.formHeight <= 120 && search.actionOffset <= 1 && search.gap <= 16, `${width}px student search should keep its field and actions compact: ${JSON.stringify(search)}`);
        await page.click('.pf-student-filter-toggle');
        await fit(`${width} student expanded filters`);
        assert.equal(await page.$eval('.pf-student-filter-toggle', e => e.getAttribute('aria-expanded')), 'true');
        await page.click('.pf-student-filter-toggle');
      }
      if (process.env.ADMIN_UI_ARTIFACTS && [375, 1280].includes(width)) await page.screenshot({ path: path.join(output, `${tab}-${width}.png`), fullPage: true });
    }
    t.diagnostic(`Checked all 11 workspaces at ${width}px`); console.log(`Checked all 11 workspaces at ${width}px`);
  }
  await page.setViewport({ width: 375, height: 740 });
  if (failures.length) console.log('Overflow findings:', failures);
  for (const [tab, trigger] of [['companies', 'Add company'], ['jobs', 'New post'], ['users', 'Import CSV']]) {
    await visit(`/admin/${tab}`); await clickText(trigger);
    const bounds = await page.$eval('[role=dialog]', e => { const r=e.getBoundingClientRect(); return { left:r.left, right:r.right, height:r.height, width:innerWidth, viewport:innerHeight }; });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width + 1 && bounds.height <= bounds.viewport + 1, `${tab} dialog: ${JSON.stringify(bounds)}`);
    await fit(`${tab} dialog`);
    if (process.env.ADMIN_UI_ARTIFACTS) await page.screenshot({ path: path.join(output, `${tab}-dialog.png`), fullPage: true });
    await page.keyboard.press('Escape');
  }
  await visit('/admin/applications');
  await page.click('.pf-app-job-row--clickable'); await page.waitForNetworkIdle({ idleTime: 100 }); await fit('application candidates');
  for (const label of ['Academic Filters', 'Export']) {
    // Existing actions stay available after the responsive toolbar wraps.
    const action = await page.evaluateHandle(label => [...document.querySelectorAll('button')].find(e => e.textContent.includes(label)), label);
    if (action.asElement()) { await action.asElement().click(); await fit(`application ${label}`); await page.keyboard.press('Escape'); }
  }
  await page.focus('.pf-data-row[role="group"]'); await page.keyboard.press('Enter'); await fit('application detail');
  assert.ok(await page.$('.pf-admin-overlay[role=dialog]'));
  await page.keyboard.press('Escape');
  await visit('/admin/recruitment');
  for (const label of ['Drives & proposals', 'Intelligence']) {
    await clickText(label); await fit(label);
    if (label === 'Drives & proposals') { await clickText('New proposal'); await fit('proposal drawer'); await page.keyboard.press('Escape'); }
  }
  await visit('/admin/recruitment?company=company-1');
  for (const label of ['Overview', 'Recruitment', 'Communication', 'Roles', 'Candidates', 'Resumes', 'History', 'Analytics']) { await clickText(label, '.pf-rec-subnav button'); await fit(`company ${label}`); }
  await visit('/admin/students');
  const filters = await page.$('.pf-student-filter-toggle');
  if (filters) { await filters.click(); await fit('student filters'); }
  await page.click('.pf-student-hero-bar__submit'); await page.waitForNetworkIdle({ idleTime: 100 }); await fit('student results');
  await page.click('.pf-student-card'); await clickText('Share with Recruiter'); await fit('student share wizard'); await page.keyboard.press('Escape');
  await visit('/admin/users');
  await page.click('.pf-row-menu button'); await clickText('Details'); await fit('user dossier'); await page.keyboard.press('Escape');
  overviewFailure = true;
  await visit('/admin/overview');
  assert.match(await page.$eval('[role=alert]', e => e.textContent), /Fixture overview unavailable/);
  overviewFailure = false; await clickText('Try again'); assert.ok(await page.$('.pf-overview-cards'));
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  assert.deepEqual(failures, [], 'Viewport overflow');
  assert.equal(calls.filter(c => c.method !== 'GET').length, 0, 'Read-only navigation must not mutate admin data');
  // Exercise create and failure paths against the local fake API only.
  await visit('/admin/companies'); await clickText('Add company');
  await page.type('#pf-admin-company-form input[required]', 'Fixture Test Company', { delay: 25 });
  await page.type('#pf-admin-company-form input[type=url]', 'https://fixture.test', { delay: 25 });
  assert.equal(await page.$eval('#pf-admin-company-form input[required]', e => e.value), 'Fixture Test Company');
  assert.equal(await page.$eval('#pf-admin-company-form input[type=url]', e => e.value), 'https://fixture.test');
  companyFailure = true; await page.click('button[form=pf-admin-company-form]');
  await page.waitForSelector('.pf-admin-overlay [role=alert]');
  assert.match(await page.$eval('.pf-admin-overlay [role=alert]', e => e.textContent), /Fixture company save failed/);
  companyFailure = false; await page.click('button[form=pf-admin-company-form]');
  await page.waitForNetworkIdle({ idleTime: 100 }); assert.equal(await page.$('.pf-drawer-panel'), null);
  const writes = calls.filter(c => c.path === '/api/admin/companies' && c.method === 'POST');
  assert.equal(writes.length, 2); assert.equal(JSON.parse(writes[1].body).name, 'Fixture Test Company');
  await visit('/admin/jd');
  await page.type('.pf-admin-jd-form textarea', 'Looking for a backend engineer with Java and SQL to build reliable APIs for enterprise software.');
  await page.click('.pf-admin-jd-form button[type=submit]'); await page.waitForNetworkIdle({ idleTime: 100 }); await fit('JD ranked results');
  assert.ok(await page.$('.pf-admin-jd-analysis'));
  assert.deepEqual(errors, [], 'Unexpected browser errors after form interactions');
  assert.deepEqual(failures, [], 'Viewport overflow after form interactions');
});
