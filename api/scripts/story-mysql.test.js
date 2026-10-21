// Opt-in integration test. Never connects to the application's configured database.
// Supply a pre-created, disposable schema named pathfolio_story_test_<suffix>.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const database = process.env.STORY_TEST_DB_NAME;
test('MySQL: separate workers share leases, quotas, persisted summaries, and account deletion cleanup', { skip: !database }, async () => {
  assert.match(database, /^pathfolio_story_test_[a-zA-Z0-9_]+$/, 'Only a dedicated scratch schema is allowed');
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({ host: process.env.STORY_TEST_DB_HOST || '127.0.0.1', port: Number(process.env.STORY_TEST_DB_PORT || 3306), user: process.env.STORY_TEST_DB_USER, password: process.env.STORY_TEST_DB_PASSWORD, database, connectionLimit: 8, connectTimeout: 3000 });
  const settings = { dailyPerStudent: 2, dailyCampus: 10, concurrency: 2, cooldownSeconds: 60 };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/modules/students/storyStore.js'), 'utf8'), { module, Date, structuredClone, require(name) {
    if (name === 'crypto') return crypto;
    if (name === './studentStore') return {};
    if (name === '../../config') return { storyAi: settings };
    throw new Error(name);
  } });
  const { StoryStore } = module.exports;
  try {
    // These tables exist only inside the explicitly named scratch schema.
    await pool.query('CREATE TABLE IF NOT EXISTS students (id CHAR(36) PRIMARY KEY)');
    const workerA = new StoryStore({ pool: () => pool, settings, production: true });
    const workerB = new StoryStore({ pool: () => pool, settings, production: true });
    await Promise.all([workerA.initialize(), workerB.initialize()]);
    await pool.query('DELETE FROM story_summaries'); await pool.query("UPDATE story_ai_budget SET usage_day='',attempts=0 WHERE id=1");
    const id = crypto.randomUUID(), other = crypto.randomUUID(), third = crypto.randomUUID();
    await pool.query('INSERT INTO students (id) VALUES (?),(?),(?)', [id, other, third]);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? workerA : workerB).reserve(id, 'profile-hash', false)));
    const owner = results.find(r => r.kind === 'reserved'); assert.ok(owner);
    assert.equal(results.filter(r => r.kind === 'reserved').length, 1); assert.equal(results.filter(r => r.kind === 'pending').length, 19);
    const second = await workerB.reserve(other, 'other-hash', false); assert.equal(second.kind, 'reserved');
    assert.equal((await workerA.reserve(third, 'third-hash', false)).kind, 'busy');
    assert.equal(await workerA.finish(owner, { generatedBy: 'ai', summary: 'Saved fixture summary' }), true);
    assert.equal((await workerB.read(id)).summary.summary, 'Saved fixture summary');
    assert.equal((await workerB.reserve(id, 'profile-hash', false)).kind, 'cached');
    assert.equal((await workerB.reserve(id, 'profile-hash', true)).kind, 'limited');
    assert.equal(await workerB.finish({ ...owner, token: crypto.randomUUID() }, { summary: 'Wrong owner' }), false);
    await pool.query('DELETE FROM students WHERE id IN (?,?,?)', [id, other, third]);
    assert.equal((await workerA.read(id)).summary, undefined);
    const key = crypto.createHash('sha256').update('fixture').digest('hex');
    await workerA.block(key, Date.now() + 60000); assert.equal(await workerB.blocked(key), true);
  } finally { await pool.end(); }
});
