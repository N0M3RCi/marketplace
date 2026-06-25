import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/conversations
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        b.id as b_id, b.username as b_username, b.avatar_url as b_avatar,
        s.id as s_id, s.username as s_username, s.avatar_url as s_avatar
      FROM conversations c
      LEFT JOIN user_profiles b ON c.buyer_id = b.id
      LEFT JOIN user_profiles s ON c.seller_id = s.id
      WHERE c.buyer_id = $1 OR c.seller_id = $1
      ORDER BY c.updated_at DESC`, [req.userId]);
    res.json(result.rows.map((c: any) => {
      const isBuyer = c.buyer_id === req.userId;
      const other = isBuyer ? { id: c.s_id, name: c.s_username, avatar: c.s_avatar } : { id: c.b_id, name: c.b_username, avatar: c.b_avatar };
      const unread = isBuyer ? (c.buyer_unread || 0) : (c.seller_unread || 0);
      return {
        id: c.id, participants: [c.buyer_id, c.seller_id], participantNames: [c.b_username || '', c.s_username || ''],
        listingId: c.listing_id, listingTitle: c.listing_title, lastMessage: c.last_message,
        lastMessageAt: c.last_message_at, unreadCount: unread, otherUser: other,
        buyerId: c.buyer_id, sellerId: c.seller_id,
      };
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations (get-or-create)
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { listingId, listingTitle, sellerId } = req.body;
    if (!listingId || !sellerId) {
      res.status(400).json({ error: 'listingId and sellerId are required' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    // Use the authenticated user as the buyer — ignore any buyerId from the body
    const buyerId = req.userId;
    // Check existing
    const existing = await pool.query(
      'SELECT id FROM conversations WHERE listing_id = $1 AND buyer_id = $2 AND seller_id = $3',
      [listingId, buyerId, sellerId]);
    if (existing.rows.length > 0) { res.json({ id: existing.rows[0].id }); return; }
    const id = uuid();
    await pool.query(
      'INSERT INTO conversations (id, listing_id, listing_title, buyer_id, seller_id, last_message_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
      [id, listingId, listingTitle, buyerId, sellerId]);
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/conversations/:id/read
router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    const { isBuyer } = req.body;
    await pool.query('UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2', [req.params.id, req.userId]);
    const field = isBuyer ? 'buyer_unread' : 'seller_unread';
    await pool.query(`UPDATE conversations SET ${field} = 0 WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;