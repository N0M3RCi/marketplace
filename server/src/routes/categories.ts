import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const homepage = req.query.homepage === 'true';
    let sql = 'SELECT * FROM categories';
    const params: any[] = [];
    if (homepage) {
      sql += ' WHERE homepage_featured = true';
    }
    sql += ' ORDER BY name';
    const result = await pool.query(sql, params);
    res.json(result.rows.map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug, icon: c.icon || 'Tag',
      listingCount: c.listing_count || 0, color: c.color || 'text-gray-600',
      parentId: c.parent_id || null, homepageFeatured: c.homepage_featured || false,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;