// Recruitment Intelligence API (admin/TPO side).
import { apiUrl, apiHeaders } from '../../app/services/apiClient.js';

async function request(path, options = {}) {
  const response = await fetch(apiUrl(`/api/admin/recruitment${path}`), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || 'Unable to complete this recruitment action.');
  return data;
}

export const recruitmentApi = {
  // Planning & recommendations
  recommendations: refresh => request(`/recommendations${refresh ? '?refresh=true' : ''}`),
  refreshRecommendations: () => request('/recommendations/refresh', { method: 'POST' }),
  decideRecommendation: (id, decision, reason = '') => request(`/recommendations/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) }),

  // Settings (resume policy & access defaults)
  settings: () => request('/settings'),
  updateSettings: data => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Engagements (drives)
  engagements: () => request('/engagements'),
  engagement: id => request(`/engagements/${id}`),
  previewProposal: data => request('/engagements/preview-proposal', { method: 'POST', body: JSON.stringify(data) }),
  createProposal: data => request('/engagements', { method: 'POST', body: JSON.stringify(data) }),
  updateEngagement: (id, data) => request(`/engagements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  sendProposal: id => request(`/engagements/${id}/send`, { method: 'POST' }),
  setEngagementStatus: (id, body) => request(`/engagements/${id}/status`, { method: 'POST', body: JSON.stringify(body) }),
  cancelEngagement: id => request(`/engagements/${id}`, { method: 'DELETE' }),

  // Communication
  messages: id => request(`/engagements/${id}/messages`),
  postMessage: (id, body) => request(`/engagements/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  communicationSummary: id => request(`/engagements/${id}/summary`),

  // Roles, matching, resumes, briefs
  analyzeRole: id => request(`/engagements/${id}/analyze-role`, { method: 'POST' }),
  matches: (id, limit = 50) => request(`/engagements/${id}/matches?limit=${limit}`),
  resumeRecommendation: (id, studentId) => request(`/engagements/${id}/resume-recommendation/${studentId}`),
  candidateBrief: (id, studentId, resumeId) => request(`/engagements/${id}/brief/${studentId}${resumeId ? `?resumeId=${resumeId}` : ''}`),

  // Candidate sharing
  shares: engagementId => request(`/shares${engagementId ? `?engagementId=${engagementId}` : ''}`),
  shareCandidate: data => request('/shares', { method: 'POST', body: JSON.stringify(data) }),
  approveShareResume: (id, resumeId) => request(`/shares/${id}/approve-resume`, { method: 'POST', body: JSON.stringify({ resumeId }) }),
  revokeShare: (id, reason = '') => request(`/shares/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  // Bulk on-the-fly resume tailoring for a JD
  tailorBulk: data => request('/tailor-bulk', { method: 'POST', body: JSON.stringify(data) }),

  // Pipeline & dashboard
  dashboard: () => request('/dashboard'),
  pipeline: () => request('/pipeline')
};
