import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sendEscrowNotification } from '../services/email.js';

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
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
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

// POST /api/notifications
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { user_id, type, title, message, case_id } = req.body;
    // Only admins can create notifications for other users; regular users can only create for themselves
    if (req.userRole !== 'admin' && user_id !== req.userId) {
      res.status(403).json({ error: 'You can only create notifications for yourself' });
      return;
    }
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, case_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, user_id, type, title, message, case_id || null]);

    // Send email notification if this is an escrow-related notification
    if (case_id && type) {
      try {
        const userResult = await pool.query(
          'SELECT email, username FROM user_profiles WHERE id = $1', [user_id]);
        if (userResult.rows.length > 0) {
          const { email, username } = userResult.rows[0];
          // Fire and forget — don't block the response
          sendEscrowNotification(email, username, case_id, type, `${title}${message ? ': ' + message : ''}`).catch(() => {});
        }
      } catch {
        // Email delivery failure should not break notification creation
      }
    }

    res.status(201).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;