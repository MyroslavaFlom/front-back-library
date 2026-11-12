import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi, setUnauthorizedHandler } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const me = useCallback(async () => {
    try {
      const current = await authApi.me();
      setUser(current);
      return current;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    me();
  }, [me]);

  // Будь-яка 401 з API (сесія закінчилась) → скинути користувача й перейти на /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, location]);

  const login = useCallback(async (credentials) => {
    const loggedIn = await authApi.login(credentials);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAdmin: user?.role === 'admin', me, login, logout }),
    [user, loading, me, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
