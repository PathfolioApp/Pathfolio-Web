async function request(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Unable to complete this admin action.');
  return data;
}

export const adminApi = {
  companies: () => request('/companies'),
  importCompanies: rows => request('/companies/import', { method: 'POST', body: JSON.stringify({ rows }) }),
  createCompany: data => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id, data) => request(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveCompany: id => request(`/companies/${id}`, { method: 'DELETE' }),
  jobPosts: status => request(`/job-posts${status ? `?status=${status}` : ''}`),
  createJobPost: data => request('/job-posts', { method: 'POST', body: JSON.stringify(data) }),
  updateJobPost: (id, data) => request(`/job-posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  publishJobPost: id => request(`/job-posts/${id}/publish`, { method: 'POST' }),
  unpublishJobPost: id => request(`/job-posts/${id}/unpublish`, { method: 'POST' }),
  uploadSignature: () => request('/uploads/signature', { method: 'POST' }),
  applications: jobPostId => request(`/applications${jobPostId ? `?jobPostId=${jobPostId}` : ''}`),
  updateApplication: (id, data) => request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
};