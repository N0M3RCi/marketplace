import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/profile — returns the authenticated user's complete profile
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, role, avatar_url, is_verified, is_active, status,
              phone, rating, total_transactions, created_at, updated_at
       FROM user_profiles WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      avatar: u.avatar_url,
      avatar_url: u.avatar_url,
      isVerified: u.is_verified,
      isActive: u.is_active,
      status: u.status,
      phone: u.phone || '',
      rating: Number(u.rating),
      totalTransactions: u.total_transactions,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile — update the authenticated user's profile
router.put('/', async (req: AuthRequest, res) => {
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
    await pool.query(`UPDATE user_profiles SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;