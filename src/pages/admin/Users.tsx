import { useState, useEffect, useCallback } from 'react';
import {
  Search, Shield, CheckCircle, XCircle, Filter, Loader2,
  RefreshCw, Edit2, X, Save, User, Mail, Phone, Star,
  ShieldCheck, ChevronRight, Hash, Plus,
  Ban, AlertTriangle, Crown, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { admin } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DBUser {
  id: string;
  username: string;
  email: string;
  role: 'buyer' | 'seller' | 'admin' | 'both';
  status: 'active' | 'blocked' | 'restricted';
  phone?: string;
  avatarUrl?: string;
  isVerified: boolean;
  isActive: boolean;
  totalTransactions: number;
  rating: number;
  createdAt?: string;
}

interface EditForm {
  username: string;
  role: string;
  status: 'active' | 'blocked' | 'restricted';
  phone: string;
  isVerified: boolean;
}

interface SellerRequest {
  id: string;
  userId: string;
  username: string;
  email: string;
  currentRole: string;
  avatarUrl?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  adminNotes?: string;
  createdAt: string;
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  admin:  { label: 'Admin',  bg: 'bg-purple-100', color: 'text-purple-700' },
  seller: { label: 'Seller', bg: 'bg-amber-100',  color: 'text-amber-700' },
  buyer:  { label: 'Buyer',  bg: 'bg-blue-100',   color: 'text-blue-700' },
  both:   { label: 'Both',   bg: 'bg-emerald-100',color: 'text-emerald-700' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; icon: React.ElementType; desc: string }> = {
  active:     { label: 'Active',      bg: 'bg-emerald-50',  color: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle,    desc: 'Full access to platform' },
  blocked:    { label: 'Blocked',     bg: 'bg-red-50',      color: 'text-red-700',     border: 'border-red-200',     icon: Ban,            desc: 'Cannot log in or transact' },
  restricted: { label: 'Restricted',  bg: 'bg-amber-50',    color: 'text-amber-700',   border: 'border-amber-200',   icon: AlertTriangle,  desc: 'Can browse, limited actions' },
};

export default function AdminUsers() {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<DBUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ username: '', role: 'buyer', status: 'active', phone: '', isVerified: false });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'seller-requests'>('users');
  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
const [showCreateModal, setShowCreateModal] = useState(false);
const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', role: 'seller' });
const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status, phone, avatar_url, is_verified, is_active, total_transactions, rating, created_at')
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to load users'); return; }

    setUsers((data || []).map((u: any) => ({
      id: u.id,
      username: u.username || u.email?.split('@')[0] || 'Unknown',
      email: u.email,
      role: u.role || 'buyer',
      status: u.status || 'active',
      phone: u.phone || '',
      avatarUrl: u.avatar_url,
      isVerified: u.is_verified || false,
      isActive: u.is_active !== false,
      totalTransactions: u.total_transactions || 0,
      rating: Number(u.rating || 5.0),
      createdAt: u.created_at,
    })));
  }, []);

  const fetchSellerRequests = useCallback(async () => {
    setRequestsLoading(true);
    const { data } = await supabase
      .from('seller_requests')
      .select('*, user:user_profiles!seller_requests_user_id_fkey(id, username, email, role, avatar_url)')
      .order('created_at', { ascending: false });
    setSellerRequests((data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      username: r.user?.username || r.user?.email?.split('@')[0] || 'Unknown',
      email: r.user?.email || '',
      currentRole: r.user?.role || 'buyer',
      avatarUrl: r.user?.avatar_url,
      reason: r.reason,
      status: r.status,
      adminNotes: r.admin_notes,
      createdAt: r.created_at,
    })));
    setRequestsLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchUsers().finally(() => setLoading(false));
    fetchSellerRequests();
  }, [fetchUsers, fetchSellerRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), fetchSellerRequests()]);
    setRefreshing(false);
  };

  const handleApproveRequest = async (req: SellerRequest) => {
    setProcessingRequest(req.id);
    const { error } = await supabase.from('seller_requests')
      .update({ status: 'approved', admin_id: adminUser?.id, updated_at: new Date().toISOString() })
      .eq('id', req.id);
    if (error) { toast.error('Failed to approve'); setProcessingRequest(null); return; }

    await supabase.from('user_profiles').update({ role: 'seller' }).eq('id', req.userId);

    await supabase.from('notifications').insert({
      user_id: req.userId,
      type: 'seller_approved',
      title: 'Seller Request Approved',
      message: 'Your request to become a seller has been approved! You can now list items on SafeEscrow.',
    });

    await supabase.from('audit_logs').insert({
      admin_id: adminUser?.id,
      admin_name: adminUser?.username || 'Admin',
      action: 'approve_seller_request',
      entity_type: 'user',
      entity_id: req.userId,
      details: `Approved seller request for "${req.username}" — role upgraded to seller`,
    });

    toast.success(`${req.username} is now a seller`);
    await Promise.all([fetchSellerRequests(), fetchUsers()]);
    setProcessingRequest(null);
  };

  const handleDenyRequest = async (req: SellerRequest) => {
    setProcessingRequest(req.id);
    const { error } = await supabase.from('seller_requests')
      .update({ status: 'denied', admin_id: adminUser?.id, updated_at: new Date().toISOString() })
      .eq('id', req.id);
    if (error) { toast.error('Failed to deny'); setProcessingRequest(null); return; }

    await supabase.from('notifications').insert({
      user_id: req.userId,
      type: 'seller_denied',
      title: 'Seller Request Not Approved',
      message: 'Your request to become a seller was not approved at this time. Contact support for more information.',
    });

    await supabase.from('audit_logs').insert({
      admin_id: adminUser?.id,
      admin_name: adminUser?.username || 'Admin',
      action: 'deny_seller_request',
      entity_type: 'user',
      entity_id: req.userId,
      details: `Denied seller request for "${req.username}"`,
    });

    toast.success('Request denied');
    await fetchSellerRequests();
    setProcessingRequest(null);
  };

  const openEditPanel = (u: DBUser) => {
    setSelectedUser(u);
    setEditForm({ username: u.username, role: u.role, status: u.status, phone: u.phone || '', isVerified: u.isVerified });
  };

  const closePanel = () => setSelectedUser(null);

  const handleSave = async () => {
    if (!selectedUser) return;
    if (!editForm.username.trim()) { toast.error('Username is required'); return; }
    setSaving(true);
    const isActive = editForm.status !== 'blocked';
    const { error } = await supabase.from('user_profiles').update({
      username: editForm.username.trim(),
      role: editForm.role,
      status: editForm.status,
      is_active: isActive,
      phone: editForm.phone.trim() || null,
      is_verified: editForm.isVerified,
    }).eq('id', selectedUser.id);
    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return; }
    await supabase.from('audit_logs').insert({
      admin_id: adminUser?.id,
      admin_name: adminUser?.username || 'Admin',
      action: 'edit_user',
      entity_type: 'user',
      entity_id: selectedUser.id,
      details: `Updated user "${editForm.username}" — role: ${editForm.role}, status: ${editForm.status}, verified: ${editForm.isVerified}`,
    });
    toast.success('User updated successfully');
    await fetchUsers();
    setSelectedUser(prev => prev ? { ...prev, username: editForm.username.trim(), role: editForm.role as any, status: editForm.status, phone: editForm.phone, isVerified: editForm.isVerified, isActive } : null);
    setSaving(false);
  };

  const handleQuickStatus = async (userId: string, newStatus: 'active' | 'blocked' | 'restricted') => {
    const u = users.find(u => u.id === userId);
    const isActive = newStatus !== 'blocked';
    const { error } = await supabase.from('user_profiles').update({ status: newStatus, is_active: isActive }).eq('id', userId);
    if (error) { toast.error('Failed to update status'); return; }
    await supabase.from('audit_logs').insert({
      admin_id: adminUser?.id, admin_name: adminUser?.username || 'Admin',
      action: 'change_user_status', entity_type: 'user', entity_id: userId,
      details: `User "${u?.username}" status changed to ${newStatus}`,
    });
    toast.success(`User ${newStatus}`);
    await fetchUsers();
    if (selectedUser?.id === userId) {
      setEditForm(f => ({ ...f, status: newStatus }));
      setSelectedUser(prev => prev ? { ...prev, status: newStatus, isActive } : null);
    }
  };

  const handleQuickVerify = async (userId: string, currentValue: boolean) => {
    const u = users.find(u => u.id === userId);
    const { error } = await supabase.from('user_profiles').update({ is_verified: !currentValue }).eq('id', userId);
    if (error) { toast.error('Failed to update'); return; }
    const label = currentValue ? 'unverified' : 'verified';
    await supabase.from('audit_logs').insert({
      admin_id: adminUser?.id, admin_name: adminUser?.username || 'Admin',
      action: 'toggle_verification', entity_type: 'user', entity_id: userId,
      details: `User "${u?.username}" ${label}`,
    });
    toast.success(`User ${label}`);
    await fetchUsers();
    if (selectedUser?.id === userId) {
      setEditForm(f => ({ ...f, isVerified: !currentValue }));
      setSelectedUser(prev => prev ? { ...prev, isVerified: !currentValue } : null);
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.error('Username, email, and password are required');
      return;
    }
    setCreating(true);
    try {
      await admin.users.create({
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      });
      toast.success(`User "${createForm.username}" created successfully`);
      setShowCreateModal(false);
      setCreateForm({ username: '', email: '', password: '', role: 'seller' });
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create user');
    }
    setCreating(false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const stats = {
    total:      users.length,
    verified:   users.filter(u => u.isVerified).length,
    blocked:    users.filter(u => u.status === 'blocked').length,
    restricted: users.filter(u => u.status === 'restricted').length,
    admins:     users.filter(u => u.role === 'admin').length,
  };

  const pendingRequests = sellerRequests.filter(r => r.status === 'pending');

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#C68000' }} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: '#2A1A00' }}>User Management</h1>
          <p className="text-sm mt-1" style={{ color: '#9A7C40' }}>{users.length} registered users · {pendingRequests.length} pending seller requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#C68000', color: '#FFF8E5', border: 'none' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#A66800'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#C68000'}>
            <Plus className="w-4 h-4" /> Create User
          </button>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg transition-colors"
            style={{ border: '1px solid rgba(200,160,60,0.15)', color: '#9A7C40' }}>
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-6" style={{ borderBottom: '1px solid rgba(200,160,60,0.12)' }}>
        {[
          { key: 'users', label: 'All Users', count: users.length },
          { key: 'seller-requests', label: 'Seller Requests', count: pendingRequests.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={activeTab === tab.key
              ? { color: '#C68000', borderBottom: '2px solid #C68000', marginBottom: '-1px' }
              : { color: '#9A7C40' }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={tab.key === 'seller-requests' && pendingRequests.length > 0
                  ? { background: 'rgba(239,68,68,0.20)', color: 'rgba(252,165,165,0.90)' }
                  : { background: 'rgba(200,160,60,0.15)', color: '#C68000' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ──── SELLER REQUESTS TAB ──── */}
      {activeTab === 'seller-requests' && (
        <div>
          <div className="mb-4">
            <h2 className="font-heading text-lg font-bold" style={{ color: '#2A1A00' }}>Seller Role Requests</h2>
            <p className="text-sm mt-0.5" style={{ color: '#9A7C40' }}>Review users requesting seller access on the platform</p>
          </div>
          {requestsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#C68000' }} />
            </div>
          ) : sellerRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
              <Store className="w-10 h-10 mb-3 opacity-20" style={{ color: '#9A7C40' }} />
              <p className="text-sm" style={{ color: '#9A7C40' }}>No seller requests yet</p>
              <p className="text-xs mt-1" style={{ color: '#C8B090' }}>Requests appear here when users apply to become sellers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellerRequests.map(req => (
                <div key={req.id} className="rounded-xl p-5" style={{
                  background: req.status === 'pending' ? 'rgba(200,160,60,0.08)' : 'rgba(200,160,60,0.05)',
                  border: req.status === 'pending' ? '1px solid rgba(200,160,60,0.18)' : '1px solid rgba(200,160,60,0.10)',
                }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                        style={{ background: 'rgba(200,160,60,0.15)', color: '#C68000' }}>
                        {req.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: '#2A1A00' }}>{req.username}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 capitalize">{req.currentRole}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                            style={req.status === 'pending'
                              ? { background: 'rgba(251,191,36,0.15)', color: 'rgba(251,191,36,0.90)' }
                              : req.status === 'approved'
                              ? { background: 'rgba(52,211,153,0.15)', color: 'rgba(52,211,153,0.90)' }
                              : { background: 'rgba(239,68,68,0.15)', color: 'rgba(252,165,165,0.90)' }}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: '#9A7C40' }}>{req.email}</p>
                        {req.reason && (
                          <p className="text-xs mt-1.5 italic" style={{ color: '#9A7C40' }}>"{req.reason}"</p>
                        )}
                        <p className="text-[11px] mt-1" style={{ color: '#B8A070' }}>{formatDate(req.createdAt)}</p>
                      </div>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          disabled={processingRequest === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.30)', color: 'rgba(52,211,153,0.90)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.25)'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.15)'}>
                          {processingRequest === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Approve Seller
                        </button>
                        <button
                          onClick={() => handleDenyRequest(req)}
                          disabled={processingRequest === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: 'rgba(252,165,165,0.85)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.22)'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'}>
                          <XCircle className="w-3 h-3" /> Deny
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──── USERS TAB ──── */}
      {activeTab === 'users' && (
        <div className="flex gap-6">
          {/* Main Table Panel */}
          <div className={cn('flex-1 min-w-0 transition-all', selectedUser ? 'lg:max-w-[calc(100%-420px)]' : '')}>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Total Users',  value: stats.total,      highlight: false },
                { label: 'Verified',     value: stats.verified,   highlight: false },
                { label: 'Admins',       value: stats.admins,     highlight: false },
                { label: 'Blocked',      value: stats.blocked,    highlight: stats.blocked > 0 },
                { label: 'Restricted',   value: stats.restricted, highlight: stats.restricted > 0 },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4"
                  style={{ background: 'rgba(200,160,60,0.06)', border: s.highlight ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(200,160,60,0.12)' }}>
                  <p className="font-bold text-xl font-heading" style={{ color: s.highlight ? 'rgba(252,165,165,0.90)' : '#C68000' }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9A7C40' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B8A070' }} />
                <input type="text" placeholder="Search by name or email..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 transition-all"
                  style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }} />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs mr-1" style={{ color: '#B8A070' }}>Role:</span>
                {['all', 'admin', 'buyer', 'seller', 'both'].map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors"
                    style={roleFilter === r
                      ? { background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }
                      : { color: '#9A7C40' }}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs mr-1" style={{ color: '#B8A070' }}>Status:</span>
                {['all', 'active', 'restricted', 'blocked'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors"
                    style={statusFilter === s
                      ? { background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }
                      : { color: '#9A7C40' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <User className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#9A7C40' }} />
                  <p className="text-sm" style={{ color: '#9A7C40' }}>No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(200,160,60,0.10)', background: 'rgba(200,160,60,0.05)' }}>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>User</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>Role</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: '#9A7C40' }}>Tx / Rating</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: '#9A7C40' }}>Joined</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: '#9A7C40' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => {
                        const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.buyer;
                        const sc = STATUS_CONFIG[u.status] || STATUS_CONFIG.active;
                        const StatusIcon = sc.icon;
                        const isSelected = selectedUser?.id === u.id;
                        return (
                          <tr key={u.id}
                            onClick={() => openEditPanel(u)}
                            className="cursor-pointer group transition-colors"
                            style={{
                              borderBottom: '1px solid rgba(200,160,60,0.08)',
                              background: isSelected ? 'rgba(200,160,60,0.08)' : 'transparent',
                              borderLeft: isSelected ? '2px solid rgba(200,160,60,0.55)' : '2px solid transparent',
                            }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.05)'; }}
                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                                  {u.avatarUrl ? (
                                    <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold"
                                      style={{ background: 'rgba(200,160,60,0.16)', color: '#C68000' }}>
                                      {getInitials(u.username)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-medium text-xs" style={{ color: '#4A3010' }}>{u.username}</p>
                                    {u.role === 'admin' && <Crown className="w-3 h-3" style={{ color: '#C68000' }} />}
                                    {u.isVerified && <ShieldCheck className="w-3 h-3" style={{ color: 'rgba(52,211,153,0.80)' }} />}
                                  </div>
                                  <p className="text-[11px]" style={{ color: '#B8A070' }}>{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', rc.bg, rc.color)}>{rc.label}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border', sc.bg, sc.color, sc.border)}>
                                <StatusIcon className="w-3 h-3" />{sc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 hidden lg:table-cell">
                              <p className="text-xs" style={{ color: '#7A5C30' }}>{u.totalTransactions} tx</p>
                              <p className="text-[11px] text-amber-400">★ {u.rating.toFixed(1)}</p>
                            </td>
                            <td className="px-4 py-3.5 text-xs hidden md:table-cell" style={{ color: '#9A7C40' }}>
                              {u.createdAt ? formatDate(u.createdAt) : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={e => { e.stopPropagation(); handleQuickVerify(u.id, u.isVerified); }} title={u.isVerified ? 'Unverify' : 'Verify'}
                                  className="p-1.5 rounded-lg transition-colors" style={{ color: u.isVerified ? 'rgba(52,211,153,0.80)' : '#B8A070' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.10)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                  <Shield className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleQuickStatus(u.id, u.status === 'blocked' ? 'active' : 'blocked'); }} title={u.status === 'blocked' ? 'Unblock' : 'Block'}
                                  className="p-1.5 rounded-lg transition-colors" style={{ color: u.status === 'blocked' ? 'rgba(252,165,165,0.85)' : '#B8A070' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.10)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); openEditPanel(u); }}
                                  className="p-1.5 rounded-lg transition-colors" style={{ color: '#B8A070' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.10)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Edit Panel */}
          {selectedUser && (
            <div className="w-[420px] flex-shrink-0 hidden lg:block">
              <div className="rounded-2xl overflow-hidden sticky top-8" style={{ background: 'rgba(200,160,60,0.08)', border: '1px solid rgba(200,160,60,0.16)', backdropFilter: 'blur(20px)' }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(200,160,60,0.10)', borderBottom: '1px solid rgba(200,160,60,0.15)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: 'rgba(200,160,60,0.35)' }}>
                      {selectedUser.avatarUrl ? (
                        <img src={selectedUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ background: 'rgba(200,160,60,0.20)', color: '#C68000' }}>
                          {getInitials(selectedUser.username)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-heading font-bold text-sm" style={{ color: '#2A1A00' }}>{selectedUser.username}</p>
                        {selectedUser.role === 'admin' && <Crown className="w-3.5 h-3.5" style={{ color: '#C68000' }} />}
                        {selectedUser.isVerified && <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'rgba(52,211,153,0.80)' }} />}
                      </div>
                      <p className="text-[11px]" style={{ color: '#9A7C40' }}>{selectedUser.email}</p>
                    </div>
                  </div>
                  <button onClick={closePanel} className="p-1.5 rounded-lg transition-colors" style={{ color: '#9A7C40' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2A1A00'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9A7C40'}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(200,160,60,0.10)' }}>
                  {[
                    { label: 'Transactions', value: selectedUser.totalTransactions },
                    { label: 'Rating',       value: `★ ${selectedUser.rating.toFixed(1)}` },
                    { label: 'Joined',       value: selectedUser.createdAt ? formatDate(selectedUser.createdAt).split(',')[0] : '—' },
                  ].map(s => (
                    <div key={s.label} className="px-4 py-3 text-center" style={{ borderRight: '1px solid rgba(200,160,60,0.10)' }}>
                      <p className="font-bold text-sm" style={{ color: '#2A1A00' }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#B8A070' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                  <h3 className="font-heading font-semibold text-sm flex items-center gap-2" style={{ color: '#4A3000' }}>
                    <Edit2 className="w-4 h-4" style={{ color: '#9A7C40' }} /> Edit Profile
                  </h3>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                      <input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                        style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}
                        placeholder="Username" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Email (read-only)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#C8B090' }} />
                      <input value={selectedUser.email} disabled
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl cursor-not-allowed"
                        style={{ background: 'rgba(200,160,60,0.05)', border: '1px solid rgba(200,160,60,0.10)', color: '#B8A070' }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                      <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                        style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}
                        placeholder="+1 234 567 890" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: '#9A7C40' }}>Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                        <button key={k} type="button" onClick={() => setEditForm(f => ({ ...f, role: k }))}
                          className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border', v.bg, v.color)}
                          style={editForm.role === k ? { outline: '2px solid rgba(200,160,60,0.60)', outlineOffset: '1px', opacity: 1 } : { opacity: 0.55 }}>
                          {k === 'admin' && <Crown className="w-3.5 h-3.5 flex-shrink-0" />}
                          {k === 'buyer' && <User className="w-3.5 h-3.5 flex-shrink-0" />}
                          {k === 'seller' && <Star className="w-3.5 h-3.5 flex-shrink-0" />}
                          {k === 'both'   && <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />}
                          {v.label}
                          {editForm.role === k && <CheckCircle className="w-3 h-3 ml-auto flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: '#9A7C40' }}>Account Status</label>
                    <div className="space-y-2">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => {
                        const Icon = v.icon;
                        const isSel = editForm.status === k;
                        return (
                          <button key={k} type="button" onClick={() => setEditForm(f => ({ ...f, status: k as any }))}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all"
                            style={isSel
                              ? { background: k === 'active' ? 'rgba(52,211,153,0.12)' : k === 'blocked' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', border: k === 'active' ? '1px solid rgba(52,211,153,0.35)' : k === 'blocked' ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(245,158,11,0.35)' }
                              : { background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)', opacity: 0.65 }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: isSel ? (k === 'active' ? 'rgba(52,211,153,0.20)' : k === 'blocked' ? 'rgba(239,68,68,0.20)' : 'rgba(245,158,11,0.20)') : 'rgba(200,160,60,0.12)' }}>
                              <Icon className="w-4 h-4" style={{ color: isSel ? (k === 'active' ? 'rgba(52,211,153,0.90)' : k === 'blocked' ? 'rgba(252,165,165,0.90)' : 'rgba(251,191,36,0.90)') : '#9A7C40' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: isSel ? (k === 'active' ? 'rgba(52,211,153,0.95)' : k === 'blocked' ? 'rgba(252,165,165,0.95)' : 'rgba(251,191,36,0.95)') : '#7A5C30' }}>{v.label}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: '#B8A070' }}>{v.desc}</p>
                            </div>
                            {isSel && (
                              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: k === 'active' ? 'rgba(52,211,153,0.25)' : k === 'blocked' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)' }}>
                                <div className="w-2 h-2 rounded-full" style={{ background: k === 'active' ? '#34d399' : k === 'blocked' ? '#f87171' : '#fbbf24' }} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {editForm.status === 'blocked' && <p className="mt-2 text-[11px] px-2" style={{ color: 'rgba(252,165,165,0.70)' }}>⚠ Blocked users cannot log in.</p>}
                    {editForm.status === 'restricted' && <p className="mt-2 text-[11px] px-2" style={{ color: 'rgba(251,191,36,0.70)' }}>⚠ Restricted users can browse but cannot transact.</p>}
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: editForm.isVerified ? 'rgba(52,211,153,0.15)' : 'rgba(200,160,60,0.12)' }}>
                        <ShieldCheck className="w-4 h-4" style={{ color: editForm.isVerified ? 'rgba(52,211,153,0.85)' : '#B8A070' }} />
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#4A3000' }}>Identity Verified</p>
                        <p className="text-[11px]" style={{ color: '#B8A070' }}>KYC / manual verification</p>
                      </div>
                    </div>
                    <button onClick={() => setEditForm(f => ({ ...f, isVerified: !f.isVerified }))}
                      className="w-10 h-6 rounded-full transition-colors relative flex-shrink-0"
                      style={{ background: editForm.isVerified ? 'rgba(52,211,153,0.70)' : '#C8B090' }}>
                      <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', editForm.isVerified ? 'left-[18px]' : 'left-0.5')} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(200,160,60,0.05)', border: '1px solid rgba(200,160,60,0.10)' }}>
                    <Hash className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C8B090' }} />
                    <span className="text-[11px] font-mono truncate" style={{ color: '#B8A070' }}>{selectedUser.id}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSave} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.28)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.18)'}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                    <button onClick={closePanel}
                      className="px-4 py-2.5 rounded-xl text-sm transition-all"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#8A6C40' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.15)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.10)'}>
                      Cancel
                    </button>
                  </div>
                  <p className="text-[10px] text-center" style={{ color: '#C8B090' }}>All changes are logged in the audit trail</p>
                </div>
              </div>
            </div>
          )}
        {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.50)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white shadow-2xl border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ background: '#FFFDF5' }}>
              <div>
                <h2 className="font-heading font-bold" style={{ color: '#2A1A00' }}>Create User</h2>
                <p className="text-xs mt-0.5" style={{ color: '#9A7C40' }}>Add a new seller or buyer account</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg transition-colors hover:bg-muted" style={{ color: '#9A7C40' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5D3D' }}>Username <span className="text-red-500">*</span></label>
                <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. john_doe"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white"
                  style={{ color: '#2A1A00' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5D3D' }}>Email <span className="text-red-500">*</span></label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. john@example.com"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white"
                  style={{ color: '#2A1A00' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5D3D' }}>Password <span className="text-red-500">*</span></label>
                <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Set a temporary password"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white"
                  style={{ color: '#2A1A00' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B5D3D' }}>Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setCreateForm(f => ({ ...f, role: k }))}
                      className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border', v.bg, v.color)}
                      style={createForm.role === k ? { outline: '2px solid rgba(200,160,60,0.60)', outlineOffset: '1px', opacity: 1 } : { opacity: 0.55 }}>
                      {k === 'admin' && <Crown className="w-3.5 h-3.5 flex-shrink-0" />}
                      {k === 'buyer' && <User className="w-3.5 h-3.5 flex-shrink-0" />}
                      {k === 'seller' && <Star className="w-3.5 h-3.5 flex-shrink-0" />}
                      {k === 'both' && <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />}
                      {v.label}
                      {createForm.role === k && <CheckCircle className="w-3 h-3 ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border" style={{ background: '#FFFDF5' }}>
              <button onClick={handleCreateUser} disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#C68000', color: '#FFF8E5', border: 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#A66800'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#C68000'}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? 'Creating...' : 'Create User'}
              </button>
              <button onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm transition-all border"
                style={{ background: 'white', border: '1px solid rgba(200,160,60,0.25)', color: '#6B5D3D' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
