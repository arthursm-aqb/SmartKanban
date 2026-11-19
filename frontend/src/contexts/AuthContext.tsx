import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';
import { PublicUser } from '../types/kanban';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(res.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await apiFetch<{ user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', skipAutoRefresh: true });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return ctx;
}
