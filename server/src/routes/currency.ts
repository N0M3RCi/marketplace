import { Router } from 'express';

const router = Router();

interface RateCache {
  rates: Record<string, number>;
  base: string;
  fetchedAt: number;
}

let cache: RateCache | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchRates(): Promise<Record<string, number>> {
  // Use frankfurter.app (free, no API key required)
  const res = await fetch('https://api.frankfurter.app/latest?from=USD');
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  return { USD: 1, ...data.rates };
}

// GET /api/currency/rates
router.get('/rates', async (_req, res) => {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      res.json({ base: cache.base, rates: cache.rates, cached: true });
      return;
    }
    const rates = await fetchRates();
    cache = { rates, base: 'USD', fetchedAt: Date.now() };
    res.json({ base: 'USD', rates, cached: false });
  } catch (err: any) {
    // If cache exists, serve stale data
    if (cache) {
      res.json({ base: cache.base, rates: cache.rates, cached: true, stale: true });
      return;
    }
    // Fallback to hardcoded common rates
    res.json({
      base: 'USD',
      rates: { USD: 1, EUR: 0.92, GBP: 0.79, AUD: 1.54, CAD: 1.36, JPY: 149.50, CNY: 7.24, INR: 83.50, BRL: 5.05 },
      cached: true, fallback: true,
    });
  }
});

// GET /api/currency/convert?amount=100&from=USD&to=EUR
router.get('/convert', async (req, res) => {
  try {
    const { amount, from = 'USD', to = 'USD' } = req.query;
    if (!amount || isNaN(Number(amount))) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    const numAmount = Number(amount);
    if (from === to) {
      res.json({ amount: numAmount, from, to, rate: 1 });
      return;
    }

    let rates: Record<string, number>;
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      rates = cache.rates;
    } else {
      rates = await fetchRates();
      cache = { rates, base: 'USD', fetchedAt: Date.now() };
    }

    const fromStr = typeof from === 'string' ? from : 'USD';
    const toStr = typeof to === 'string' ? to : 'USD';

    // Convert via USD
    const fromRate = fromStr === 'USD' ? 1 : rates[fromStr];
    const toRate = toStr === 'USD' ? 1 : rates[toStr];

    if (!fromRate || !toRate) {
      res.status(400).json({ error: `Unsupported currency: ${fromRate ? toStr : fromStr}` });
      return;
    }

    const usdAmount = numAmount / fromRate;
    const converted = usdAmount * toRate;

    res.json({ amount: Math.round(converted * 100) / 100, from: fromStr, to: toStr, rate: toRate / fromRate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;