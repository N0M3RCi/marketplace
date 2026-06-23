import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Heart, Share2, ShieldCheck, MapPin,
  Star, Eye, Package, MessageSquare, BadgeCheck, Clock, Tag, AlertCircle,
  Loader2, Info
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { fetchListingById, toggleFavorite, getOrCreateConversation } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, getInitials, cn } from '@/lib/utils';
import { MOCK_LISTINGS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import type { Listing } from '@/types';
import { toast } from 'sonner';

const CONDITION_LABELS: Record<string, string> = {
  new: 'Brand New', 'like-new': 'Like New', good: 'Good Condition', fair: 'Fair', poor: 'Well Used',
};

const CONDITION_COLORS: Record<string, string> = {
  new: 'bg-emerald-100 text-emerald-700', 'like-new': 'bg-blue-100 text-blue-700',
  good: 'bg-amber-100 text-amber-700', fair: 'bg-orange-100 text-orange-700', poor: 'bg-red-100 text-red-700',
};

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<{ cryptoAddress: string; cryptoNetwork: string } | null>(null);
  const [userStatus, setUserStatus] = useState<'active' | 'blocked' | 'restricted'>('active');

  useEffect(() => {
    // Fetch active payment settings for the escrow modal
    supabase.from('payment_settings').select('crypto_address, crypto_network').eq('is_active', true).limit(1).single()
      .then(({ data }) => {
        if (data) setPaymentSettings({ cryptoAddress: data.crypto_address, cryptoNetwork: data.crypto_network });
      });
    // Fetch current user's account status
    if (user) {
      supabase.from('user_profiles').select('status').eq('id', user.id).single()
        .then(({ data }) => { if (data?.status) setUserStatus(data.status as any); })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    // Try DB first, fallback to mock
    fetchListingById(id)
      .then(data => {
        if (data) { setListing(data); }
        else {
          const mock = MOCK_LISTINGS.find(l => l.id === id);
          if (mock) setListing(mock);
          else navigate('/marketplace');
        }
      })
      .catch(() => {
        const mock = MOCK_LISTINGS.find(l => l.id === id);
        if (mock) setListing(mock);
        else navigate('/marketplace');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleFavorite = async () => {
    if (!user) { navigate('/login'); return; }
    setIsFav(!isFav);
    try {
      await toggleFavorite(listing!.id, user.id);
    } catch {
      setIsFav(isFav);
    }
  };

  const handleContact = async () => {
    if (!user) { navigate('/login'); return; }
    if (user.id === listing?.sellerId) { toast.info("You can't message yourself"); return; }
    if (userStatus === 'blocked') { toast.error('Your account is blocked. Contact support.'); return; }
    if (userStatus === 'restricted') { toast.error('Your account is restricted. You cannot contact sellers. Contact support.'); return; }
    setContactLoading(true);
    try {
      const convId = await getOrCreateConversation(
        listing!.id, listing!.title, user.id, listing!.sellerId
      );
      navigate(`/messages?conv=${convId}`);
    } catch {
      toast.error('Could not start conversation');
      setContactLoading(false);
    }
  };

  const handleBuyEscrow = () => {
    if (!user) { navigate('/login'); return; }
    if (user.id === listing?.sellerId) { toast.info("You can't buy your own listing"); return; }
    if (userStatus === 'blocked') { toast.error('Your account is blocked. Contact support.'); return; }
    if (userStatus === 'restricted') { toast.error('Your account is restricted. You cannot start new transactions. Contact support.'); return; }
    setShowEscrowModal(true);
  };

  const handleCreateEscrowCase = async () => {
    if (!listing || !user) return;
    setEscrowLoading(true);

    // Generate case number
    const caseNumber = `ESC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const fees = listing.price * 0.03;

    // Validate IDs are real UUIDs (mock listings use IDs like "listing-1")
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealListing = UUID_REGEX.test(listing.id);
    const isRealSeller = UUID_REGEX.test(listing.sellerId);

    if (!isRealSeller) {
      toast.error('This is a demo listing. Please browse real listings from the marketplace to use escrow.');
      setEscrowLoading(false);
      return;
    }

    // Get active payment settings
    const { data: paymentData } = await supabase.from('payment_settings').select('*').eq('is_active', true).limit(1).single();

    const { data: newCase, error } = await supabase.from('escrow_cases').insert({
      case_number: caseNumber,
      buyer_id: user.id,
      seller_id: listing.sellerId,
      listing_id: isRealListing ? listing.id : null,
      listing_title: listing.title,
      amount: listing.price,
      fees: fees,
      currency: listing.currency || 'USD',
      status: 'awaiting_payment',
      payment_address: paymentData?.crypto_address || null,
      payment_network: paymentData?.crypto_network || null,
    }).select('id').single();

    if (error || !newCase) {
      toast.error('Failed to create escrow case: ' + (error?.message || 'Unknown error'));
      setEscrowLoading(false);
      return;
    }

    // Create initial timeline event
    await supabase.from('escrow_timeline').insert({
      case_id: newCase.id,
      status: 'awaiting_payment',
      label: 'Escrow Case Created',
      timestamp: new Date().toISOString(),
      actor_name: user.username || 'Buyer',
      actor_role: 'buyer',
      notes: `Case ${caseNumber} opened for "${listing.title}"`,
    });

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: listing.sellerId,
      type: 'new_escrow_case',
      title: 'New Escrow Case Opened',
      message: `${user.username || 'A buyer'} has opened an escrow case for your listing "${listing.title}".`,
      case_id: newCase.id,
    });

    toast.success(`Escrow case ${caseNumber} created!`);
    setEscrowLoading(false);
    setShowEscrowModal(false);
    navigate(`/escrow/${newCase.id}`);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#FFFDF5' }}>
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const sellerProfile = (listing as any).sellerProfile;

  return (
    <div className="min-h-screen" style={{ background: '#090907' }}>
      <Navbar />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/marketplace" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Marketplace
          </Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{listing.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-5 gap-8">

          {/* LEFT: Images */}
          <div className="lg:col-span-3 space-y-3">
            {/* Main image */}
            <div className="relative bg-muted rounded-2xl overflow-hidden aspect-[4/3]">
              {listing.images.length > 0 ? (
                <img
                  src={listing.images[activeImg]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-muted-foreground/20" />
                </div>
              )}

              {/* Nav arrows */}
              {listing.images.length > 1 && (
                <>
                  <button onClick={() => setActiveImg(i => (i - 1 + listing.images.length) % listing.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setActiveImg(i => (i + 1) % listing.images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Condition badge */}
              <div className="absolute top-3 left-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CONDITION_COLORS[listing.condition] || 'bg-gray-100 text-gray-700'}`}>
                  {CONDITION_LABELS[listing.condition] || listing.condition}
                </span>
              </div>

              {/* View count */}
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 text-white text-xs px-2 py-1 rounded-full">
                <Eye className="w-3 h-3" />
                <span>{listing.viewCount.toLocaleString()} views</span>
              </div>
            </div>

            {/* Thumbnails */}
            {listing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {listing.images.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImg(idx)}
                    className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${activeImg === idx ? 'border-[hsl(var(--brand-navy))] opacity-100' : 'border-transparent opacity-60 hover:opacity-80'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="font-heading font-semibold text-base text-foreground mb-3">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>

            {/* Details Grid */}
            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="font-heading font-semibold text-base text-foreground mb-4">Item Details</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Category', value: listing.categoryName },
                  { label: 'Condition', value: CONDITION_LABELS[listing.condition] || listing.condition },
                  { label: 'Location', value: listing.location || 'Not specified' },
                  { label: 'Listed', value: formatDate(listing.createdAt) },
                  { label: 'Currency', value: listing.currency },
                  { label: 'Listing ID', value: listing.id.substring(0, 8) + '…' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground mt-0.5">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Pricing + Actions + Seller */}
          <div className="lg:col-span-2 space-y-4">
            {/* Price card */}
            <div className="bg-white rounded-2xl border border-border p-6 sticky top-24">
              <div className="flex items-start justify-between mb-1">
                <p className="text-3xl font-heading font-bold text-[hsl(var(--brand-navy))]">
                  {formatCurrency(listing.price, listing.currency)}
                </p>
                <div className="flex gap-2">
                  <button onClick={handleFavorite}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${isFav ? 'bg-rose-50 border-rose-200 text-rose-500' : 'border-border text-muted-foreground hover:text-rose-500'}`}>
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={handleShare}
                    className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h1 className="font-heading text-lg font-bold text-foreground mt-3 mb-1 leading-tight">{listing.title}</h1>

              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs text-muted-foreground">
                {listing.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {listing.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {listing.categoryName}
                </span>
              </div>

              {/* Escrow Protection notice */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Escrow Protected</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                    Funds held securely until you confirm item receipt. Admin-verified at every stage.
                  </p>
                </div>
              </div>

              {/* Platform fee notice */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 bg-muted/30 rounded-lg px-3 py-2">
                <span>Platform escrow fee (3%)</span>
                <span className="font-medium">{formatCurrency(listing.price * 0.03, listing.currency)}</span>
              </div>

              {userStatus === 'restricted' || userStatus === 'blocked' ? (
                <div className="rounded-xl p-3.5 mb-3 flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(252,165,165,0.85)' }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'rgba(252,165,165,0.95)' }}>
                      Account {userStatus === 'blocked' ? 'Blocked' : 'Restricted'}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(252,165,165,0.65)' }}>
                      {userStatus === 'blocked' ? 'Your account is blocked. Contact support to resolve.' : 'Your account is restricted. Escrow purchases are disabled.'}
                    </p>
                  </div>
                </div>
              ) : null}
              <Button
                onClick={handleBuyEscrow}
                disabled={userStatus === 'blocked' || userStatus === 'restricted'}
                className="w-full h-12 navy-gradient text-white border-0 hover:opacity-90 font-semibold text-sm mb-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Buy with Escrow
              </Button>

              {/* Escrow Confirmation Modal */}
              {showEscrowModal && listing && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !escrowLoading && setShowEscrowModal(false)} />
                  <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
                    {/* Modal Header */}
                    <div className="navy-gradient px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="font-heading font-bold text-white">Confirm Escrow Purchase</h2>
                          <p className="text-xs text-white/70 mt-0.5">Review details before proceeding</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Item summary */}
                      <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                        {listing.images[0] ? (
                          <img src={listing.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-border" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="w-6 h-6 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{listing.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">Seller: {listing.sellerName}</p>
                        </div>
                      </div>

                      {/* Fee breakdown */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Item price</span>
                          <span className="font-semibold">{formatCurrency(listing.price, listing.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Escrow fee (3%)</span>
                          <span className="text-muted-foreground">{formatCurrency(listing.price * 0.03, listing.currency)}</span>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Total to send</span>
                          <span className="text-lg font-bold text-[hsl(var(--brand-navy))]">{formatCurrency(listing.price + listing.price * 0.03, listing.currency)}</span>
                        </div>
                      </div>

                      {/* Payment method */}
                      {paymentSettings && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-blue-800">Payment via {paymentSettings.cryptoNetwork}</p>
                            <p className="text-[11px] text-blue-700 mt-0.5">You'll receive the crypto address after creating this case.</p>
                          </div>
                        </div>
                      )}

                      {/* How it works */}
                      <div className="space-y-2">
                        {[
                          'Case created & payment address assigned',
                          'You send crypto — admin verifies receipt',
                          'Seller ships item with photo evidence',
                          'You confirm receipt → funds released to seller',
                        ].map((step, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                            <div className="w-5 h-5 rounded-full bg-[hsl(var(--brand-navy))]/10 text-[hsl(var(--brand-navy))] flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                              {i + 1}
                            </div>
                            {step}
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 pt-1">
                        <Button
                          onClick={handleCreateEscrowCase}
                          disabled={escrowLoading}
                          className="flex-1 navy-gradient text-white border-0 hover:opacity-90 h-11"
                        >
                          {escrowLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
                          ) : (
                            <><ShieldCheck className="w-4 h-4 mr-2" /> Create Escrow Case</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowEscrowModal(false)}
                          disabled={escrowLoading}
                          className="flex-1 h-11"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                onClick={handleContact}
                disabled={contactLoading || userStatus === 'blocked' || userStatus === 'restricted'}
                className="w-full h-11 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {contactLoading ? 'Opening chat…' : 'Message Seller'}
              </Button>
            </div>

            {/* Seller card */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h3 className="font-heading font-semibold text-sm text-foreground mb-4">Seller</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--brand-navy))] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {sellerProfile?.avatar_url ? (
                    <img src={sellerProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(listing.sellerName)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm text-foreground">{listing.sellerName}</p>
                    {sellerProfile?.is_verified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium text-foreground">{listing.sellerRating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {sellerProfile?.total_transactions || 0} transactions
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Identity Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span>Escrow Enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Usually responds within 2 hours</span>
                </div>
              </div>
            </div>

            {/* Safety tips */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-800">Safety Tips</span>
              </div>
              <ul className="text-[11px] text-amber-700 space-y-1">
                <li>• Always use the SafeEscrow system for payments</li>
                <li>• Never pay outside the platform</li>
                <li>• Verify item before confirming receipt</li>
                <li>• Open a dispute if something seems wrong</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
