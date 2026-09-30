async function request(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Unable to complete this admin action.');
  return data;
}

export const adminApi = {
  users: () => request('/users'),
  overview: () => request('/overview'),
  setUserBlocked: (id, blocked) => request(`/users/${id}/block`, { method: 'PATCH', body: JSON.stringify({ blocked }) }),
  deleteUser: id => request(`/users/${id}`, { method: 'DELETE' }),
  createUser: data => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  importUsers: rows => request('/users/import', { method: 'POST', body: JSON.stringify({ rows }) }),
  setUserRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  companies: () => request('/companies'),
  importCompanies: rows => request('/companies/import', { method: 'POST', body: JSON.stringify({ rows }) }),
  createCompany: data => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id, data) => request(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveCompany: id => request(`/companies/${id}`, { method: 'DELETE' }),
  jobPosts: status => request(`/job-posts${status ? `?status=${status}` : ''}`),
  jobPost: id => request(`/job-posts/${id}`),
  createJobPost: data => request('/job-posts', { method: 'POST', body: JSON.stringify(data) }),
  updateJobPost: (id, data) => request(`/job-posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  // Approval workflow: admin reviews pending jobs, then publishes them.
  reviewJobPost: (id, decision, note) => request(`/job-posts/${id}/review`, { method: 'POST', body: JSON.stringify({ decision, note }) }),
  publishJobPost: id => request(`/job-posts/${id}/publish`, { method: 'POST' }),
  unpublishJobPost: id => request(`/job-posts/${id}/unpublish`, { method: 'POST' }),
  reopenJobPost: id => request(`/job-posts/${id}/reopen`, { method: 'POST' }),
  // Admin-only student discovery & recruiter sharing.
  searchStudents: params => request(`/students?${new URLSearchParams(params).toString()}`),
  studentDetail: id => request(`/students/${id}`),
  recruiters: () => request('/recruiters'),
  shares: () => request('/shares'),
  createShare: data => request('/shares', { method: 'POST', body: JSON.stringify(data) }),
  logs: params => request(`/logs?${new URLSearchParams(Object.entries(params).filter(([, value]) => String(value).trim() !== '')).toString()}`),
  uploadSignature: () => request('/uploads/signature', { method: 'POST' }),
  analyzeJobDescription: data => request('/jd/analyze', { method: 'POST', body: JSON.stringify(data) }),
  applications: jobPostId => request(`/applications${jobPostId ? `?jobPostId=${jobPostId}` : ''}`),
  updateApplication: (id, data) => request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateApplicationsBulk: (ids, data) => request('/applications/bulk', { method: 'PATCH', body: JSON.stringify({ ids, ...data }) }),
  getPlacementPolicy: () => request('/placement-policy'),
  updatePlacementPolicy: data => request('/placement-policy', { method: 'PUT', body: JSON.stringify(data) })
};