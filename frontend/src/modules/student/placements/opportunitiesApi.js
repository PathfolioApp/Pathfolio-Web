import { apiUrl, apiHeaders } from '../../../app/services/apiClient.js';

export const opportunitiesApi = {
  getMine: async () => {
    const res = await fetch(apiUrl('/api/opportunities/mine'), { credentials: 'include', headers: apiHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load your applications');
    return data;
  },
  getStats: async () => {
    const res = await fetch(apiUrl('/api/opportunities/stats'), { credentials: 'include', headers: apiHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load placement stats');
    return data;
  },
  getSavedSearches: async () => {
    const res = await fetch(apiUrl('/api/opportunities/saved-searches'), { credentials: 'include', headers: apiHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load saved searches');
    return data;
  },
  saveSearch: async (name, query) => {
    const res = await fetch(apiUrl('/api/opportunities/saved-searches'), { method: 'POST', credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name, query }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Unable to save this search');
    return data;
  },
  deleteSavedSearch: async (id) => {
    const res = await fetch(apiUrl(`/api/opportunities/saved-searches/${id}`), { method: 'DELETE', credentials: 'include', headers: apiHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Unable to delete this search');
    return data;
  },
  getOpportunities: async () => {
    const res = await fetch(apiUrl('/api/opportunities'), { credentials: 'include', headers: apiHeaders() });
    if (!res.ok) throw new Error('Failed to load opportunities');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  },
  getEligibility: async (jobId) => {
    const res = await fetch(apiUrl(`/api/opportunities/${jobId}/eligibility`), { credentials: 'include', headers: apiHeaders() });
    if (!res.ok) throw new Error('Failed to load eligibility status');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  },
  apply: async (jobId, payload) => {
    const body = typeof payload === 'object' && payload !== null && ('resumeId' in payload || 'answers' in payload)
      ? payload
      : { answers: payload };
    const res = await fetch(apiUrl(`/api/opportunities/${jobId}/applications`), {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      credentials: 'include'
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to submit application');
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  }
};
