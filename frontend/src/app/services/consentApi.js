import { apiUrl, apiHeaders } from '../../app/services/apiClient.js';

async function request(path, options = {}) {
  const response = await fetch(apiUrl(`/api/preference${path}`), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save your cookie preference.');
  return data;
}

export const consentApi = {
  set: choice => request('/', { method: 'POST', body: JSON.stringify({ choice }) }),
  get: () => request('/')
};
