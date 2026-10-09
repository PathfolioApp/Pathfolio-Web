import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../services/authApi';

// Session cache: /api/auth/me was previously re-fetched by every explicit
// refresh() call (profile saves, portal switches), producing bursts of
// identical requests in a single session. A short TTL keeps those cheap;
// login/logout always bypass it.
const ME_CACHE_TTL_MS = 60_000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const meCacheRef = useRef({ at: 0, promise: null });

  const refresh = async () => {
    const cache = meCacheRef.current;
    const now = Date.now();
    if (cache.promise && now - cache.at < ME_CACHE_TTL_MS) {
      const data = await cache.promise;
      setStudent(data.student);
      return data.student;
    }
    cache.at = now;
    cache.promise = authApi.me().catch(error => {
      cache.promise = null; // failed fetches must not poison the cache
      throw error;
    });
    try {
      const data = await cache.promise;
      setStudent(data.student);
      return data.student;
    } catch {
      setStudent(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    meCacheRef.current = { at: Date.now(), promise: Promise.resolve({ student: data.student }) };
    setStudent(data.student);
    return data.student;
  };

  const logout = async () => {
    await authApi.logout();
    meCacheRef.current = { at: 0, promise: null };
    setStudent(null);
  };

  return (
    <AuthContext.Provider value={{ student, loading, login, logout, refresh, authenticated: Boolean(student) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
