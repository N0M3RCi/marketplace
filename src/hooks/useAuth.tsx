import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

const MAX_AUTH_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const retryCountRef = useRef(0);

  const logout = useCallback(async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const profile = await auth.me();
        if (!mounted) return;
        setUser({
          id: profile.id,
          email: profile.email,
          username: profile.username,
          avatar: profile.avatar,
          role: profile.role,
        });
        setLoading(false);
        retryCountRef.current = 0;
      } catch (err: any) {
        if (!mounted) return;

        const msg = err?.message || '';
        // 401 = token expired/invalid — legit logout
        // 404 = user deleted — legit logout
        if (msg.includes('401') || msg.includes('404') || msg.includes('No token')) {
          localStorage.removeItem('auth_token');
          setUser(null);
          setLoading(false);
          return;
        }

        // Transient error (503, 500, network timeout) — retry
        retryCountRef.current += 1;
        if (retryCountRef.current < MAX_AUTH_RETRIES) {
          retryTimer = setTimeout(() => {
            if (mounted) checkAuth();
          }, RETRY_DELAY_MS);
        } else {
          // Give up retrying — show logged-out state but KEEP the token
          // so the next full navigation can try again
          setUser(null);
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    setLoading(true);
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
      // Silent — don't log out on transient errors
      setUser(null);
      setLoading(false);
    }
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