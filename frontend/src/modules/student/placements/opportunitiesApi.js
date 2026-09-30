export const opportunitiesApi = {
  getOpportunities: async () => {
    const res = await fetch('/api/opportunities', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load opportunities');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  },
  getEligibility: async (jobId) => {
    const res = await fetch(`/api/opportunities/${jobId}/eligibility`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load eligibility status');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  },
  apply: async (jobId, payload) => {
    const body = typeof payload === 'object' && payload !== null && ('resumeId' in payload || 'answers' in payload)
      ? payload
      : { answers: payload };
    const res = await fetch(`/api/opportunities/${jobId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
