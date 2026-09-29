async function request(path, options = {}) {
  const response = await fetch(`/api/recruiter/jobs${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
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
  publishJob: id => request(`/jobs/${id}/publish`, { method: 'POST' }),
  unpublishJob: id => request(`/jobs/${id}/unpublish`, { method: 'POST' }),
  searchStudents: async ({ keywords = '', jobDescription = '' } = {}) => {
    const params = new URLSearchParams();
    if (keywords.trim()) params.set('keywords', keywords.trim());
    if (jobDescription.trim()) params.set('jobDescription', jobDescription.trim());
    const response = await fetch(`/api/recruiter/students?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to search student profiles.');
    return data.students;
  }
};