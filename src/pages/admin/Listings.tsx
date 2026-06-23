import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Edit2, Trash2, Eye, RefreshCw, Package, CheckCircle,
  XCircle, Filter, Loader2, Tag, MapPin, DollarSign, Save,
  X, ExternalLink, Image as ImageIcon, ToggleLeft, ToggleRight, AlertTriangle, Plus, Upload, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminListing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  location: string;
  status: 'active' | 'inactive' | 'sold' | 'pending';
  images: string[];
  viewCount: number;
  categoryName: string;
  categoryId?: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface EditForm {
  title: string;
  description: string;
  price: string;
  condition: string;
  location: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: 'Active',   bg: 'bg-emerald-100', color: 'text-emerald-700' },
  inactive: { label: 'Inactive', bg: 'bg-slate-100',   color: 'text-slate-600' },
  sold:     { label: 'Sold',     bg: 'bg-blue-100',    color: 'text-blue-700' },
  pending:  { label: 'Pending',  bg: 'bg-amber-100',   color: 'text-amber-700' },
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'Brand New', 'like-new': 'Like New', good: 'Good', fair: 'Fair', poor: 'Well Used',
};

export default function AdminListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', description: '', price: '', condition: '', location: '', status: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sellers, setSellers] = useState<{ id: string; username: string; email: string }[]>([]);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', price: '', currency: 'USD', categoryId: '', condition: 'good',
    location: '', sellerId: '', images: [] as File[], imageUrls: [] as string[],
  });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploadingCreate, setUploadingCreate] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);

  const fetchSellers = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, email')
      .order('username');
    setSellers((data || []).map((u: any) => ({ id: u.id, username: u.username || u.email?.split('@')[0] || 'Unknown', email: u.email })));
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    setCategories((data || []).map((c: any) => ({ id: c.id, name: c.name })));
  }, []);

  const fetchListings = useCallback(async () => {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        id, title, description, price, currency, condition, location,
        status, images, view_count, category_id, created_at, updated_at,
        seller:user_profiles!listings_seller_id_fkey(id, username, email),
        category:categories!listings_category_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to load listings'); return; }

    setListings((data || []).map((l: any) => ({
      id: l.id,
      title: l.title,
      description: l.description || '',
      price: Number(l.price),
      currency: l.currency || 'USD',
      condition: l.condition || 'good',
      location: l.location || '',
      status: l.status || 'active',
      images: l.images || [],
      viewCount: l.view_count || 0,
      categoryName: l.category?.name || 'Uncategorized',
      categoryId: l.category_id,
      sellerId: l.seller?.id || '',
      sellerName: l.seller?.username || 'Unknown',
      sellerEmail: l.seller?.email || '',
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchListings().finally(() => setLoading(false));
    fetchSellers();
    fetchCategories();
  }, [fetchListings, fetchSellers, fetchCategories]);

  const handleCreateImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.size <= 10 * 1024 * 1024).slice(0, 8);
    const previews = files.map(f => URL.createObjectURL(f));
    setCreateForm(prev => ({
      ...prev,
      images: [...prev.images, ...files].slice(0, 8),
      imageUrls: [...prev.imageUrls, ...previews].slice(0, 8),
    }));
    if (createFileRef.current) createFileRef.current.value = '';
  };

  const handleCreateListing = async () => {
    if (!createForm.title.trim() || !createForm.sellerId || !Number(createForm.price)) {
      toast.error('Title, seller, and price are required');
      return;
    }
    setCreating(true);

    // Upload images
    const uploadedUrls: string[] = [];
    if (createForm.images.length > 0) {
      setUploadingCreate(true);
      for (const file of createForm.images) {
        const ext = file.name.split('.').pop();
        const path = `${createForm.sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('listing-images').upload(path, file, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from('listing-images').getPublicUrl(path);
          uploadedUrls.push(data.publicUrl);
        }
      }
      setUploadingCreate(false);
    }

    const { error } = await supabase.from('listings').insert({
      title: createForm.title.trim(),
      description: createForm.description.trim(),
      price: Number(createForm.price),
      currency: createForm.currency,
      category_id: createForm.categoryId || null,
      seller_id: createForm.sellerId,
      images: uploadedUrls,
      condition: createForm.condition,
      location: createForm.location.trim(),
      status: 'active',
    });

    if (error) { toast.error('Failed to create: ' + error.message); setCreating(false); return; }

    await supabase.from('audit_logs').insert({
      admin_id: user?.id,
      admin_name: user?.username || 'Admin',
      action: 'create_listing',
      entity_type: 'listing',
      details: `Created listing "${createForm.title}" for seller ${sellers.find(s => s.id === createForm.sellerId)?.username || createForm.sellerId}`,
    });

    toast.success('Listing created successfully');
    setShowCreateModal(false);
    setCreateForm({ title: '', description: '', price: '', currency: 'USD', categoryId: '', condition: 'good', location: '', sellerId: '', images: [], imageUrls: [] });
    await fetchListings();
    setCreating(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const startEdit = (listing: AdminListing) => {
    setEditingId(listing.id);
    setEditForm({
      title: listing.title,
      description: listing.description,
      price: listing.price.toString(),
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: '', description: '', price: '', condition: '', location: '', status: '' });
  };

  const saveEdit = async (listingId: string) => {
    const price = parseFloat(editForm.price);
    if (!editForm.title.trim()) { toast.error('Title is required'); return; }
    if (isNaN(price) || price <= 0) { toast.error('Enter a valid price'); return; }

    setSaving(true);
    const { error } = await supabase.from('listings').update({
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      price,
      condition: editForm.condition,
      location: editForm.location.trim(),
      status: editForm.status,
      updated_at: new Date().toISOString(),
    }).eq('id', listingId);

    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return; }

    // Log to audit_logs
    await supabase.from('audit_logs').insert({
      admin_id: user?.id,
      admin_name: user?.username || 'Admin',
      action: 'edit_listing',
      entity_type: 'listing',
      entity_id: listingId,
      details: `Updated listing "${editForm.title}" — price: ${formatCurrency(price)}, status: ${editForm.status}`,
    });

    toast.success('Listing updated successfully');
    setEditingId(null);
    await fetchListings();
    setSaving(false);
  };

  const toggleStatus = async (listing: AdminListing) => {
    const newStatus = listing.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('listings').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', listing.id);
    if (error) { toast.error('Failed to update status'); return; }

    await supabase.from('audit_logs').insert({
      admin_id: user?.id,
      admin_name: user?.username || 'Admin',
      action: 'toggle_listing_status',
      entity_type: 'listing',
      entity_id: listing.id,
      details: `Changed listing "${listing.title}" status to ${newStatus}`,
    });

    toast.success(`Listing ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    await fetchListings();
  };

  const handleDelete = async (listingId: string) => {
    setDeletingId(listingId);
    const listing = listings.find(l => l.id === listingId);
    const { error } = await supabase.from('listings').delete().eq('id', listingId);
    if (error) { toast.error('Failed to delete listing'); setDeletingId(null); return; }

    await supabase.from('audit_logs').insert({
      admin_id: user?.id,
      admin_name: user?.username || 'Admin',
      action: 'delete_listing',
      entity_type: 'listing',
      entity_id: listingId,
      details: `Deleted listing "${listing?.title}"`,
    });

    toast.success('Listing deleted');
    setConfirmDeleteId(null);
    setDeletingId(null);
    await fetchListings();
  };

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !search || l.title.toLowerCase().includes(q) || l.sellerName.toLowerCase().includes(q) || l.categoryName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: listings.length,
    active: listings.filter(l => l.status === 'active').length,
    inactive: listings.filter(l => l.status === 'inactive').length,
    sold: listings.filter(l => l.status === 'sold').length,
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Listing Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Edit, moderate, and manage all marketplace listings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,224,0,0.18)', border: '1px solid rgba(255,224,0,0.32)', color: '#FFE000' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,224,0,0.28)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,224,0,0.18)'}>
            <Plus className="w-4 h-4" /> Add Listing
          </button>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)' }}>
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Listings', value: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inactive', value: stats.inactive, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Sold', value: stats.sold, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <p className={cn('text-xl font-bold font-heading', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by title, seller, or category..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1">
            {['all', 'active', 'inactive', 'sold', 'pending'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors',
                  statusFilter === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No listings found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(listing => {
              const isEditing = editingId === listing.id;
              const sc = STATUS_CONFIG[listing.status] || STATUS_CONFIG.active;

              return (
                <div key={listing.id} className={cn('p-5', isEditing ? 'bg-blue-50/30' : 'hover:bg-muted/20 transition-colors')}>
                  {!isEditing ? (
                    /* ─── View Mode ─── */
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-muted flex-shrink-0">
                        {listing.images[0] ? (
                          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <h3 className="font-semibold text-sm text-foreground">{listing.title}</h3>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', sc.bg, sc.color)}>
                                {sc.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />{listing.categoryName}
                              </span>
                              {listing.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />{listing.location}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />{listing.viewCount.toLocaleString()} views
                              </span>
                              <span>Listed {formatDate(listing.createdAt)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Seller: <span className="font-medium text-foreground">{listing.sellerName}</span>
                              <span className="text-muted-foreground/60"> ({listing.sellerEmail})</span>
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-[hsl(var(--brand-navy))]">{formatCurrency(listing.price, listing.currency)}</p>
                            <p className="text-xs text-muted-foreground">{CONDITION_LABELS[listing.condition] || listing.condition}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => startEdit(listing)}
                            className="h-7 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50">
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>
                          <Link to={`/listing/${listing.id}`} target="_blank">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                              <ExternalLink className="w-3 h-3" /> View
                            </Button>
                          </Link>
                          <button onClick={() => toggleStatus(listing)}
                            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                              listing.status === 'active'
                                ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
                            {listing.status === 'active'
                              ? <><ToggleRight className="w-3.5 h-3.5" /> Deactivate</>
                              : <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>}
                          </button>
                          <button onClick={() => setConfirmDeleteId(listing.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ─── Edit Mode ─── */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-blue-500" /> Editing: {listing.title}
                        </h3>
                        <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium mb-1">Title</label>
                          <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium mb-1">Description</label>
                          <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            rows={3} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Price (USD)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Location</label>
                          <input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                            placeholder="City, Country"
                            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Condition</label>
                          <select value={editForm.condition} onChange={e => setEditForm(f => ({ ...f, condition: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white">
                            {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Status</label>
                          <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white">
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button onClick={() => saveEdit(listing.id)} disabled={saving}
                          className="navy-gradient text-white border-0 hover:opacity-90 gap-1.5">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                        <p className="text-[11px] text-muted-foreground ml-2">Changes will be logged in audit trail</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: '#0c0c0c', border: '1px solid rgba(255,224,0,0.18)', boxShadow: '0 32px 100px rgba(0,0,0,0.90)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,224,0,0.08)' }}>
              <div>
                <h2 className="font-heading font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>Create New Listing</h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Add a listing on behalf of any seller</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Seller Selector */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Seller <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={createForm.sellerId}
                  onChange={e => setCreateForm(f => ({ ...f, sellerId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                  <option value="" style={{ background: '#111' }}>Select a seller...</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id} style={{ background: '#111' }}>
                      {s.username} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Title <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Apple MacBook Pro 16-inch M3"
                  className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Description</label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the item in detail..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                />
              </div>

              {/* Price + Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Currency</label>
                  <select value={createForm.currency} onChange={e => setCreateForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                    {['USD','EUR','GBP','AUD','CAD'].map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Price <span style={{ color: '#ef4444' }}>*</span></label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.30)' }} />
                    <input type="number" min="1" step="0.01"
                      value={createForm.price}
                      onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Category + Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Category</label>
                  <select value={createForm.categoryId} onChange={e => setCreateForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                    <option value="" style={{ background: '#111' }}>Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Condition</label>
                  <select value={createForm.condition} onChange={e => setCreateForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                    {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k} style={{ background: '#111' }}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.30)' }} />
                  <input
                    value={createForm.location}
                    onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. New York, NY"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                  />
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Photos (up to 8)</label>
                <div
                  onClick={() => createFileRef.current?.click()}
                  className="rounded-xl p-5 text-center cursor-pointer transition-all"
                  style={{ border: '2px dashed rgba(255,224,0,0.20)', background: 'rgba(255,224,0,0.03)' }}>
                  <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(255,224,0,0.45)' }} />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Click to upload images</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.30)' }}>{createForm.images.length}/8 added · max 10MB each</p>
                </div>
                <input ref={createFileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleCreateImagePick} className="hidden" />
                {createForm.imageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {createForm.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button"
                          onClick={() => setCreateForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx), imageUrls: f.imageUrls.filter((_, i) => i !== idx) }))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={handleCreateListing}
                disabled={creating || uploadingCreate}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,224,0,0.18)', border: '1px solid rgba(255,224,0,0.35)', color: '#FFE000' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,224,0,0.28)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,224,0,0.18)'}>
                {creating || uploadingCreate ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {uploadingCreate ? 'Uploading...' : creating ? 'Creating...' : 'Create Listing'}
              </button>
              <button onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">Delete Listing</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Are you sure you want to permanently delete
              <span className="font-semibold text-foreground"> "{listings.find(l => l.id === confirmDeleteId)?.title}"</span>?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={!!deletingId}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0">
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
