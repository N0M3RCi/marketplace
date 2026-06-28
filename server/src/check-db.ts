import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/marketplace' });

async function check() {
  // Check listings - all of them, including non-seed ones
  const listings = await pool.query('SELECT id, title, price, status, seller_id, created_at FROM listings ORDER BY created_at ASC');
  console.log('=== ALL LISTINGS ===');
  for (const l of listings.rows) {
    console.log(`  ${l.id} | "${l.title}" | $${l.price} | status: ${l.status} | created: ${l.created_at}`);
  }

  // Check categories
  const cats = await pool.query('SELECT id, name, slug FROM categories ORDER BY name');
  console.log('\n=== CATEGORIES ===');
  for (const c of cats.rows) {
    console.log(`  ${c.id} | ${c.name} (${c.slug})`);
  }

  // Check featured listings
  const featured = await pool.query('SELECT fl.sort_order, l.title FROM featured_listings fl JOIN listings l ON fl.listing_id = l.id ORDER BY fl.sort_order');
  console.log('\n=== FEATURED LISTINGS ===');
  for (const f of featured.rows) {
    console.log(`  ${f.sort_order}. ${f.title}`);
  }

  // Check users
  const users = await pool.query("SELECT id, email, username, role FROM user_profiles ORDER BY created_at");
  console.log('\n=== USERS ===');
  for (const u of users.rows) {
    console.log(`  ${u.id} | ${u.email} | ${u.username} | role: ${u.role}`);
  }

  await pool.end();
}

check().catch(err => { console.error(err); process.exit(1); });