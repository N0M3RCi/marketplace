import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
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
const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
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