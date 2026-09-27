async function request(path, options = {}) { const res = await fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.message || 'Unable to save your changes.'); return data; }
export const profileApi = { get: () => request('/api/profile'), update: (section, data) => request(`/api/profile/${section}`, { method: 'PATCH', body: JSON.stringify(data) }), addAchievement: data => request('/api/profile/achievements', { method: 'POST', body: JSON.stringify(data) }), editAchievement: (id,data) => request(`/api/profile/achievements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }), deleteAchievement: id => request(`/api/profile/achievements/${id}`, { method: 'DELETE' }), settings: data => request('/api/profile/settings', { method: 'PATCH', body: JSON.stringify(data) }), password: data => request('/api/settings/security/password', { method: 'PATCH', body: JSON.stringify(data) }), uploadSignature: () => request('/api/profile/uploads/signature', { method: 'POST' }), setAvatar: avatarUrl => request('/api/profile/avatar', { method: 'POST', body: JSON.stringify({ avatarUrl }) }), deleteAccount: () => request('/api/profile/account', { method: 'DELETE' }) };

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
