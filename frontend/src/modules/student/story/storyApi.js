import { apiUrl, apiHeaders } from '../../../app/services/apiClient';

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new window.DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
export async function storySummary({ generate = false, regenerate = false, signal }) {
  let method = generate ? 'POST' : 'GET';
  for (;;) {
    const response = await fetch(apiUrl('/api/story/me/summary'), {
      method, signal, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json' }),
      ...(method === 'POST' ? { body: JSON.stringify({ regenerate }) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const retry = Number(data.retryAfter);
      const minutes = Math.ceil(retry / 60);
      throw new Error((data.message || 'Your story is briefly unavailable. Please try again.') + (retry > 0 && retry < 3600 ? ` Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` : ''));
    }
    if (!data.pending) {
      if (!Object.hasOwn(data, 'summary')) throw new Error('Your story could not be loaded. Please try again shortly.');
      return data;
    }
    // Other tabs/instances join an existing generation without starting another.
    await pause(Math.min(5000, Math.max(1000, Number(data.retryAfter || 2) * 1000)), signal);
    method = 'GET';
  }
}
