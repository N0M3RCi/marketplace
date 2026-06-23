import { Router } from 'express';
import pool from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/wallet
router.get('/', async (req: AuthRequest, res) => {
  try {
    let result = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [req.userId]);
    if (result.rows.length === 0) {
      await pool.query('INSERT INTO wallets (user_id, balance, pending_balance, currency) VALUES ($1, 0, 0, $2)', [req.userId, 'USD']);
      result = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [req.userId]);
    }
    const w = result.rows[0];
    res.json({ id: w.id, userId: w.user_id, balance: Number(w.balance), pendingBalance: Number(w.pending_balance), currency: w.currency });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/transactions
router.get('/transactions', async (req: AuthRequest, res) => {
  try {
    const wallet = await pool.query('SELECT id FROM wallets WHERE user_id = $1', [req.userId]);
    if (wallet.rows.length === 0) { res.json([]); return; }
    const result = await pool.query('SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC', [wallet.rows[0].id]);
    res.json(result.rows.map((t: any) => ({
      id: t.id, walletId: t.wallet_id, caseId: t.case_id, type: t.type,
      amount: Number(t.amount), currency: t.currency, description: t.description,
      status: t.status, createdAt: t.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/payment-methods
router.get('/payment-methods', async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_settings WHERE is_active = true ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;