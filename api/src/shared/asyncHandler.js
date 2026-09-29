/**
 * Promise-safe Express 4 request handling.
 *
 * The problem
 * -----------
 * Express 4 only catches *synchronous* throws from middleware and routes:
 *
 *   Layer.handle [as handle_request] (express/lib/router/layer.js:95)
 *     try { fn(req, res, next) } catch (err) { next(err) }
 *
 * When `fn` is an `async` function, a rejected promise never reaches that
 * `catch`. It escapes as an unhandled rejection, and Node's default
 * `--unhandled-rejections=throw` turns it into a fatal uncaught exception:
 *
 *   Error: read ECONNRESET
 *     at StudentStore.getSession (...)
 *     at AuthService.getStudentForSession (...)
 *     at module.exports (src/shared/authenticate.js:4:30)   <-- async middleware
 *
 * One reset database socket therefore killed the entire API process, the Vite
 * proxy started returning ECONNREFUSED, and the watcher restarted the process
 * into the same state. Express 5 fixes this natively; we are on 4.
 *
 * The fix
 * -------
 * `wrapRouter` rewrites every registered handler in place so it forwards a
 * returned promise's rejection to `next(err)`, which routes it to the existing
 * `errorHandler` middleware. Handlers keep their original signature and
 * behaviour — sync throws, `next()` calls and response writes are untouched —
 * so no route needs to change.
 */

const isAsyncFunction = fn => Boolean(fn && fn.constructor && fn.constructor.name === 'AsyncFunction');

/**
 * Wrap a single handler so a rejected promise becomes `next(err)`.
 * Arity is preserved because Express identifies 4-argument error middleware
 * by `fn.length`.
 */
function wrapHandler(fn) {
  if (typeof fn !== 'function') return fn;
  if (fn.pathfolioAsyncSafe) return fn;

  const arity = fn.length;
  const wrapped = function pathfolioAsyncSafe(req, res, next) {
    let result;
    try {
      result = fn.apply(this, arguments);
    } catch (error) {
      return next(error);
    }
    // Only thenables need help; synchronous handlers keep the old fast path.
    if (result && typeof result.then === 'function') {
      result.then(undefined, error => next(error));
    }
    return result;
  };

  // The wrapper is a plain function, so the original's kind is recorded here for
  // the structural check in scripts/verify-async-safety.js.
  Object.defineProperty(wrapped, 'pathfolioWasAsync', { value: isAsyncFunction(fn), enumerable: false });
  Object.defineProperty(wrapped, 'length', { value: arity, configurable: true });
  Object.defineProperty(wrapped, 'pathfolioAsyncSafe', { value: true, enumerable: false });
  for (const key of ['name', 'displayName']) {
    try { Object.defineProperty(wrapped, key, { value: fn[key], configurable: true }); } catch { /* non-configurable upstream */ }
  }
  return wrapped;
}

/** Walk a layer's own stack: routes, mounted sub-routers, and raw handlers. */
function wrapStack(stack, seen) {
  if (!Array.isArray(stack) || seen.has(stack)) return;
  seen.add(stack);

  for (const layer of stack) {
    if (!layer) continue;
    // Keep a reference to the original handle: the wrapper does not carry the
    // `.stack` of a mounted sub-router, so nested stacks must be found here.
    const original = layer.handle;
    if (original) layer.handle = wrapHandler(original);
    // `router.get('/x', h)` layers carry the handler chain in `route.stack`;
    // `router.use(subRouter)` layers carry it in `handle.stack`.
    if (layer.route) wrapStack(layer.route.stack, seen);
    if (original && original.stack) wrapStack(original.stack, seen);
  }
}

/**
 * Make every handler reachable from `router` promise-safe. Idempotent, and
 * safe to call before or after the router is mounted, because a mounted
 * sub-router is referenced (not copied) by its parent layer.
 */
function wrapRouter(router) {
  if (!router || !Array.isArray(router.stack)) return router;
  wrapStack(router.stack, new Set());
  return router;
}

module.exports = { wrapRouter, wrapHandler, isAsyncFunction };
