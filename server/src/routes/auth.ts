import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import pool, { queryWithRetry } from '../db.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
      res.status(400).json({ error: 'Email, password, and username required' });
      return;
    }
    const existing = await queryWithRetry('SELECT id FROM user_profiles WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const hash = await bcryptjs.hash(password, 10);
    const id = uuid();
    await queryWithRetry(
      'INSERT INTO user_profiles (id, email, username, password_hash, role) VALUES ($1,$2,$3,$4,$5)',
      [id, email, username, hash, 'buyer']
    );
    // Create wallet
    try {
      await queryWithRetry('INSERT INTO wallets (user_id, balance, pending_balance, currency) VALUES ($1, 0, 0, $2)', [id, 'USD']);
    } catch (walletErr) {
      console.warn('Could not create wallet for new user:', walletErr);
    }
    const token = generateToken(id, 'buyer');
    res.status(201).json({ token, user: { id, email, username, role: 'buyer', avatar: null } });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed, please try again' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    // Use queryWithRetry for resilience against transient DB failures
    const result = await queryWithRetry(
      'SELECT id, email, username, password_hash, role, avatar_url FROM user_profiles WHERE email = $1 AND is_active = true',
      [email]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const user = result.rows[0];
    let valid = false;
    try {
      valid = await bcryptjs.compare(password, user.password_hash);
    } catch (bcErr) {
      console.error('bcryptjs compare error:', bcErr);
      res.status(500).json({ error: 'Authentication error, please try again' });
      return;
    }
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = generateToken(user.id, user.role);
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role, avatar: user.avatar_url } });
  } catch (err: any) {
    console.error('=== LOGIN ERROR ===');
    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Login failed, please try again. If the issue persists, check your connection.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await queryWithRetry(
      'SELECT id, email, username, role, avatar_url, is_verified, is_active, rating, total_transactions, phone, created_at FROM user_profiles WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const u = result.rows[0];
    res.json({ id: u.id, email: u.email, username: u.username, role: u.role, avatar: u.avatar_url, isVerified: u.is_verified, isActive: u.is_active, rating: Number(u.rating), totalTransactions: u.total_transactions, phone: u.phone, createdAt: u.created_at });
  } catch (err: any) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to load profile, please try again' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username, phone, avatar_url } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (username !== undefined) { updates.push(`username = $${idx++}`); values.push(username); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone); }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${idx++}`); values.push(avatar_url); }
    if (updates.length === 0) { res.json({ ok: true }); return; }
    updates.push(`updated_at = NOW()`);
    values.push(req.userId);
    await queryWithRetry(`UPDATE user_profiles SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query('SELECT password_hash FROM user_profiles WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    const valid = await bcryptjs.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }
    const hash = await bcryptjs.hash(newPassword, 10);
    await pool.query('UPDATE user_profiles SET password_hash = $1 WHERE id = $2', [hash, req.userId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;