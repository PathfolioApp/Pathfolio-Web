const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const content = require('../src/modules/students/storyContent');

const settings = { dailyPerStudent: 5, dailyCampus: 1000, concurrency: 4, cooldownSeconds: 60, deadlineMs: 1000, geminiModels: ['fixture-primary', 'fixture-secondary'] };
const student = () => ({ id: 'fixture-student', personal: { fullName: 'Test Student', email: 'private@example.test', dateOfBirth: '2000-01-01' }, academic: { department: 'Engineering', cgpa: 1 }, interests: { hobbies: [{ name: 'Music' }] }, achievements: [{ title: 'Sample certificate', category: 'Certification', year: '2026' }], familyContext: { details: 'never send this' } });
const valid = () => ({ summary: 'Test Student is studying Engineering and has recorded a certificate.', highlights: ['Sample certificate'], themes: ['Engineering'] });
const log = { api: { info() {}, warn() {} } };
function load(relative, dependencies, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
    module, require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; },
    Date, Buffer, structuredClone, console, setTimeout, clearTimeout, AbortController, ...globals
  });
  return module.exports;
}
function makeStore(options = {}) {
  const { StoryStore } = load('modules/students/storyStore.js', { crypto, './studentStore': {}, '../../config': { storyAi: settings } });
  return new StoryStore({ pool: () => null, settings, production: false, ...options });
}
function makeService(storage, gateway, options = {}) {
  const { StoryService } = load('modules/students/story.service.js', { crypto, './storyStore': storage, '../../shared/aiGateway.service': gateway, '../../config': { storyAi: settings }, './storyContent': content, '../../shared/logger': options.logger || log });
  return new StoryService({ storage, gateway, settings, ...options });
}
function makeGateway(fetch, overrides = {}, globals = {}, logger = log) {
  return load('shared/aiGateway.service.js', { '../config': { geminiApiKey: 'fixture-key', groqApiKey: 'fixture-groq', groqModel: 'fixture-groq-model', ai: { provider: 'auto' }, ...overrides }, crypto, './logger': logger }, { fetch, ...globals });
}
const providerResponse = value => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }], choices: [{ message: { content: JSON.stringify(value) } }] }) });

test('facts are bounded, exclude sensitive fields, retain ongoing status and actual totals', () => {
  const source = student(); source.projects = Array.from({ length: 15 }, (_, i) => ({ projectName: `Project ${i}`, description: 'x'.repeat(1000), currentlyWorking: true }));
  const facts = content.factsFor(source); const serialized = JSON.stringify(facts);
  assert.equal(facts.projects.length, 10); assert.equal(facts.counts.projects, 15);
  assert.equal(facts.projects[0].description.length, 200); assert.equal(facts.projects[0].ongoing, true);
  assert.ok(!serialized.includes('private@example')); assert.ok(!serialized.includes('2000-01-01')); assert.ok(!serialized.includes('never send this'));
  assert.ok(serialized.length < 28000);
});
test('fingerprint ignores unrelated account data and changes when relevant profile data changes', () => {
  const s = student(); const initial = content.fingerprint(content.factsFor(s));
  s.familyContext.details = 'changed'; s.personal.email = 'other@example.test'; s.updatedAt = 'new';
  assert.equal(content.fingerprint(content.factsFor(s)), initial);
  s.achievements[0].title = 'Another milestone'; assert.notEqual(content.fingerprint(content.factsFor(s)), initial);
});
test('strict schema rejects whitespace, object highlights, excessive output and missing arrays', () => {
  assert.ok(content.validateSummary(valid()));
  for (const bad of [{ ...valid(), summary: '   ' }, { ...valid(), highlights: [{}] }, { ...valid(), themes: [10] }, { ...valid(), summary: 'a'.repeat(901) }, { summary: valid().summary }]) assert.equal(content.validateSummary(bad), false);
});
test('fallback is complete for achievement-only profiles and neutral about grades', () => {
  const summary = content.fallback(content.factsFor({ personal: { fullName: 'Test Student' }, achievements: [{ title: 'Certificate' }], academic: { cgpa: 1 } }));
  assert.ok(summary.summary.includes('Certificate')); assert.ok(summary.summary.includes('CGPA is 1'));
  assert.ok(!summary.summary.includes(' is .')); assert.ok(!summary.summary.includes('strong'));
  assert.equal(content.fallback(content.factsFor({})).available, false);
});
test('20 simultaneous requests start exactly one generation and other requests join', async () => {
  let calls = 0, complete; const wait = new Promise(resolve => { complete = resolve; });
  const service = makeService(makeStore(), { generateJson: async () => { calls++; await wait; return valid(); } });
  const results = Array.from({ length: 20 }, () => service.generate(student()));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1); complete();
  const responses = await Promise.all(results); assert.equal(responses.filter(r => r.status === 202).length, 19);
  const saved = await service.read(student()); assert.equal(saved.summary.generatedBy, 'ai'); assert.equal(saved.pending, false);
});
test('saved summaries load and reuse without provider calls; profile edits mark them stale', async () => {
  let calls = 0; const service = makeService(makeStore(), { generateJson: async () => { calls++; return valid(); } });
  await service.generate(student()); await service.generate(student()); await service.read(student()); assert.equal(calls, 1);
  const edited = student(); edited.achievements[0].title = 'New milestone'; assert.equal((await service.read(edited)).summary.stale, true);
});
test('empty profiles do not reserve budget or call AI', async () => {
  const service = makeService({ clearSummary: async () => {}, reserve() { assert.fail('must not reserve'); } }, { generateJson() { assert.fail('must not call AI'); } });
  assert.equal((await service.generate({ id: 'empty' })).summary.available, false);
});
test('cooldown and daily account limits apply to explicit regenerations, resetting next IST day', async () => {
  let now = Date.parse('2026-10-21T23:57:00+05:30'); const store = makeStore({ now: () => now, settings: { ...settings, dailyPerStudent: 2 } });
  let r = await store.reserve('a', 'hash', true); await store.finish(r, { generatedBy: 'ai' });
  assert.equal((await store.reserve('a', 'hash', true)).kind, 'limited');
  now += 61000; r = await store.reserve('a', 'hash', true); assert.equal(r.kind, 'reserved'); await store.release(r);
  now += 61000; assert.equal((await store.reserve('a', 'hash', true)).kind, 'limited');
  now = Date.parse('2026-10-22T00:00:01+05:30'); assert.equal((await store.reserve('a', 'hash', true)).kind, 'reserved');
});
test('both allowances reset exactly at IST midnight while UTC is still the previous day', async () => {
  let now = Date.parse('2026-10-21T23:58:00+05:30');
  const store = makeStore({ now: () => now, settings: { ...settings, dailyPerStudent: 1, dailyCampus: 1 } });
  const first = await store.reserve('a', 'hash', true); await store.release(first);
  now = Date.parse('2026-10-21T23:59:59.999+05:30');
  assert.equal((await store.reserve('a', 'hash', true)).retryAfter, 1);
  assert.equal((await store.reserve('b', 'hash', true)).kind, 'limited');
  now = Date.parse('2026-10-22T00:00:00+05:30');
  const next = await store.reserve('a', 'hash', true);
  assert.equal(next.kind, 'reserved'); assert.equal(next.state.usageDay, '2026-10-22');
  assert.equal(next.budget.attempts, 1);
});
test('campus budget and concurrency are independent of student IP addresses', async () => {
  const store = makeStore({ settings: { ...settings, concurrency: 1, dailyCampus: 2 } });
  const first = await store.reserve('a', 'hash', true); assert.equal((await store.reserve('b', 'hash', true)).kind, 'busy');
  await store.release(first); const second = await store.reserve('b', 'hash', true); await store.release(second);
  assert.equal((await store.reserve('c', 'hash', true)).kind, 'limited');
});
test('expired owners cannot overwrite a replacement generation', async () => {
  let now = Date.now(); const store = makeStore({ now: () => now });
  const first = await store.reserve('a', 'hash', true); now += 61000;
  const second = await store.reserve('a', 'hash', true); assert.notEqual(first.token, second.token);
  assert.equal(await store.finish(first, { summary: 'late' }), false); assert.equal(await store.finish(second, { summary: 'current' }), true);
  assert.equal((await store.read('a')).summary.summary, 'current');
});
test('failed regeneration preserves the current AI summary and releases ownership', async () => {
  let now = Date.now(), fail = false; const storage = makeStore({ now: () => now });
  const service = makeService(storage, { generateJson: async () => fail ? null : valid() });
  await service.generate(student()); now += 61000; fail = true;
  const result = await service.generate(student(), true); assert.equal(result.summary.generatedBy, 'ai'); assert.ok(result.notice); assert.equal(result.pending, false);
  assert.equal((await storage.read(student().id)).leaseUntil, 0);
});
test('storage failures do not trigger unmetered AI calls', async () => {
  const service = makeService({ read: async () => ({}), reserve: async () => { throw new Error('offline'); } }, { generateJson() { assert.fail('must fail closed'); } });
  await assert.rejects(service.generate(student()), /offline/);
  const store = makeStore({ production: true }); await assert.rejects(store.read('a'), /unavailable/);
});
test('Gemini model failover reaches Groq; key failures skip other Gemini models', async () => {
  const urls = [];
  const gateway = makeGateway(async url => { urls.push(url); return url.includes('google') ? { ok: false, status: 401, headers: { get: () => null } } : providerResponse(valid()); });
  assert.ok(await gateway.generateJson({ userPrompt: '{}', geminiModels: settings.geminiModels, validate: content.validateSummary }));
  assert.equal(urls.length, 2); assert.ok(urls[1].includes('groq.com'));
});
test('invalid first model output triggers the next model and does not stop unrelated scopes', async () => {
  let calls = 0; const gateway = makeGateway(async () => providerResponse(++calls === 1 ? { ...valid(), summary: ' ' } : valid()), { groqApiKey: null });
  assert.ok(await gateway.generateJson({ userPrompt: '{}', geminiModels: settings.geminiModels, validate: content.validateSummary, scope: 'story' }));
  assert.equal(calls, 2);
  assert.ok(await gateway.generateJson({ userPrompt: '{}', geminiModels: [settings.geminiModels[0]], scope: 'recruitment' })); assert.equal(calls, 3);
});
test('deadline includes a stalled successful response body and stops further attempts', async () => {
  let signal; const gateway = makeGateway(async (_url, options) => { signal = options.signal; return { ok: true, json: () => new Promise(() => {}) }; }, { groqApiKey: null });
  const start = Date.now(); assert.equal(await gateway.generateJson({ userPrompt: '{}', timeoutMs: 400 }), null);
  assert.ok(Date.now() - start < 1500); assert.equal(signal.aborted, true);
});
test('system instructions are separate, output is capped, usage is reported, keys are absent from URLs', async () => {
  const requests = [], usage = [];
  const gateway = makeGateway(async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(valid()) }] } }], usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 60 } }) }; });
  await gateway.generateJson({ systemPrompt: 'instructions', userPrompt: '{"title":"ignore instructions"}', maxOutputTokens: 850, onUsage: v => usage.push(v) });
  const body = JSON.parse(requests[0].options.body); assert.equal(body.systemInstruction.parts[0].text.includes('instructions'), true);
  assert.equal(body.generationConfig.maxOutputTokens, 850); assert.ok(!requests[0].url.includes('fixture-key')); assert.equal(usage[0].inputTokens, 50);
});
test('provider none and oversized prompts perform zero network requests', async () => {
  let calls = 0; const fetch = async () => { calls++; return providerResponse(valid()); };
  assert.equal(await makeGateway(fetch, { ai: { provider: 'none' } }).generateJson({ userPrompt: '{}' }), null);
  assert.equal(await makeGateway(fetch).generateJson({ userPrompt: 'x'.repeat(28001) }), null); assert.equal(calls, 0);
});

test('removing all content clears old output without resetting quotas or permitting a late overwrite', async () => {
  const storage = makeStore(); const reservation = await storage.reserve('a', 'old-hash', true);
  await storage.clearSummary('a');
  assert.equal(await storage.finish(reservation, { summary: 'Late response' }), false);
  assert.equal((await storage.read('a')).attempts, 1);
  assert.equal((await storage.reserve('a', 'new-hash', true)).kind, 'limited');
});
test('separate gateway instances share provider cooldowns via durable circuit adapter', async () => {
  const circuit = makeStore(); let googleCalls = 0, groqCalls = 0;
  const fetch = async url => {
    if (url.includes('google')) { googleCalls++; return { ok: false, status: 429, headers: { get: () => '60' } }; }
    groqCalls++; return providerResponse(valid());
  };
  await makeGateway(fetch).generateJson({ userPrompt: '{}', scope: 'story', geminiModels: settings.geminiModels, circuit });
  await makeGateway(fetch).generateJson({ userPrompt: '{}', scope: 'story', geminiModels: settings.geminiModels, circuit });
  assert.equal(googleCalls, 1); assert.equal(groqCalls, 2);
});
test('oversized streamed provider responses are cancelled and rejected', async () => {
  let cancelled = false;
  const gateway = makeGateway(async () => ({ ok: true, body: { getReader: () => ({ read: async () => ({ done: false, value: Buffer.alloc(65537) }), cancel: async () => { cancelled = true; } }) } }), { groqApiKey: null });
  assert.equal(await gateway.generateJson({ userPrompt: '{}' }), null); assert.equal(cancelled, true);
});
test('routes use the authenticated student, validate regeneration, and expose pending retry status', async () => {
  const routes = {}; const auth = () => {}; const middleware = []; let received;
  const response = () => ({ code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  load('modules/students/story.routes.js', {
    express: { Router: () => ({ use: value => middleware.push(value), get: (p, fn) => { routes.GET = fn; }, post: (p, fn) => { routes.POST = fn; } }) },
    '../../shared/authenticate': auth, '../../shared/logger': log,
    './story.service': { generate: async (s, force) => { received = { s, force }; return { status: 202, summary: null, pending: true, retryAfter: 2 }; } }
  });
  assert.equal(middleware[0], auth);
  let res = response(); await routes.POST({ student: { id: 'signed-in' }, body: { studentId: 'other-user', regenerate: true } }, res);
  assert.equal(received.s.id, 'signed-in'); assert.equal(received.force, true); assert.equal(res.code, 202); assert.equal(res.headers['Retry-After'], '2');
  res = response(); await routes.POST({ student: { id: 'signed-in' }, body: { regenerate: 'true' } }, res); assert.equal(res.code, 400);
});
test('invalid output for one profile does not open a provider circuit for other students', async () => {
  let blocked = 0;
  const gateway = makeGateway(async () => providerResponse({ summary: ' ' }), { groqApiKey: null });
  await gateway.generateJson({ userPrompt: '{}', validate: content.validateSummary, circuit: { blocked: async () => false, block: async () => { blocked++; } } });
  assert.equal(blocked, 0);
});
test('a synthetic burst of 1000 distinct students admits no more than the configured active jobs', async () => {
  const store = makeStore();
  const results = await Promise.all(Array.from({ length: 1000 }, (_, i) => store.reserve(`fixture-${i}`, 'hash', false)));
  assert.equal(results.filter(r => r.kind === 'reserved').length, settings.concurrency);
  assert.equal(results.filter(r => r.kind === 'busy').length, 1000 - settings.concurrency);
});

function captureLogs() {
  const lines = [];
  const capture = (...args) => lines.push(args);
  return { lines, logger: { api: { info: capture, warn: capture } }, events: () => lines.map(args => JSON.parse(args[args.length - 1])) };
}
test('generation lifecycle logs are traceable and include explicit limit reasons without private data', async () => {
  const logs = captureLogs(); const service = makeService(makeStore(), { generateJson: async () => valid() }, { logger: logs.logger });
  await service.generate(student()); await service.read(student()); await service.generate(student()); await service.generate(student(), true);
  const events = logs.events();
  assert.ok(events.some(e => e.outcome === 'started' && e.requestId));
  assert.ok(events.some(e => e.outcome === 'ai' && e.requestId));
  assert.ok(events.some(e => e.event === 'story_read' && e.outcome === 'saved'));
  assert.ok(events.some(e => e.outcome === 'cache_hit'));
  assert.ok(events.some(e => e.outcome === 'limited' && e.reason === 'student_cooldown' && e.retryAfterSeconds > 0));
  const serialized = JSON.stringify(logs.lines);
  for (const secret of ['Test Student', 'fixture-student', 'private@example.test', 'Sample certificate', 'never send this']) assert.ok(!serialized.includes(secret));
});
test('provider logs distinguish authentication failures, skips and success using the same request ID', async () => {
  const logs = captureLogs();
  const gateway = makeGateway(async url => url.includes('google') ? { ok: false, status: 401 } : providerResponse(valid()), {}, {}, logs.logger);
  await gateway.generateJson({ userPrompt: 'private profile content', scope: 'story', requestId: 'trace-fixture', geminiModels: settings.geminiModels });
  const events = logs.events();
  for (const outcome of ['attempt_started', 'http_401', 'cooldown_skipped', 'success']) assert.ok(events.some(e => e.outcome === outcome));
  assert.ok(events.every(e => e.requestId === 'trace-fixture'));
  assert.ok(!JSON.stringify(logs.lines).includes('fixture-key')); assert.ok(!JSON.stringify(logs.lines).includes('private profile content'));
});
test('timeout logs name the failure instead of reporting an unspecified outage', async () => {
  const logs = captureLogs();
  const gateway = makeGateway(async () => ({ ok: true, json: () => new Promise(() => {}) }), { groqApiKey: null }, {}, logs.logger);
  await gateway.generateJson({ userPrompt: '{}', timeoutMs: 300 });
  assert.ok(logs.events().some(e => e.outcome === 'timeout'));
  assert.ok(logs.events().some(e => e.outcome === 'exhausted'));
});
test('terminal logger prints explicit IST offset and correct next-day time while respecting log levels', () => {
  const lines = []; const env = { LOG_LEVEL: 'info' };
  class FixedDate extends Date { static now() { return Date.parse('2026-10-21T18:30:00.123Z'); } }
  const logger = load('shared/logger.js', {}, { Date: FixedDate, process: { env }, console: { log: (...args) => lines.push(args), warn: (...args) => lines.push(args), error: (...args) => lines.push(args) } });
  logger.api.info('Fixture message');
  assert.equal(lines[0][0], '2026-10-22T00:00:00.123+05:30'); assert.equal(lines[0][1], '[info ]');
  env.LOG_LEVEL = 'warn'; logger.api.info('hidden'); logger.api.warn('visible'); assert.equal(lines.length, 2);
});
test('Story time allocation gives Gemini 12 seconds and retains an 8-second Groq attempt', async () => {
  const logs = captureLogs(); const requests = [];
  const gateway = makeGateway(async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return url.includes('google') ? { ok: false, status: 503 } : providerResponse(valid());
  }, { groqModel: 'openai/gpt-oss-120b' }, {}, logs.logger);
  const result = await gateway.generateJson({ scope: 'story', userPrompt: '{}', geminiModels: ['gemini-3.5-flash-lite'], timeoutMs: 20000,
    attemptTimeoutsMs: { gemini: 12000, groq: 8000 }, maxOutputTokens: 1600 });
  assert.ok(result);
  const attempts = logs.events().filter(e => e.outcome === 'attempt_started');
  assert.equal(attempts[0].timeoutMs, 12000); assert.equal(attempts[1].timeoutMs, 8000);
  assert.ok(requests[0].url.includes('gemini-3.5-flash-lite'));
  assert.equal(requests[1].body.model, 'openai/gpt-oss-120b');
  assert.equal(requests[1].body.reasoning_effort, 'low'); assert.equal(requests[1].body.reasoning_format, 'hidden');
  assert.equal(requests[1].body.max_completion_tokens, 1600);
});
test('a larger per-model timeout cannot exceed the shared deadline', async () => {
  const logs = captureLogs();
  const gateway = makeGateway(async () => ({ ok: true, json: () => new Promise(() => {}) }), { groqApiKey: null }, {}, logs.logger);
  const start = Date.now();
  assert.equal(await gateway.generateJson({ userPrompt: '{}', timeoutMs: 300, attemptTimeoutsMs: { gemini: 12000 } }), null);
  assert.ok(Date.now() - start < 1500);
  assert.ok(logs.events().some(e => e.outcome === 'timeout'));
  assert.ok(logs.events().find(e => e.outcome === 'attempt_started').timeoutMs <= 300);
});
