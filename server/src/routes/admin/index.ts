import { Router } from 'express';
import { adminOnly } from '../../middleware/auth.js';
import type { AuthRequest } from '../../middleware/auth.js';
import pool from '../../db.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// All admin routes require admin role
router.use(adminOnly);

// ============ USERS ============
router.get('/users', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_profiles ORDER BY created_at DESC');
    res.json(result.rows.map((u: any) => ({
      id: u.id, email: u.email, username: u.username, role: u.role,
      avatar_url: u.avatar_url, is_verified: u.is_verified, is_active: u.is_active,
      status: u.status, phone: u.phone, rating: Number(u.rating),
      total_transactions: u.total_transactions, created_at: u.created_at,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE user_profiles SET role = $1 WHERE id = $2', [req.body.role, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/profile', async (req: AuthRequest, res) => {
  try {
    const { username, email, avatar_url, role, phone } = req.body;
    await pool.query('UPDATE user_profiles SET username=COALESCE($1,username), email=COALESCE($2,email), avatar_url=COALESCE($3,avatar_url), role=COALESCE($4,role), phone=COALESCE($5,phone), updated_at=NOW() WHERE id=$6',
      [username, email, avatar_url, role, phone, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/status', async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE user_profiles SET status=$1, is_active=$2 WHERE id=$3',
      [req.body.status, req.body.is_active, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/verify', async (req: AuthRequest, res) => {
  try {
    const curr = await pool.query('SELECT is_verified FROM user_profiles WHERE id=$1', [req.params.id]);
    const newVal = !curr.rows[0]?.is_verified;
    await pool.query('UPDATE user_profiles SET is_verified=$1 WHERE id=$2', [newVal, req.params.id]);
    res.json({ is_verified: newVal });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ SELLER REQUESTS ============
router.get('/seller-requests', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT sr.*, up.username, up.email, up.created_at as user_since, up.is_verified, up.total_transactions
      FROM seller_requests sr LEFT JOIN user_profiles up ON sr.user_id = up.id ORDER BY sr.created_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/seller-requests/:id/approve', async (req: AuthRequest, res) => {
  try {
    const sr = await pool.query('SELECT * FROM seller_requests WHERE id=$1', [req.params.id]);
    if (sr.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const r = sr.rows[0];
    await pool.query('UPDATE user_profiles SET role = CASE WHEN role=$1 THEN $2 ELSE $3 END WHERE id=$4',
      ['seller', 'both', 'seller', r.user_id]);
    await pool.query("UPDATE seller_requests SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2",
      [req.userId, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/seller-requests/:id/reject', async (req: AuthRequest, res) => {
  try {
    await pool.query("UPDATE seller_requests SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), admin_notes=$2 WHERE id=$3",
      [req.userId, req.body.notes || '', req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ DELIVERY STATUS (admin update) ============
router.put('/escrow/:id/delivery-status', async (req: AuthRequest, res) => {
  try {
    const { delivery_status, status, notes } = req.body;
    const result = await pool.query('SELECT * FROM escrow_cases WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const escrow = result.rows[0];

    await pool.query('UPDATE escrow_cases SET delivery_status=$1, status=COALESCE($2,status), updated_at=NOW() WHERE id=$3',
      [delivery_status, status || null, req.params.id]);

    // Add timeline entry
    const timelineLabels: Record<string, string> = {
      pickup_scheduled: 'Pickup Scheduled', picked_up: 'Picked Up',
      in_transit: 'In Transit', out_for_delivery: 'Out for Delivery', delivered: 'Package Delivered',
    };
    const label = timelineLabels[delivery_status] || delivery_status;
    await pool.query(
      'INSERT INTO escrow_timeline (case_id, status, label, actor_name, actor_role, notes) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.params.id, delivery_status, label, 'Alex Morgan', 'Admin', notes || '']);

    // Create notifications
    const buyerNotif = delivery_status === 'delivered' ? 'Package delivered' : `Delivery status updated: ${label}`;
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, case_id) VALUES ($1,$2,$3,$4,$5)',
      [escrow.buyer_id, delivery_status === 'delivered' ? 'delivered' : 'delivery_started', `Delivery ${delivery_status === 'delivered' ? 'Delivered' : 'Updated'}`, buyerNotif, req.params.id]);
    if (escrow.seller_id !== escrow.buyer_id) {
      await pool.query(
        'INSERT INTO notifications (user_id, type, title, message, case_id) VALUES ($1,$2,$3,$4,$5)',
        [escrow.seller_id, delivery_status === 'delivered' ? 'delivered' : 'delivery_started', `Delivery ${delivery_status === 'delivered' ? 'Delivered' : 'Updated'}`, buyerNotif, req.params.id]);
    }

    res.json({ ok: true, delivery_status });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ LISTINGS (admin view) ============
router.get('/listings', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, c.id as c_id, c.name as c_name, up.username as seller_name
      FROM listings l LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN user_profiles up ON l.seller_id = up.id ORDER BY l.created_at DESC`);
    res.json(result.rows.map((l: any) => ({
      ...l, category_id: l.c_id, category_name: l.c_name, seller_name: l.seller_name,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/listings/:id', async (req: AuthRequest, res) => {
  try {
    const { title, description, price, currency, condition, location, status, category_id, images, seller_id } = req.body;
    const sets: string[] = ['updated_at = NOW()'];
    const vals: any[] = [];
    let idx = 1;
    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
    if (price !== undefined) { sets.push(`price = $${idx++}`); vals.push(price); }
    if (currency !== undefined) { sets.push(`currency = $${idx++}`); vals.push(currency); }
    if (condition !== undefined) { sets.push(`"condition" = $${idx++}`); vals.push(condition); }
    if (location !== undefined) { sets.push(`location = $${idx++}`); vals.push(location); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (category_id !== undefined) { sets.push(`category_id = $${idx++}`); vals.push(category_id); }
    if (images !== undefined) { sets.push(`images = $${idx++}`); vals.push(images); }
    if (seller_id !== undefined) { sets.push(`seller_id = $${idx++}`); vals.push(seller_id); }
    if (sets.length === 1) { res.json({ ok: true }); return; }
    vals.push(req.params.id);
    await pool.query(`UPDATE listings SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/listings/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM listings WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ ESCROW CASES (admin view) ============
router.get('/escrow', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, b.username as buyer_name, s.username as seller_name
      FROM escrow_cases e
      LEFT JOIN user_profiles b ON e.buyer_id=b.id LEFT JOIN user_profiles s ON e.seller_id=s.id
      ORDER BY e.created_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/escrow/:id', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, b.username as buyer_name, b.email as buyer_email, s.username as seller_name, s.email as seller_email
      FROM escrow_cases e LEFT JOIN user_profiles b ON e.buyer_id=b.id LEFT JOIN user_profiles s ON e.seller_id=s.id WHERE e.id=$1`,
      [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/escrow/:id', async (req: AuthRequest, res) => {
  try {
    const sets: string[] = ['updated_at = NOW()']; const vals: any[] = []; let idx = 1;
    const allowed = ['status','admin_notes','payment_address','payment_network','payment_method','payment_admin_notes','payment_verified_at','payment_rejected_at','payment_submitted_at','payment_proof_url','payment_reference','payment_amount_sent','delivery_status','delivery_notes','dispute_status','dispute_outcome','dispute_admin_notes','dispute_resolved_at','payout_status','courier_name','tracking_number','pickup_date','estimated_delivery_date','actual_delivery_date','delivered_at','seller_evidence_status','seller_evidence_admin_notes','packaging_approved_at','seller_item_photos','seller_packaging_photos','seller_packaging_video','funds_released_at','refunded_at'];
    for (const f of allowed) { if (req.body[f] !== undefined) { sets.push(`${f} = $${idx++}`); vals.push(req.body[f]); } }
    vals.push(req.params.id);
    await pool.query(`UPDATE escrow_cases SET ${sets.join(',')} WHERE id=$${idx}`, vals);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/escrow/:id', async (req: AuthRequest, res) => {
  try {
    // Delete timeline events first
    await pool.query('DELETE FROM escrow_timeline WHERE case_id = $1', [req.params.id]);
    // Delete notifications referencing this case
    await pool.query('DELETE FROM notifications WHERE case_id = $1', [req.params.id]);
    // Delete the escrow case
    await pool.query('DELETE FROM escrow_cases WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ WALLETS ============
router.get('/wallets', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT w.*, up.username, up.email FROM wallets w LEFT JOIN user_profiles up ON w.user_id=up.id ORDER BY w.created_at DESC');
    res.json(result.rows.map((w: any) => ({ ...w, balance: Number(w.balance), pending_balance: Number(w.pending_balance) })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/wallets/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE wallets SET balance=$1, pending_balance=$2, updated_at=NOW() WHERE id=$3',
      [req.body.balance, req.body.pending_balance, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/wallet-transactions', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM wallet_transactions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/wallet-transactions/:walletId', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC', [req.params.walletId]);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/wallet-transactions', async (req: AuthRequest, res) => {
  try {
    const { wallet_id, type, amount, currency, status, description, balance_after } = req.body;
    const id = uuid();
    await pool.query(
      'INSERT INTO wallet_transactions (id, wallet_id, type, amount, currency, status, description) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, wallet_id, type, amount, currency || 'USD', status || 'completed', description || '']);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ PAYOUTS ============
router.get('/payouts', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, e.listing_title, e.amount as case_amount, e.fees as case_fees, e.currency as case_currency,
        e.status as case_status, e.updated_at as case_updated
      FROM payouts p LEFT JOIN escrow_cases e ON p.case_id=e.id ORDER BY p.created_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/payouts', async (req: AuthRequest, res) => {
  try {
    const { caseId, sellerId, amount, fees, netAmount, currency } = req.body;
    const id = uuid();
    await pool.query(
      `INSERT INTO payouts (id, case_id, seller_id, amount, fees, net_amount, currency, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
      [id, caseId, sellerId, amount, fees || 0, netAmount || amount, currency || 'USD']);
    await pool.query("UPDATE escrow_cases SET payout_status='pending', updated_at=NOW() WHERE id=$1", [caseId]);
    await pool.query(`INSERT INTO escrow_timeline (case_id, status, label, actor_name) VALUES ($1,'funds_released','Payout created','Admin')`, [caseId]);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/payouts/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE payouts SET status=$1, approved_by=$2, notes=$3, paid_at=NOW() WHERE id=$4',
      [req.body.status, req.body.approved_by || 'Admin', req.body.notes || '', req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ DISPUTES ============
router.get('/disputes', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.listing_title, e.amount, e.fees, e.currency, e.status, e.dispute_status,
        e.dispute_reason, e.dispute_description, e.dispute_outcome, e.admin_notes, e.created_at,
        b.username as buyer_name, s.username as seller_name
      FROM escrow_cases e
      LEFT JOIN user_profiles b ON e.buyer_id=b.id LEFT JOIN user_profiles s ON e.seller_id=s.id
      WHERE e.status='disputed' ORDER BY e.created_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/disputes/:id/evidence', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT de.*, up.username FROM dispute_evidence de
      LEFT JOIN user_profiles up ON de.uploaded_by=up.id WHERE de.case_id=$1`, [req.params.id]);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ PAYMENT REVIEWS ============
router.get('/payment-reviews', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, b.username as buyer_name, s.username as seller_name
      FROM escrow_cases e
      LEFT JOIN user_profiles b ON e.buyer_id=b.id LEFT JOIN user_profiles s ON e.seller_id=s.id
      WHERE e.status IN ('payment_submitted','payment_verified') ORDER BY e.created_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ PAYMENT SETTINGS ============
router.get('/payment-settings', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_settings ORDER BY created_at DESC');
    res.json(result.rows.map((s: any) => ({
      id: s.id,
      method: s.method,
      cryptoAddress: s.crypto_address,
      cryptoNetwork: s.crypto_network,
      instructions: s.instructions || '',
      qrCodeUrl: s.qr_code_url || null,
      iconUrl: s.icon_url || null,
      isActive: s.is_active,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      // also keep snake_case for compatibility
      crypto_address: s.crypto_address,
      crypto_network: s.crypto_network,
      is_active: s.is_active,
      qr_code_url: s.qr_code_url,
      icon_url: s.icon_url || null,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/payment-settings', async (req: AuthRequest, res) => {
  try {
    const { method, crypto_address, crypto_network, instructions, qr_code_url, icon_url } = req.body;
    await pool.query(
      'INSERT INTO payment_settings (method, crypto_address, crypto_network, instructions, qr_code_url, icon_url) VALUES ($1,$2,$3,$4,$5,$6)',
      [method || 'crypto', crypto_address, crypto_network, instructions || null, qr_code_url || null, icon_url || null]
    );
    res.status(201).json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/payment-settings/:id', async (req: AuthRequest, res) => {
  try {
    const { crypto_address, crypto_network, instructions, qr_code_url, is_active, icon_url } = req.body;
    await pool.query(
      `UPDATE payment_settings SET crypto_address=$1, crypto_network=$2, instructions=$3, qr_code_url=$4, is_active=$5, icon_url=$6, updated_at=NOW() WHERE id=$7`,
      [crypto_address, crypto_network, instructions || null, qr_code_url || null, is_active !== undefined ? is_active : true, icon_url || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/payment-settings/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM payment_settings WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ MESSAGES (admin view) ============
router.get('/messages', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, b.username as b_name, s.username as s_name
      FROM conversations c LEFT JOIN user_profiles b ON c.buyer_id=b.id LEFT JOIN user_profiles s ON c.seller_id=s.id
      ORDER BY c.updated_at DESC`);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/messages — send a message on behalf of any user (admin bypass)
router.post('/messages', async (req: AuthRequest, res) => {
  try {
    const { conversationId, senderId, content } = req.body;
    if (!conversationId || !senderId || !content) {
      res.status(400).json({ error: 'conversationId, senderId, and content are required' });
      return;
    }
    const id = uuid();
    await pool.query(
      'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES ($1,$2,$3,$4)',
      [id, conversationId, senderId, content]);
    await pool.query(
      'UPDATE conversations SET last_message=$1, last_message_at=NOW(), updated_at=NOW() WHERE id=$2',
      [content.substring(0, 100), conversationId]);
    const user = await pool.query('SELECT username FROM user_profiles WHERE id=$1', [senderId]);
    res.status(201).json({
      id, conversationId, senderId,
      senderName: user.rows[0]?.username || 'Unknown',
      content, isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ ANALYTICS ============
router.get('/analytics', async (_req: AuthRequest, res) => {
  try {
    const [users, listings, activeListings, escrow, disputed, escrows, revenue, monthly] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM user_profiles'),
      pool.query('SELECT COUNT(*) FROM listings'),
      pool.query("SELECT COUNT(*) FROM listings WHERE status='active'"),
      pool.query("SELECT COUNT(*) FROM escrow_cases WHERE status NOT IN ('closed','funds_released','refunded')"),
      pool.query("SELECT COUNT(*) FROM escrow_cases WHERE status='disputed'"),
      pool.query('SELECT id, amount, fees, status, created_at, listing_title FROM escrow_cases ORDER BY created_at DESC'),
      pool.query("SELECT COALESCE(SUM(amount),0) as total FROM escrow_cases WHERE status IN ('funds_released','buyer_confirmed','closed')"),
      pool.query(`SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count, COALESCE(SUM(amount),0) as volume FROM escrow_cases GROUP BY 1 ORDER BY 1`),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      listingsCreated: parseInt(listings.rows[0].count),
      activeEscrowCases: parseInt(escrow.rows[0].count),
      disputedTransactions: parseInt(disputed.rows[0].count),
      activeListings: parseInt(activeListings.rows[0].count),
      totalEscrowVolume: Number(revenue.rows[0].total),
      monthlyVolume: monthly.rows,
      escrowCases: escrows.rows,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ CATEGORIES (admin CRUD) ============
router.get('/categories', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, (
        SELECT COUNT(*) FROM listings l
        WHERE l.status = 'active'
        AND (l.category_id = c.id OR l.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))
      ) as effective_listing_count
      FROM categories c ORDER BY c.name`);
    res.json(result.rows.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon || 'Tag',
      color: c.color || 'text-gray-600',
      parent_id: c.parent_id || null,
      listing_count: parseInt(c.effective_listing_count || c.listing_count || 0),
      homepage_featured: !!c.homepage_featured,
      image_url: c.image_url || null,
      parentId: c.parent_id || null,
      listingCount: parseInt(c.effective_listing_count || c.listing_count || 0),
      homepageFeatured: !!c.homepage_featured,
      imageUrl: c.image_url || null,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const { name, slug, icon, color, parent_id } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
    const finalSlug = slug || name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const id = uuid();
    await pool.query(
      'INSERT INTO categories (id, name, slug, icon, color, parent_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name.trim(), finalSlug, icon || 'Tag', color || 'text-gray-600', parent_id || null]);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const { name, slug, icon, color, parent_id, image_url } = req.body;
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name.trim()); }
    if (slug !== undefined) { sets.push(`slug = $${idx++}`); vals.push(slug); }
    if (icon !== undefined) { sets.push(`icon = $${idx++}`); vals.push(icon); }
    if (color !== undefined) { sets.push(`color = $${idx++}`); vals.push(color); }
    if (parent_id !== undefined) { sets.push(`parent_id = $${idx++}`); vals.push(parent_id || null); }
    if (image_url !== undefined) { sets.push(`image_url = $${idx++}`); vals.push(image_url); }
    if (sets.length === 0) { res.json({ ok: true }); return; }
    vals.push(req.params.id);
    await pool.query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id/homepage-featured', async (req: AuthRequest, res) => {
  try {
    const { featured } = req.body;
    if (featured === undefined) { res.status(400).json({ error: 'featured field is required' }); return; }
    await pool.query('UPDATE categories SET homepage_featured = $1 WHERE id = $2', [featured, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', async (req: AuthRequest, res) => {
  try {
    // Check if any listings reference this category
    const check = await pool.query('SELECT COUNT(*) FROM listings WHERE category_id = $1', [req.params.id]);
    if (parseInt(check.rows[0].count) > 0) {
      res.status(400).json({ error: 'Cannot delete category — it has associated listings. Reassign them first.' });
      return;
    }
    // Check if any child categories reference this as parent
    const childCheck = await pool.query('SELECT COUNT(*) FROM categories WHERE parent_id = $1', [req.params.id]);
    if (parseInt(childCheck.rows[0].count) > 0) {
      res.status(400).json({ error: 'Cannot delete category — it has subcategories. Remove or reassign them first.' });
      return;
    }
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ FEATURED LISTINGS ============
router.get('/featured-listings', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT fl.id as featured_id, fl.sort_order, fl.created_at as featured_at,
        l.*, c.name as c_name, up.username as seller_name
      FROM featured_listings fl
      JOIN listings l ON fl.listing_id = l.id
      LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN user_profiles up ON l.seller_id = up.id
      ORDER BY fl.sort_order ASC, fl.created_at DESC`);
    res.json(result.rows.map((r: any) => ({
      featuredId: r.featured_id,
      sortOrder: r.sort_order,
      featuredAt: r.featured_at,
      id: r.id,
      title: r.title,
      description: r.description || '',
      price: Number(r.price),
      currency: r.currency || 'USD',
      condition: r.condition,
      location: r.location,
      status: r.status,
      images: r.images || [],
      categoryName: r.c_name || 'Uncategorized',
      sellerName: r.seller_name || 'Unknown',
      createdAt: r.created_at,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/featured-listings', async (req: AuthRequest, res) => {
  try {
    const { listing_id } = req.body;
    if (!listing_id) { res.status(400).json({ error: 'listing_id is required' }); return; }
    // Check listing exists
    const listing = await pool.query('SELECT id FROM listings WHERE id = $1', [listing_id]);
    if (listing.rows.length === 0) { res.status(404).json({ error: 'Listing not found' }); return; }
    // Check not already featured
    const existing = await pool.query('SELECT id FROM featured_listings WHERE listing_id = $1', [listing_id]);
    if (existing.rows.length > 0) { res.status(400).json({ error: 'Listing is already featured' }); return; }
    // Get next sort order
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM featured_listings');
    const id = uuid();
    await pool.query(
      'INSERT INTO featured_listings (id, listing_id, sort_order, added_by) VALUES ($1,$2,$3,$4)',
      [id, listing_id, maxOrder.rows[0].next, req.userId]);
    res.status(201).json({ id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/featured-listings/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM featured_listings WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/featured-listings/reorder', async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body; // Array of featured IDs in new order
    if (!Array.isArray(ids)) { res.status(400).json({ error: 'ids array is required' }); return; }
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE featured_listings SET sort_order = $1 WHERE id = $2', [i, ids[i]]);
    }
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ AUDIT LOGS ============
router.get('/audit-logs', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
    res.json(result.rows.map((l: any) => ({
      id: l.id, admin_id: l.admin_id, admin_name: l.admin_name, action: l.action,
      entity_type: l.entity_type, entity_id: l.entity_id, details: l.details,
      ip_address: l.ip_address, created_at: l.created_at,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/audit-logs', async (req: AuthRequest, res) => {
  try {
    const { admin_id, admin_name, action, entity_type, entity_id, details, ip_address } = req.body;
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    await pool.query(
      'INSERT INTO audit_logs (id, admin_id, admin_name, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, admin_id, admin_name, action, entity_type, entity_id, details, ip_address || req.ip || '']);
    res.status(201).json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============ AUDIT LOG HELPER ============
export async function createAuditLog(adminId: string, adminName: string, action: string, entityType: string, entityId: string, details: string, ipAddress?: string) {
  await pool.query(
    'INSERT INTO audit_logs (admin_id, admin_name, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [adminId, adminName, action, entityType, entityId, details, ipAddress || '']);
}

export async function createNotification(userId: string, type: string, title: string, message: string, caseId?: string) {
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, message, case_id) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, title, message, caseId || null]);
}

export default router;