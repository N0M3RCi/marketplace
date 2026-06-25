import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { authMiddleware } from './middleware/auth.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import categoriesRoutes from './routes/categories.js';
import listingsRoutes from './routes/listings.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import favoritesRoutes from './routes/favorites.js';
import notificationsRoutes from './routes/notifications.js';
import escrowRoutes from './routes/escrow.js';
import walletRoutes from './routes/wallets.js';
import storageRoutes, { fileRouter as storageFileRouter } from './routes/storage.js';
import profileRoutes from './routes/profile.js';
import reviewsRoutes from './routes/reviews.js';
import sellerRequestRoutes from './routes/sellerRequests.js';
import currencyRoutes from './routes/currency.js';
import featuredListingsRoutes from './routes/featuredListings.js';
import paymentAddressesRoutes from './routes/paymentAddresses.js';
import adminRoutes from './routes/admin/index.js';
import { setupSocket } from './socket.js';

const app = express();
// Use port 3001 as default (Vite dev server uses 3000)
const PORT = parseInt(process.env.PORT || '3001', 10);

// Ready flag: blocked until migrations complete
let dbReady = false;

// Determine trusted CORS origins from env or dev default
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:3000'];

// Middleware
app.disable('x-powered-by');
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(helmet({
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', apiLimiter); // Global: 100 requests per 15 min
app.use('/api/auth', authLimiter); // Stricter: 10 requests per 15 min

// JSON body parser error handler (malformed JSON → readable 400)
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }
  next(err);
});

// API routes (no auth required) — registered BEFORE dbReady middleware so login
// and registration are never blocked during migrations
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/featured-listings', featuredListingsRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/storage/file', storageFileRouter); // Public file retrieval (for chat images/files)

// Block non-auth API requests until migrations finish — port is still open for Railway health
app.use('/api', (req, _res, next) => {
  // Auth routes are already handled above — this catches everything else
  if (dbReady) return next();
  // Let auth routes through even if DB isn't ready (their own error handling will manage)
  if (req.path.startsWith('/auth/')) return next();
  _res.status(503).json({ error: 'Service initializing, please try again in a moment' });
});

// API routes (auth required)
app.use('/api/listings', listingsRoutes);
app.use('/api/favorites', authMiddleware, favoritesRoutes);
app.use('/api/conversations', authMiddleware, conversationsRoutes);
app.use('/api/messages', authMiddleware, messagesRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);
app.use('/api/escrow', authMiddleware, escrowRoutes);
app.use('/api/wallet', authMiddleware, walletRoutes);
app.use('/api/storage', authMiddleware, storageRoutes);
app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/reviews', authMiddleware, reviewsRoutes);
app.use('/api/seller-requests', authMiddleware, sellerRequestRoutes);
app.use('/api/payment-addresses', authMiddleware, paymentAddressesRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Health check (includes database status)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// API 404 handler — unmatched API routes return JSON, not HTML
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler — always returns JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

// Serve frontend static files in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../dist');

app.use(express.static(distPath, { maxAge: '1h' }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server — listen immediately, then run migrations in background
async function start() {
  const httpServer = http.createServer(app);
  setupSocket(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Run SQL migrations in background so startup is not blocked
    runMigrations();
  });
}

async function runMigrations() {
  const statements = [
    { name: 'categories', sql: `CREATE TABLE IF NOT EXISTS categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, icon TEXT DEFAULT 'Tag', listing_count INTEGER DEFAULT 0, color TEXT DEFAULT 'text-gray-600')` },
    { name: 'user_profiles', sql: `CREATE TABLE IF NOT EXISTS user_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, username TEXT NOT NULL, password_hash TEXT NOT NULL, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin','buyer','seller','both')), is_verified BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true, status TEXT DEFAULT 'active', phone TEXT, rating NUMERIC DEFAULT 5.0, total_transactions INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'listings', sql: `CREATE TABLE IF NOT EXISTS listings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, description TEXT, price NUMERIC NOT NULL, currency TEXT DEFAULT 'USD', category_id UUID REFERENCES categories(id), seller_id UUID NOT NULL REFERENCES user_profiles(id), seller_name TEXT, images TEXT[] DEFAULT '{}', condition TEXT DEFAULT 'good', location TEXT, status TEXT DEFAULT 'active', view_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'escrow_cases', sql: `CREATE TABLE IF NOT EXISTS escrow_cases (id TEXT PRIMARY KEY, case_number TEXT, buyer_id UUID NOT NULL REFERENCES user_profiles(id), seller_id UUID NOT NULL REFERENCES user_profiles(id), listing_id TEXT, listing_title TEXT, amount NUMERIC NOT NULL, fees NUMERIC DEFAULT 0, currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'awaiting_payment', payment_address TEXT, payment_network TEXT, payment_method TEXT, payment_reference TEXT, payment_proof_url TEXT, payment_amount_sent NUMERIC, payment_submitted_at TIMESTAMPTZ, payment_verified_at TIMESTAMPTZ, payment_rejected_at TIMESTAMPTZ, payment_admin_notes TEXT, seller_item_photos TEXT[] DEFAULT '{}', seller_packaging_photos TEXT[] DEFAULT '{}', seller_packaging_video TEXT, seller_readiness_confirmed BOOLEAN DEFAULT false, seller_evidence_submitted_at TIMESTAMPTZ, seller_evidence_status TEXT DEFAULT 'pending', seller_evidence_admin_notes TEXT, packaging_approved_at TIMESTAMPTZ, courier_name TEXT, tracking_number TEXT, pickup_date TIMESTAMPTZ, pickup_scheduled_at TIMESTAMPTZ, estimated_delivery_date TIMESTAMPTZ, actual_delivery_date TIMESTAMPTZ, delivered_at TIMESTAMPTZ, delivery_status TEXT, delivery_notes TEXT, dispute_status TEXT, dispute_reason TEXT, dispute_description TEXT, dispute_outcome TEXT, dispute_opened_by TEXT, dispute_admin_notes TEXT, dispute_resolved_at TIMESTAMPTZ, admin_notes TEXT, payout_status TEXT, funds_released_at TIMESTAMPTZ, refunded_at TIMESTAMPTZ, buyer_confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'escrow_timeline', sql: `CREATE TABLE IF NOT EXISTS escrow_timeline (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id TEXT NOT NULL REFERENCES escrow_cases(id), status TEXT, label TEXT, actor_name TEXT, actor_role TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'notifications', sql: `CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES user_profiles(id), type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, case_id TEXT, is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'conversations', sql: `CREATE TABLE IF NOT EXISTS conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), buyer_id UUID NOT NULL REFERENCES user_profiles(id), seller_id UUID NOT NULL REFERENCES user_profiles(id), listing_id TEXT, listing_title TEXT, last_message TEXT, last_message_at TIMESTAMPTZ, buyer_unread INTEGER DEFAULT 0, seller_unread INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'messages', sql: `CREATE TABLE IF NOT EXISTS messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES conversations(id), sender_id UUID NOT NULL REFERENCES user_profiles(id), content TEXT NOT NULL, is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'favorites', sql: `CREATE TABLE IF NOT EXISTS favorites (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES user_profiles(id), listing_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id, listing_id))` },
    { name: 'wallets', sql: `CREATE TABLE IF NOT EXISTS wallets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES user_profiles(id) UNIQUE, balance NUMERIC DEFAULT 0, pending_balance NUMERIC DEFAULT 0, currency TEXT DEFAULT 'USD', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'wallet_transactions', sql: `CREATE TABLE IF NOT EXISTS wallet_transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), wallet_id UUID NOT NULL REFERENCES wallets(id), case_id TEXT, type TEXT NOT NULL, amount NUMERIC NOT NULL, currency TEXT DEFAULT 'USD', description TEXT, status TEXT DEFAULT 'completed', created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'payment_settings', sql: `CREATE TABLE IF NOT EXISTS payment_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), method TEXT NOT NULL, is_active BOOLEAN DEFAULT true, crypto_address TEXT, crypto_network TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'seller_requests', sql: `CREATE TABLE IF NOT EXISTS seller_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES user_profiles(id), status TEXT DEFAULT 'pending', reason TEXT, reviewed_by UUID REFERENCES user_profiles(id), reviewed_at TIMESTAMPTZ, admin_notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'payouts', sql: `CREATE TABLE IF NOT EXISTS payouts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id TEXT NOT NULL REFERENCES escrow_cases(id), seller_id UUID REFERENCES user_profiles(id), amount NUMERIC NOT NULL, fees NUMERIC DEFAULT 0, net_amount NUMERIC, currency TEXT DEFAULT 'USD', status TEXT DEFAULT 'pending', release_date TIMESTAMPTZ, paid_at TIMESTAMPTZ, approved_by TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'dispute_evidence', sql: `CREATE TABLE IF NOT EXISTS dispute_evidence (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id TEXT NOT NULL, uploaded_by UUID NOT NULL REFERENCES user_profiles(id), file_name TEXT, file_url TEXT, file_type TEXT, file_size INTEGER, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'reviews', sql: `CREATE TABLE IF NOT EXISTS reviews (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), seller_id UUID NOT NULL REFERENCES user_profiles(id), reviewer_id UUID NOT NULL REFERENCES user_profiles(id), rating INTEGER DEFAULT 5, comment TEXT, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'audit_logs', sql: `CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admin_id UUID REFERENCES user_profiles(id), admin_name TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details TEXT, ip_address TEXT, created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'uploaded_files', sql: `CREATE TABLE IF NOT EXISTS uploaded_files (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), file_name TEXT NOT NULL, file_type TEXT NOT NULL, file_size INTEGER NOT NULL, file_data TEXT NOT NULL, uploaded_by UUID REFERENCES user_profiles(id), created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'messages_image_url', sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT` },
    { name: 'messages_file_url', sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT` },
    { name: 'messages_file_name', sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT` },
    { name: 'messages_file_size', sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size INTEGER` },
    { name: 'categories_parent_id', sql: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id)` },
    { name: 'featured_listings', sql: `CREATE TABLE IF NOT EXISTS featured_listings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE, sort_order INTEGER DEFAULT 0, added_by UUID REFERENCES user_profiles(id), created_at TIMESTAMPTZ DEFAULT NOW())` },
    { name: 'featured_listings_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_listing_id ON featured_listings(listing_id)` },
    { name: 'sync_category_listing_count_fn', sql: `
      CREATE OR REPLACE FUNCTION sync_category_listing_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE categories SET listing_count = (
            SELECT COUNT(*) FROM listings WHERE category_id = NEW.category_id AND status = 'active'
          ) WHERE id = NEW.category_id;
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE categories SET listing_count = (
            SELECT COUNT(*) FROM listings WHERE category_id = OLD.category_id AND status = 'active'
          ) WHERE id = OLD.category_id;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          IF OLD.category_id IS DISTINCT FROM NEW.category_id OR OLD.status IS DISTINCT FROM NEW.status THEN
            UPDATE categories SET listing_count = (
              SELECT COUNT(*) FROM listings WHERE category_id = OLD.category_id AND status = 'active'
            ) WHERE id = OLD.category_id;
            UPDATE categories SET listing_count = (
              SELECT COUNT(*) FROM listings WHERE category_id = NEW.category_id AND status = 'active'
            ) WHERE id = NEW.category_id;
          END IF;
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql` },
    { name: 'sync_category_listing_count_trg', sql: `
      DROP TRIGGER IF EXISTS trg_sync_category_listing_count ON listings;
      CREATE TRIGGER trg_sync_category_listing_count
      AFTER INSERT OR DELETE OR UPDATE OF status, category_id ON listings
      FOR EACH ROW EXECUTE FUNCTION sync_category_listing_count()` },
    { name: 'sync_category_counts_initial', sql: `
      UPDATE categories SET listing_count = (
        SELECT COUNT(*) FROM listings WHERE listings.category_id = categories.id AND listings.status = 'active'
      )` },
    { name: 'categories_homepage_featured', sql: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS homepage_featured BOOLEAN DEFAULT false` },
    { name: 'categories_image_url', sql: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT` },
    { name: 'payment_settings_instructions', sql: `ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS instructions TEXT` },
    { name: 'payment_settings_qr_code_url', sql: `ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS qr_code_url TEXT` },
    { name: 'payment_settings_icon_url', sql: `ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS icon_url TEXT` },
    { name: 'escrow_payment_rejected_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS payment_rejected_at TIMESTAMPTZ` },
    { name: 'escrow_seller_evidence_admin_notes', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS seller_evidence_admin_notes TEXT` },
    { name: 'escrow_packaging_approved_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS packaging_approved_at TIMESTAMPTZ` },
    { name: 'escrow_pickup_scheduled_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS pickup_scheduled_at TIMESTAMPTZ` },
    { name: 'escrow_delivered_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ` },
    { name: 'escrow_dispute_opened_by', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS dispute_opened_by TEXT` },
    { name: 'escrow_dispute_admin_notes', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS dispute_admin_notes TEXT` },
    { name: 'escrow_dispute_resolved_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ` },
    { name: 'escrow_funds_released_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS funds_released_at TIMESTAMPTZ` },
    { name: 'escrow_refunded_at', sql: `ALTER TABLE escrow_cases ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ` },
  ];

  let allOk = true;
  for (const stmt of statements) {
    try {
      await pool.query(stmt.sql);
      console.log(`  ✓ ${stmt.name}`);
    } catch (err: any) {
      console.error(`  ✗ ${stmt.name}: ${err.message} (code: ${err.code})`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log('Database tables ensured.');
  } else {
    console.warn('Some migrations failed — server may have limited functionality.');
  }
  dbReady = true;
  console.log('Server ready to accept API requests.');
}

start();