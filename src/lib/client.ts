// Centralized API client for the marketplace backend
const API = '';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const msg = body.error || `Request failed: ${res.status}`;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return res.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, username: string) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, username }) }),
  me: () => request('/api/auth/me'),
  updateProfile: (data: any) =>
    request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/api/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
};

// Categories
export const categories = {
  list: () => request('/api/categories'),
};

// Listings
export const listings = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/listings${qs}`);
  },
  get: (id: string) => request(`/api/listings/${id}`),
  create: (data: any) =>
    request('/api/listings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request(`/api/listings/${id}`, { method: 'DELETE' }),
};

// Favorites
export const favorites = {
  list: () => request('/api/favorites'),
  toggle: (listingId: string) =>
    request('/api/favorites/toggle', { method: 'POST', body: JSON.stringify({ listingId }) }),
};

// Conversations
export const conversations = {
  list: () => request('/api/conversations'),
  getOrCreate: (data: any) =>
    request('/api/conversations', { method: 'POST', body: JSON.stringify(data) }),
  markRead: (id: string, isBuyer: boolean) =>
    request(`/api/conversations/${id}/read`, { method: 'PUT', body: JSON.stringify({ isBuyer }) }),
};

// Messages
export const messages = {
  list: (conversationId: string) => request(`/api/messages/${conversationId}`),
  send: (conversationId: string, content: string, isBuyer: boolean) =>
    request('/api/messages', { method: 'POST', body: JSON.stringify({ conversationId, content, isBuyer }) }),
};

// Notifications
export const notifications = {
  list: (limit?: number) => request(`/api/notifications?limit=${limit || 30}`),
  markRead: (id: string) =>
    request(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () =>
    request('/api/notifications/read-all', { method: 'PUT' }),
};

// Escrow
export const escrow = {
  list: () => request('/api/escrow'),
  get: (id: string) => request(`/api/escrow/${id}`),
  create: (data: any) =>
    request('/api/escrow', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request(`/api/escrow/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  timeline: (caseId: string) => request(`/api/escrow/${caseId}/timeline`),
  addTimeline: (data: any) =>
    request('/api/escrow/timeline', { method: 'POST', body: JSON.stringify(data) }),
};

// Wallet
export const wallet = {
  get: () => request('/api/wallet'),
  transactions: () => request('/api/wallet/transactions'),
  paymentMethods: () => request('/api/wallet/payment-methods'),
};

// Storage (file upload)
export const storage = {
  upload: (file: File): Promise<{ id: string; url: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const result = await request('/api/storage/upload', {
            method: 'POST',
            body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size, fileData: base64 }),
          });
          resolve(result);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },
};

// Seller Requests
export const sellerRequests = {
  my: () => request('/api/seller-requests'),
  create: (reason: string) =>
    request('/api/seller-requests', { method: 'POST', body: JSON.stringify({ reason }) }),
};

// Payment Addresses (public)
export const paymentAddresses = {
  list: () => request('/api/payment-addresses'),
};

// Admin API
export const admin = {
  users: {
    list: () => request('/api/admin/users'),
    updateRole: (id: string, role: string) =>
      request(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    updateProfile: (id: string, data: any) =>
      request(`/api/admin/users/${id}/profile`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string, isActive: boolean) =>
      request(`/api/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, is_active: isActive }) }),
    toggleVerify: (id: string) =>
      request(`/api/admin/users/${id}/verify`, { method: 'PUT' }),
  },
  listings: {
    list: () => request('/api/admin/listings'),
    update: (id: string, data: any) =>
      request(`/api/admin/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/api/admin/listings/${id}`, { method: 'DELETE' }),
  },
  escrow: {
    list: () => request('/api/admin/escrow'),
    get: (id: string) => request(`/api/admin/escrow/${id}`),
    update: (id: string, data: any) =>
      request(`/api/admin/escrow/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateDeliveryStatus: (id: string, deliveryStatus: string, escrowStatus?: string) =>
      request(`/api/admin/escrow/${id}/delivery-status`, {
        method: 'PUT',
        body: JSON.stringify({ delivery_status: deliveryStatus, status: escrowStatus }),
      }),
    delete: (id: string) =>
      request(`/api/admin/escrow/${id}`, { method: 'DELETE' }),
  },
  wallets: {
    list: () => request('/api/admin/wallets'),
    update: (id: string, balance: number, pendingBalance: number) =>
      request(`/api/admin/wallets/${id}`, { method: 'PUT', body: JSON.stringify({ balance, pending_balance: pendingBalance }) }),
    transactions: () => request('/api/admin/wallet-transactions'),
    walletTransactions: (walletId: string) => request(`/api/admin/wallet-transactions/${walletId}`),
  },
  payouts: {
    list: () => request('/api/admin/payouts'),
    create: (data: any) =>
      request('/api/admin/payouts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`/api/admin/payouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  disputes: {
    list: () => request('/api/admin/disputes'),
    evidence: (caseId: string) => request(`/api/admin/disputes/${caseId}/evidence`),
  },
  paymentReviews: {
    list: () => request('/api/admin/payment-reviews'),
  },
  paymentSettings: {
    list: () => request('/api/admin/payment-settings'),
    create: (data: any) =>
      request('/api/admin/payment-settings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`/api/admin/payment-settings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/api/admin/payment-settings/${id}`, { method: 'DELETE' }),
  },
  messages: {
    list: () => request('/api/admin/messages'),
  },
  analytics: {
    get: () => request('/api/admin/analytics'),
  },
  auditLogs: {
    list: () => request('/api/admin/audit-logs'),
  },
  sellerRequests: {
    list: () => request('/api/admin/seller-requests'),
    approve: (id: string) =>
      request(`/api/admin/seller-requests/${id}/approve`, { method: 'PUT' }),
    reject: (id: string, notes?: string) =>
      request(`/api/admin/seller-requests/${id}/reject`, { method: 'PUT', body: JSON.stringify({ notes }) }),
  },
  categories: {
    list: () => request('/api/admin/categories'),
    create: (data: any) =>
      request('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  },
  featuredListings: {
    list: () => request('/api/admin/featured-listings'),
    add: (listingId: string) =>
      request('/api/admin/featured-listings', { method: 'POST', body: JSON.stringify({ listing_id: listingId }) }),
    remove: (id: string) =>
      request(`/api/admin/featured-listings/${id}`, { method: 'DELETE' }),
    reorder: (ids: string[]) =>
      request('/api/admin/featured-listings/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
  },
};

// Currency / exchange rates
export const currency = {
  rates: (): Promise<{ base: string; rates: Record<string, number> }> =>
    request('/api/currency/rates'),
  convert: (amount: number, from = 'USD', to = 'USD'): Promise<{ amount: number; from: string; to: string; rate: number }> =>
    request(`/api/currency/convert?amount=${amount}&from=${from}&to=${to}`),
};