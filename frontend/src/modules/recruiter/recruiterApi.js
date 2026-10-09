import { apiUrl, apiHeaders } from '../../app/services/apiClient.js';

async function request(path, options = {}) {
  const response = await fetch(apiUrl(`/api/recruiter${path}`), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || 'Unable to complete this recruiter action.');
  return data;
}

export const recruiterApi = {
  myJobs: () => request('/jobs'),
  overview: () => request('/overview'),
  companies: () => request('/companies'),
  createJob: data => request('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id, data) => request(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  // Recruiters submit jobs for admin approval, publishing is admin-only.
  submitJob: id => request(`/jobs/${id}/submit`, { method: 'POST' }),
  jobApplications: id => request(`/jobs/${id}/applications`),
  // Shared candidates: only students explicitly shared by the placement team.
  sharedCandidates: () => request('/shared-candidates'),
  sharedCandidate: shareId => request(`/shared-candidates/${shareId}`),
  recordCandidateFeedback: (shareId, body) => request(`/shared-candidates/${shareId}/feedback`, { method: 'POST', body: JSON.stringify(body) })
};