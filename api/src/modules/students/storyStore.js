const crypto = require('crypto');
const studentStore = require('./studentStore');
const config = require('../../config');
// IST is UTC+05:30. Keep instants unchanged; shift only the calendar-day boundary.
const IST_OFFSET_MS = 330 * 60 * 1000;
const istDay = now => new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
const nextIstMidnight = day => Date.parse(`${day}T00:00:00+05:30`) + 86400000;

// All admission writes lock one small row. No database lock is held during AI calls.
// Expiring ownership tokens fence late completions after a crashed worker is replaced.
class StoryStore {
  constructor({ pool = () => studentStore.pool, settings = config.storyAi, production = config.databaseConfigured || config.nodeEnv === 'production', now = Date.now } = {}) {
    this.pool = pool; this.settings = settings; this.production = production; this.now = now;
    this.ready = null; this.memory = new Map(); this.health = new Map(); this.budget = {};
  }
  async initialize() {
    const pool = this.pool();
    if (!pool) { if (this.production) throw new Error('Story storage unavailable.'); return; }
    if (!this.ready) this.ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS story_summaries (
        student_id VARCHAR(64) PRIMARY KEY, state JSON NOT NULL,
        lease_until BIGINT NOT NULL DEFAULT 0, lease_token CHAR(36) NULL,
        INDEX idx_story_leases (lease_until),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS story_ai_budget (
        id TINYINT PRIMARY KEY, usage_day VARCHAR(10) NOT NULL, attempts INT NOT NULL DEFAULT 0
      )`);
      await pool.query("INSERT IGNORE INTO story_ai_budget (id,usage_day,attempts) VALUES (1,'',0)");
      await pool.query(`CREATE TABLE IF NOT EXISTS story_ai_health (
        provider_key CHAR(64) PRIMARY KEY, retry_at BIGINT NOT NULL
      )`);
    })().catch(error => { this.ready = null; throw error; });
    await this.ready;
  }
  decode(row) { return row ? { ...(typeof row.state === 'string' ? JSON.parse(row.state) : row.state), leaseUntil: Number(row.lease_until), token: row.lease_token } : {}; }
  async read(id) {
    await this.initialize();
    if (!this.pool()) return structuredClone(this.memory.get(id) || {});
    const [rows] = await this.pool().execute('SELECT state,lease_until,lease_token FROM story_summaries WHERE student_id=?', [id]);
    return this.decode(rows[0]);
  }
  async clearSummary(id) {
    await this.initialize();
    if (!this.pool()) {
      const state = this.memory.get(id);
      if (state) { delete state.summary; delete state.fingerprint; delete state.generatedAt; state.leaseUntil = 0; state.token = null; }
      return;
    }
    // Preserve quotas when content is removed; deleting the row would reset them.
    await this.pool().execute("UPDATE story_summaries SET state=JSON_REMOVE(state,'$.summary','$.fingerprint','$.generatedAt'),lease_until=0,lease_token=NULL WHERE student_id=?", [id]);
  }
  decide(state, hash, force, now, day, budget, active) {
    if (state.leaseUntil > now) return { kind: 'pending', retryAfter: 2 };
    if (!force && state.fingerprint === hash && state.summary && (state.summary.generatedBy === 'ai' || state.retryAt > now)) return { kind: 'cached', summary: state.summary };
    const cooldown = state.lastAttempt + this.settings.cooldownSeconds * 1000 - now;
    if (cooldown > 0) return { kind: 'limited', reason: 'student_cooldown', retryAfter: Math.ceil(cooldown / 1000), note: 'Please wait before generating again.' };
    const dailyCount = state.usageDay === day ? state.attempts || 0 : 0;
    const campusCount = budget.day === day ? budget.attempts || 0 : 0;
    if (dailyCount >= this.settings.dailyPerStudent || campusCount >= this.settings.dailyCampus) return { kind: 'limited', reason: dailyCount >= this.settings.dailyPerStudent ? 'student_daily_limit' : 'campus_daily_limit', retryAfter: Math.max(1, Math.ceil((nextIstMidnight(day) - now) / 1000)), note: 'The daily story generation allowance has been reached. It resets at midnight IST. Your saved story remains available.' };
    if (active >= this.settings.concurrency) return { kind: 'busy', reason: 'concurrency_limit', retryAfter: 10, note: 'Story writing is busy. Please try again shortly.' };
    const token = crypto.randomUUID();
    const next = { ...state, usageDay: day, attempts: dailyCount + 1, lastAttempt: now, token, leaseUntil: now + 25000, pendingFingerprint: hash };
    return { kind: 'reserved', state: next, token, fingerprint: hash, budget: { day, attempts: campusCount + 1 } };
  }
  async reserve(id, hash, force) {
    await this.initialize();
    const pool = this.pool();
    if (!pool) {
      // No await between decision and write: atomic within the dev process.
      const now = this.now(); const day = istDay(now);
      const active = [...this.memory.values()].filter(s => s.leaseUntil > now).length;
      const result = this.decide(this.memory.get(id) || {}, hash, force, now, day, this.budget, active);
      if (result.kind === 'reserved') { this.memory.set(id, result.state); this.budget = result.budget; }
      return { ...result, id };
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [budgets] = await connection.query('SELECT usage_day AS day,attempts FROM story_ai_budget WHERE id=1 FOR UPDATE');
      const [clock] = await connection.query('SELECT UNIX_TIMESTAMP(NOW(3))*1000 AS nowMs');
      const now = Number(clock[0].nowMs), day = istDay(now);
      await connection.execute("INSERT IGNORE INTO story_summaries (student_id,state) VALUES (?,JSON_OBJECT())", [id]);
      const [rows] = await connection.execute('SELECT state,lease_until,lease_token FROM story_summaries WHERE student_id=? FOR UPDATE', [id]);
      const [counts] = await connection.execute('SELECT COUNT(*) AS active FROM story_summaries WHERE lease_until>?', [now]);
      const result = this.decide(this.decode(rows[0]), hash, force, now, day, budgets[0], Number(counts[0].active));
      if (result.kind === 'reserved') {
        await connection.execute('UPDATE story_summaries SET state=?,lease_until=?,lease_token=? WHERE student_id=?', [JSON.stringify(result.state), result.state.leaseUntil, result.token, id]);
        await connection.execute('UPDATE story_ai_budget SET usage_day=?,attempts=? WHERE id=1', [result.budget.day, result.budget.attempts]);
      }
      await connection.commit();
      return { ...result, id };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async finish(reservation, summary) {
    const now = this.now();
    const state = { ...reservation.state, summary, fingerprint: reservation.fingerprint, generatedAt: new Date(now).toISOString(), retryAt: summary.generatedBy === 'ai' ? 0 : now + 180000, leaseUntil: 0, token: null };
    delete state.pendingFingerprint;
    if (!this.pool()) {
      const current = this.memory.get(reservation.id);
      if (current?.token !== reservation.token || current.leaseUntil <= now) return false;
      this.memory.set(reservation.id, state); return true;
    }
    const [result] = await this.pool().execute('UPDATE story_summaries SET state=?,lease_until=0,lease_token=NULL WHERE student_id=? AND lease_token=? AND lease_until>UNIX_TIMESTAMP(NOW(3))*1000', [JSON.stringify(state), reservation.id, reservation.token]);
    return result.affectedRows === 1;
  }
  async release(reservation) {
    if (!this.pool()) { const state = this.memory.get(reservation.id); if (state?.token === reservation.token) { state.leaseUntil = 0; state.token = null; } return; }
    await this.pool().execute('UPDATE story_summaries SET lease_until=0,lease_token=NULL WHERE student_id=? AND lease_token=?', [reservation.id, reservation.token]);
  }
  async blocked(key) {
    if (!this.pool()) return (this.health.get(key) || 0) > this.now();
    const [rows] = await this.pool().execute('SELECT retry_at FROM story_ai_health WHERE provider_key=?', [key]);
    return Number(rows[0]?.retry_at || 0) > this.now();
  }
  async block(key, retryAt) {
    if (!this.pool()) { this.health.set(key, retryAt); return; }
    await this.pool().execute('INSERT INTO story_ai_health (provider_key,retry_at) VALUES (?,?) ON DUPLICATE KEY UPDATE retry_at=GREATEST(retry_at,VALUES(retry_at))', [key, retryAt]);
  }
}
module.exports = new StoryStore();
module.exports.StoryStore = StoryStore;
