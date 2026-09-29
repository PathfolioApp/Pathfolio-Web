/**
 * Structural check: every handler reachable from the Express app must be
 * promise-safe, otherwise a rejected `await` becomes a fatal unhandled rejection
 * and kills the process. Run with: node scripts/verify-async-safety.js
 *
 * Note: a wrapped handler is a plain `function`, so `constructor.name` is no
 * longer `AsyncFunction`. The original's kind is recorded on the wrapper as
 * `pathfolioWasAsync`, and that is what this script counts.
 */
const path = require('path');
const app = require('../src/app');
const { isAsyncFunction } = require('../src/shared/asyncHandler');

const seen = new Set();
let handlers = 0;
let asyncTotal = 0;
let unwrappedHandlers = 0;
const asyncRoutes = [];
const unwrapped = [];

/** An unwrapped handler is only a bug when it can actually reject. */
const canReject = fn => isAsyncFunction(fn) || fn.pathfolioWasAsync === true;

function walk(stack, label) {
  if (!Array.isArray(stack) || seen.has(stack)) return;
  seen.add(stack);
  for (const layer of stack) {
    if (!layer) continue;
    const original = layer.handle;
    handlers += 1;
    const wrapped = Boolean(original && original.pathfolioAsyncSafe);
    if (original && original.pathfolioWasAsync) {
      asyncTotal += 1;
      if (wrapped) asyncRoutes.push(label);
    }
    if (!wrapped) {
      unwrappedHandlers += 1;
      if (canReject(original)) unwrapped.push(label);
    }
    if (layer.route) walk(layer.route.stack, `${label} ${layer.route.path}`);
    if (original && original.stack) walk(original.stack, `${label} (nested)`);
  }
}

const routers = [];
for (const id of Object.keys(require.cache)) {
  if (id.includes(`${path.sep}modules${path.sep}`) && id.endsWith('.routes.js')) {
    routers.push([id, require(id)]);
  }
}
routers.forEach(([id, router]) => walk(router.stack, path.basename(id, '.routes.js')));
walk(app._router.stack, 'app');

console.log('routers walked       :', routers.length);
console.log('handlers walked      :', handlers);
console.log('async handlers found :', asyncTotal);
console.log('handlers not wrapped :', unwrappedHandlers, '(sync ones are harmless)');
console.log('');
asyncRoutes.forEach(r => console.log('  ok  ', r));

if (unwrapped.length) {
  console.error('\nFAIL: these async handlers can still reject outside the Express error pipeline:');
  unwrapped.forEach(u => console.error('  !   ', u));
  process.exit(1);
}
console.log('\nPASS: every async handler forwards rejections to next(err).');
