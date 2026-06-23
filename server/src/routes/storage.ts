import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

// Public file retrieval (no auth required for viewing shared files/images in chat)
export const fileRouter = Router();

fileRouter.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM uploaded_files WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'File not found' }); return; }
    const f = result.rows[0];
    const base64 = f.file_data;
    const matches = base64.match(/^data:(.*?);base64,(.*)$/);
    if (matches) {
      res.setHeader('Content-Type', matches[1]);
      res.send(Buffer.from(matches[2], 'base64'));
    } else {
      res.setHeader('Content-Type', f.file_type);
      res.send(Buffer.from(base64, 'base64'));
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auth-protected routes
const router = Router();

// POST /api/storage/upload - stores file as base64 in the database
router.post('/upload', async (req: AuthRequest, res) => {
  try {
    const { fileName, fileType, fileSize, fileData } = req.body;
    if (!fileData) { res.status(400).json({ error: 'No file data provided' }); return; }
    const id = uuid();
    await pool.query(
      'INSERT INTO uploaded_files (id, file_name, file_type, file_size, file_data, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, fileName || 'unnamed', fileType || 'image/png', fileSize || 0, fileData, req.userId]);
    res.json({ id, url: `/api/storage/file/${id}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;