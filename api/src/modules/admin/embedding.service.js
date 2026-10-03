const config = require('../../config');

/**
 * Generates a 768-dimensional normalized semantic vector using Gemini embedding API.
 * 
 * @param {string} text - The text to embed.
 * @param {string} taskType - 'RETRIEVAL_DOCUMENT' for candidates, 'RETRIEVAL_QUERY' for JDs.
 * @returns {Promise<number[] | null>} The normalized unit vector, or null if API key is missing or request fails.
 */
async function getEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!config.geminiApiKey) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.geminiApiKey}`;
  
  const payload = {
    model: 'models/gemini-embedding-001',
    content: {
      parts: [{ text }]
    },
    taskType,
    outputDimensionality: 768
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second safe timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const vector = data.embedding?.values;
    
    if (!vector || !Array.isArray(vector)) {
      throw new Error('Invalid embedding vector returned from Gemini');
    }

    // Normalize to unit vector for lightning-fast dot product similarity
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSquares);
    const normalized = vector.map(val => val / magnitude);

    return normalized;

  } catch (err) {
    // We log and return null to gracefully fallback to deterministic scoring
    console.warn('[EmbeddingService] Failed to generate embedding:', err.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calculates cosine similarity between two pre-normalized unit vectors.
 * Because the vectors are pre-normalized, this is simply the dot product.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
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
