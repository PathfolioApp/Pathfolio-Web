const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getEmbedding } = require('./embedding.service');
const logger = require('../../shared/logger');

class EmbeddingStore {
  constructor() {
    this.cache = new Map();
    // Default to api/storage/embeddings.json
    this.storagePath = path.resolve(__dirname, '../../../storage/embeddings.json');
    this.saveTimeout = null;
    this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        const parsed = JSON.parse(data);
        for (const [key, value] of Object.entries(parsed)) {
          this.cache.set(key, value);
        }
        logger.api.info(`[EmbeddingStore] Loaded ${this.cache.size} embeddings from cache.`);
      } else {
        // Ensure directory exists
        const dir = path.dirname(this.storagePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (err) {
      logger.api.error('[EmbeddingStore] Failed to load cache', err);
    }
  }

  _scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Debounce save to disk (2 seconds)
    this.saveTimeout = setTimeout(() => {
      try {
        const obj = Object.fromEntries(this.cache);
        fs.writeFileSync(this.storagePath, JSON.stringify(obj), 'utf8');
      } catch (err) {
        logger.api.error('[EmbeddingStore] Failed to save cache', err);
      }
    }, 2000);
  }

  _generateHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Gets a cached embedding or computes a new one.
   * 
   * @param {string} text - The text to embed
   * @param {string} taskType - 'RETRIEVAL_DOCUMENT' (student) or 'RETRIEVAL_QUERY' (JD)
   * @returns {Promise<number[] | null>}
   */
  async getOrComputeEmbedding(text, taskType) {
    if (!text || text.trim() === '') return null;

    const hash = this._generateHash(text);

    // Check cache
    if (this.cache.has(hash)) {
      return this.cache.get(hash);
    }

    // Compute new embedding
    const vector = await getEmbedding(text, taskType);
    
    if (vector) {
      this.cache.set(hash, vector);
      this._scheduleSave();
    }

    return vector;
  }

  async getStudentEmbedding(text) {
    return this.getOrComputeEmbedding(text, 'RETRIEVAL_DOCUMENT');
  }

  async getJdEmbedding(text) {
    return this.getOrComputeEmbedding(text, 'RETRIEVAL_QUERY');
  }
}

module.exports = new EmbeddingStore();
