import { apiUrl, apiHeaders } from '../../../../app/services/apiClient.js';

const API_BASE_URL = '/api/onboarding';
async function request(url, options) {
  const res = await fetch(apiUrl(url), { ...options, credentials: 'include', headers: apiHeaders({ 'Content-Type': 'application/json', ...(options?.headers || {}) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) throw new Error(data.message || 'Unable to reach PathfolioApp.');
  return data;
}
export const onboardingApi = {
  checkEmail: email => request(`${API_BASE_URL}/check-email`, { method: 'POST', body: JSON.stringify({ email }) }),
  verifyRollNumber: rollNumber => request(`${API_BASE_URL}/verify-roll-number`, { method: 'POST', body: JSON.stringify({ rollNumber }) }),
  register: onboardingData => request(`${API_BASE_URL}/register`, { method: 'POST', body: JSON.stringify(onboardingData) }),
  verifyEmail: token => request(`${API_BASE_URL}/verify-email`, { method: 'POST', body: JSON.stringify({ token }) })
};
