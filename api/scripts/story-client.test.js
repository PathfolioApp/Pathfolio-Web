const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function client(fetch, timers = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/modules/student/story/storyApi.js'), 'utf8')
    .replace(/^import .*;\r?\n/, '').replace('export async function', 'async function');
  const context = { fetch, apiUrl: p => p, apiHeaders: v => v, setTimeout, clearTimeout, window: { DOMException }, ...timers };
  vm.createContext(context); vm.runInContext(source, context); return context.storySummary;
}
test('loading saved Story data performs GET only', async () => {
  const requests = []; const request = client(async (_url, options) => { requests.push(options.method); return { ok: true, json: async () => ({ summary: { summary: 'Saved' }, pending: false }) }; });
  const result = await request({ signal: new AbortController().signal }); assert.equal(result.summary.summary, 'Saved'); assert.deepEqual(requests, ['GET']);
});
test('joining an existing generation sends one POST followed only by GET polls', async () => {
  const requests = []; const request = client(async (_url, options) => {
    requests.push(options); return { ok: true, json: async () => requests.length < 3 ? { pending: true, retryAfter: 2 } : { summary: { summary: 'Finished' }, pending: false } };
  }, { setTimeout: fn => setTimeout(fn, 1) });
  assert.equal((await request({ generate: true, regenerate: true, signal: new AbortController().signal })).summary.summary, 'Finished');
  assert.deepEqual(requests.map(r => r.method), ['POST', 'GET', 'GET']); assert.equal(JSON.parse(requests[0].body).regenerate, true);
});
test('cancelling a pending generation stops polling', async () => {
  let calls = 0; const controller = new AbortController();
  const request = client(async () => { calls++; controller.abort(); return { ok: true, json: async () => ({ pending: true }) }; });
  await assert.rejects(request({ generate: true, signal: controller.signal }), { name: 'AbortError' }); assert.equal(calls, 1);
});
test('rate limits and invalid gateway responses become actionable client errors', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(client(async () => ({ ok: false, json: async () => ({ message: 'Please wait.', retryAfter: 60 }) }))({ generate: true, signal }), /1 minute\./);
  await assert.rejects(client(async () => ({ ok: true, json: async () => { throw new Error('HTML gateway error'); } }))({ signal }), /could not be loaded/);
});
