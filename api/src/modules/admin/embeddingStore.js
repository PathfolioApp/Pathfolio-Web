const crypto = require('crypto');
const { getEmbedding } = require('./embedding.service');

class EmbeddingStore {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
  }

  _generateHash(text, taskType) {
    return crypto.createHash('sha256').update(`gemini-embedding-001:768:v2:${taskType}:${text}`).digest('hex');
  }

  /**
   * Gets a cached embedding or computes a new one.
   * 
   * @param {string} text - The text to embed
   * @param {string} taskType - 'RETRIEVAL_DOCUMENT' (student) or 'RETRIEVAL_QUERY' (JD)
   * @returns {Promise<number[] | null>}
   */
  async getOrComputeEmbedding(text, taskType, {budget} = {}) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const normalized = text.trim().slice(0,12000);
    const hash = this._generateHash(normalized,taskType);
    const cached = this.cache.get(hash);
    if (cached && cached.expiresAt > Date.now()) {
      this.cache.delete(hash); this.cache.set(hash,cached);
      return cached.vector;
    }
    this.cache.delete(hash);
    if (this.inFlight.has(hash)) return this.inFlight.get(hash);
    if (budget && (budget.remaining <= 0 || Date.now() >= budget.deadlineAt)) return null;
    if (budget) budget.remaining--;
    const pending = Promise.resolve().then(()=>getEmbedding(normalized,taskType,{deadlineAt:budget?.deadlineAt})).then(vector=>{
      this.cache.set(hash,{vector,expiresAt:Date.now()+(vector?24*60*60*1000:15000)});
      while (this.cache.size>5000) this.cache.delete(this.cache.keys().next().value);
      return vector;
    }).finally(()=>this.inFlight.delete(hash));
    this.inFlight.set(hash,pending);
    return pending;
  }

  async getStudentEmbedding(text, options) {
    return this.getOrComputeEmbedding(text, 'RETRIEVAL_DOCUMENT', options);
  }

  async getJdEmbedding(text, options) {
    return this.getOrComputeEmbedding(text, 'RETRIEVAL_QUERY', options);
  }
}

module.exports = new EmbeddingStore();
module.exports.EmbeddingStore = EmbeddingStore;
