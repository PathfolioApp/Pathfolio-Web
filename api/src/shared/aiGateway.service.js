const config = require('../config');
const crypto = require('crypto');
const log = require('./logger').api;
const cooldowns = new Map();

function providers(geminiModels) {
  const requested = config.ai?.provider || 'auto';
  if (requested === 'none') return [];
  const candidates = [];
  if (['auto', 'openai-compatible'].includes(requested) && config.ai?.apiKey) candidates.push({ name: 'openai-compatible', key: config.ai.apiKey, base: config.ai.baseUrl || 'https://api.groq.com/openai/v1', model: config.ai.model || (config.ai.baseUrl?.includes('apmix.ai') ? 'claude-sonnet-4-6-free' : (!config.ai.baseUrl || config.ai.baseUrl.includes('groq.com')) ? config.groqModel : 'gpt-4o-mini') });
  if (['auto', 'gemini'].includes(requested) && config.geminiApiKey) {
    for (const model of (geminiModels || [config.ai?.model || 'gemini-flash-latest']).slice(0, 2)) candidates.push({ name: 'gemini', key: config.geminiApiKey, base: 'https://generativelanguage.googleapis.com/v1beta', model });
  }
  if (['auto', 'groq'].includes(requested) && config.groqApiKey) candidates.push({ name: 'groq', key: config.groqApiKey, base: 'https://api.groq.com/openai/v1', model: requested === 'groq' ? config.ai?.model || config.groqModel : config.groqModel });
  // Reserve the final attempt for the other provider rather than exhausting Gemini models.
  if (candidates.length > 3) return [...candidates.slice(0, 2), candidates[candidates.length - 1]];
  return candidates;
}
function healthKey(provider, scope) {
  return crypto.createHash('sha256').update([scope, provider.name, provider.base, provider.model, provider.key].join('|')).digest('hex');
}

async function readJson(response) {
  // Never buffer arbitrarily large model output. This includes metadata/reasoning.
  if (response.body?.getReader) {
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 65536) throw new Error('response_too_large');
        chunks.push(Buffer.from(value));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); }
  }
  return response.json();
}

async function call(provider, system, user, temperature, maxOutputTokens, timeoutMs, onUsage, lowReasoning = false) {
  const controller = new AbortController(); let timer;
  const operation = (async () => {
    const gemini = provider.name === 'gemini';
    const url = gemini ? `${provider.base}/models/${encodeURIComponent(provider.model)}:generateContent` : `${provider.base}/chat/completions`;
    const body = gemini ? {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens }
    } : {
      model: provider.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature,
      response_format: { type: 'json_object' },
      ...(lowReasoning && (provider.name === 'groq' || provider.base.includes('groq.com')) && /^openai\/gpt-oss-(20b|120b)$/.test(provider.model)
        ? { reasoning_effort: 'low', reasoning_format: 'hidden' } : {}),
      ...(provider.name === 'groq' || provider.base.includes('groq.com') ? { max_completion_tokens: maxOutputTokens } : { max_tokens: maxOutputTokens })
    };
    const response = await fetch(url, { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(gemini ? { 'x-goog-api-key': provider.key } : { Authorization: `Bearer ${provider.key}` }) }, body: JSON.stringify(body) });
    if (!response.ok) { const error = new Error('provider_http_error'); error.status = response.status; const retry = Number(response.headers?.get('retry-after')); error.retryMs = Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 300000) : 60000; await response.body?.cancel?.().catch(() => {}); throw error; }
    const data = await readJson(response);
    const usage = gemini ? data.usageMetadata : data.usage;
    onUsage?.({ inputTokens: Number(usage?.promptTokenCount ?? usage?.prompt_tokens ?? 0), outputTokens: gemini ? Number(usage?.candidatesTokenCount || 0) + Number(usage?.thoughtsTokenCount || 0) : Number(usage?.completion_tokens || 0) });
    return gemini ? data?.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') : data?.choices?.[0]?.message?.content;
  })();
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('deadline_exceeded')); }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

async function generateJson({ systemPrompt, userPrompt, schemaHint, temperature = 0.2, timeoutMs = 20000,
  maxOutputTokens = 1200, validate, geminiModels, circuit, scope = 'shared', onUsage, attemptTimeoutsMs, requestId = crypto.randomUUID() } = {}) {
  const started = Date.now(); const deadline = started + Math.min(Math.max(timeoutMs, 1), 20000);
  const emit = (level, outcome, message, details = {}) => log[level](`[${scope === 'story' ? 'Story AI' : 'AI'}] ${message}`, JSON.stringify({ event: 'ai_generation', scope, requestId, outcome, durationMs: Date.now() - started, ...details }));
  const candidates = providers(geminiModels); const failedProviders = new Set();
  if (!candidates.length) { emit('info', 'unconfigured', 'AI is disabled or no provider is configured.'); return null; }
  const system = [systemPrompt, schemaHint ? `Return ONLY valid JSON with this shape: ${schemaHint}` : 'Return ONLY a valid JSON object.'].filter(Boolean).join('\n\n');
  const user = String(userPrompt || '');
  // Reject oversize requests; truncating serialized facts can change their meaning.
  if (user.length > 28000 || system.length > 6000) { emit('warn', 'input_too_large', 'Input exceeds the generation budget; AI skipped.'); return null; }
  for (let index = 0; index < candidates.length; index++) {
    const provider = candidates[index]; const key = healthKey(provider, scope);
    const detail = { provider: provider.name, model: provider.model, attempt: index + 1 };
    if (failedProviders.has(provider.name) || (cooldowns.get(key) || 0) > Date.now()) { emit('info', 'cooldown_skipped', 'Provider attempt skipped after an earlier failure or cooldown.', detail); continue; }
    if (circuit) {
      try { if (await circuit.blocked(key)) { emit('info', 'cooldown_skipped', 'Provider attempt skipped by shared cooldown.', detail); continue; } }
      catch { emit('warn', 'storage_failure', 'Provider health storage is unavailable; AI stopped.', detail); return null; }
    }
    try {
      const remaining = deadline - Date.now(); if (remaining < 250) { emit('warn', 'deadline_exhausted', 'No time remains for another provider attempt.'); break; }
      // Story gives its primary model time to finish while retaining a fallback window.
      const laterAttempts = candidates.length - index - 1;
      const reservedMs = Math.min(laterAttempts * 3000, remaining * 0.35);
      const attemptMs = attemptTimeoutsMs?.[provider.name]
        ? Math.min(attemptTimeoutsMs[provider.name], remaining - reservedMs)
        : Math.min(7000, remaining / (candidates.length - index));
      emit('info', 'attempt_started', 'Provider attempt started.', { ...detail, timeoutMs: Math.floor(attemptMs) });
      const raw = await call(provider, system, user, temperature, Math.max(100, Math.min(2400, maxOutputTokens)), attemptMs, onUsage, scope === 'story');
      if (typeof raw !== 'string' || !raw.trim() || raw.length > 16000) throw new Error('invalid_response');
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || (validate && !validate(parsed))) throw new Error('invalid_response');
      emit('info', 'success', 'Provider returned a valid response.', detail);
      return parsed;
    } catch (error) {
      // Invalid output can depend on one student's input; it must not disable
      // this model for everyone else. Try the next candidate within the deadline.
      if (error instanceof SyntaxError || ['invalid_response', 'response_too_large'].includes(error.message)) {
        emit('warn', 'invalid_response', 'Provider output failed validation; trying the next eligible model.', detail);
        continue;
      }
      if ([401, 403, 429].includes(error.status)) failedProviders.add(provider.name);
      const retryAt = Date.now() + (error.status === 429 ? error.retryMs : [401, 403].includes(error.status) ? 300000 : 15000);
      cooldowns.set(key, retryAt);
      // Do not log provider response bodies, prompts, keys, or student content.
      const reason = error.message === 'deadline_exceeded' || error.name === 'AbortError' ? 'timeout' : error.status ? `http_${error.status}` : 'network_failure';
      emit('warn', reason, 'Provider attempt failed; trying the next eligible provider.', { ...detail, retryAfterSeconds: Math.ceil((retryAt - Date.now()) / 1000) });
      const affected = [401, 403, 429].includes(error.status)
        ? candidates.filter(p => p.name === provider.name && p.key === provider.key).map(p => healthKey(p, scope)) : [key];
      for (const affectedKey of affected) {
        cooldowns.set(affectedKey, retryAt);
        if (circuit) { try { await circuit.block(affectedKey, retryAt); } catch { emit('warn', 'storage_failure', 'Provider cooldown could not be saved; AI stopped.', detail); return null; } }
      }
    }
  }
  emit('warn', 'exhausted', 'No AI response available; returning control to the profile fallback.');
  return null;
}
module.exports = { generateJson, isConfigured: () => providers().length > 0 };
