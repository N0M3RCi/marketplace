import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications
router.get('/', async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [req.userId, limit]);
    res.json(result.rows.map((n: any) => ({
      id: n.id, userId: n.user_id, type: n.type, title: n.title,
      message: n.message, caseId: n.case_id, isRead: n.is_read, createdAt: n.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;