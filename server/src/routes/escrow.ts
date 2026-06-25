import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sendEscrowNotification } from '../services/email.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// GET /api/escrow
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, b.username as buyer_name, s.username as seller_name
      FROM escrow_cases e
      LEFT JOIN user_profiles b ON e.buyer_id = b.id
      LEFT JOIN user_profiles s ON e.seller_id = s.id
      WHERE e.buyer_id = $1 OR e.seller_id = $1
      ORDER BY e.created_at DESC`, [req.userId]);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/escrow/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, b.username as buyer_name, b.email as buyer_email, s.username as seller_name, s.email as seller_email
      FROM escrow_cases e
      LEFT JOIN user_profiles b ON e.buyer_id = b.id
      LEFT JOIN user_profiles s ON e.seller_id = s.id
      WHERE e.id = $1`, [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Case not found' }); return; }
    const e = result.rows[0];
    res.json({
      id: e.id, caseNumber: e.case_number, buyerId: e.buyer_id, buyerName: e.buyer_name || 'Unknown',
      sellerId: e.seller_id, sellerName: e.seller_name || 'Unknown',
      listingTitle: e.listing_title, listingId: e.listing_id,
      amount: Number(e.amount), fees: Number(e.fees || 0), currency: e.currency || 'USD',
      status: e.status, paymentAddress: e.payment_address, paymentNetwork: e.payment_network,
      paymentMethod: e.payment_method, paymentReference: e.payment_reference,
      paymentProofUrl: e.payment_proof_url,
      paymentAmountSent: e.payment_amount_sent ? Number(e.payment_amount_sent) : undefined,
      paymentSubmittedAt: e.payment_submitted_at, paymentVerifiedAt: e.payment_verified_at,
      paymentRejectedAt: e.payment_rejected_at,
      paymentAdminNotes: e.payment_admin_notes,
      sellerItemPhotos: e.seller_item_photos || [], sellerPackagingPhotos: e.seller_packaging_photos || [],
      sellerPackagingVideo: e.seller_packaging_video,
      sellerReadinessConfirmed: e.seller_readiness_confirmed || false,
      sellerEvidenceSubmittedAt: e.seller_evidence_submitted_at,
      sellerEvidenceStatus: e.seller_evidence_status || 'pending',
      courierName: e.courier_name, trackingNumber: e.tracking_number,
      pickupDate: e.pickup_date, estimatedDeliveryDate: e.estimated_delivery_date,
      actualDeliveryDate: e.actual_delivery_date, deliveryStatus: e.delivery_status,
      deliveryNotes: e.delivery_notes, disputeStatus: e.dispute_status,
      disputeReason: e.dispute_reason, disputeDescription: e.dispute_description,
      disputeOutcome: e.dispute_outcome, adminNotes: e.admin_notes,
      createdAt: e.created_at, updatedAt: e.updated_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/escrow
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { listingId, listingTitle, sellerId, amount, fees, currency } = req.body;
    const buyerId = req.userId;
    if (!buyerId) { res.status(401).json({ error: 'Authentication required' }); return; }
    if (!sellerId) { res.status(400).json({ error: 'sellerId is required' }); return; }
    const id = `ESC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await pool.query(`
      INSERT INTO escrow_cases (id, case_number, listing_id, listing_title, buyer_id, seller_id, amount, fees, currency, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'awaiting_payment',NOW(),NOW())`, [
      id, id, listingId, listingTitle, buyerId, sellerId, amount, fees || 0, currency || 'USD'
    ]);
    // Timeline
    await pool.query(`INSERT INTO escrow_timeline (case_id, status, label, actor_name, actor_role) VALUES ($1,'awaiting_payment','Escrow case created','System','system')`, [id]);
    // Notify seller
    try {
      await pool.query(`INSERT INTO notifications (user_id, type, title, message, case_id) VALUES ($1,'new_escrow_case','New Escrow Case Opened', $2, $3)`,
        [sellerId, `A buyer has opened an escrow case for your listing "${listingTitle || ''}".`, id]);
      // Fire and forget email notification
      const sellerResult = await pool.query('SELECT email, username FROM user_profiles WHERE id = $1', [sellerId]);
      if (sellerResult.rows.length > 0) {
        const { email, username } = sellerResult.rows[0];
        sendEscrowNotification(email, username, id, 'new_escrow_case',
          `A buyer has opened an escrow case for your listing "${listingTitle || ''}". Please log in to review and prepare your item.`).catch(() => {});
      }
    } catch {}
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/escrow/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const updates: string[] = []; const vals: any[] = []; let idx = 1;
    const allowed = ['status', 'payment_address', 'payment_network', 'payment_method', 'payment_reference',
      'payment_proof_url', 'payment_amount_sent', 'payment_submitted_at', 'payment_verified_at', 'payment_admin_notes',
      'seller_item_photos', 'seller_packaging_photos', 'seller_packaging_video', 'seller_readiness_confirmed',
      'seller_evidence_submitted_at', 'seller_evidence_status', 'courier_name', 'tracking_number',
      'pickup_date', 'estimated_delivery_date', 'actual_delivery_date', 'delivery_status', 'delivery_notes',
      'dispute_status', 'dispute_reason', 'dispute_description', 'dispute_outcome', 'admin_notes', 'payout_status',
      'buyer_confirmed_at'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        vals.push(req.body[field]);
      }
    }
    if (updates.length === 0) { res.json({ ok: true }); return; }
    updates.push('updated_at = NOW()');
    vals.push(req.params.id);
    await pool.query(`UPDATE escrow_cases SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/escrow/:id/timeline
router.get('/:id/timeline', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM escrow_timeline WHERE case_id = $1 ORDER BY created_at ASC', [req.params.id]);
    res.json(result.rows.map((t: any) => ({
      id: t.id, status: t.status, label: t.label, timestamp: t.created_at,
      actorName: t.actor_name, actorRole: t.actor_role, notes: t.notes,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/escrow/timeline
router.post('/timeline', async (req: AuthRequest, res) => {
  try {
    const { caseId, status, label, actorName, actorRole, notes } = req.body;
    await pool.query(
      'INSERT INTO escrow_timeline (case_id, status, label, actor_name, actor_role, notes) VALUES ($1,$2,$3,$4,$5,$6)',
      [caseId, status, label, actorName, actorRole, notes]);
    res.status(201).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/escrow/:id — buyer can cancel/delete before submitting payment
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const caseId = req.params.id;
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Fetch the case (escrow_cases.id is text, eg. ESC-xxx)
    const caseResult = await pool.query('SELECT * FROM escrow_cases WHERE id = $1', [caseId]);
    if (caseResult.rows.length === 0) { res.status(404).json({ error: 'Case not found' }); return; }
    const escrowCase = caseResult.rows[0];

    // Only the buyer can delete
    if (escrowCase.buyer_id !== userId) {
      res.status(403).json({ error: 'Only the buyer can delete this escrow case' });
      return;
    }

    // Only allowed when awaiting_payment and payment not yet submitted
    if (escrowCase.status !== 'awaiting_payment') {
      res.status(403).json({ error: 'Can only cancel cases in awaiting_payment status' });
      return;
    }
    if (escrowCase.payment_submitted_at) {
      res.status(403).json({ error: 'Cannot delete after payment has been submitted' });
      return;
    }

    // Cascade delete related data
    await pool.query('DELETE FROM escrow_timeline WHERE case_id = $1', [caseId]);
    await pool.query('DELETE FROM notifications WHERE case_id = $1', [caseId]);
    await pool.query('DELETE FROM escrow_cases WHERE id = $1', [caseId]);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;