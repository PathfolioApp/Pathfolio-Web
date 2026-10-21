const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const express = require('express');

test('sharing settings restore bio and resume preference without exposing link tokens', async t => {
  const students = new Map([
    ['one', { id: 'one', personal: { fullName: 'Test Student' }, profileSettings: { publicShare: {
      tokenHash: 'private-token-hash', bio: 'My saved bio', includeResume: true, createdAt: '2026-10-01T00:00:00Z', viewCount: 4,
    } } }],
    ['two', { id: 'two', personal: {}, profileSettings: {} }],
  ]);
  const dependencies = {
    crypto: require('node:crypto'), express,
    '../../shared/authenticate': (req, res, next) => {
      if (!students.has(req.headers['x-test-student'])) return res.status(401).json({ message: 'Sign in required' });
      req.student = { id: req.headers['x-test-student'] }; next();
    },
    './studentStore': { getStudentById: async id => students.get(id), saveStudent: async student => students.set(student.id, student) },
    '../resumes/resumeStore': {}, '../../shared/auditLog.service': { record: async () => {} },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/modules/students/publicShare.routes.js'), 'utf8'), {
    module, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; },
  });
  const app = express(); app.use(express.json()); app.use('/api/public-profile', module.exports);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/public-profile/me`;
  const request = (student, method = 'GET', body) => fetch(url, {
    method, headers: { 'Content-Type': 'application/json', ...(student ? { 'x-test-student': student } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await request()).status, 401);
  const initial = await (await request('one')).json();
  assert.equal(initial.share.bio, 'My saved bio');
  assert.equal(initial.share.includeResume, true);
  assert.equal(initial.share.viewCount, 4);
  assert.equal(initial.share.tokenHash, undefined);
  assert.equal(initial.url, undefined);
  const updated = await (await request('one', 'PATCH', { bio: 'Updated bio' })).json();
  assert.equal(updated.share.bio, 'Updated bio');
  assert.equal(updated.share.includeResume, true);
  assert.equal(students.get('one').profileSettings.publicShare.tokenHash, 'private-token-hash');
  assert.equal((await (await request('two')).json()).share, null);
  assert.equal((await request('two', 'PATCH', { bio: 'Unrelated' })).status, 404);
  const reloaded = await (await request('one')).json();
  assert.equal(reloaded.share.bio, 'Updated bio');
  assert.equal(reloaded.share.includeResume, true);
});
