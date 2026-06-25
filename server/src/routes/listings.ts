import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sanitizeText, sanitizeDescription } from '../middleware/sanitizer.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/listings
router.get('/', async (req, res) => {
  try {
    const { categoryId, categoryIds, search, minPrice, maxPrice, sort, sellerId } = req.query;
    let sql = `SELECT l.*, c.name as category_name, up.username as seller_username, up.rating as seller_rating
      FROM listings l LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN user_profiles up ON l.seller_id = up.id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (!sellerId) { sql += ` AND l.status = 'active'`; }
    if (categoryIds) {
      // categoryIds is a JSON array string like ["id1","id2"]
      try {
        const ids = JSON.parse(categoryIds as string);
        if (Array.isArray(ids) && ids.length > 0) {
          const placeholders = ids.map(() => `$${idx++}`);
          sql += ` AND l.category_id IN (${placeholders.join(',')})`;
          params.push(...ids);
        }
      } catch {}
    } else if (categoryId) { sql += ` AND l.category_id = $${idx++}`; params.push(categoryId); }
    if (search) { sql += ` AND (LOWER(l.title) LIKE LOWER($${idx++}) OR LOWER(l.description) LIKE LOWER($${idx-1}))`; params.push(`%${search}%`); }
    if (minPrice) { sql += ` AND l.price >= $${idx++}`; params.push(minPrice); }
    if (maxPrice) { sql += ` AND l.price <= $${idx++}`; params.push(maxPrice); }
    if (sellerId) { sql += ` AND l.seller_id = $${idx++}`; params.push(sellerId); }
    if (sort === 'price-asc') sql += ' ORDER BY l.price ASC';
    else if (sort === 'price-desc') sql += ' ORDER BY l.price DESC';
    else if (sort === 'popular') sql += ' ORDER BY l.view_count DESC';
    else sql += ' ORDER BY l.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows.map((l: any) => ({
      id: l.id, title: l.title, description: l.description || '', price: Number(l.price),
      currency: l.currency || 'USD', categoryId: l.category_id, categoryName: l.category_name || '',
      sellerId: l.seller_id, sellerName: l.seller_username || 'Unknown', sellerRating: Number(l.seller_rating) || 5,
      images: l.images || [], condition: l.condition || 'good', location: l.location || '',
      status: l.status, createdAt: l.created_at, viewCount: l.view_count || 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, c.name as category_name, up.id as sp_id, up.username as sp_username, up.rating as sp_rating,
        up.avatar_url as sp_avatar, up.is_verified as sp_verified, up.total_transactions as sp_txns
      FROM listings l LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN user_profiles up ON l.seller_id = up.id WHERE l.id = $1`, [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Listing not found' }); return; }
    const l = result.rows[0];
    // Increment view count
    await pool.query('UPDATE listings SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1', [l.id]);
    res.json({
      id: l.id, title: l.title, description: l.description || '', price: Number(l.price),
      currency: l.currency || 'USD', categoryId: l.category_id, categoryName: l.category_name || '',
      sellerId: l.seller_id, sellerName: l.sp_username || 'Unknown', sellerRating: Number(l.sp_rating) || 5,
      images: l.images || [], condition: l.condition || 'good', location: l.location || '',
      status: l.status, createdAt: l.created_at, viewCount: (l.view_count || 0) + 1,
      sellerProfile: { id: l.sp_id, username: l.sp_username, rating: l.sp_rating, avatar_url: l.sp_avatar, is_verified: l.sp_verified, total_transactions: l.sp_txns },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/listings
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, description, price, currency, categoryId, images, condition, location, sellerId } = req.body;
    const id = uuid();
    // Sanitize user input
    const safeTitle = sanitizeText(title, 200);
    const safeDescription = sanitizeDescription(description || '', 50000);
    if (!safeTitle) { res.status(400).json({ error: 'Title is required' }); return; }
    // Admin can attribute listings to a specific user; non-admin always use own ID
    const effectiveSellerId = (req.userRole === 'admin' && sellerId) ? sellerId : req.userId;
    const result = await pool.query(`
      INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [
      id, safeTitle, safeDescription, price, currency || 'USD', categoryId, effectiveSellerId,
      images || [], condition || 'good', location || ''
    ]);
    const l = result.rows[0];
    res.status(201).json({
      id: l.id, title: l.title, description: l.description, price: Number(l.price),
      currency: l.currency, categoryId: l.category_id, sellerId: l.seller_id,
      images: l.images, condition: l.condition, location: l.location, status: l.status,
      createdAt: l.created_at, viewCount: 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/listings/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, description, price, currency, categoryId, images, condition, location, status } = req.body;
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(sanitizeText(title, 200)); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(sanitizeDescription(description, 50000)); }
    if (price !== undefined) { sets.push(`price = $${idx++}`); vals.push(price); }
    if (currency !== undefined) { sets.push(`currency = $${idx++}`); vals.push(currency); }
    if (categoryId !== undefined) { sets.push(`category_id = $${idx++}`); vals.push(categoryId); }
    if (images !== undefined) { sets.push(`images = $${idx++}`); vals.push(images); }
    if (condition !== undefined) { sets.push(`condition = $${idx++}`); vals.push(condition); }
    if (location !== undefined) { sets.push(`location = $${idx++}`); vals.push(location); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (sets.length === 0) { res.json({ ok: true }); return; }
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id, req.userId);
    await pool.query(`UPDATE listings SET ${sets.join(', ')} WHERE id = $${idx++} AND seller_id = $${idx}`, vals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/listings/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM listings WHERE id = $1 AND seller_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;