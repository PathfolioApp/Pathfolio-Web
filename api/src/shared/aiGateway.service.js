const config = require('../config');

/**
 * Shared AI gateway for the recruitment intelligence features.
 *
 * Design rules (product principle #22):
 *  - No new paid dependency: resolves to the existing free Gemini key when
 *    AI_* variables are not set; `AI_PROVIDER=none` disables every call.
 *  - The whole platform works without AI. Every caller must handle `null`
 *    and show "AI analysis unavailable" instead of fabricating results.
 *  - Structured JSON output only, validated before use; invalid payloads are
 *    treated the same as an outage (null), never silently repaired.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

const DEFAULT_TIMEOUT_MS = 30000;

let lastFailureAt = 0;
const FAILURE_BACKOFF_MS = 60000;

function resolveProvider() {
  const requested = config.ai?.provider || 'auto';
  if (requested === 'none') return null;
  if (requested === 'gemini') return config.geminiApiKey ? { name: 'gemini', key: config.geminiApiKey } : null;
  if (requested === 'groq') return config.groqApiKey ? { name: 'groq', key: config.groqApiKey } : null;
  if (requested === 'openai-compatible') {
    if (!config.ai?.apiKey) return null;
    return { name: 'openai-compatible', key: config.ai.apiKey, baseUrl: config.ai.baseUrl || null };
  }
  // auto: prefer an explicit AI_API_KEY deployment when supplied.
  if (config.ai?.apiKey) {
    return { name: 'openai-compatible', key: config.ai.apiKey, baseUrl: config.ai.baseUrl || 'https://api.groq.com/openai/v1' };
  }
  if (config.geminiApiKey) return { name: 'gemini', key: config.geminiApiKey };
  if (config.groqApiKey) return { name: 'groq', key: config.groqApiKey };
  return null;
}

function isConfigured() {
  return Boolean(resolveProvider());
}

/**
 * Ask the configured provider for a JSON object. Returns the parsed object or
 * null when AI is unavailable / unconfigured / returned garbage. `schemaHint`
 * is a short human description of the expected shape included in the prompt.
 */
async function generateJson({ systemPrompt, userPrompt, schemaHint, temperature = 0.2, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const provider = resolveProvider();
  if (!provider) return null;
  // Simple circuit breaker: after one failure wait a minute before retrying so
  // a dead provider does not slow every request in a dashboard render.
  if (Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) return null;

  const instruction = [systemPrompt, schemaHint ? `Respond with ONLY a valid JSON object. Shape: ${schemaHint}` : 'Respond with ONLY a valid JSON object.', userPrompt]
    .filter(Boolean)
    .join('\n\n');

  try {
    let raw;
    if (provider.name === 'groq') {
      raw = await callOpenAiCompatible(`${GROQ_BASE}/chat/completions`, provider.key, config.ai?.model || config.groqModel, instruction, temperature, timeoutMs);
    } else if (provider.name === 'openai-compatible') {
      const base = provider.baseUrl || 'https://api.groq.com/openai/v1';
      const model = config.ai?.model || defaultModelForBase(base);
      raw = await callOpenAiCompatible(`${base}/chat/completions`, provider.key, model, instruction, temperature, timeoutMs);
    } else {
      raw = await callGemini(provider.key, config.ai?.model || 'gemini-flash-latest', instruction, temperature, timeoutMs);
    }
    if (!raw) return null;
    const cleaned = String(raw).trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    lastFailureAt = Date.now();
    require('../shared/logger').api.warn(`[AI gateway] provider "${provider.name}" failed: ${error.message}`);
    return null;
  }
}

async function callGemini(key, model, prompt, temperature, timeoutMs) {
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`;
  const response = await postJson(url, {
    contents: [{ role: 'user', parts: [{ text: prompt.slice(0, 28000) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature }
  }, timeoutMs);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// One chat-completions implementation for every OpenAI-compatible host
// (Groq, apmix.ai, or any AI_BASE_URL deployment). JSON mode requested when
// the caller wants JSON; the gateway still strips markdown fences defensively
// because some free endpoints ignore response_format.
async function callOpenAiCompatible(url, key, model, prompt, temperature, timeoutMs) {
  const response = await postJson(url, {
    model,
    messages: [{ role: 'user', content: prompt.slice(0, 28000) }],
    temperature,
    response_format: { type: 'json_object' }
  }, timeoutMs, { Authorization: `Bearer ${key}` });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
}

// Sensible fallback model per known free host when AI_MODEL is unset.
function defaultModelForBase(baseUrl) {
  if (baseUrl.includes('apmix.ai')) return 'claude-sonnet-4-6-free';
  if (baseUrl.includes('groq.com')) return config.groqModel;
  return 'gpt-4o-mini';
}

async function postJson(url, body, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${detail.slice(0, 160)}`);
    }
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { generateJson, isConfigured };
