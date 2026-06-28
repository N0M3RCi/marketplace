import { auth } from './client';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
}

// Base map from API user response
export function mapSupabaseUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email || '',
    username: user.user_metadata?.username || user.username || user.email?.split('@')[0] || 'User',
    avatar: user.user_metadata?.avatar_url || user.avatar,
    role: user.user_metadata?.role || user.role || 'buyer',
  };
}

// Fetch user profile from our backend
export async function fetchUserWithRole(user: any): Promise<AuthUser> {
  try {
    const profile = await auth.me();
    return {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      avatar: profile.avatar,
      role: profile.role,
    };
  } catch {
    // Fallback to JWT data
    return mapSupabaseUser(user);
  }
}

export async function signInWithPassword(email: string, password: string) {
  const result = await auth.login(email, password);
  localStorage.setItem('auth_token', result.token);
  return { id: result.user.id, email: result.user.email, user_metadata: { username: result.user.username, role: result.user.role, avatar_url: result.user.avatar } };
}

export async function signOut() {
  localStorage.removeItem('auth_token');
}