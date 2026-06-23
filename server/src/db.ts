import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/marketplace';

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Allow the pool to retry on connection failures
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  // The pool will automatically attempt to recover on next query
});

// Helper to execute a query with automatic retry on connection errors
export async function queryWithRetry(text: string, params?: any[], retries = 2): Promise<pg.QueryResult> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err: any) {
      const isConnectionError =
        err.code === 'ECONNREFUSED' || err.code === '08001' || err.code === '08003' ||
        err.code === '08006' || err.code === '08007' || err.message?.includes('connection');
      if (isConnectionError && attempt <= retries) {
        console.warn(`Database query failed (attempt ${attempt}), retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Query failed after all retries');
}

// Test connection on startup (non-blocking)
pool.query('SELECT 1').then(() => {
  console.log('Database connection verified.');
}).catch((err) => {
  console.warn('Database not available at startup, will retry on demand:', err.message);
});

export default pool;