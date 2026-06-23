import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/client';
import { type AuthUser } from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await auth.me();
      setUser({
        id: profile.id,
        email: profile.email,
        username: profile.username,
        avatar: profile.avatar,
        role: profile.role,
      });
      setLoading(false);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('auth_token');

    if (token) {
      auth.me().then(profile => {
        if (mounted) {
          setUser({
            id: profile.id,
            email: profile.email,
            username: profile.username,
            avatar: profile.avatar,
            role: profile.role,
          });
          setLoading(false);
        }
      }).catch(() => {
        localStorage.removeItem('auth_token');
        if (mounted) setLoading(false);
      });
    } else {
      if (mounted) setLoading(false);
    }

    return () => { mounted = false; };
  }, [refreshKey]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}