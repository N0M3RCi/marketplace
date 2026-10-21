import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/reviews — returns reviews, optionally filtered by seller/user ID
router.get('/', async (req: AuthRequest, res) => {
  try {
    // Support various query param patterns:
    // - eq_seller_id=xxx  (from supabase .eq('seller_id', userId))
    // - seller_id=xxx     (direct query param)
    // If no filter, return reviews for the authenticated user
    const sellerId = (req.query as any).eq_seller_id || (req.query as any).seller_id || req.userId;

    const result = await pool.query(`
      SELECT r.*, up.username as reviewer_name
      FROM reviews r
      LEFT JOIN user_profiles up ON r.reviewer_id = up.id
      WHERE r.seller_id = $1
      ORDER BY r.created_at DESC
    `, [sellerId]);

    res.json(result.rows.map((r: any) => ({
      id: r.id,
      sellerId: r.seller_id,
      reviewerId: r.reviewer_id,
      reviewerName: r.reviewer_name || 'Anonymous',
      rating: r.rating,
      comment: r.comment,
      role: r.role,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    console.error('Reviews GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { sellerId, rating, comment, role } = req.body;
    if (!sellerId || !rating) {
      res.status(400).json({ error: 'sellerId and rating required' });
      return;
    }
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    await pool.query(
      `INSERT INTO reviews (id, seller_id, reviewer_id, rating, comment, role)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, sellerId, req.userId, Math.min(Math.max(1, rating), 5), comment || null, role || 'buyer']
    );
    res.status(201).json({ id, ok: true });
  } catch (err: any) {
    console.error('Reviews POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;