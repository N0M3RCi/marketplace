import pg from 'pg';

const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is required in production');
}
const connectionString = rawConnectionString || 'postgresql://postgres:postgres@localhost:5432/marketplace';

// Log connection diagnostic (password masked)
const masked = connectionString
  ? connectionString.replace(/\/\/[^:]+:[^@]+@/, '//USER:***@')
  : '(empty)';
console.log(`DB config: DATABASE_URL env set: ${!!rawConnectionString}, using: ${masked}`);

if (!rawConnectionString) {
  console.warn('⚠️  DATABASE_URL environment variable is NOT SET on Railway.');
  console.warn('   Go to Railway Dashboard → your service → Variables tab.');
  console.warn('   Verify a PostgreSQL plugin is linked (add one if not, then link it).');
  console.warn('   DATABASE_URL should auto-populate. If empty, click "New Variable" or re-link the database.');
}

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
        err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === '08001' || err.code === '08003' ||
        err.code === '08004' || err.code === '08006' || err.code === '08007' || err.message?.includes('connection');
      if (isConnectionError && attempt <= retries) {
        console.warn(`Database query failed (attempt ${attempt}/${retries + 1}), retrying in 1s...`, err.code || err.message);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (attempt > 1 || isConnectionError) {
        console.error(`Database query error (final): [${err.code}] ${err.message}`);
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
  console.warn('═══════════════════════════════════════');
  console.warn('  DATABASE CONNECTION FAILED');
  console.warn('  Error:', err.code || err.message);
  console.warn('  This means Railway cannot reach your PostgreSQL database.');
  console.warn('  ═  Check that a PostgreSQL plugin exists in your Railway project');
  console.warn('  ═  Verify it is LINKED to your web service (not just in the same project)');
  console.warn('  ═  Confirm DATABASE_URL has a value in the Variables tab');
  console.warn('  ═  If all else fails, remove and re-add the PostgreSQL plugin');
  console.warn('═══════════════════════════════════════');
});

export default pool;