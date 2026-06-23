import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Package, Clock, DollarSign, MessageSquare, ChevronRight,
  Plus, TrendingUp, Bell, BellOff, Loader2, RefreshCw, AlertTriangle, Store, CheckCircle, X
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { sellerRequests as sellerReqApi } from '@/lib/client';
import { formatCurrency, formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { ESCROW_STATUS_CONFIG } from '@/constants';
import type { EscrowStatus } from '@/types';
import { toast } from 'sonner';

interface EscrowCaseRow {
  id: string;
  caseNumber: string;
  listingTitle: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  createdAt: string;
  updatedAt: string;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  caseId?: string;
  isRead: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const { user: authUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [cases, setCases] = useState<EscrowCaseRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'buying' | 'selling'>('all');
  const [sellerRequestStatus, setSellerRequestStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [showSellerRequestModal, setShowSellerRequestModal] = useState(false);
  const [sellerRequestReason, setSellerRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchCases = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('escrow_cases')
      .select(`
        id, case_number, listing_title, buyer_id, seller_id,
        amount, currency, status, created_at, updated_at,
        buyer:user_profiles!escrow_cases_buyer_id_fkey(username),
        seller:user_profiles!escrow_cases_seller_id_fkey(username)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching cases:', error);
      return;
    }

    setCases((data || []).map((c: any) => ({
      id: c.id,
      caseNumber: c.case_number || c.caseNumber,
      listingTitle: c.listing_title || c.listingTitle,
      buyerId: c.buyer_id || c.buyerId,
      sellerId: c.seller_id || c.sellerId,
      buyerName: c.buyer_name || c.buyerName || c.buyer?.username || 'Unknown',
      sellerName: c.seller_name || c.sellerName || c.seller?.username || 'Unknown',
      amount: Number(c.amount),
      currency: c.currency || 'USD',
      status: c.status,
      createdAt: c.created_at || c.createdAt,
      updatedAt: c.updated_at || c.updatedAt,
    })));
  }, []);

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    setNotifications((data || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      caseId: n.case_id || n.caseId,
      isRead: n.is_read || n.isRead,
      createdAt: n.created_at || n.createdAt,
    })));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { navigate('/login'); return; }
    if (authUser.role === 'admin') { navigate('/admin'); return; }

    setCasesLoading(true);
    Promise.all([
      fetchCases(authUser.id),
      fetchNotifications(authUser.id),
    ]).finally(() => setCasesLoading(false));

    // Check existing seller request
    if (authUser.role === 'buyer') {
      supabase.from('seller_requests').select('status').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(1).single()
        .then(({ data }) => { if (data) setSellerRequestStatus(data.status as any); })
        .catch(() => {});
    }
  }, [authUser, authLoading, navigate, fetchCases, fetchNotifications]);

  const handleSubmitSellerRequest = async () => {
    if (!authUser) return;
    setSubmittingRequest(true);
    try {
      await sellerReqApi.create(sellerRequestReason.trim());
      toast.success('Request submitted! Admin will review shortly.');
      setSellerRequestStatus('pending');
      setShowSellerRequestModal(false);
      setSellerRequestReason('');
    } catch { toast.error('Failed to submit request'); }
    setSubmittingRequest(false);
  };

  const handleRefresh = async () => {
    if (!authUser) return;
    setRefreshing(true);
    await Promise.all([fetchCases(authUser.id), fetchNotifications(authUser.id)]);
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const markNotifRead = async (notifId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#000000' }}>
      <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );
  if (!authUser) return null;

  const buyingCases = cases.filter(c => c.buyerId === authUser.id);
  const sellingCases = cases.filter(c => c.sellerId === authUser.id);
  const displayCases = activeTab === 'buying' ? buyingCases : activeTab === 'selling' ? sellingCases : cases;

  const totalVolume = cases.reduce((sum, c) => sum + c.amount, 0);
  const completedCases = cases.filter(c => ['funds_released', 'closed'].includes(c.status));
  const activeCases = cases.filter(c => !['funds_released', 'closed', 'refunded'].includes(c.status));
  const unreadNotifs = notifications.filter(n => !n.isRead).length;
  const disputedCases = cases.filter(c => c.status === 'disputed');

  const stats = [
    { label: 'Active Cases', value: activeCases.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: completedCases.length, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Volume', value: formatCurrency(totalVolume), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Notifications', value: unreadNotifs, icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>My Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>Welcome back, {authUser.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
            <Button className="navy-gradient text-white border-0 hover:opacity-90" onClick={() => navigate('/marketplace')}>
              <Plus className="w-4 h-4 mr-2" /> New Purchase
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,224,0,0.14)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <stat.icon className="w-4 h-4" style={{ color: '#FFE000' }} />
                </div>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.18)' }} />
              </div>
              <p className="font-heading text-xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Disputed Cases Alert */}
        {disputedCases.length > 0 && (
          <div className="mb-5 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(252,165,165,0.90)' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'rgba(252,165,165,0.95)' }}>
                {disputedCases.length} disputed case{disputedCases.length > 1 ? 's' : ''} require your attention
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(252,165,165,0.65)' }}>Admin is reviewing. You may be asked to submit additional evidence.</p>
            </div>
            <Link to={`/escrow/${disputedCases[0].id}`}>
              <Button variant="outline" size="sm" className="text-xs" style={{ borderColor: 'rgba(239,68,68,0.35)', color: 'rgba(252,165,165,0.85)', background: 'transparent' }}>
                View <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Escrow Cases */}
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="font-heading font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>Escrow Cases</h2>
                <div className="flex gap-1">
                  {(['all', 'buying', 'selling'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className="px-3 py-1 text-xs font-medium rounded-lg transition-colors capitalize"
                      style={activeTab === tab
                        ? { background: 'rgba(255,224,0,0.16)', border: '1px solid rgba(255,224,0,0.28)', color: '#FFE000' }
                        : { color: 'rgba(255,255,255,0.42)' }}>
                      {tab} ({tab === 'buying' ? buyingCases.length : tab === 'selling' ? sellingCases.length : cases.length})
                    </button>
                  ))}
                </div>
              </div>

              {casesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : displayCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="w-10 h-10 mb-3 opacity-30" />
                  <p className="font-medium text-sm">No cases found</p>
                  <p className="text-xs mt-1">Browse listings to start a secure transaction</p>
                  <Link to="/marketplace" className="mt-4">
                    <Button size="sm" className="navy-gradient text-white border-0 hover:opacity-90">
                      Browse Marketplace
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {displayCases.map(escrowCase => {
                    const isBuying = escrowCase.buyerId === authUser.id;
                    const sc = ESCROW_STATUS_CONFIG[escrowCase.status];
                    const isActive = !['funds_released', 'closed', 'refunded'].includes(escrowCase.status);
                    const isDisputed = escrowCase.status === 'disputed';

                    return (
                      <Link key={escrowCase.id} to={`/escrow/${escrowCase.id}`}
                        className="block px-6 py-4 transition-colors group"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.38)' }}>{escrowCase.caseNumber}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold',
                                isBuying ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}>
                                {isBuying ? 'Buying' : 'Selling'}
                              </span>
                              {isDisputed && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">
                                  Disputed
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-sm truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{escrowCase.listingTitle}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                              {isBuying
                                ? `from ${escrowCase.sellerName}`
                                : `to ${escrowCase.buyerName}`}
                              {' · '}
                              {formatDate(escrowCase.createdAt)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 space-y-1.5">
                            <p className="font-bold text-sm" style={{ color: 'rgba(255,224,0,0.90)' }}>
                              {formatCurrency(escrowCase.amount, escrowCase.currency)}
                            </p>
                            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap', sc?.bg, sc?.color)}>
                              {sc?.label || escrowCase.status}
                            </span>
                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                              {formatRelativeTime(escrowCase.updatedAt)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
                        </div>

                        {/* Progress bar for active cases */}
                        {isActive && (() => {
                          const statusOrder = Object.keys(ESCROW_STATUS_CONFIG);
                          const idx = statusOrder.indexOf(escrowCase.status);
                          const pct = idx >= 0 ? Math.round((idx / (statusOrder.length - 1)) * 100) : 0;
                          return (
                            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-[hsl(var(--brand-emerald))] rounded-full transition-all"
                                style={{ width: `${pct}%` }} />
                            </div>
                          );
                        })()}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Notifications */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="font-heading font-semibold flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  Notifications
                  {unreadNotifs > 0 && (
                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                      {unreadNotifs}
                    </span>
                  )}
                </h2>
                {unreadNotifs > 0 && (
                  <button
                    onClick={async () => {
                      await supabase.from('notifications').update({ is_read: true }).eq('user_id', authUser.id);
                      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                    }}
                    className="text-[11px] transition-colors"
                    style={{ color: 'rgba(255,224,0,0.75)' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <BellOff className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin">
                  {notifications.map(notif => (
                    <div key={notif.id}
                      className="px-5 py-3.5 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: !notif.isRead ? 'rgba(255,224,0,0.05)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = !notif.isRead ? 'rgba(255,224,0,0.05)' : 'transparent'}
                      onClick={() => {
                        if (!notif.isRead) markNotifRead(notif.id);
                        if (notif.caseId) navigate(`/escrow/${notif.caseId}`);
                      }}>
                      <div className="flex items-start gap-2.5">
                        {!notif.isRead && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                        <div className={cn('flex-1', !notif.isRead ? '' : 'ml-4')}>
                          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{notif.title}</p>
                          <p className="text-[11px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.42)' }}>{notif.message}</p>
                          <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatRelativeTime(notif.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seller Request Card — buyers only */}
            {authUser.role === 'buyer' && (
              <div className="rounded-xl p-5" style={{
                background: sellerRequestStatus === 'pending' ? 'rgba(251,191,36,0.06)' : sellerRequestStatus === 'approved' ? 'rgba(52,211,153,0.06)' : sellerRequestStatus === 'denied' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
                border: sellerRequestStatus === 'pending' ? '1px solid rgba(251,191,36,0.20)' : sellerRequestStatus === 'approved' ? '1px solid rgba(52,211,153,0.20)' : sellerRequestStatus === 'denied' ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(255,255,255,0.09)',
              }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                    background: sellerRequestStatus === 'pending' ? 'rgba(251,191,36,0.15)' : sellerRequestStatus === 'approved' ? 'rgba(52,211,153,0.15)' : 'rgba(255,224,0,0.12)',
                  }}>
                    <Store className="w-4 h-4" style={{ color: sellerRequestStatus === 'approved' ? 'rgba(52,211,153,0.85)' : '#FFE000' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.88)' }}>Become a Seller</p>
                    {sellerRequestStatus === 'none' && (
                      <>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>Request seller access to list items on SafeEscrow</p>
                        <button
                          onClick={() => setShowSellerRequestModal(true)}
                          className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: 'rgba(255,224,0,0.16)', border: '1px solid rgba(255,224,0,0.30)', color: '#FFE000' }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,224,0,0.26)'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,224,0,0.16)'}>
                          Request Seller Access
                        </button>
                      </>
                    )}
                    {sellerRequestStatus === 'pending' && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(251,191,36,0.80)' }}>Your request is under review — admin will respond shortly.</p>
                    )}
                    {sellerRequestStatus === 'approved' && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(52,211,153,0.80)' }}>Approved! Your account has been upgraded to seller status.</p>
                    )}
                    {sellerRequestStatus === 'denied' && (
                      <>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(252,165,165,0.80)' }}>Your last request was not approved. You may submit a new request.</p>
                        <button
                          onClick={() => setShowSellerRequestModal(true)}
                          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: 'rgba(255,224,0,0.12)', border: '1px solid rgba(255,224,0,0.25)', color: '#FFE000' }}>
                          Re-apply
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

        {/* Quick links */}
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <h3 className="font-heading font-semibold text-sm mb-3" style={{ color: 'rgba(255,255,255,0.88)' }}>Quick Actions</h3>
              <div className="space-y-1">
                {[
                  { label: 'Browse Marketplace', to: '/marketplace' },
                  { label: 'My Messages', to: '/messages' },
                  { label: 'My Wallet', to: '/wallet' },
                  ...(authUser.role === 'admin' ? [{ label: 'Add a Listing', to: '/sell' }] : []),
                ].map(link => (
                  <Link key={link.to} to={link.to}
                    className="flex items-center justify-between p-2.5 rounded-lg transition-colors text-sm"
                    style={{ color: 'rgba(255,255,255,0.50)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'}>
                    <span>{link.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </Link>
                ))}
              </div>
            </div>

      {/* Seller Request Modal */}
      {showSellerRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0c0c0c', border: '1px solid rgba(255,224,0,0.20)', boxShadow: '0 32px 100px rgba(0,0,0,0.90)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,224,0,0.08)' }}>
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5" style={{ color: '#FFE000' }} />
                <h2 className="font-heading font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>Request Seller Access</h2>
              </div>
              <button onClick={() => setShowSellerRequestModal(false)} className="p-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Tell us why you'd like to become a seller on SafeEscrow. Our admin team will review your request and respond within 24 hours.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Why do you want to sell? (optional)</label>
                <textarea
                  value={sellerRequestReason}
                  onChange={e => setSellerRequestReason(e.target.value)}
                  placeholder="e.g. I want to sell luxury watches and collectibles..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                />
                <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>{sellerRequestReason.length}/500</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitSellerRequest}
                  disabled={submittingRequest}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,224,0,0.18)', border: '1px solid rgba(255,224,0,0.35)', color: '#FFE000' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,224,0,0.28)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,224,0,0.18)'}>
                  {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                  Submit Request
                </button>
                <button onClick={() => setShowSellerRequestModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Summary card */}
            {cases.length > 0 && (
              <div className="bg-gradient-to-br from-[hsl(var(--brand-navy))] to-[hsl(220,65%,28%)] rounded-xl p-5 text-white">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Account Summary</p>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Total Escrow Volume</span>
                    <span className="font-bold">{formatCurrency(totalVolume)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Completed Deals</span>
                    <span className="font-bold">{completedCases.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Active Deals</span>
                    <span className="font-bold">{activeCases.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
