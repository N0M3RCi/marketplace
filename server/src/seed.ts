import pool from './db.js';
import bcryptjs from 'bcryptjs';
import { v4 as uuid } from 'uuid';

async function seed() {
  const hash = await bcryptjs.hash('password123', 10);

  // Users
  const adminId = uuid();
  const buyerId = uuid();
  const sellerId = uuid();

  await pool.query('INSERT INTO user_profiles (id, email, username, password_hash, role, is_verified, is_active, rating, total_transactions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [adminId, 'admin@safeescrow.com', 'Admin', hash, 'admin', true, true, 5.0, 0]);
  await pool.query('INSERT INTO user_profiles (id, email, username, password_hash, role, is_verified, is_active, rating, total_transactions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [buyerId, 'buyer@example.com', 'John Buyer', hash, 'buyer', true, true, 5.0, 12]);
  await pool.query('INSERT INTO user_profiles (id, email, username, password_hash, role, is_verified, is_active, rating, total_transactions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [sellerId, 'seller@example.com', 'Jane Seller', hash, 'seller', true, true, 4.9, 45]);

  // Categories
  const catElectronics = uuid();
  const catWatches = uuid();
  const catVehicles = uuid();
  const catArt = uuid();
  const catJewelry = uuid();
  const catSports = uuid();
  const catInstruments = uuid();
  const catRealEstate = uuid();

  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catElectronics, 'Electronics', 'electronics', 'Laptop', 2, 'text-blue-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catWatches, 'Luxury Watches', 'watches', 'Watch', 1, 'text-amber-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catVehicles, 'Vehicles', 'vehicles', 'Car', 1, 'text-red-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catArt, 'Art & Collectibles', 'art', 'Palette', 1, 'text-purple-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catJewelry, 'Jewelry', 'jewelry', 'Gem', 1, 'text-pink-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catSports, 'Sports Equipment', 'sports', 'Trophy', 0, 'text-green-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catInstruments, 'Musical Instruments', 'instruments', 'Music', 1, 'text-indigo-500']);
  await pool.query('INSERT INTO categories (id, name, slug, icon, listing_count, color) VALUES ($1,$2,$3,$4,$5,$6)', [catRealEstate, 'Real Estate', 'real-estate', 'Building2', 0, 'text-cyan-500']);

  // Listings
  const l1 = uuid(), l2 = uuid(), l3 = uuid(), l4 = uuid(), l5 = uuid(), l6 = uuid();
  await pool.query('INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location, status, view_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [l1, 'MacBook Pro M3 Max', 'Brand new MacBook Pro with M3 Max chip, 64GB RAM, 1TB SSD. Still sealed in box.', 3499.99, 'USD', catElectronics, sellerId, ['https://placehold.co/600x400?text=MacBook+Pro'], 'new', 'New York, NY', 'active', 234]);
  await pool.query('INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location, status, view_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [l2, 'Rolex Submariner 2024', 'Rolex Submariner Date 126610LN. Full set with box and papers. Mint condition.', 15999.99, 'USD', catWatches, sellerId, ['https://placehold.co/600x400?text=Rolex'], 'like-new', 'Miami, FL', 'active', 567]);
  await pool.query('INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location, status, view_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [l3, 'Tesla Model S Plaid', '2023 Tesla Model S Plaid. 10k miles, flawless condition. Full warranty.', 89999.99, 'USD', catVehicles, sellerId, ['https://placehold.co/600x400?text=Tesla'], 'like-new', 'Los Angeles, CA', 'active', 1893]);
  await pool.query('INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location, status, view_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [l4, 'Banksy Screen Print', 'Authentic Banksy screen print "Girl with Balloon". COA included. Framed.', 45000.00, 'USD', catArt, sellerId, ['https://placehold.co/600x400?text=Banksy'], 'good', 'London, UK', 'active', 445]);
  await pool.query('INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location, status, view_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [l5, 'Gibson Les Paul Standard', 'Gibson Les Paul Standard 60s Bourbon Burst. Professional setup done. Hard case.', 2899.99, 'USD', catInstruments, sellerId, ['https://placehold.co/600x400?text=Gibson'], 'like-new', 'Nashville, TN', 'active', 178]);
  await pool.query('INSERT INTO listings (id, title, description, price, currency, category_id, seller_id, images, condition, location, status, view_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [l6, 'Cartier Love Bracelet', 'Cartier Love Bracelet 18K Yellow Gold. Size 17. Original box and certificate.', 6850.00, 'USD', catJewelry, sellerId, ['https://placehold.co/600x400?text=Cartier'], 'new', 'Beverly Hills, CA', 'active', 892]);

  // Escrow cases
  const esc1 = 'ESC-2024-001', esc2 = 'ESC-2024-002', esc3 = 'ESC-2024-003';
  await pool.query('INSERT INTO escrow_cases (id, case_number, buyer_id, seller_id, listing_id, listing_title, amount, fees, currency, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [esc1, esc1, buyerId, sellerId, l1, 'MacBook Pro M3 Max', 3499.99, 104.99, 'USD', 'awaiting_payment']);
  await pool.query('INSERT INTO escrow_cases (id, case_number, buyer_id, seller_id, listing_id, listing_title, amount, fees, currency, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [esc2, esc2, buyerId, sellerId, l2, 'Rolex Submariner 2024', 15999.99, 479.99, 'USD', 'in_transit']);
  await pool.query('INSERT INTO escrow_cases (id, case_number, buyer_id, seller_id, listing_id, listing_title, amount, fees, currency, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [esc3, esc3, buyerId, sellerId, l3, 'Tesla Model S Plaid', 89999.99, 2699.99, 'USD', 'payment_submitted']);

  // Conversation
  const convId = uuid();
  await pool.query('INSERT INTO conversations (id, buyer_id, seller_id, listing_id, listing_title, last_message, last_message_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())', [convId, buyerId, sellerId, l1, 'MacBook Pro M3 Max', 'Great, thanks!']);

  // Messages
  await pool.query('INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES ($1,$2,$3,NOW() - INTERVAL \'2 hours\')', [convId, buyerId, 'Hi, is this still available?']);
  await pool.query('INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES ($1,$2,$3,NOW() - INTERVAL \'1 hour\')', [convId, sellerId, 'Yes, it is! Would you like to make an offer?']);
  await pool.query('INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES ($1,$2,$3,NOW() - INTERVAL \'30 minutes\')', [convId, buyerId, 'Great! Can you do $3,200?']);
  await pool.query("INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES ($1,$2,$3,NOW() - INTERVAL '5 minutes')", [convId, sellerId, 'How about $3,300?']);

  // Wallets
  await pool.query('INSERT INTO wallets (user_id, balance, pending_balance, currency) VALUES ($1,50000,0,$2)', [adminId, 'USD']);
  await pool.query('INSERT INTO wallets (user_id, balance, pending_balance, currency) VALUES ($1,10000,3499.99,$2)', [buyerId, 'USD']);
  await pool.query('INSERT INTO wallets (user_id, balance, pending_balance, currency) VALUES ($1,25000,15999.99,$2)', [sellerId, 'USD']);

  // Payment settings
  await pool.query("INSERT INTO payment_settings (method, is_active, crypto_address, crypto_network) VALUES ('USDT (ERC-20)', true, '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'Ethereum')");
  await pool.query("INSERT INTO payment_settings (method, is_active, crypto_address, crypto_network) VALUES ('USDT (TRC-20)', true, 'TXYZ123456789abcdefghijklmnopqrstuvw', 'Tron')");
  await pool.query("INSERT INTO payment_settings (method, is_active, crypto_address, crypto_network) VALUES ('BTC', true, 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'Bitcoin')");

  // Notifications
  await pool.query("INSERT INTO notifications (user_id, type, title, message, is_read) VALUES ($1,'new_message','New Message','Jane Seller sent you a message about MacBook Pro',false)", [buyerId]);
  await pool.query("INSERT INTO notifications (user_id, type, title, message, is_read) VALUES ($1,'payment_submitted','Payment Submitted','Your payment for Tesla Model S has been submitted',false)", [buyerId]);
  await pool.query("INSERT INTO notifications (user_id, type, title, message, is_read) VALUES ($1,'funds_released','Funds Released','Funds for Rolex Submariner have been released',true)", [sellerId]);

  console.log('Seed data inserted successfully.');
  console.log('---');
  console.log('Admin: admin@safeescrow.com / password123');
  console.log('Buyer: buyer@example.com / password123');
  console.log('Seller: seller@example.com / password123');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });