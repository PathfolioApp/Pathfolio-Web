/**
 * End-to-end regression test for the crash in the original report:
 *
 *   Error: read ECONNRESET
 *     at StudentStore.getSession
 *     at AuthService.getStudentForSession
 *     at module.exports (src/shared/authenticate.js:4)
 *
 * Force the session lookup to reject the way a recycled remote MySQL socket
 * does, then hit a protected route. Before the fix this rejection escaped as an
 * unhandled rejection and Node killed the process. Now it must surface as a 503
 * and the process must still be serving requests afterwards.
 *
 * Run with: node scripts/test-db-reset-resilience.js
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'warn';
process.env.USE_DATABASE = 'false';

const studentStore = require('../src/modules/students/studentStore');
const app = require('../src/app');

const PORT = 5641;
const BASE = `http://127.0.0.1:${PORT}`;

const econnreset = () => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET', errno: -4077, syscall: 'read' });

const get = async (path, headers = {}) => {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
};

const assertions = [];
const check = (name, condition, detail) => {
  assertions.push({ name, pass: Boolean(condition), detail });
  console.log(`${condition ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  const server = app.listen(PORT);

  // Wait for the listener.
  await new Promise(resolve => server.once('listening', resolve));

  console.log('\n1. Baseline: protected route with no session');
  {
    const { status, body } = await get('/api/opportunities');
    check('no session is 401', status === 401, `got ${status}`);
    check('401 body is the sign-in message', /sign in/i.test(body.message || ''), body.message);
  }

  console.log('\n2. A dropped MySQL socket during the session lookup must NOT crash the API');
  {
    // Exactly what the crash log showed: getSession rejects with ECONNRESET.
    const real = studentStore.getSession;
    studentStore.getSession = async () => { throw econnreset(); };
    try {
      const { status, body } = await get('/api/opportunities', { cookie: 'pf_session=fake' });
      check('transient DB failure answers 503', status === 503, `got ${status}`);
      check('503 body asks the caller to retry', /retry/i.test(body.message || ''), body.message);
    } finally {
      studentStore.getSession = real;
    }
  }

  console.log('\n3. Same for a route with no try/catch of its own (proves wrapRouter is load-bearing)');
  {
    const real = studentStore.getSession;
    studentStore.getSession = async () => { throw econnreset(); };
    try {
      // /api/auth/me does its own `await` with no guard, so the rejection has to
      // be caught by the wrapper in src/shared/asyncHandler.js.
      const { status } = await get('/api/auth/me', { cookie: 'pf_session=fake' });
      check('unprotected by its own try/catch still answers 503', status === 503, `got ${status}`);
    } finally {
      studentStore.getSession = real;
    }
  }

  console.log('\n4. The process is still alive and serving after that rejection');
  {
    const { status, body } = await get('/api/health');
    check('health endpoint still responds', status === 200, `got ${status}`);
    check('health payload intact', body.status === 'healthy', JSON.stringify(body));
  }

  console.log('\n5. A non-transient error still surfaces as a 500 through errorHandler');
  {
    const real = studentStore.getSession;
    studentStore.getSession = async () => { throw new Error('deliberate failure'); };
    try {
      const { status } = await get('/api/opportunities', { cookie: 'pf_session=fake' });
      check('unexpected error is 500', status === 500, `got ${status}`);
    } finally {
      studentStore.getSession = real;
    }
  }

  console.log('\n6. withRetry absorbs one dropped connection on an idempotent read');
  {
    const { withRetry } = require('../src/shared/db');
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      if (calls === 1) throw econnreset();
      return 'ok';
    }, { label: 'test-read' });
    check('retry succeeded on a fresh connection', value === 'ok' && calls === 2, `calls=${calls}`);

    // A real SQL error must NOT be retried — that could double-apply a write.
    let sqlCalls = 0;
    try {
      await withRetry(async () => {
        sqlCalls += 1;
        throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
      }, { label: 'test-sql' });
    } catch (e) {
      check('SQL errors are not retried', sqlCalls === 1 && e.code === 'ER_DUP_ENTRY', `calls=${sqlCalls}`);
    }
  }

  server.close();

  const failed = assertions.filter(a => !a.pass);
  console.log(`\n${assertions.length - failed.length}/${assertions.length} checks passed`);
  if (failed.length) process.exit(1);
  // If the API had crashed on an unhandled rejection, we would never reach here.
  console.log('Process survived every injected database failure.\n');
}

main().catch(error => {
  console.error('Test harness error:', error);
  process.exit(1);
});
