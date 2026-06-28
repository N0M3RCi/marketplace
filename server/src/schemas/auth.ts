import { z } from 'zod';

export const register = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  username: z.string().min(2, 'Username must be at least 2 characters').max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

export const login = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfile = z.object({
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().max(500).optional(),
});

export const changePassword = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});