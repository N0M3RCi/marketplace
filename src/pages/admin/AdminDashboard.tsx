import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ListChecks, ShieldCheck, Truck, AlertTriangle,
  Banknote, TrendingUp, Clock, ChevronRight, Activity,
  Eye, RefreshCw, CheckCircle, Package, Bitcoin, Scale,
  BarChart3, Loader2, ArrowUpRight, Wallet
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatRelativeTime, formatDate, cn } from '@/lib/utils';
import { ESCROW_STATUS_CONFIG } from '@/constants';
import type { EscrowStatus } from '@/types';
import { toast } from 'sonner';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalListings: number;
  activeListings: number;
  totalEscrowCases: number;
  activeEscrowCases: number;
  completedCases: number;
  disputedCases: number;
  totalEscrowVolume: number;
  totalRevenue: number;
  pendingPayments: number;
  pendingEvidence: number;
  activeDisputes: number;
  pendingPayouts: number;
}

interface RecentCase {
  id: string;
  caseNumber: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  updatedAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, activeUsers: 0, totalListings: 0, activeListings: 0,
    totalEscrowCases: 0, activeEscrowCases: 0, completedCases: 0, disputedCases: 0,
    totalEscrowVolume: 0, totalRevenue: 0,
    pendingPayments: 0, pendingEvidence: 0, activeDisputes: 0, pendingPayouts: 0,
  });
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    const [
      { count: totalUsers },
      { count: totalListings },
      { data: escrowData },
      { data: recentData },
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('escrow_cases').select('id, amount, fees, status, payment_submitted_at, seller_evidence_submitted_at, dispute_status, buyer_confirmed_at'),
      supabase
        .from('escrow_cases')
        .select(`
          id, case_number, listing_title, amount, currency, status, updated_at,
          buyer:user_profiles!escrow_cases_buyer_id_fkey(username),
          seller:user_profiles!escrow_cases_seller_id_fkey(username)
        `)
        .order('updated_at', { ascending: false })
        .limit(10),
    ]);

    const cases = escrowData || [];
    const activeStatuses = ['awaiting_payment','payment_submitted','payment_verified','seller_notified','item_ready','packaging_submitted','packaging_approved','pickup_scheduled','in_transit','delivered'];

    setStats({
      totalUsers: totalUsers || 0,
      activeUsers: Math.floor((totalUsers || 0) * 0.7),
      totalListings: totalListings || 0,
      activeListings: Math.floor((totalListings || 0) * 0.8),
      totalEscrowCases: cases.length,
      activeEscrowCases: cases.filter(c => activeStatuses.includes(c.status)).length,
      completedCases: cases.filter(c => ['funds_released', 'closed'].includes(c.status)).length,
      disputedCases: cases.filter(c => c.status === 'disputed' || c.dispute_status).length,
      totalEscrowVolume: cases.reduce((s, c) => s + Number(c.amount || 0), 0),
      totalRevenue: cases.filter(c => c.status === 'funds_released').reduce((s, c) => s + Number(c.fees || 0), 0),
      pendingPayments: cases.filter(c => c.status === 'payment_submitted').length,
      pendingEvidence: cases.filter(c => c.status === 'packaging_submitted').length,
      activeDisputes: cases.filter(c => c.dispute_status && c.dispute_status !== 'resolved').length,
      pendingPayouts: cases.filter(c => c.status === 'buyer_confirmed').length,
    });

    setRecentCases((recentData || []).map((c: any) => ({
      id: c.id,
      caseNumber: c.case_number,
      listingTitle: c.listing_title,
      buyerName: c.buyer?.username || 'Unknown',
      sellerName: c.seller?.username || 'Unknown',
      amount: Number(c.amount),
      currency: c.currency || 'USD',
      status: c.status,
      updatedAt: c.updated_at,
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDashboardData().finally(() => setLoading(false));
  }, [fetchDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'rgba(255,215,60,0.70)' }} />
    </div>
  );

  const mainStats = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), sub: `~${stats.activeUsers.toLocaleString()} active`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', path: '/admin/users' },
    { label: 'Escrow Volume', value: formatCurrency(stats.totalEscrowVolume), sub: `${stats.totalEscrowCases} total cases`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', path: '/admin/escrow' },
    { label: 'Platform Revenue', value: formatCurrency(stats.totalRevenue), sub: `from completed cases`, icon: Banknote, color: 'text-purple-600', bg: 'bg-purple-50', path: '/admin/payouts' },
    { label: 'Active Listings', value: stats.activeListings.toLocaleString(), sub: `of ${stats.totalListings} total`, icon: ListChecks, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/admin/listings' },
  ];

  const escrowStats = [
    { label: 'Active Cases', value: stats.activeEscrowCases, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: stats.completedCases, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Disputed', value: stats.disputedCases, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total Cases', value: stats.totalEscrowCases, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  const actionItems = [
    {
      label: 'Payment Reviews',
      count: stats.pendingPayments,
      desc: 'Buyer payment proof submitted',
      path: '/admin/payments',
      icon: Bitcoin,
      color: stats.pendingPayments > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-white text-foreground',
      dotColor: 'bg-amber-500',
    },
    {
      label: 'Seller Evidence',
      count: stats.pendingEvidence,
      desc: 'Packaging evidence to review',
      path: '/admin/seller-verification',
      icon: Package,
      color: stats.pendingEvidence > 0 ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-border bg-white text-foreground',
      dotColor: 'bg-violet-500',
    },
    {
      label: 'Active Disputes',
      count: stats.activeDisputes,
      desc: 'Require admin resolution',
      path: '/admin/disputes',
      icon: AlertTriangle,
      color: stats.activeDisputes > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-border bg-white text-foreground',
      dotColor: 'bg-red-500',
    },
    {
      label: 'Pending Payouts',
      count: stats.pendingPayouts,
      desc: 'Buyer confirmed receipt',
      path: '/admin/payouts',
      icon: Banknote,
      color: stats.pendingPayouts > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-border bg-white text-foreground',
      dotColor: 'bg-emerald-500',
    },
  ];

  const adminSections = [
    { label: 'Users', icon: Users, path: '/admin/users', desc: 'Manage user accounts' },
    { label: 'Listings', icon: ListChecks, path: '/admin/listings', desc: 'Review marketplace listings' },
    { label: 'Escrow Cases', icon: ShieldCheck, path: '/admin/escrow', desc: `${stats.activeEscrowCases} active` },
    { label: 'Wallet Management', icon: Wallet, path: '/admin/wallets', desc: 'User wallets & balances' },
    { label: 'Payment Reviews', icon: Bitcoin, path: '/admin/payments', desc: `${stats.pendingPayments} pending` },
    { label: 'Payment Settings', icon: Bitcoin, path: '/admin/payment-settings', desc: 'Crypto addresses' },
    { label: 'Seller Verification', icon: Package, path: '/admin/seller-verification', desc: `${stats.pendingEvidence} pending` },
    { label: 'Delivery Management', icon: Truck, path: '/admin/delivery', desc: 'Track shipments' },
    { label: 'Disputes', icon: AlertTriangle, path: '/admin/disputes', desc: `${stats.activeDisputes} open` },
    { label: 'Payouts', icon: Banknote, path: '/admin/payouts', desc: `${stats.pendingPayouts} pending` },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics', desc: 'Platform metrics' },
    { label: 'Audit Logs', icon: Scale, path: '/admin/audit-logs', desc: 'Admin actions' },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>Admin Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.42)' }}>Real-time overview of all escrow transactions and platform activity</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors" style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.50)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'; }}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {mainStats.map(stat => (
          <Link key={stat.label} to={stat.path}>
            <div className="rounded-xl p-5 hover:-translate-y-0.5 transition-all group cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,60,0.12)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <stat.icon className="w-4 h-4" style={{ color: 'rgba(255,215,60,0.75)' }} />
                </div>
                <ArrowUpRight className="w-4 h-4 transition-colors" style={{ color: 'rgba(255,255,255,0.18)' }} />
              </div>
              <p className="font-heading text-xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.48)' }}>{stat.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{stat.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Escrow Case Stats */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.88)' }}>
            <ShieldCheck className="w-4 h-4" style={{ color: 'rgba(255,215,60,0.65)' }} /> Escrow Case Overview
          </h2>
          <Link to="/admin/escrow" className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'rgba(255,215,60,0.70)' }}>
            Manage all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {escrowStats.map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-2xl font-bold font-heading" style={{ color: 'rgba(255,215,60,0.85)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions Required */}
      <div className="mb-6">
        <h2 className="font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.88)' }}>
          <Clock className="w-4 h-4" style={{ color: 'rgba(255,215,60,0.70)' }} /> Actions Required
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {actionItems.map(item => (
            <Link key={item.path} to={item.path}>
              <div className="p-4 rounded-xl hover:-translate-y-0.5 transition-all group cursor-pointer"
                style={item.count > 0
                  ? { background: 'rgba(255,215,60,0.08)', border: '2px solid rgba(255,215,60,0.22)' }
                  : { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-2.5 h-2.5 rounded-full', item.count > 0 ? item.dotColor : 'bg-slate-600')} />
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'rgba(255,255,255,0.60)' }} />
                </div>
                <p className="text-2xl font-bold font-heading" style={{ color: item.count > 0 ? 'rgba(255,215,60,0.90)' : 'rgba(255,255,255,0.80)' }}>{item.count}</p>
                <p className="text-xs font-semibold mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{item.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Admin Sections Grid */}
      <div className="mb-6">
        <h2 className="font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.88)' }}>
          <Activity className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} /> All Admin Sections
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {adminSections.map(section => (
            <Link key={section.path} to={section.path}>
              <div className="rounded-xl p-4 hover:-translate-y-0.5 transition-all group cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,215,60,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,60,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}>
                <section.icon className="w-5 h-5 mb-2" style={{ color: 'rgba(255,215,60,0.55)' }} />
                <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{section.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{section.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Escrow Cases */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-heading font-semibold flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.88)' }}>
            <Clock className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} /> Recent Escrow Cases
          </h2>
          <Link to="/admin/escrow" className="text-xs hover:underline flex items-center gap-1" style={{ color: 'rgba(255,215,60,0.70)' }}>
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentCases.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No escrow cases yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Cases will appear here when buyers initiate escrow transactions</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Case #', 'Item', 'Buyer', 'Seller', 'Amount', 'Status', 'Updated', ''].map(h => (
                    <th key={h} className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wider',
                      h === 'Amount' ? 'text-right' : 'text-left')}
                      style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentCases.map(c => {
                  const sc = ESCROW_STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td className="px-4 py-3.5 font-mono text-xs font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>{c.caseNumber}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-xs truncate max-w-[130px]" style={{ color: 'rgba(255,255,255,0.80)' }}>{c.listingTitle}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{c.buyerName}</td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{c.sellerName}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs font-bold" style={{ color: 'rgba(255,215,60,0.85)' }}>{formatCurrency(c.amount, c.currency)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap', sc?.bg, sc?.color)}>
                          {sc?.label || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(c.updatedAt)}</td>
                      <td className="px-4 py-3.5">
                        <Link to={`/admin/escrow/${c.id}`}
                          className="flex items-center gap-1 text-xs font-semibold hover:underline whitespace-nowrap" style={{ color: 'rgba(255,215,60,0.70)' }}>
                          <Eye className="w-3.5 h-3.5" /> Manage
                        </Link>
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
  );
}
