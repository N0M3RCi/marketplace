import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows.map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug, icon: c.icon || 'Tag',
      listingCount: c.listing_count || 0, color: c.color || 'text-gray-600',
      parentId: c.parent_id || null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;