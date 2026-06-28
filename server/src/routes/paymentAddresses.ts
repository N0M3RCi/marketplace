import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/payment-addresses - returns active payment addresses for buyers
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_settings WHERE is_active = true ORDER BY created_at ASC'
    );
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
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;