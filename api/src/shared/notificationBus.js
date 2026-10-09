/**
 * Real-time notification delivery over Server-Sent Events (SSE).
 *
 * A single in-process event bus. `notificationBus.emit(studentId, payload)`
 * is called wherever a notification is created; connected clients subscribed
 * to that student id receive the event instantly (`/api/notifications/stream`).
 *
 * SSE was chosen over WebSockets because notifications are server-to-client
 * only, it survives proxies that block WS upgrades, and it needs no extra
 * dependency. Vercel serverless does not hold long-lived connections, so the
 * client falls back to its normal polling when the stream errors.
 */
const log = require('./logger');

const subscribers = new Map(); // studentId -> Set(res)
const MAX_SUBSCRIBERS_PER_USER = 3;

function subscribe(studentId, res) {
  let set = subscribers.get(studentId);
  if (!set) { set = new Set(); subscribers.set(studentId, set); }
  if (set.size >= MAX_SUBSCRIBERS_PER_USER) {
    // Drop the oldest connection to keep memory bounded.
    const oldest = set.values().next().value;
    set.delete(oldest);
    try { oldest.end(); } catch { /* already gone */ }
  }
  set.add(res);
  log.rt.debug(`SSE subscribe ${studentId.slice(0, 8)} (${set.size} live)`);
  return () => {
    set.delete(res);
    if (!set.size) subscribers.delete(studentId);
  };
}

/** Push a payload to every live connection of one student. Fire-and-forget. */
function emit(studentId, payload) {
  const set = subscribers.get(studentId);
  if (!set || !set.size) return 0;
  const frame = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  let delivered = 0;
  for (const res of set) {
    try { res.write(frame); delivered += 1; } catch { /* dropped; unsubscribe handles cleanup */ }
  }
  return delivered;
}

function liveConnectionCount() {
  let total = 0;
  for (const set of subscribers.values()) total += set.size;
  return total;
}

module.exports = { subscribe, emit, liveConnectionCount };
