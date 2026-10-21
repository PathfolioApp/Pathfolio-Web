const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real profile service with an isolated store; no database or user data.
function createService(student) {
  const saved = [];
  const store = { getStudentById: async () => student, saveStudent: async record => { saved.push(structuredClone(record)); return record; } };
  const module = { exports: {} };
  const dependencies = { crypto: require('node:crypto'), './studentStore': store, '../auth/auth.service': { publicStudent: value => value }, '../resumes/r2.service': {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/modules/students/profile.service.js'), 'utf8'), {
    module,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; },
    Buffer, console
  });
  return { service: module.exports, saved };
}

test('new milestones persist creation and update timestamps with the saved data', async () => {
  const student = { achievements: [] };
  const { service, saved } = createService(student);
  const before = Date.now();
  await service.achievement('student', { title: '  Hackathon  ', year: '2026' });
  const milestone = saved[0].achievements[0];
  assert.equal(milestone.title, 'Hackathon');
  assert.ok(Date.parse(milestone.createdAt) >= before);
  assert.equal(milestone.updatedAt, milestone.createdAt);
});

test('edits preserve the original creation date and record a new update time', async () => {
  const student = { achievements: [{ id: 'milestone', title: 'Old title', createdAt: '2025-01-01T00:00:00.000Z' }] };
  const { service, saved } = createService(student);
  await service.achievement('student', { title: 'Updated title' }, 'milestone');
  const milestone = saved[0].achievements[0];
  assert.equal(milestone.createdAt, '2025-01-01T00:00:00.000Z');
  assert.ok(Date.parse(milestone.updatedAt) > Date.parse(milestone.createdAt));
  assert.equal(milestone.title, 'Updated title');
});

test('editing legacy entries does not invent their missing creation date', async () => {
  const { service, saved } = createService({ achievements: [{ id: 'legacy', title: 'Old milestone' }] });
  await service.achievement('student', { title: 'Edited milestone' }, 'legacy');
  assert.equal(saved[0].achievements[0].createdAt, undefined);
  assert.ok(Number.isFinite(Date.parse(saved[0].achievements[0].updatedAt)));
});

test('validation errors do not save a timestamped milestone', async () => {
  const { service, saved } = createService({ achievements: [] });
  await assert.rejects(service.achievement('student', { title: '   ' }), /title is required/);
  await assert.rejects(service.achievement('student', { title: 'Valid' }, 'missing'), /not found/);
  assert.equal(saved.length, 0);
});
