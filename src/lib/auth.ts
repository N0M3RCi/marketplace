import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
}

// Base map from JWT only — role may be stale, use fetchUserWithRole for authoritative role
export function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username:
      user.user_metadata?.username ||
      user.user_metadata?.full_name ||
      user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url,
    role: user.user_metadata?.role || 'buyer',
  };
}

// Fetches the authoritative role from user_profiles table, then syncs it back to user_metadata
export async function fetchUserWithRole(user: User): Promise<AuthUser> {
  const base = mapSupabaseUser(user);
  const { data } = await supabase
    .from('user_profiles')
    .select('role, username, avatar_url')
    .eq('id', user.id)
    .single();

  if (!data) return base;

  const dbRole = data.role || base.role;
  // Sync role back into user_metadata so JWT stays fresh
  if (dbRole !== base.role) {
    await supabase.auth.updateUser({ data: { role: dbRole } });
  }

  return {
    ...base,
    role: dbRole,
    username: data.username || base.username,
    avatar: data.avatar_url || base.avatar,
  };
}

export async function sendOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyOtpAndSetPassword(
  email: string,
  token: string,
  password: string,
  username: string
) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;

  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password,
    data: { username, role: 'buyer' },
  });
  if (updateError) throw updateError;

  return updateData.user!;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
}
