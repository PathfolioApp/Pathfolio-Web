import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { authApi } from '../services/authApi';

// Initial session reads can share a short-lived request. Explicit refreshes
// (including those after profile saves) must fetch fresh student data.
const ME_CACHE_TTL_MS = 60_000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const meCacheRef = useRef({ at: 0, promise: null });

  const refresh = useCallback(async ({ force = true } = {}) => {
    const cache = meCacheRef.current;
    const now = Date.now();
    const useCached = !force && cache.promise && now - cache.at < ME_CACHE_TTL_MS;
    if (!useCached) {
      cache.at = now;
      cache.promise = authApi.me();
    }
    const pending = cache.promise;
    try {
      const data = await pending;
      setStudent(data.student);
      return data.student;
    } catch {
      if (cache.promise === pending) cache.promise = null;
      setStudent(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh({ force: false }); }, [refresh]);

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
