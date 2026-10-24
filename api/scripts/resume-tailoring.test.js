// Synthetic profiles/providers only. No .env, database, storage, or live model access.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const parsePdf = require('pdf-parse/lib/pdf-parse');
const policy = require('../src/modules/resumes/tailoringPolicy');
const pdf = require('../src/modules/resumes/resumePdf.service');

const { student, jd, loadService } = require('./resume-tailoring.fixture.cjs');

test('project stacks preserve labels and separate individual verified skills', () => {
  const expected = 'Languages: Java, JavaScript | Backend: Node.js, Express.js | Database: MySQL';
  for (const input of [student.projects[1].technologies, '1. Languages: Java, JavaScript\n2. Backend: Node.js, Express.js\n3. Database: MySQL', { Languages: ['Java', 'JavaScript'], Backend: ['Node.js', 'Express.js'], Database: ['MySQL'] }]) {
    assert.equal(policy.technologyStack(input).text, expected);
    assert.deepEqual(policy.technologyStack(input).list, ['Java', 'JavaScript', 'Node.js', 'Express.js', 'MySQL']);
  }
  assert.equal(policy.containsSkill('JavaScript engineer', 'Java'), false);
  assert.equal(policy.containsSkill('C++ and C#', 'C'), false);
  assert.equal(policy.containsSkill('RESTful APIs and OOP', 'REST API'), true);
  assert.equal(policy.containsSkill('OOP', 'Object-Oriented Programming'), true);
});

test('tailoring rejects technology swapping, invented entries, credentials, URLs, numbers, and unsupported CS defaults', () => {
  const engine = loadService(); const profile = engine.extractProfileContext(student);
  const fake = { resume: {
    personal: { fullName: 'Invented', email: 'invented@example.test', links: ['https://invented.test'] },
    summary: { text: 'Expert in Rust and Kubernetes with 99% performance improvement.' },
    experience: [{ id: profile.experience[0].id, company: 'Wrong Company', bullets: ['Reduced latency by 95% using Rust and Kubernetes.'] }],
    projects: [{ title: 'SnackIt', technologies: 'Java, Spring Boot, Node.js, MySQL', liveUrl: 'https://invented.test', bullets: ['Implemented Spring Boot microservices handling 50000 users.'] }, { title: 'Invented Java project' }],
    skills: { coreConcepts: ['DSA', 'Operating Systems', 'Computer Networks'], languages: ['Rust'] },
    certifications: [{ title: 'Invented Certificate' }], achievements: [{ title: 'Invented Award' }], leadership: [{ title: 'Invented President' }],
  }, tailoredMeta: { matchScore: 99, matchedSkills: ['Rust'] } };
  const { resume, tailoredMeta } = engine.sanitizeAndGuardrailTailoredResume(fake, profile, { jobDescription: jd });
  const snack = resume.projects.find(p => p.title === 'SnackIt'); assert.ok(snack);
  assert.equal(snack.technologies, 'Languages: Java, JavaScript | Backend: Node.js, Express.js | Database: MySQL');
  assert.equal(snack.liveUrl, 'https://snackit.example.test'); assert.ok(!snack.bullets.join(' ').includes('Spring Boot'));
  assert.ok(!JSON.stringify(resume).match(/Invented|50000|95%|Rust|Kubernetes|invented\.test/));
  assert.equal(resume.personal.fullName, student.personal.fullName);
  assert.ok(!resume.skills.coreConcepts.includes('Operating Systems'));
  assert.ok(tailoredMeta.missingOrWeakSkills.includes('operating systems'));
  assert.ok(!tailoredMeta.matchedSkills.includes('data structures and algorithms'));
  assert.ok(tailoredMeta.matchScore < 99);
  assert.match(resume.achievements.find(a => a.title === 'Academic Excellence Award').description, /10\.0 SGPA/);
});

test('deterministic tailoring ranks relevant projects and categorizes skills without positional buckets', () => {
  const engine = loadService(); const profile = engine.extractProfileContext(student);
  const draft = engine.deterministicTailorFallback(profile, 'Java Backend Developer', 'Example', jd);
  const { resume } = engine.sanitizeAndGuardrailTailoredResume(draft, profile, { jobDescription: jd });
  assert.deepEqual(resume.projects.map(p => p.title).sort(), ['JobAssist AI', 'SnackIt']);
  assert.ok(resume.skills.languages.includes('Java')); assert.ok(resume.skills.frameworks.includes('Spring Boot'));
  assert.ok(resume.skills.databasesTools.includes('MySQL')); assert.ok(!resume.skills.languages.includes('Docker'));
  assert.equal(policy.roleEvidence([], 'Java Spring Boot').score, 0);
  assert.ok(!policy.roleEvidence(['Spring Boot'], 'Spring Boot').missing.includes('spring'));
  assert.deepEqual(policy.roleEvidence(['Authentication & Authorization', 'GitHub', 'GitHub Actions'], 'authentication authorization GitHub GitHub Actions').missing, []);
  assert.deepEqual(policy.roleEvidence(['GitHub Actions'], 'GitHub').missing, []);
});

test('Java elsewhere in the profile or JD must not become a SnackIt technology or contribution', () => {
  const source = structuredClone(student);
  const snackSource = source.projects.find(project => project.projectName === 'SnackIt');
  snackSource.technologies = ['JavaScript', 'Node.js', 'Express.js', 'MySQL'];
  // Java remains a genuine candidate skill/internship technology, but is NOT a
  // fact about this project. A prior resume is also not allowed to override it.
  const history = [{ isDefault: true, extractedData: { projects: [{ title: 'SnackIt', technologies: 'Java, Spring Boot' }] } }];
  const engine = loadService();
  const profile = engine.extractProfileContext(source, history);
  assert.ok(profile.rawSkills.includes('Java'));
  const maliciousAi = { resume: { projects: [{ title: 'SnackIt', technologies: 'Java, Spring Boot, MySQL', bullets: ['Built Java backend APIs for the shopping cart.', 'Implemented Spring Boot order processing.'] }] } };
  const deterministic = engine.deterministicTailorFallback(profile, 'Java Backend Developer', 'Example', jd);
  for (const draft of [maliciousAi, deterministic]) {
    const { resume } = engine.sanitizeAndGuardrailTailoredResume(draft, profile, { jobDescription: jd });
    const snack = resume.projects.find(project => project.title === 'SnackIt');
    assert.ok(snack);
    assert.equal(snack.technologies, 'Languages: JavaScript | Backend: Node.js, Express.js | Database: MySQL');
    assert.equal(policy.containsSkill(JSON.stringify(snack), 'Java'), false);
    assert.equal(policy.containsSkill(JSON.stringify(snack), 'Spring Boot'), false);
    assert.ok(resume.skills.languages.includes('Java'), 'Candidate-level Java remains valid');
  }
});

test('tailored history never becomes source evidence and a genuine primary source takes precedence', () => {
  const service = loadService();
  const history = [
    { isDefault: true, extractedData: { tailoredMeta: { modelUsed: 'gemini' }, skills: { raw: ['Rust', 'Kubernetes'] } } },
    { extractedData: { skills: { raw: ['Elixir'] } } },
    { isDefault: true, extractedData: { skills: { raw: ['JUnit'] } } },
  ];
  const profile = service.extractProfileContext(student, history);
  assert.ok(profile.rawSkills.includes('JUnit'));
  assert.ok(!profile.rawSkills.some(skill => ['Rust', 'Kubernetes', 'Elixir'].includes(skill)));
  assert.ok(!service.extractProfileContext(student, [history[0]]).rawSkills.includes('Rust'));
});

test('valid tools and numbers do not authorize invented ownership, scale, outcomes or negation changes', () => {
  const source = { id:'p', title:'Shop', technologies:'JavaScript, MySQL', dates:'2025', bullets:[
    'Assisted with MySQL database integration.',
    'Tested 10 checkout cases; did not implement payment processing.',
  ] };
  const invented = [
    'Led MySQL database integration.',
    'Optimized MySQL queries to improve application performance.',
    'Built enterprise-grade MySQL services for global customers.',
    'Implemented payment processing for 10 customers.',
    'Won an award for MySQL database integration.',
    'Introduced PlanetScale and CockroachDB for shopping workflows.',
  ];
  for (const text of invented) {
    assert.deepEqual(policy.groundedBullets([text],source,'MySQL checkout'), source.bullets);
    const audit = policy.auditClaims({projects:[{...source,bullets:[text]}]}, {projects:[source]});
    assert.equal(audit.passed,false,text);
    assert.match(audit.findings[0].path,/bullets/);
  }
  assert.equal(policy.auditClaims({projects:[source]}, {projects:[source]}).passed,true);
  assert.equal(policy.auditClaims({projects:[{...source,bullets:['Assisted with MySQL database integration']}]}, {projects:[source]}).passed,true);
});

test('all model claims are replaced by source statements, including headline, summary and strengths', () => {
  const engine=loadService(); const profile=engine.extractProfileContext(student);
  const fake={resume:{personal:{headline:'Staff Engineer and award-winning team lead'},summary:{text:'Led global teams and delivered secure enterprise systems.'},
    experience:[{...profile.experience[0],bullets:['Led high-availability backend systems for enterprise customers.']}],
    projects:[{...profile.projects[1],bullets:['Architected secure checkout and optimized inventory performance.']}],
    education:[{institution:'Invented University',degree:'PhD'}]},tailoredMeta:{matchedStrengths:['Led global teams.']}};
  const {resume,tailoredMeta}=engine.sanitizeAndGuardrailTailoredResume(fake,profile,{jobDescription:jd});
  assert.equal(resume.personal.headline,profile.headline);
  assert.match(resume.summary.text,/^Skills include /);
  assert.equal(/global teams|enterprise systems|secure checkout|high-availability|PhD/.test(JSON.stringify(resume)),false);
  assert.equal(tailoredMeta.contentValidation.passed,true);
  assert.equal(policy.auditClaims(resume,profile).passed,true);
  assert.equal(tailoredMeta.matchedStrengths.includes('Led global teams.'),false);
});

test('same-company roles and same-named projects cannot supply each other’s contributions', () => {
  const sources=[{id:'a',company:'Example',title:'Intern',bullets:['Reviewed SQL reports.']},{id:'b',company:'Example',title:'Engineer',bullets:['Led backend development.']}];
  const resume={experience:[{...sources[0],bullets:sources[1].bullets}]};
  assert.equal(policy.auditClaims(resume,{experience:sources}).passed,false);
  const guarded=policy.selectEntries(resume.experience,sources,2,jd,item=>item.company);
  assert.equal(policy.auditClaims({experience:guarded},{experience:sources}).passed,true);
});

test('page fitting reduces content without changing layout and fails clearly if irreducible', async () => {
  const original = { personal: { fullName: 'Example' }, projects: [{ title: 'Project', bullets: ['One complete statement.', 'Another complete statement.'] }], achievements: [{ title: 'A', description: 'A long description.' }, { title: 'B' }], studioLayout: { version: 1, template: 'modern', isCompact: false } };
  const fitted = await policy.fitOnePage(original, async data => data.achievements.length <= 1 && !data.achievements[0].description ? 1 : 2);
  assert.deepEqual(fitted.studioLayout, original.studioLayout); assert.equal(original.achievements.length, 2);
  await assert.rejects(policy.fitOnePage({ personal: original.personal }, async () => 2), { statusCode: 422 });
});

test('provider success, retry, malformed output, timeout, and deterministic fallback matrix', { timeout: 120000 }, async t => {
  t.after(pdf.closePdfBrowser);
  const output = { resume: { personal: { headline: 'Java Backend Developer' }, summary: { text: 'Practical experience with Java, Spring Boot, and MySQL.' }, projects: [{ title: 'SnackIt', technologies: 'Java, Spring Boot, MySQL', bullets: ['Built shopping APIs using Node.js and MySQL.'] }] } };
  const response = (provider, text = JSON.stringify(output)) => ({ ok: true, json: async () => provider === 'gemini'
    ? { candidates: [{ content: { parts: [{ text }] } }] } : { choices: [{ message: { content: text } }] } });
  const failed = status => ({ ok: false, status, text: async () => 'Synthetic provider failure' });
  const aborted = signal => new Promise((resolve, reject) => { const stop = () => reject(Object.assign(new Error('Fixture abort'), { name: 'AbortError' })); if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true }); });
  const scenarios = [
    { name: 'Gemini first success', expected: 'gemini-', decide: p => response(p), order: ['gemini'] },
    { name: 'Gemini next model after transient failure', expected: 'gemini-', decide: (p, n) => n === 1 ? failed(503) : response(p), order: ['gemini', 'gemini'] },
    ...[401, 403, 404, 429, 500, 503].map(status => ({ name: `Gemini HTTP ${status} to Groq`, expected: 'groq-', decide: p => p === 'gemini' ? failed(status) : response(p), order: ['gemini', 'gemini', 'gemini', 'gemini', 'groq'] })),
    ...['not JSON', JSON.stringify({ resume: [] }), JSON.stringify({ resume: { projects: 'wrong shape' } }), JSON.stringify({ resume: { projects: [{ bullets: [null] }] } }), JSON.stringify({ result: 'missing resume' })].map((text, index) => ({ name: `Gemini invalid output ${index + 1} to Groq`, expected: 'groq-', decide: p => p === 'gemini' ? response(p, text) : response(p) })),
    { name: 'Gemini empty candidates to Groq', expected: 'groq-', decide: p => p === 'gemini' ? { ok: true, json: async () => ({ candidates: [] }) } : response(p) },
    { name: 'Gemini network failure to Groq', expected: 'groq-', decide: p => { if (p === 'gemini') throw new TypeError('Synthetic connection failure'); return response(p); } },
    { name: 'Gemini abort before headers to Groq', expected: 'groq-', fastTimers: true, decide: (p, n, signal) => p === 'gemini' ? aborted(signal) : response(p) },
    { name: 'Gemini stalled response body to Groq', expected: 'groq-', fastTimers: true, decide: (p, n, signal) => p === 'gemini' ? { ok: true, json: () => aborted(signal) } : response(p) },
    { name: 'Groq only when Gemini is unconfigured', expected: 'groq-', gemini: false, decide: p => response(p), order: ['groq'] },
    { name: 'Groq next model after 429', expected: 'groq-', gemini: false, decide: (p, n) => n === 1 ? failed(429) : response(p), order: ['groq', 'groq'] },
    { name: 'Both providers fail to deterministic', expected: 'deterministic-fallback', decide: () => failed(429), order: ['gemini', 'gemini', 'gemini', 'gemini', 'groq', 'groq', 'groq'] },
    { name: 'Invalid Groq output to deterministic', expected: 'deterministic-fallback', gemini: false, decide: p => response(p, 'invalid JSON') },
    { name: 'No configured providers to deterministic without network', expected: 'deterministic-fallback', gemini: false, groq: false, decide: () => { throw Error('Unexpected network'); }, order: [] },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async () => {
    const attempts = []; const timers = new Set();
    const engine = loadService({
      config: { geminiApiKey: scenario.gemini === false ? null : 'fixture-gemini', groqApiKey: scenario.groq === false ? null : 'fixture-groq', groqModel: 'openai/gpt-oss-120b' },
      timers: { setTimeout: (fn, ms) => { const id = setTimeout(fn, scenario.fastTimers ? 2 : ms); timers.add(id); return id; }, clearTimeout: id => { timers.delete(id); clearTimeout(id); } },
      fetch: async (url, options) => {
        const provider = url.includes('googleapis') ? 'gemini' : 'groq';
        const model = provider === 'groq' ? JSON.parse(options.body).model : new URL(url).pathname.split('/').pop().split(':')[0];
        attempts.push({ provider, model }); return scenario.decide(provider, attempts.filter(a => a.provider === provider).length, options.signal);
      },
    });
    const { resumeData, tailoredMeta } = await engine.tailorForJd('fixture', { jobTitle: 'Java Backend Developer', jobDescription: jd });
    assert.ok(tailoredMeta.modelUsed.startsWith(scenario.expected), tailoredMeta.modelUsed);
    assert.equal(tailoredMeta.pageCount, 1); assert.equal(timers.size, 0, 'Every provider timer must be cleared');
    assert.equal(policy.auditClaims(resumeData, engine.extractProfileContext(student)).passed, true, 'Audit actual final content, including after page fitting');
    assert.equal(resumeData.personal.fullName, student.personal.fullName);
    assert.match(resumeData.projects.find(p => p.title === 'SnackIt').technologies, /Backend: Node\.js, Express\.js/);
    assert.ok(!resumeData.projects.find(p => p.title === 'SnackIt').technologies.includes('Spring Boot'));
    if (scenario.order) assert.deepEqual(attempts.map(a => a.provider), scenario.order);
    const groqModels = attempts.filter(a => a.provider === 'groq').map(a => a.model);
    assert.equal(new Set(groqModels).size, groqModels.length, 'Do not retry a duplicate model ID');
  });
});

test('fresher outputs fit the unchanged A4 renderer and main entrypoint enforces measured page count', { timeout: 120000 }, async t => {
  t.after(pdf.closePdfBrowser);
  const engine = loadService();
  const { printable, normalizeExtractedData } = await import('../../shared/resume/resumeDocument.mjs');
  async function render(data, template = 'classic') {
    const html = printable(normalizeExtractedData(data), template, false, '', false, false);
    const bytes = await pdf.renderResumePdf(html);
    return { bytes, document: await PDFDocument.load(bytes) };
  }
  for (const internships of [[], student.internships.slice(0, 1), student.internships]) {
    const service = loadService({ profile: { ...student, internships } });
    const { resumeData, tailoredMeta } = await service.tailorForJd('fixture-student', { jobTitle: 'Java Backend Developer', company: 'Example', jobDescription: jd });
    assert.equal(tailoredMeta.pageCount, 1);
    const result = await render(resumeData);
    assert.equal(result.document.getPageCount(), 1);
    const size = result.document.getPage(0).getSize(); assert.ok(Math.abs(size.width - 595.28) < 1 && Math.abs(size.height - 841.89) < 1);
    const text = (await parsePdf(result.bytes)).text; assert.match(text, /Languages:.*Java/); assert.match(text, /Database: MySQL/);
  }
  let providerCalls = 0;
  const aiService = loadService({ config: { geminiApiKey: 'fixture-key' }, fetch: async url => {
    providerCalls++; assert.match(url, /generativelanguage\.googleapis\.com/);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ resume: { personal: { headline: 'Java Backend Developer' }, summary: { text: 'Practical experience with Java, Spring Boot, and MySQL.' }, projects: [{ title: 'SnackIt', technologies: 'Java, Spring Boot, MySQL', bullets: ['Built shopping APIs using Node.js and MySQL.'] }] }, tailoredMeta: { matchScore: 95 } }) }] } }] }) };
  } });
  const aiResult = await aiService.tailorForJd('fixture-student', { jobTitle: 'Java Backend Developer', jobDescription: jd });
  assert.equal(providerCalls, 1, 'Gemini remains first preference');
  assert.match(aiResult.resumeData.projects.find(p => p.title === 'SnackIt').technologies, /Backend: Node\.js, Express\.js/);
  assert.equal((await render(aiResult.resumeData)).document.getPageCount(), 1);
  const profile = engine.extractProfileContext(student);
  const fallback = engine.deterministicTailorFallback(profile, 'Java Backend Developer', 'Example', jd);
  const { resume } = engine.sanitizeAndGuardrailTailoredResume(fallback, profile, { jobDescription: jd });
  const dense = structuredClone(resume);
  dense.achievements = Array.from({ length: 8 }, (_, i) => ({ title: `Achievement ${i}`, description: 'Built and presented a campus project, documented the engineering process, and collaborated with other student developers. '.repeat(2) }));
  const fitted = await policy.fitOnePage(dense, async data => (await render(data)).document.getPageCount());
  assert.ok(fitted.achievements.length < dense.achievements.length);
  // A Classic fit is not a guarantee for a different template's typography.
  // Measure and fit each existing template without changing its layout settings.
  for (const template of ['classic', 'modern', 'compact', 'technical', 'editorial']) {
    const templateFit = await policy.fitOnePage(dense, async data => (await render(data, template)).document.getPageCount());
    assert.equal((await render(templateFit, template)).document.getPageCount(), 1, template);
    assert.equal(policy.auditClaims(templateFit, profile).passed, true);
  }
});
