import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/authApi';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null); const [loading, setLoading] = useState(true);
  const refresh = async () => { try { const data = await authApi.me(); setStudent(data.student); } catch { setStudent(null); } finally { setLoading(false); } };
  useEffect(() => { refresh(); }, []);
  const login = async (email, password) => { const data = await authApi.login(email, password); setStudent(data.student); return data.student; };
  const logout = async () => { await authApi.logout(); setStudent(null); };
  return <AuthContext.Provider value={{ student, loading, login, logout, refresh, authenticated: Boolean(student), isAdmin: Boolean(student?.isAdmin) }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
