import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/seller-requests — check the current user's seller request status
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      "SELECT id, status, reason, admin_notes, created_at FROM seller_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.userId]
    );
    if (result.rows.length === 0) {
      res.json([]);
      return;
    }
    res.json(result.rows.map((r: any) => ({
      id: r.id, user_id: req.userId, status: r.status,
      reason: r.reason, admin_notes: r.admin_notes, created_at: r.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seller-requests — submit a new seller request
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    // Check if already has a pending request
    const existing = await pool.query(
      "SELECT id FROM seller_requests WHERE user_id = $1 AND status = 'pending'",
      [req.userId]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'You already have a pending seller request' });
      return;
    }
    const id = uuid();
    await pool.query(
      'INSERT INTO seller_requests (id, user_id, reason, status) VALUES ($1,$2,$3,$4)',
      [id, req.userId, reason || null, 'pending']
    );
    res.status(201).json({ id, status: 'pending' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;