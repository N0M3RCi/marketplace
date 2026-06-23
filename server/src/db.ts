import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/marketplace',
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export default pool;