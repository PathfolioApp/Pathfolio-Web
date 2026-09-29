async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'An error occurred.');
  return data;
}

export const resumeApi = {
  list: () => request('/api/resumes'),
  updateTags: (id, tags) =>
    request(`/api/resumes/${id}/tags`, { method: 'PATCH', body: JSON.stringify({ tags }) }),
  rename: (id, filename) =>
    request(`/api/resumes/${id}/filename`, { method: 'PATCH', body: JSON.stringify({ filename }) }),
  setDefault: (id) =>
    request(`/api/resumes/${id}/default`, { method: 'PUT' }),
  remove: (id) =>
    request(`/api/resumes/${id}`, { method: 'DELETE' }),
};

export async function uploadResume(file, tags = []) {
  const formData = new FormData();
  formData.append('file', file);
  if (tags && tags.length > 0) {
    formData.append('tags', JSON.stringify(tags));
  }

  const res = await fetch('/api/resumes/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to upload resume.');
  return data;
}
