// Recruiter-side Recruitment Intelligence API (company response & candidates).
import { apiUrl, apiHeaders } from '../../app/services/apiClient.js';

async function request(path, options = {}) {
  const response = await fetch(apiUrl(`/api/recruiter/recruitment${path}`), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || 'Unable to complete this action.');
  return data;
}

export const recruiterRecruitmentApi = {
  engagements: () => request('/engagements'),
  engagement: id => request(`/engagements/${id}`),
  respond: (id, body) => request(`/engagements/${id}/respond`, { method: 'POST', body: JSON.stringify(body) }),
  postMessage: (id, body) => request(`/engagements/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  communicationSummary: id => request(`/engagements/${id}/summary`),
  candidates: () => request('/candidates'),
  sharedCandidate: shareId => request(`/shared-candidates/${shareId}`),
  recordFeedback: (shareId, body) => request(`/shared-candidates/${shareId}/feedback`, { method: 'POST', body: JSON.stringify(body) }),
  selectResume: (shareId, resumeId) => request(`/shares/${shareId}/select-resume`, { method: 'POST', body: JSON.stringify({ resumeId }) })
};
