// Integration checks use synthetic data and never connect to the database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { PDFDocument, PDFName } = require('pdf-lib');
const parsePdf = require('pdf-parse/lib/pdf-parse');
const { renderResumePdf, closePdfBrowser, validateHtml } = require('../src/modules/resumes/resumePdf.service');

// Exercise the exact Studio HTML generator, including its shared formatting helpers.
async function loadPrintable() {
  return (await import('../../shared/resume/resumeDocument.mjs')).printable;
}

const fixture = {
  personal: { fullName: 'PDF Export Test', email: 'test@example.com', location: 'Bengaluru, India', links: [
    { label: 'Portfolio', url: 'https://example.com/portfolio' },
    { label: 'GitHub', url: 'https://github.com/example' },
    { label: 'LinkedIn', url: 'https://linkedin.com/in/example' },
  ] },
  summary: { text: 'Selectable resume summary with precise spacing and working portfolio links.' },
  skills: { languages: ['JavaScript', 'SQL'], frameworks: ['React', 'Express'] },
  projects: [{ title: 'Resume Export Project', technologies: 'Node.js, Chromium', bullets: ['Preserved selectable text and clickable links in exported resumes.'] }],
  education: [{ institution: 'Example Institute', degree: 'B.Tech Computer Science', dates: '2023 - 2027' }],
  certifications: [{ title: 'Cloud Fundamentals', description: 'Synthetic certification description.' }],
};

function linksIn(document) {
  return document.getPages().flatMap(page => {
    const annotations = page.node.Annots();
    return annotations ? annotations.asArray().flatMap(ref => {
      const annotation = document.context.lookup(ref);
      const action = annotation.lookup(PDFName.of('A'));
      const uri = action?.lookup(PDFName.of('URI'));
      return uri ? [uri.decodeText()] : [];
    }) : [];
  });
}

test('rejects missing, invalid and oversized documents before opening Chrome', () => {
  for (const html of [undefined, {}, '<p>Not a document</p>']) {
    assert.throws(() => validateHtml(html), { statusCode: 400 });
  }
  assert.throws(() => validateHtml('<!doctype html>' + 'x'.repeat(512 * 1024)), { statusCode: 413 });
});

test('library downloads render saved data as PDF, preserve uploads and enforce ownership', { timeout: 40_000 }, async t => {
  t.after(closePdfBrowser);
  const uploaded = await (await PDFDocument.create()).save();
  let storageReads = 0;
  const records = {
    generated: { filename: 'Generated.pdf', filepath: '', extractedData: fixture },
    uploaded: { filename: 'Uploaded.pdf', filepath: 'stored.pdf', extractedData: fixture },
    empty: { filename: 'Empty.pdf', filepath: '' },
  };
  const module = { exports: {} };
  const dependencies = {
    crypto: require('node:crypto'),
    './resumeStore': { findOwnedResume: async (student, id) => student === 'owner' ? records[id] : null },
    './r2.service': { getFile: async () => { storageReads++; return { Body: uploaded, ContentType: 'application/pdf' }; } },
    './resumeAnalysis': {}, './tailorResume.service': {},
    './resumeValidation': require('../src/modules/resumes/resumeValidation'),
    './resumePdf.service': { renderResumePdf },
    './resumeDocument.service': require('../src/modules/resumes/resumeDocument.service'),
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/modules/resumes/resume.controller.js'), 'utf8'), {
    module, Buffer, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; },
  });
  async function get(id, mode, student = 'owner') {
    const res = { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      attachment(name) { this.setHeader('Content-Type', 'application/pdf'); this.setHeader('Content-Disposition', `attachment; filename="${name}"`); },
      send(body) { this.body = body; return this; },
    };
    let error;
    await module.exports.getFile({ student: { id: student }, params: { resumeId: id }, query: { mode } }, res, err => { error = err; });
    return { res, error };
  }
  const download = await get('generated', 'download');
  assert.equal(download.error, undefined);
  assert.equal(download.res.headers['content-type'], 'application/pdf');
  assert.match(download.res.headers['content-disposition'], /attachment/);
  assert.equal(download.res.headers['cache-control'], 'no-store');
  assert.equal(download.res.body.subarray(0, 5).toString(), '%PDF-');
  assert.match((await parsePdf(download.res.body)).text, /PDF Export Test/);
  assert.ok(linksIn(await PDFDocument.load(download.res.body)).includes('https://example.com/portfolio'));
  assert.ok(linksIn(await PDFDocument.load(download.res.body)).includes('https://linkedin.com/in/example'));
  assert.match((await parsePdf(download.res.body)).text, /Languages:/);
  assert.match((await parsePdf(download.res.body)).text, /Frameworks & Libraries:/);
  assert.ok((await PDFDocument.load(download.res.body)).getPageCount() > 0);
  const preview = await get('generated', 'view');
  assert.equal(preview.error, undefined);
  assert.match(preview.res.headers['content-type'], /text\/html/);
  assert.match(preview.res.body, /^<!doctype html>/);
  for (const mode of ['view', 'download']) {
    const result = await get('uploaded', mode);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.res.body, uploaded);
    assert.match(result.res.headers['content-disposition'], mode === 'view' ? /inline/ : /attachment/);
  }
  assert.equal(storageReads, 2);
  assert.equal((await get('generated', 'download', 'other-student')).error.statusCode, 404);
  assert.equal((await get('uploaded', 'download', 'other-student')).error.statusCode, 404);
  assert.equal(storageReads, 2);
  assert.equal((await get('empty', 'download')).error.statusCode, 400);
});

test('saved downloads share Studio HTML, categorized raw skills and labeled profile/project links', async () => {
  const { normalizeExtractedData, printable } = await import('../../shared/resume/resumeDocument.mjs');
  const { renderSavedResumeHtml } = require('../src/modules/resumes/resumeDocument.service');
  const data = {
    ...fixture,
    personal: { ...fixture.personal, links: ['https://linkedin.com/in/example', 'https://example.dev', { label: 'My GitHub', url: 'github.com/example' }] },
    skills: { raw: ['Java', 'React', 'Docker', 'PostgreSQL'] },
    sectionOrder: ['projects', 'skills', 'summary'],
    projects: [{ title: 'Linked Project', liveUrl: 'https://example.com/project', repoUrl: 'https://github.com/example/project' }],
  };
  const normalized = normalizeExtractedData(data);
  const html = await renderSavedResumeHtml(data, 'Saved Resume');
  assert.equal(html, printable(normalized, 'classic', false, 'Saved Resume', false, true));
  assert.match(html, /href="https:\/\/linkedin.com\/in\/example"[^>]*>LinkedIn<\/a>/);
  assert.match(html, /href="https:\/\/example.dev"[^>]*>Portfolio<\/a>/);
  assert.match(html, /href="https:\/\/github.com\/example"[^>]*>My GitHub<\/a>/);
  assert.match(html, /<b>Languages:<\/b> Java/);
  assert.match(html, /<b>Frameworks & Libraries:<\/b> React/);
  assert.match(html, /<b>Cloud & DevOps:<\/b> Docker/);
  assert.match(html, /<b>Databases & Tools:<\/b> PostgreSQL/);
  assert.ok(html.indexOf('<h2>Projects</h2>') < html.indexOf('<h2>Technical Skills</h2>'));
  assert.doesNotMatch(html, /\[object Object\]/);
  for (const template of ['classic', 'modern', 'compact', 'technical', 'editorial']) {
    const saved = { ...data, studioLayout: { version: 1, template, isCompact: true, condenseDesc: true } };
    assert.equal(await renderSavedResumeHtml(saved, 'Saved Resume'), printable(normalizeExtractedData(saved), template, true, 'Saved Resume', true));
    assert.deepEqual(normalizeExtractedData(saved).studioLayout, saved.studioLayout);
  }
});

test('dense saved resumes keep Studio density, one-page fit and no empty trailing page', { timeout: 40_000 }, async t => {
  t.after(closePdfBrowser);
  const { renderSavedResumeHtml } = require('../src/modules/resumes/resumeDocument.service');
  const { normalizeExtractedData, printable } = await import('../../shared/resume/resumeDocument.mjs');
  const dense = {
    ...fixture,
    projects: Array.from({ length: 8 }, (_, i) => ({ title: `Full Length Project ${i + 1}`, technologies: 'Java, Spring Boot, PostgreSQL',
      bullets: [
        'Engineered reliable backend services with authentication, input validation, database integration and comprehensive operational documentation.',
        'Improved application reliability and query performance with measured results, automated deployment pipelines and regression checks.',
      ],
    })),
    achievements: [{ title: 'Campus Hackathon', description: 'Delivered a functioning prototype and demonstrated the completed application to reviewers.' }],
  };
  const saved = { ...dense, studioLayout: { version: 1, template: 'classic', isCompact: true, condenseDesc: true } };
  const direct = await renderResumePdf(await renderSavedResumeHtml(saved, 'Dense Resume'));
  const studio = await renderResumePdf(printable(normalizeExtractedData(saved), 'classic', true, 'Dense Resume', true));
  assert.equal((await PDFDocument.load(direct)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(studio)).getPageCount(), 1);
  const textPositions = async bytes => {
    const pages = [];
    await parsePdf(bytes, { pagerender: async page => {
      const content = await page.getTextContent();
      pages.push(content.items.map(item => ({ text: item.str, transform: item.transform, width: item.width })));
      return content.items.map(item => item.str).join(' ');
    } });
    return pages;
  };
  assert.deepEqual(await textPositions(direct), await textPositions(studio));
  const legacy = await renderResumePdf(await renderSavedResumeHtml(dense, 'Dense Resume'));
  assert.equal((await PDFDocument.load(legacy)).getPageCount(), 1);
  assert.match((await parsePdf(legacy)).text, /Full Length Project 8/);
  assert.deepEqual(await textPositions(legacy), await textPositions(studio));
  if (process.env.PDF_TEST_ARTIFACTS) {
    fs.mkdirSync(process.env.PDF_TEST_ARTIFACTS, { recursive: true });
    for (const [name, bytes] of [['dense-direct', direct], ['dense-studio', studio], ['dense-legacy', legacy]]) {
      fs.writeFileSync(path.join(process.env.PDF_TEST_ARTIFACTS, `${name}.pdf`), bytes);
    }
  }
});

test('download client refuses HTML, JSON and mislabeled files instead of saving broken PDFs', async () => {
  const { readPdfResponse } = await import('../../frontend/src/modules/student/resume/pdfDownload.mjs');
  for (const [body, type] of [
    ['<!doctype html><p>Preview</p>', 'text/html'],
    ['{"message":"error"}', 'application/json'],
    ['<!doctype html><p>Preview</p>', 'application/pdf'],
  ]) {
    await assert.rejects(readPdfResponse(new Response(body, { headers: { 'Content-Type': type } })), /PDF/);
  }
  await assert.rejects(readPdfResponse(new Response('{"message":"Please sign in"}', {
    status: 401, headers: { 'Content-Type': 'application/json' },
  })), /Please sign in/);
  const blob = await readPdfResponse(new Response('%PDF-1.7\nExample', { headers: { 'Content-Type': 'application/pdf' } }));
  assert.equal(await blob.text(), '%PDF-1.7\nExample');
});

test('PDF endpoint requires auth, downloads privately and enforces limits', async t => {
  const express = require('express');
  const rateLimit = require('../src/shared/rateLimit');
  const validation = require('../src/modules/resumes/resumeValidation');
  rateLimit.clear();
  t.after(() => rateLimit.clear());
  let renders = 0;
  function load(relative, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, relative), 'utf8'), {
      module, require: name => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    });
    return module.exports;
  }
  const controller = load('../src/modules/resumes/resumePdf.controller.js', {
    './resumePdf.service': { renderResumePdf: async html => {
      renders++; validateHtml(html);
      if (html.includes('busy')) throw Object.assign(new Error('Please try again or use Print.'), { statusCode: 503 });
      return Buffer.from('%PDF-1.7\nTest response');
    } },
    './resumeValidation': validation,
    '../../shared/logger': { api: { warn() {} } },
  });
  const router = load('../src/modules/resumes/resume.routes.js', {
    express,
    '../../shared/authenticate': (req, res, next) => {
      if (!req.headers['x-test-student']) return res.status(401).json({ message: 'Authentication required' });
      req.student = { id: req.headers['x-test-student'] }; next();
    },
    './resume.controller': new Proxy({}, { get: () => (req, res) => res.sendStatus(204) }),
    './resumeUpload': { resumeUpload: (req, res, next) => next() },
    '../../shared/rateLimit': rateLimit,
    './resumePdf.controller': controller,
  });
  const app = express();
  app.use(express.json()); app.use('/api/resumes', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/resumes/export-pdf`;
  const request = (student, body = { html: '<!doctype html><p>Resume</p>', filename: 'My Resume.pdf' }) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(student ? { 'x-test-student': student } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal((await request()).status, 401);
  assert.equal(renders, 0);
  const response = await request('one');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.match(response.headers.get('content-disposition'), /attachment; filename="My Resume.pdf"/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(await response.text(), /^%PDF/);
  assert.equal((await request('bad-name', { html: '<!doctype html>', filename: '../oops.pdf' })).status, 400);
  assert.equal((await request('bad-html', { html: 'invalid' })).status, 400);
  const busy = await request('busy', { html: '<!doctype html>busy' });
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get('retry-after'), '3');
  assert.match((await busy.json()).message, /Print/);
  for (let i = 0; i < 9; i++) assert.equal((await request('one')).status, 200);
  const limited = await request('one');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await request('another-student')).status, 200);
});

test('native PDFs preserve Studio templates, text, links and multi-page content', { timeout: 120_000 }, async t => {
  t.after(closePdfBrowser);
  const printable = await loadPrintable();
  for (const template of ['classic', 'modern', 'compact', 'technical', 'editorial']) {
    const bytes = await renderResumePdf(printable(fixture, template, false, 'Export Test'));
    const document = await PDFDocument.load(bytes);
    const extracted = await parsePdf(bytes);
    assert.match(extracted.text, /PDF Export Test/);
    assert.match(extracted.text, /Selectable resume summary/);
    assert.match(extracted.text, /Resume Export Project/);
    assert.equal(document.getPageCount(), 1, template);
    assert.ok(Math.abs(document.getPage(0).getWidth() - 595.28) < 1);
    assert.ok(Math.abs(document.getPage(0).getHeight() - 841.89) < 1);
    assert.ok(linksIn(document).includes('https://example.com/portfolio'), template);
    assert.ok(linksIn(document).includes('https://github.com/example'), template);
    if (process.env.PDF_TEST_ARTIFACTS) {
      fs.mkdirSync(process.env.PDF_TEST_ARTIFACTS, { recursive: true });
      fs.writeFileSync(path.join(process.env.PDF_TEST_ARTIFACTS, `${template}.pdf`), bytes);
    }
  }
  const long = { ...fixture, projects: Array.from({ length: 35 }, (_, i) => ({
    title: `Project ${i + 1}`, bullets: ['Built a reliable application with verified results and documented implementation details.'],
  })) };
  const bytes = await renderResumePdf(printable(long, 'classic', false, 'Long Resume'));
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1);
  assert.match((await parsePdf(bytes)).text, /Project 35/);
  const condensed = await renderResumePdf(printable(fixture, 'classic', true, 'Compact Resume', true));
  assert.doesNotMatch((await parsePdf(condensed)).text, /Synthetic certification description/);
});

test('exported documents cannot execute scripts or load external resources', { timeout: 40_000 }, async t => {
  t.after(closePdfBrowser);
  let requests = 0;
  const server = http.createServer((req, res) => { requests++; res.end('external'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/resource`;
  const bytes = await renderResumePdf(`<!doctype html><html><head><style>body { background-image:url('${url}'); }</style></head><body><p>Safe static resume</p><script>document.body.innerHTML='SCRIPT EXECUTED';fetch('${url}')</script><img src="${url}"><iframe src="${url}"></iframe></body></html>`);
  const extracted = await parsePdf(bytes);
  assert.match(extracted.text, /Safe static resume/);
  assert.doesNotMatch(extracted.text, /SCRIPT EXECUTED/);
  assert.equal(requests, 0);
});
