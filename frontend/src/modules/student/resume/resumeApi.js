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
  categories: () => request('/api/resumes/categories'),
  createCategory: name => request('/api/resumes/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  renameCategory: (name, nextName) => request(`/api/resumes/categories/${encodeURIComponent(name)}`, { method: 'PATCH', body: JSON.stringify({ name: nextName }) }),
  deleteCategory: name => request(`/api/resumes/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  updateTags: (id, tags) =>
    request(`/api/resumes/${id}/tags`, { method: 'PATCH', body: JSON.stringify({ tags }) }),
  rename: (id, filename) =>
    request(`/api/resumes/${id}/filename`, { method: 'PATCH', body: JSON.stringify({ filename }) }),
  updateCategory: (id, category) =>
    request(`/api/resumes/${id}/category`, { method: 'PATCH', body: JSON.stringify({ category }) }),
  analyze: id => request(`/api/resumes/${id}/analyze`, { method: 'POST' }),
  updateExtracted: (id, extractedData) =>
    request(`/api/resumes/${id}/extracted`, { method: 'PATCH', body: JSON.stringify({ extractedData }) }),
  setDefault: (id) =>
    request(`/api/resumes/${id}/default`, { method: 'PUT' }),
  remove: (id) =>
    request(`/api/resumes/${id}`, { method: 'DELETE' }),
};

export async function uploadResume(file, tags = [], category = 'General') {
  const formData = new FormData();
  formData.append('file', file);
  if (tags && tags.length > 0) {
    formData.append('tags', JSON.stringify(tags));
  }
  formData.append('category', category);

  const res = await fetch('/api/resumes/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to upload resume.');
  return data;
}

export async function replaceResume(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/resumes/${id}/file`, { method: 'PUT', credentials: 'include', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to replace resume.');
  return data;
}
