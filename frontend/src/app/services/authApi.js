async function request(path, options = {}) {
  const res = await fetch(`/api/auth${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}
export const authApi = { me: () => request('/me'), login: (email, password) => request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }), logout: () => request('/logout', { method: 'POST' }), forgotPassword: email => request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }) };
