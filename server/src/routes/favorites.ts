import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/favorites/toggle
router.post('/toggle', async (req: AuthRequest, res) => {
  try {
    const { listingId } = req.body;
    const existing = await pool.query('SELECT id FROM favorites WHERE user_id = $1 AND listing_id = $2', [req.userId, listingId]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2', [req.userId, listingId]);
      res.json({ favorited: false });
    } else {
      await pool.query('INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)', [req.userId, listingId]);
      res.json({ favorited: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/favorites
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT listing_id FROM favorites WHERE user_id = $1', [req.userId]);
    res.json(result.rows.map((f: any) => f.listing_id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;