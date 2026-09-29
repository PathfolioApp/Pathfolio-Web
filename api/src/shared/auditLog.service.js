const crypto = require('crypto');
const config = require('../config');
const db = require('./db');

const clean = value => String(value || '').trim();

/**
 * Lightweight audit trail for important administrative and workflow events.
 * Each entry records who did it, what happened, which entity was touched,
 * and when. Kept intentionally simple: one table, append-only reads.
 */
class AuditLogService {
  constructor() { this.entries = []; this.nextId = 1; this.pool = null; }

  async initialize() {
    if (!config.databaseConfigured) { require('./logger').db.warn('Audit log: database not configured, keeping entries in memory.'); return; }
    this.pool = db.createPool({ connectionLimit: 5 });
    const connection = await this.pool.getConnection();
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS audit_logs (id BIGINT AUTO_INCREMENT PRIMARY KEY, actor_id VARCHAR(64) NULL, actor_name VARCHAR(180) NULL, action VARCHAR(64) NOT NULL, entity_type VARCHAR(48) NOT NULL, entity_id VARCHAR(64) NULL, entity_label VARCHAR(220) NULL, detail VARCHAR(500) NULL, created_at DATETIME NOT NULL, INDEX idx_audit_created (created_at), INDEX idx_audit_action (action))`);
    } finally { connection.release(); }
  }

  async record({ actorId = null, actorName = '', action, entityType, entityId = null, entityLabel = '', detail = '' }) {
    if (!action || !entityType) return;
    const entry = {
      id: this.nextId,
      actorId: actorId || null,
      actorName: clean(actorName) || 'System',
      action: clean(action),
      entityType: clean(entityType),
      entityId: entityId ? String(entityId) : null,
      entityLabel: clean(entityLabel).slice(0, 200),
      detail: clean(detail).slice(0, 480),
      createdAt: new Date().toISOString()
    };
    if (this.pool) {
      await this.pool.execute(
        'INSERT INTO audit_logs (actor_id,actor_name,action,entity_type,entity_id,entity_label,detail,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [entry.actorId, entry.actorName, entry.action, entry.entityType, entry.entityId, entry.entityLabel, entry.detail, new Date(entry.createdAt)]
      );
      const [rows] = await this.pool.execute('SELECT id FROM audit_logs ORDER BY id DESC LIMIT 1');
      entry.id = rows[0]?.id ?? entry.id;
    } else {
      const recorded = { ...entry, id: this.nextId++ };
      this.entries.push(recorded);
      if (this.entries.length > 500) this.entries.shift();
    }
  }

  async list({ action = '', entity = '', search = '', limit = 60 } = {}) {
    let rows;
    if (this.pool) {
      const clauses = []; const params = [];
      if (action) { clauses.push('action=?'); params.push(action); }
      if (entity) { clauses.push('entity_type=?'); params.push(entity); }
      if (search) { clauses.push('(actor_name LIKE ? OR entity_label LIKE ? OR detail LIKE ?)'); const like = `%${search}%`; params.push(like, like, like); }
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      // The limit is clamped to an integer range before being inlined:
      // mysql2 prepared statements reject bound parameters in LIMIT clauses.
      const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 200);
      const [result] = await this.pool.execute(`SELECT * FROM audit_logs${where} ORDER BY id DESC LIMIT ${safeLimit}`, params);
      rows = result;
    } else {
      rows = [...this.entries].reverse();
    }
    return rows
      .map(row => ({
        id: row.id,
        actorId: row.actor_id || row.actorId || null,
        actorName: row.actor_name || row.actorName || 'System',
        action: row.action,
        entityType: row.entity_type || row.entityType,
        entityId: row.entity_id || row.entityId || null,
        entityLabel: row.entity_label || row.entityLabel || '',
        detail: row.detail || row.Detail || '',
        createdAt: new Date(row.created_at || row.createdAt).toISOString()
      }))
      .filter(entry => (!action || entry.action === action) && (!entity || entry.entityType === entity))
      .filter(entry => !search || `${entry.actorName} ${entry.entityLabel} ${entry.detail}`.toLowerCase().includes(search.toLowerCase()))
      .slice(0, Math.min(Math.max(Number(limit) || 60, 1), 200));
  }

  async actions() {
    const rows = this.pool
      ? (await this.pool.execute('SELECT DISTINCT action FROM audit_logs'))[0]
      : [...new Set(this.entries.map(entry => entry.action))].map(action => ({ action }));
    return rows.map(row => row.action || row.ACTION).filter(Boolean).sort();
  }
}

module.exports = new AuditLogService();
