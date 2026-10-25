const mysql = require('mysql2/promise');
const config = require('../../config');
const crypto = require('crypto');

class ResumeStore {
  constructor() {
    this.resumes = new Map();
    this.categories = new Map();
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
          category VARCHAR(48) NOT NULL DEFAULT 'General',
          analysis JSON NULL,
          extracted_data JSON NULL,
          updated_at DATETIME NULL,
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          uploaded_at DATETIME NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `);
      await c.query("ALTER TABLE resumes ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'General'").catch(error => {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      });
      await c.query('ALTER TABLE resumes MODIFY COLUMN category VARCHAR(48) NOT NULL DEFAULT \'General\'').catch(error => {
        if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) throw error;
      });
      await c.query('ALTER TABLE resumes ADD COLUMN analysis JSON NULL').catch(error => {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      });
      await c.query('ALTER TABLE resumes ADD COLUMN extracted_data JSON NULL').catch(error => {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      });
      await c.query('ALTER TABLE resumes ADD COLUMN updated_at DATETIME NULL').catch(error => {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      });
      await c.query(`
        CREATE TABLE IF NOT EXISTS resume_categories (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          student_id VARCHAR(64) NOT NULL,
          name VARCHAR(48) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_student_category (student_id, name),
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `);
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
      extractedData: parse(row.extracted_data),
      isDefault: Boolean(row.is_default),
      uploadedAt: new Date(row.uploaded_at).toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date(row.uploaded_at).toISOString()
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

  async create(studentId, { filename, filepath, driveLink, isCloud, tags, category, analysis, extractedData, isDefault }) {
    const uploadedAt = new Date().toISOString();
    if (this.pool) {
      const [result] = await this.pool.execute(
        `INSERT INTO resumes (student_id, filename, filepath, drive_link, is_r2, tags, category, analysis, extracted_data, is_default, uploaded_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [studentId, filename, filepath || '', driveLink || null, isCloud, JSON.stringify(tags || []), category || 'General', analysis ? JSON.stringify(analysis) : null, extractedData ? JSON.stringify(extractedData) : null, isDefault]
      );
      return await this.findOwnedResume(studentId, result.insertId);
    }
    const id = this.nextId++;
    const record = { id, studentId, filename, filepath: filepath || '', driveLink: driveLink || null, isCloud: Boolean(isCloud), tags: tags || [], category: category || 'General', analysis: analysis || null, extractedData: extractedData || null, isDefault: Boolean(isDefault), uploadedAt, updatedAt: uploadedAt };
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
      await this.pool.execute('UPDATE resumes SET drive_link = ?, updated_at = NOW() WHERE id = ? AND student_id = ?', [driveLink || null, resumeId, studentId]);
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
      await this.pool.execute('UPDATE resumes SET tags = ?, updated_at = NOW() WHERE id = ? AND student_id = ?', [JSON.stringify(tags || []), resumeId, studentId]);
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
      await this.pool.execute('UPDATE resumes SET category = ?, updated_at = NOW() WHERE id = ? AND student_id = ?', [category, resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) r.category = category;
    return r;
  }

  async updateAnalysis(studentId, resumeId, analysis, expectedResume) {
    const canonical = value => JSON.stringify(value, function(key, item) {
      if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map(k => [k,item[k]]));
      return item;
    });
    const assertUnchanged = current => {
      if (!expectedResume) return;
      if (!current || current.filepath !== expectedResume.filepath || canonical(current.extractedData || null) !== canonical(expectedResume.extractedData || null)) {
        const error = new Error('This resume changed while re-extraction was running. Your newer edits were kept. Reload before trying again.');
        error.statusCode = 409; throw error;
      }
    };
    if (this.pool) {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute('SELECT filepath, extracted_data FROM resumes WHERE id = ? AND student_id = ? FOR UPDATE', [resumeId, studentId]);
        const row = rows[0];
        assertUnchanged(row ? { filepath: row.filepath, extractedData: typeof row.extracted_data === 'string' ? JSON.parse(row.extracted_data) : row.extracted_data } : null);
        await connection.execute('UPDATE resumes SET analysis = ?, extracted_data = ?, updated_at = NOW() WHERE id = ? AND student_id = ?', [JSON.stringify(analysis), JSON.stringify(analysis?.structured || null), resumeId, studentId]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    assertUnchanged(r?.studentId === studentId ? r : null);
    if (r && r.studentId === studentId) {
      r.analysis = analysis;
      r.extractedData = analysis?.structured || null;
      r.updatedAt = new Date().toISOString();
    }
    return r;
  }

  async replaceFile(studentId, resumeId, { filename, filepath, analysis, extractedData }) {
    if (this.pool) {
      await this.pool.execute(
        'UPDATE resumes SET filename = ?, filepath = ?, analysis = ?, extracted_data = ?, updated_at = NOW() WHERE id = ? AND student_id = ?',
        [filename, filepath, JSON.stringify(analysis || null), JSON.stringify(extractedData || null), resumeId, studentId]
      );
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) {
      r.filename = filename;
      r.filepath = filepath;
      r.analysis = analysis || null;
      r.extractedData = extractedData || null;
      r.updatedAt = new Date().toISOString();
    }
    return r;
  }

  async updateExtractedData(studentId, resumeId, extractedData) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET extracted_data = ?, updated_at = NOW() WHERE id = ? AND student_id = ?', [JSON.stringify(extractedData || null), resumeId, studentId]);
      return await this.findOwnedResume(studentId, resumeId);
    }
    const r = this.resumes.get(Number(resumeId));
    if (r && r.studentId === studentId) {
      r.extractedData = extractedData || null;
      r.updatedAt = new Date().toISOString();
    }
    return r;
  }

  async rename(studentId, resumeId, filename) {
    if (this.pool) {
      await this.pool.execute('UPDATE resumes SET filename = ?, updated_at = NOW() WHERE id = ? AND student_id = ?', [filename, resumeId, studentId]);
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

  async listCategories(studentId) {
    const builtIns = ['Software Engineering', 'Backend Engineering', 'Cloud / DevOps', 'Data / AI', 'Core Engineering', 'Design / Product', 'General'];
    if (this.pool) {
      const [rows] = await this.pool.execute('SELECT name FROM resume_categories WHERE student_id = ? ORDER BY name', [studentId]);
      return [...builtIns, ...rows.map(row => row.name).filter(name => !builtIns.includes(name))];
    }
    return [...new Set([...(this.categories.get(studentId) || []), ...builtIns])];
  }

  async createCategory(studentId, name) {
    if (this.pool) await this.pool.execute('INSERT IGNORE INTO resume_categories (student_id, name) VALUES (?, ?)', [studentId, name]);
    else this.categories.set(studentId, [...new Set([...(this.categories.get(studentId) || []), name])]);
    return name;
  }

  async renameCategory(studentId, previousName, nextName) {
    if (this.pool) {
      const c = await this.pool.getConnection();
      try {
        await c.beginTransaction();
        await c.execute('UPDATE resumes SET category = ?, updated_at = NOW() WHERE student_id = ? AND category = ?', [nextName, studentId, previousName]);
        await c.execute('UPDATE resume_categories SET name = ? WHERE student_id = ? AND name = ?', [nextName, studentId, previousName]);
        await c.commit();
      } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
    } else {
      const names = (this.categories.get(studentId) || []).map(name => name === previousName ? nextName : name);
      this.categories.set(studentId, [...new Set(names)]);
      for (const resume of this.resumes.values()) if (resume.studentId === studentId && resume.category === previousName) resume.category = nextName;
    }
    return nextName;
  }

  async deleteCategory(studentId, name) {
    if (this.pool) {
      const c = await this.pool.getConnection();
      try {
        await c.beginTransaction();
        await c.execute("UPDATE resumes SET category = 'General', updated_at = NOW() WHERE student_id = ? AND category = ?", [studentId, name]);
        await c.execute('DELETE FROM resume_categories WHERE student_id = ? AND name = ?', [studentId, name]);
        await c.commit();
      } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
    } else {
      this.categories.set(studentId, (this.categories.get(studentId) || []).filter(category => category !== name));
      for (const resume of this.resumes.values()) if (resume.studentId === studentId && resume.category === name) resume.category = 'General';
    }
  }
}

module.exports = new ResumeStore();
