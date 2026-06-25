// Drop-in replacement for @supabase/supabase-js that routes through our Railway backend API
// Pages can still use `import { supabase } from '@/lib/supabase'` without changes
import * as client from './client';

const API = '';

// Store tokens
function getToken() {
  return localStorage.getItem('auth_token');
}

// Build URL query params from a chain of filters
function buildParams(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (key === 'or') { params.set('or', val); }
    else { params.set(key, String(val)); }
  }
  return params.toString();
}

// Generic query builder that maps .from().select().eq() chains to REST API calls
class QueryBuilder {
  private table: string;
  private method: string = 'GET';
  private filters: Record<string, string> = {};
  private _single = false;
  private orderCol = '';
  private orderAsc = true;
  private limitVal = 0;
  private offsetVal = 0;
  private insertData: any = null;
  private updateData: any = null;
  private deleteMode = false;
  private countMode = false;
  private selectFields = '*';

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string) {
    this.selectFields = fields || '*';
    return this;
  }

  insert(data: any) {
    this.method = 'POST';
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.method = 'PUT';
    this.updateData = data;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    this.deleteMode = true;
    return this;
  }

  eq(col: string, val: any) { this.filters[`eq_${col}`] = String(val); return this; }
  neq(col: string, val: any) { this.filters[`neq_${col}`] = String(val); return this; }
  in(col: string, vals: any[]) { this.filters[`in_${col}`] = JSON.stringify(vals); return this; }
  single() { this._single = true; return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  ilike(col: string, val: any) { this.filters[`ilike_${col}`] = String(val); return this; }
  gte(col: string, val: any) { this.filters[`gte_${col}`] = String(val); return this; }
  lte(col: string, val: any) { this.filters[`lte_${col}`] = String(val); return this; }
  limit(n: number) { this.limitVal = n; return this; }
  range(start: number, end: number) { this.offsetVal = start; this.limitVal = end - start + 1; return this; }
  or(filter: string) { this.filters['or'] = filter; return this; }
  textSearch() { return this; }
  abortSignal() { return this; }

  // Special handling for { count: 'exact', head: true }
  async execute(): Promise<{ data: any; error: any; count: number | null }> {
    try {
      // Map table to endpoint
      const endpoint = this.mapTableToEndpoint();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (this.method === 'POST' && this.insertData) {
        // Handle post body — wrap in the table structure if needed
        const body = this.insertData;
        const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          return { data: null, error: new Error(errBody.error || 'Insert failed'), count: null };
        }
        const data = await res.json();
        return { data: data.id || data, error: null, count: null };
      }

      if (this.method === 'PUT' && this.updateData) {
        const id = this.filters[`eq_id`];
        const res = await fetch(`${API}${endpoint}${id ? `/${id}` : ''}`, {
          method: 'PUT', headers,
          body: JSON.stringify(this.updateData),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          return { data: null, error: new Error(errBody.error || 'Update failed'), count: null };
        }
        return { data: await res.json(), error: null, count: null };
      }

      if (this.method === 'DELETE' && this.deleteMode) {
        const id = this.filters[`eq_id`];
        await fetch(`${API}${endpoint}/${id}`, { method: 'DELETE', headers });
        return { data: null, error: null, count: null };
      }

      // GET
      const params = buildParams(this.filters);
      const url = `${API}${endpoint}${params ? `?${params}` : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }));
        return { data: this._single ? null : [], error: new Error(errBody.error || `Request failed: ${res.status}`), count: null };
      }
      const data = await res.json();
      return { data: this._single ? (Array.isArray(data) ? data[0] : data) : data, error: null, count: (Array.isArray(data) ? data.length : null) };
    } catch (err: any) {
      return { data: null, error: err, count: null };
    }
  }

  // Thenable — makes QueryBuilder awaitable
  then(resolve: (value: { data: any; error: any; count: number | null }) => void) {
    resolve(this.execute());
    return this;
  }
  catch(reject?: (reason: any) => void) {
    this.execute().catch(reject || (() => {}));
    return this;
  }
  finally(fn: () => void) {
    this.execute().finally(fn);
    return this;
  }

  private mapTableToEndpoint(): string {
    const map: Record<string, string> = {
      categories: '/api/categories',
      listings: '/api/listings',
      user_profiles: '/api/admin/users',
      escrow_cases: '/api/escrow',
      escrow_timeline: '/api/escrow/timeline',
      notifications: '/api/notifications',
      conversations: '/api/conversations',
      messages: '/api/messages',
      favorites: '/api/favorites',
      wallets: '/api/wallet',
      wallet_transactions: '/api/admin/wallet-transactions',
      payment_settings: '/api/admin/payment-settings',
      seller_requests: '/api/seller-requests',
      payouts: '/api/admin/payouts',
      dispute_evidence: '/api/admin/disputes',
      reviews: '/api/reviews',
      audit_logs: '/api/admin/audit-logs',
      uploaded_files: '/api/storage',
    };
    return map[this.table] || `/api/${this.table}`;
  }
}

// Auth handler
const authHandler = {
  getSession: async () => {
    const token = getToken();
    if (!token) return { data: { session: null }, error: null };
    try {
      const user = await client.auth.me();
      return { data: { session: { user: { id: user.id, email: user.email, user_metadata: { username: user.username, role: user.role, avatar_url: user.avatar } } } }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },
  onAuthStateChange: () => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
  signInWithOtp: async () => ({ data: null, error: new Error('OTP not supported via API — use email/password') }),
  verifyOtp: async () => ({ data: null, error: new Error('OTP not supported') }),
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const result = await client.auth.login(email, password);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return { data: { user: { id: result.user.id, email: result.user.email, user_metadata: { username: result.user.username, role: result.user.role, avatar_url: result.user.avatar } } }, error: null };
  },
  updateUser: async (attrs: any) => {
    const token = getToken();
    if (!token) return { data: null, error: new Error('Not authenticated') };
    // Handle password update vs profile update
    if (attrs.password) {
      // For role sync from admin
      if (attrs.data?.role) {
        await client.auth.updateProfile({ role: attrs.data.role });
      }
    }
    if (attrs.data?.username) {
      await client.auth.updateProfile({ username: attrs.data.username });
    }
    return { data: { user: { id: '', user_metadata: attrs.data } }, error: null };
  },
  signOut: async () => {
    localStorage.removeItem('auth_token');
    return { error: null };
  },
};

// Main export — a supabase-like object
export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth: authHandler,
  rpc: () => Promise.resolve({ data: null, error: null }),
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, file: File) => {
        try {
          const result = await client.storage.upload(file);
          return { data: { path: result.url }, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    }),
  },
};

// Supabase-js types no longer needed - using inline types via client.ts