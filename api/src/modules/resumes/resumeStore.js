const mysql = require('mysql2/promise');
const config = require('../../config');
const crypto = require('crypto');

class ResumeStore {
  constructor() {
    this.resumes = new Map();
    this.nextId = 1;
    this.pool = null;
  }

  async initialize(pool) {
    this.pool = pool;
    if (!this.pool) return;
    const c = await this.pool.getConnection();
    try {
      await c.query(`
        CREATE TABLE IF NOT EXISTS resumes (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          student_id VARCHAR(64) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          filepath VARCHAR(500) NOT NULL,
          drive_link TEXT,
          is_r2 BOOLEAN NOT NULL DEFAULT FALSE,
          tags JSON NOT NULL,
          category VARCHAR(32) NOT NULL DEFAULT 'General',
          analysis JSON NULL,
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          uploaded_at DATETIME NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `);
      await c.query("ALTER TABLE resumes ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'General'").catch(error => {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      });
      await c.query('ALTER TABLE resumes ADD COLUMN analysis JSON NULL').catch(error => {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      });
    } finally {
      c.release();
    }
  }

  row(row) {
    if (!row) return null;
    const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
    return {
      id: row.id,
      studentId: row.student_id,
      filename: row.filename,
      filepath: row.filepath,
      driveLink: row.drive_link,
      isCloud: Boolean(row.is_r2),
      tags: parse(row.tags),
      category: row.category || 'General',
      analysis: parse(row.analysis),
      isDefault: Boolean(row.is_default),
      uploadedAt: new Date(row.uploaded_at).toISOString()
    };
  }

  async list(studentId) {
    if (this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT * FROM resumes WHERE student_id = ? ORDER BY uploaded_at DESC, id DESC',
        [studentId]
      );
      return rows.map(r => this.row(r));
    }
    return [...this.resumes.values()]
      .filter(r => r.studentId === studentId)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  async findOwnedResume(studentId, resumeId) {
    if (this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT * FROM resumes WHERE id = ? AND student_id = ? LIMIT 1',
        [resumeId, studentId]
      );
      if (!rows.length) return null;
      return this.row(rows[0]);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) return r;
    return null;
  }

  async create(studentId, { filename, filepath, driveLink, isCloud, tags, category, analysis, isDefault }) {
    const uploadedAt = new Date().toISOString();
    if (this.pool) {
      const [result] = await this.pool.execute(
        `INSERT INTO resumes (student_id, filename, filepath, drive_link, is_r2, tags, category, analysis, is_default, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [studentId, filename, filepath || '', driveLink || null, isCloud, JSON.stringify(tags || []), category || 'General', analysis ? JSON.stringify(analysis) : null, isDefault]
      );
      return await this.findOwnedResume(studentId, result.insertId);
    }
    const id = this.nextId++;
    const record = { id, studentId, filename, filepath: filepath || '', driveLink: driveLink || null, isCloud: Boolean(isCloud), tags: tags || [], category: category || 'General', analysis: analysis || null, isDefault: Boolean(isDefault), uploadedAt };
    this.resumes.set(id, record);
    return record;
  }

  async count(studentId) {
    if (this.pool) {
      const [rows] = await this.pool.execute('SELECT COUNT(*) AS c FROM resumes WHERE student_id = ?', [studentId]);
      return Number(rows[0].c);
    }
    return [...this.resumes.values()].filter(r => r.studentId === studentId).length;
  }

  async updateLink(studentId, resumeId, driveLink) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET drive_link = ? WHERE id = ? AND student_id = ?', [driveLink || null, resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) {
      r.driveLink = driveLink || null;
    }
    return r;
  }

  async updateTags(studentId, resumeId, tags) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET tags = ? WHERE id = ? AND student_id = ?', [JSON.stringify(tags || []), resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) {
      r.tags = tags || [];
    }
    return r;
  }

  async updateCategory(studentId, resumeId, category) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET category = ? WHERE id = ? AND student_id = ?', [category, resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) r.category = category;
    return r;
  }

  async updateAnalysis(studentId, resumeId, analysis) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET analysis = ? WHERE id = ? AND student_id = ?', [JSON.stringify(analysis), resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) r.analysis = analysis;
    return r;
  }

  async rename(studentId, resumeId, filename) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET filename = ? WHERE id = ? AND student_id = ?', [filename, resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) {
      r.filename = filename;
    }
    return r;
  }

  async setDefault(studentId, resumeId) {
    if (this.pool) {
      const c = await this.pool.getConnection();
      try {
        await c.beginTransaction();
        await c.execute('UPDATE resumes SET is_default = FALSE WHERE student_id = ?', [studentId]);
        await c.execute('UPDATE resumes SET is_default = TRUE WHERE id = ? AND student_id = ?', [resumeId, studentId]);
        await c.commit();
        return await this.findOwnedResume(studentId, resumeId);
      } catch (err) {
        await c.rollback();
        throw err;
      } finally {
        c.release();
      }
    }
    for (const r of this.resumes.values()) {
      if (r.studentId === studentId) {
        r.isDefault = r.id === Number(resumeId);
      }
    }
    return this.resumes.get(Number(resumeId));
  }

  async delete(studentId, resumeId) {
    if (this.pool) {
      const c = await this.pool.getConnection();
      try {
        await c.beginTransaction();
        await c.execute('UPDATE applications SET resume_id = NULL WHERE resume_id = ? AND student_id = ?', [resumeId, studentId]).catch(() => {});
        await c.execute('DELETE FROM resumes WHERE id = ? AND student_id = ?', [resumeId, studentId]);
        await c.commit();
        return true;
      } catch (err) {
        await c.rollback();
        throw err;
      } finally {
        c.release();
      }
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) {
      this.resumes.delete(Number(resumeId));
      return true;
    }
    return false;
  }
}

module.exports = new ResumeStore();
