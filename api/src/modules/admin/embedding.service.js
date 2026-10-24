const config = require('../../config');
let activeRequests = 0;
let cooldownUntil = 0;
const MAX_CONCURRENT = 4;
const DIMENSIONS = 768;

/**
 * Generates a 768-dimensional normalized semantic vector using Gemini embedding API.
 * 
 * @param {string} text - The text to embed.
 * @param {string} taskType - 'RETRIEVAL_DOCUMENT' for candidates, 'RETRIEVAL_QUERY' for JDs.
 * @returns {Promise<number[] | null>} The normalized unit vector, or null if API key is missing or request fails.
 */
async function getEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT', { deadlineAt = Infinity } = {}) {
  if (!config.geminiApiKey || activeRequests >= MAX_CONCURRENT || Date.now() < cooldownUntil || deadlineAt <= Date.now() || typeof text !== 'string' || !text.trim()) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.geminiApiKey}`;
  
  const payload = {
    model: 'models/gemini-embedding-001',
    content: {
      parts: [{ text: text.trim().slice(0,12000) }]
    },
    taskType,
    outputDimensionality: DIMENSIONS
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.min(4000, deadlineAt - Date.now()));
  activeRequests++;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      if ([401,403,429].includes(response.status)) cooldownUntil = Date.now() + 60000;
      else if (response.status >= 500) cooldownUntil = Date.now() + 5000;
      console.warn('[EmbeddingService] Provider unavailable; using deterministic scoring.', {status:response.status});
      return null;
    }

    const data = await response.json();
    const vector = data.embedding?.values;
    
    if (!Array.isArray(vector) || vector.length !== DIMENSIONS || !vector.every(value => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('Invalid embedding vector returned from Gemini');
    }

    // Normalize to unit vector for lightning-fast dot product similarity
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSquares);
    if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error('Invalid embedding magnitude');
    const normalized = vector.map(val => val / magnitude);

    return normalized;

  } catch (err) {
    // We log and return null to gracefully fallback to deterministic scoring
    console.warn('[EmbeddingService] Embedding unavailable; using deterministic scoring.', {reason:err.name});
    return null;
  } finally {
    clearTimeout(timeoutId);
    activeRequests--;
  }
}

/**
 * Calculates cosine similarity between two pre-normalized unit vectors.
 * Because the vectors are pre-normalized, this is simply the dot product.
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || !vecA.length || vecA.length !== vecB.length || ![...vecA,...vecB].every(value=>Number.isFinite(value))) return NaN;
  
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

module.exports = {
  getEmbedding,
  cosineSimilarity
};
