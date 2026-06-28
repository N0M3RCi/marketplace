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
  const authGenerationRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const logout = useCallback(async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async (generation: number) => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const profile = await auth.me();
        if (!mounted || generation !== authGenerationRef.current) return;
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
        if (!mounted || generation !== authGenerationRef.current) return;

        const msg = err?.message || '';
        // [401] = token expired/invalid — legit logout
        // [404] = user deleted — legit logout
        if (msg.includes('[401]') || msg.includes('[404]') || msg.includes('No token')) {
          localStorage.removeItem('auth_token');
          setUser(null);
          setLoading(false);
          return;
        }

        // Transient error (503, 500, network timeout) — retry
        retryCountRef.current += 1;
        if (retryCountRef.current < MAX_AUTH_RETRIES) {
          retryTimerRef.current = setTimeout(() => {
            if (mounted) checkAuth(authGenerationRef.current);
          }, RETRY_DELAY_MS);
        } else {
          // Give up retrying — show logged-out state but KEEP the token
          // so the next full navigation can try again
          setUser(null);
          setLoading(false);
        }
      }
    };

    checkAuth(authGenerationRef.current);

    return () => {
      mounted = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    // Bump generation to invalidate any in-flight checkAuth retries
    authGenerationRef.current += 1;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const myGen = authGenerationRef.current;

    setLoading(true);
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await auth.me();
      if (myGen !== authGenerationRef.current) return; // stale, another refresh already happened
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