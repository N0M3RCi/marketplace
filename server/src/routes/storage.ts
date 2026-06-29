import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sanitizeText } from '../middleware/sanitizer.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.zip'];

// Public file retrieval (no auth required for viewing shared files/images in chat)
export const fileRouter = Router();

fileRouter.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM uploaded_files WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'File not found' }); return; }
    const f = result.rows[0];

    // Serve from disk if file_path exists, otherwise fall back to base64
    if (f.file_path && fs.existsSync(f.file_path)) {
      res.setHeader('Content-Type', f.file_type);
      res.sendFile(f.file_path);
    } else if (f.file_data) {
      const base64 = f.file_data;
      const matches = base64.match(/^data:(.*?);base64,(.*)$/);
      if (matches) {
        res.setHeader('Content-Type', matches[1]);
        res.send(Buffer.from(matches[2], 'base64'));
      } else {
        res.setHeader('Content-Type', f.file_type);
        res.send(Buffer.from(base64, 'base64'));
      }
    } else {
      res.status(404).json({ error: 'File data not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auth-protected routes
const router = Router();

// POST /api/storage/upload - stores file on disk
router.post('/upload', uploadLimiter, async (req: AuthRequest, res) => {
  try {
    const { fileName, fileType, fileSize, fileData } = req.body;
    if (!fileData) { res.status(400).json({ error: 'No file data provided' }); return; }

    // Validate file size
    const size = Number(fileSize) || 0;
    if (size > MAX_FILE_SIZE) {
      res.status(400).json({ error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024} MB` });
      return;
    }

    // Validate file type
    const safeName = sanitizeText(fileName || 'unnamed', 255);
    if (!ALLOWED_TYPES.includes(fileType) &&
        !ALLOWED_EXTENSIONS.some(ext => safeName.toLowerCase().endsWith(ext))) {
      res.status(400).json({ error: `File type "${fileType}" is not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}` });
      return;
    }

    const id = uuid();

    // Write file to disk
    const ext = path.extname(safeName) || '.bin';
    const diskFileName = `${id}${ext}`;
    const filePath = path.join(UPLOADS_DIR, diskFileName);

    // Decode base64 to buffer and write to disk
    const matches = fileData.match(/^data:(.*?);base64,(.*)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(fileData, 'base64');
    fs.writeFileSync(filePath, buffer);

    // Store file_path in DB instead of base64 data
    const placeholder = ''; // empty string for file_data since we store on disk
    await pool.query(
      'INSERT INTO uploaded_files (id, file_name, file_type, file_size, file_data, file_path, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, safeName, fileType || 'application/octet-stream', size, placeholder, filePath, req.userId]);
    res.json({ id, url: `/api/storage/file/${id}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
