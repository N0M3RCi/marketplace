import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const homepage = req.query.homepage === 'true';
    let sql = 'SELECT c.*, (SELECT COUNT(*) FROM listings l WHERE l.status = \'active\' AND (l.category_id = c.id OR l.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))) as effective_listing_count FROM categories c';
    const params: any[] = [];
    if (homepage) {
      sql += ' WHERE c.homepage_featured = true';
    }
    sql += ' ORDER BY c.name';
    const result = await pool.query(sql, params);
    res.json(result.rows.map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug, icon: c.icon || 'Tag',
      listingCount: parseInt(c.effective_listing_count || c.listing_count || 0), color: c.color || 'text-gray-600',
      parentId: c.parent_id || null, homepageFeatured: c.homepage_featured || false,
      imageUrl: c.image_url || null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;