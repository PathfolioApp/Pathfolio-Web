import { apiUrl, apiHeaders } from '../../../app/services/apiClient.js';
import { readPdfResponse } from './pdfDownload.mjs';

async function request(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'An error occurred.');
  return data;
}

export const resumeApi = {
  downloadPdf: async path => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      return await readPdfResponse(await fetch(apiUrl(path), {
        credentials: 'include', headers: apiHeaders(), signal: controller.signal,
      }));
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('PDF download timed out. Please try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  },
  exportPdf: async ({ html, filename }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      const res = await fetch(apiUrl('/api/resumes/export-pdf'), {
        method: 'POST', credentials: 'include', signal: controller.signal,
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ html, filename })
      });
      return await readPdfResponse(res);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('PDF export timed out. Please try again or use Print.');
      throw error;
    } finally { clearTimeout(timeout); }
  },
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
  reparse: id => request(`/api/resumes/${id}/reparse`, { method: 'POST' }),
  createStudioResume: data =>
    request('/api/resumes/studio', { method: 'POST', body: JSON.stringify(data) }),
  tailor: ({ jobTitle, company, jobDescription }) =>
    request('/api/resumes/tailor', { method: 'POST', body: JSON.stringify({ jobTitle, company, jobDescription }) }),
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

  const res = await fetch(apiUrl('/api/resumes/upload'), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to upload resume.');
  return data;
}

export async function replaceResume(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(apiUrl(`/api/resumes/${id}/file`), { method: 'PUT', credentials: 'include', headers: apiHeaders(), body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to replace resume.');
  return data;
}
