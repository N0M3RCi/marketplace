import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sanitizeText } from '../middleware/sanitizer.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// Check that the authenticated user is a participant in the conversation
async function checkParticipant(req: AuthRequest, conversationId: string): Promise<boolean> {
  if (!conversationId || !req.userId) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) return false;
  try {
    const result = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [conversationId, req.userId]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

// GET /api/messages/:conversationId
router.get('/:conversationId', async (req: AuthRequest, res) => {
  try {
    if (!(await checkParticipant(req, req.params.conversationId))) {
      res.status(403).json({ error: 'Access denied — you are not a participant in this conversation' });
      return;
    }
    const result = await pool.query(`
      SELECT m.*, up.username as sender_name
      FROM messages m LEFT JOIN user_profiles up ON m.sender_id = up.id
      WHERE m.conversation_id = $1 ORDER BY m.created_at ASC`, [req.params.conversationId]);
    res.json(result.rows.map((m: any) => ({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      senderName: m.sender_name || 'Unknown', content: m.content,
      createdAt: m.created_at, isRead: m.is_read,
      imageUrl: m.image_url || null, fileUrl: m.file_url || null,
      fileName: m.file_name || null, fileSize: m.file_size || null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { conversationId, content, isBuyer, imageUrl, fileUrl, fileName, fileSize } = req.body;
    if (!conversationId || !content?.trim()) {
      res.status(400).json({ error: 'conversationId and content are required' });
      return;
    }
    if (!(await checkParticipant(req, conversationId))) {
      res.status(403).json({ error: 'Access denied — you are not a participant in this conversation' });
      return;
    }
    const safeContent = sanitizeText(content, 5000);
    if (!safeContent) { res.status(400).json({ error: 'Message content is required' }); return; }
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO messages (id, conversation_id, sender_id, content, image_url, file_url, file_name, file_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, conversationId, req.userId, safeContent,
       imageUrl || null, fileUrl || null, fileName || null, fileSize || null]);

    // Update conversation
    const unreadField = isBuyer ? 'seller_unread' : 'buyer_unread';
    await pool.query(
      `UPDATE conversations SET last_message = $1, last_message_at = NOW(), updated_at = NOW(), ${unreadField} = ${unreadField} + 1 WHERE id = $2`,
      [safeContent, conversationId]);

    const user = await pool.query('SELECT username FROM user_profiles WHERE id = $1', [req.userId]);
    const m = result.rows[0];
    res.status(201).json({
      id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
      senderName: user.rows[0]?.username || 'Unknown', content: m.content,
      createdAt: m.created_at, isRead: m.is_read,
      imageUrl: m.image_url || null, fileUrl: m.file_url || null,
      fileName: m.file_name || null, fileSize: m.file_size || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;