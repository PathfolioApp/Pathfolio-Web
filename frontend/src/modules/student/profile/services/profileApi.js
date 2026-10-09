import { apiUrl, apiHeaders } from '../../../../app/services/apiClient.js';

async function request(path, options = {}) { const res = await fetch(apiUrl(path), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.message || 'Unable to save your changes.'); return data; }
export const profileApi = {
  get: () => request('/api/profile'),
  update: (section, data) => request(`/api/profile/${section}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addAchievement: data => request('/api/profile/achievements', { method: 'POST', body: JSON.stringify(data) }),
  editAchievement: (id,data) => request(`/api/profile/achievements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAchievement: id => request(`/api/profile/achievements/${id}`, { method: 'DELETE' }),
  addInternship: data => request('/api/profile/internships', { method: 'POST', body: JSON.stringify(data) }),
  editInternship: (id, data) => request(`/api/profile/internships/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInternship: id => request(`/api/profile/internships/${id}`, { method: 'DELETE' }),
  deleteInternshipCertificate: id => request(`/api/profile/internships/${id}/certificate`, { method: 'DELETE' }),
  addProject: data => request('/api/profile/projects', { method: 'POST', body: JSON.stringify(data) }),
  editProject: (id, data) => request(`/api/profile/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: id => request(`/api/profile/projects/${id}`, { method: 'DELETE' }),
  deleteProjectDocument: id => request(`/api/profile/projects/${id}/document`, { method: 'DELETE' }),
  settings: data => request('/api/profile/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  password: data => request('/api/settings/security/password', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadSignature: (params = {}) => request('/api/profile/uploads/signature', { method: 'POST', body: JSON.stringify(params) }),
  setAvatar: avatarUrl => request('/api/profile/avatar', { method: 'POST', body: JSON.stringify({ avatarUrl }) }),
  deleteAccount: () => request('/api/profile/account', { method: 'DELETE' }),
  deleteAcademicDocument: (docType, params = {}) => {
    const qs = new URLSearchParams();
    if (params.semester) qs.set('semester', params.semester);
    if (params.semesterId) qs.set('semesterId', params.semesterId);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/profile/academic/documents/${docType}${query}`, { method: 'DELETE' });
  },
  saveSemester: data => request('/api/profile/academic/semesters', { method: 'POST', body: JSON.stringify(data) }),
  deleteSemester: semesterId => request(`/api/profile/academic/semesters/${semesterId}`, { method: 'DELETE' }),
};

export async function uploadAcademicDocument(file, type, semester) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (semester) formData.append('semester', semester);

  const res = await fetch(apiUrl('/api/profile/academic/documents/upload'), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to upload document.');
  return data;
}

export async function uploadAvatarImage(file) {
  const signed = await profileApi.uploadSignature();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', signed.timestamp);
  formData.append('folder', signed.folder);
  formData.append('signature', signed.signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Unable to upload the image. Try a smaller file.');
  return data.secure_url;
}

export async function uploadCompanyLogo(file) {
  const signed = await profileApi.uploadSignature({ folder: 'internships' });
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', signed.timestamp);
  formData.append('folder', signed.folder);
  formData.append('signature', signed.signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Unable to upload company logo. Try a smaller image.');
  return data.secure_url;
}

export async function uploadInternshipCertificate(internshipId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(apiUrl(`/api/profile/internships/${internshipId}/certificate`), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to upload internship certificate.');
  return data;
}

export async function uploadProjectThumbnail(file) {
  const signed = await profileApi.uploadSignature({ folder: 'projects' });
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', signed.timestamp);
  formData.append('folder', signed.folder);
  formData.append('signature', signed.signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Unable to upload project thumbnail. Try a smaller image.');
  return data.secure_url;
}

export async function uploadProjectDocument(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(apiUrl(`/api/profile/projects/${projectId}/document`), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders(),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to upload project document.');
  return data;
}

