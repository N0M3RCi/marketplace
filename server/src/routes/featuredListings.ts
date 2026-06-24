import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT fl.sort_order,
        l.id, l.title, l.description, l.price, l.currency, l.condition, l.location,
        l.images, l.created_at,
        c.name as category_name, c.id as category_id,
        up.username as seller_name, up.rating as seller_rating
      FROM featured_listings fl
      JOIN listings l ON fl.listing_id = l.id
      LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN user_profiles up ON l.seller_id = up.id
      WHERE l.status = 'active'
      ORDER BY fl.sort_order ASC, fl.created_at DESC
      LIMIT 20`);
    res.json(result.rows.map((l: any) => ({
      id: l.id, title: l.title, description: l.description || '',
      price: Number(l.price), currency: l.currency || 'USD',
      condition: l.condition, location: l.location,
      images: l.images || [], categoryName: l.category_name || 'Uncategorized',
      categoryId: l.category_id, sellerName: l.seller_name || 'Unknown',
      sellerId: l.seller_id, sellerRating: Number(l.seller_rating || 5.0),
      status: l.status || 'active', viewCount: Number(l.view_count || 0),
      createdAt: l.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;