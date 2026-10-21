import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import pool from '../db.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    const generated = crypto.randomBytes(32).toString('hex');
    console.warn(
      'WARNING: JWT_SECRET environment variable is not set. ' +
      'Using a randomly generated secret for this session. ' +
      'ALL EXISTING TOKENS WILL BE INVALIDATED on restart. ' +
      'Set JWT_SECRET in your environment (e.g. openssl rand -hex 32).'
    );
    return generated;
  }
  return secret;
}
export const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    const result = await pool.query(
      'SELECT role, is_active FROM user_profiles WHERE id = $1',
      [decoded.userId]
    );
    const row = result.rows[0];
    if (!row || row.is_active === false) {
      res.status(401).json({ error: 'Account is not active' });
      return;
    }
    req.userId = decoded.userId;
    req.userRole = row.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}