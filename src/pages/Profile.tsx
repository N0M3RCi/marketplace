import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, Shield, Star, Package, Edit2, Save,
  Loader2, Camera, CheckCircle, Calendar, Hash,
  RefreshCw, ExternalLink, BadgeCheck, ShieldCheck, ImageOff
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getInitials, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Listing } from '@/types';

interface ProfileData {
  id: string;
  username: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  totalTransactions: number;
  rating: number;
  createdAt?: string;
}

interface ReviewRow {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment?: string;
  role?: string;
  createdAt: string;
}

export default function Profile() {
  const { user: authUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [editForm, setEditForm] = useState({
    username: '',
    phone: '',
  });

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileData) {
      const mapped: ProfileData = {
        id: profileData.id,
        username: profileData.username || '',
        email: profileData.email,
        phone: profileData.phone || '',
        avatarUrl: profileData.avatar_url,
        role: profileData.role || 'buyer',
        isVerified: profileData.is_verified || false,
        isActive: profileData.is_active !== false,
        totalTransactions: profileData.total_transactions || 0,
        rating: Number(profileData.rating || 5.0),
        createdAt: profileData.created_at,
      };
      setProfile(mapped);
      setEditForm({ username: mapped.username, phone: mapped.phone });
    }
  }, []);

  const fetchListings = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('listings')
      .select(`
        id, title, price, currency, images, status, condition, view_count, created_at,
        category:categories!listings_category_id_fkey(name)
      `)
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(8);

    setListings((data || []).map((l: any) => ({
      id: l.id,
      title: l.title,
      price: Number(l.price),
      currency: l.currency || 'USD',
      images: l.images || [],
      status: l.status,
      condition: l.condition,
      viewCount: l.view_count || 0,
      createdAt: l.created_at,
      categoryName: l.category?.name || 'Uncategorized',
      // minimal fields for display
      description: '',
      sellerId: userId,
      sellerName: '',
      sellerRating: 5,
      categoryId: '',
      location: '',
    })));
  }, []);

  const fetchReviews = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('reviews')
      .select(`
        id, reviewer_id, rating, comment, role, created_at,
        reviewer:user_profiles!reviews_reviewer_id_fkey(username)
      `)
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    setReviews((data || []).map((r: any) => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      reviewerName: r.reviewer?.username || 'Anonymous',
      rating: r.rating,
      comment: r.comment,
      role: r.role,
      createdAt: r.created_at,
    })));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { navigate('/login'); return; }

    setLoading(true);
    Promise.all([
      fetchProfile(authUser.id),
      fetchListings(authUser.id),
      fetchReviews(authUser.id),
    ]).finally(() => setLoading(false));
  }, [authUser, authLoading, navigate, fetchProfile, fetchListings, fetchReviews]);

  const handleRefresh = async () => {
    if (!authUser) return;
    setRefreshing(true);
    await Promise.all([fetchProfile(authUser.id), fetchListings(authUser.id), fetchReviews(authUser.id)]);
    setRefreshing(false);
    toast.success('Profile refreshed');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${authUser.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(filePath);

    const { error: updateError } = await supabase.from('user_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', authUser.id);

    if (updateError) { toast.error('Failed to save avatar'); setUploading(false); return; }

    setProfile(prev => prev ? { ...prev, avatarUrl: publicUrl } : prev);
    toast.success('Profile photo updated!');
    setUploading(false);
  };

  const handleSave = async () => {
    if (!authUser || !profile) return;
    if (!editForm.username.trim()) { toast.error('Username is required'); return; }

    setSaving(true);
    const { error } = await supabase.from('user_profiles').update({
      username: editForm.username.trim(),
      phone: editForm.phone.trim() || null,
    }).eq('id', authUser.id);

    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return; }

    setProfile(prev => prev ? { ...prev, username: editForm.username.trim(), phone: editForm.phone.trim() } : prev);
    setEditMode(false);
    setSaving(false);
    toast.success('Profile updated!');
  };

  const handleCancel = () => {
    if (profile) setEditForm({ username: profile.username, phone: profile.phone });
    setEditMode(false);
  };

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#090907' }}>
      <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  if (!authUser || !profile) return null;

  const activeListings = listings.filter(l => l.status === 'active');
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : profile.rating;

  const ROLE_LABELS: Record<string, string> = {
    buyer: 'Buyer', seller: 'Seller', admin: 'Administrator', both: 'Buyer & Seller',
  };

  return (
    <div className="min-h-screen" style={{ background: '#090907' }}>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>My Profile</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Manage your account information</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left Column: Avatar + Edit Form ── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Avatar Card */}
            <div className="bg-white rounded-2xl border border-border p-6 text-center">
              {/* Avatar */}
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mx-auto">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full navy-gradient flex items-center justify-center text-white text-2xl font-bold">
                      {getInitials(profile.username || profile.email)}
                    </div>
                  )}
                </div>
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[hsl(var(--brand-navy))] border-2 border-white flex items-center justify-center text-white hover:opacity-90 transition-opacity shadow"
                  title="Change photo"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <h2 className="font-heading font-bold text-lg text-foreground">{profile.username}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>

              {/* Role + badges */}
              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--brand-navy))]/10 text-[hsl(var(--brand-navy))] font-semibold">
                  {ROLE_LABELS[profile.role] || profile.role}
                </span>
                {profile.isVerified && (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                    <BadgeCheck className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3" />
                Member since {profile.createdAt ? formatDate(profile.createdAt) : '—'}
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="font-heading font-bold text-base text-foreground">{profile.totalTransactions}</p>
                  <p className="text-[11px] text-muted-foreground">Transactions</p>
                </div>
                <div>
                  <p className="font-heading font-bold text-base text-amber-500">★ {avgRating.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">Avg Rating</p>
                </div>
                <div>
                  <p className="font-heading font-bold text-base text-foreground">{activeListings.length}</p>
                  <p className="text-[11px] text-muted-foreground">Active Listings</p>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-muted-foreground" /> Edit Info
                </h3>
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    className="text-xs text-[hsl(var(--brand-navy))] hover:underline font-medium">
                    Edit
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={editMode ? editForm.username : profile.username}
                      onChange={e => editMode && setEditForm(f => ({ ...f, username: e.target.value }))}
                      readOnly={!editMode}
                      className={cn(
                        'w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl transition-colors',
                        editMode
                          ? 'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white'
                          : 'bg-muted/30 text-foreground cursor-default'
                      )}
                    />
                  </div>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={profile.email}
                      readOnly
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-muted/30 text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={editMode ? editForm.phone : (profile.phone || '—')}
                      onChange={e => editMode && setEditForm(f => ({ ...f, phone: e.target.value }))}
                      readOnly={!editMode}
                      placeholder={editMode ? '+1 234 567 890' : undefined}
                      className={cn(
                        'w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl transition-colors',
                        editMode
                          ? 'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white'
                          : 'bg-muted/30 text-foreground cursor-default'
                      )}
                    />
                  </div>
                </div>

                {/* User ID */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] font-mono text-muted-foreground truncate">{profile.id}</span>
                </div>

                {editMode && (
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSave} disabled={saving}
                      className="flex-1 navy-gradient text-white border-0 hover:opacity-90 gap-1.5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </Button>
                    <Button variant="outline" onClick={handleCancel} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Security */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-800">Account Security</p>
              </div>
              <ul className="space-y-1.5 text-[11px] text-emerald-700">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" /> Email verified
                </li>
                {profile.isVerified && (
                  <li className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3" /> Identity verified
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Escrow protection active
                </li>
              </ul>
            </div>
          </div>

          {/* ── Right Column: Listings + Reviews ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Active Listings */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  My Listings
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{listings.length}</span>
                </h2>
                <Link to="/sell">
                  <Button size="sm" className="navy-gradient text-white border-0 hover:opacity-90 text-xs h-7 gap-1.5">
                    + New Listing
                  </Button>
                </Link>
              </div>

              {listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No listings yet</p>
                  <p className="text-xs mt-1">Start selling to reach buyers worldwide</p>
                  <Link to="/sell" className="mt-4">
                    <Button size="sm" className="navy-gradient text-white border-0 hover:opacity-90">
                      Create Listing
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-border">
                  {listings.map(listing => (
                    <Link key={listing.id} to={`/listing/${listing.id}`}
                      className="group bg-white hover:bg-muted/20 transition-colors block">
                      {/* Thumbnail */}
                      <div className="aspect-square bg-muted overflow-hidden">
                        {listing.images[0] ? (
                          <img src={listing.images[0]} alt={listing.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{listing.title}</p>
                        <p className="text-xs font-bold text-[hsl(var(--brand-navy))] mt-0.5">{formatCurrency(listing.price, listing.currency)}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            listing.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            listing.status === 'sold' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600')}>
                            {listing.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{listing.viewCount} views</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  Reviews Received
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{reviews.length}</span>
                </h2>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-heading font-bold text-sm text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">avg</span>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Star className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No reviews yet</p>
                  <p className="text-xs mt-1">Complete transactions to receive reviews</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {reviews.map(review => (
                    <div key={review.id} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                          {getInitials(review.reviewerName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm text-foreground">{review.reviewerName}</span>
                            {review.role && (
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                review.role === 'buyer' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}>
                                {review.role === 'buyer' ? 'Buyer' : 'Seller'}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-auto">{formatDate(review.createdAt)}</span>
                          </div>
                          {/* Stars */}
                          <div className="flex items-center gap-0.5 mb-1.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <Star key={i} className={cn('w-3.5 h-3.5',
                                i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')} />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'My Dashboard', to: '/dashboard', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'My Wallet', to: '/wallet', icon: Star, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Messages', to: '/messages', icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(l => (
                <Link key={l.to} to={l.to}
                  className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-border hover:border-muted-foreground transition-colors group">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', l.bg)}>
                    <l.icon className={cn('w-4 h-4', l.color)} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
