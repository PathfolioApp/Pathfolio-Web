const API_BASE_URL = '/api/onboarding';
async function request(url, options) {
  const res = await fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to reach PathfolioApp.');
  return data;
}
export const onboardingApi = {
  checkUsername: username => request(`${API_BASE_URL}/check-username`, { method: 'POST', body: JSON.stringify({ username }) }),
  verifyRollNumber: rollNumber => request(`${API_BASE_URL}/verify-roll-number`, { method: 'POST', body: JSON.stringify({ rollNumber }) }),
  register: onboardingData => request(`${API_BASE_URL}/register`, { method: 'POST', body: JSON.stringify(onboardingData) })
};
