import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Users, ShieldCheck, Banknote, AlertTriangle, Package,
  ListChecks, RefreshCw, Loader2, CheckCircle, Activity
} from 'lucide-react';
import { admin, listings } from '@/lib/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AnalyticsData {
  totalUsers: number;
  activeListings: number;
  totalListings: number;
  totalEscrowCases: number;
  activeEscrowCases: number;
  completedCases: number;
  disputedCases: number;
  totalVolume: number;
  completedVolume: number;
  totalRevenue: number;
  avgCaseValue: number;
  completionRate: number;
  disputeRate: number;
  monthlyVolume: { month: string; volume: number; count: number; revenue: number }[];
  statusBreakdown: { name: string; value: number; color: string }[];
  categoryBreakdown: { category: string; count: number; volume: number }[];
  recentCompletions: { caseNumber: string; title: string; amount: number; completedAt: string }[];
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: '#94a3b8',
  payment_submitted: '#f59e0b',
  payment_verified: '#3b82f6',
  seller_notified: '#8b5cf6',
  packaging_submitted: '#ec4899',
  packaging_approved: '#06b6d4',
  pickup_scheduled: '#f97316',
  in_transit: '#6366f1',
  delivered: '#84cc16',
  buyer_confirmed: '#22c55e',
  funds_released: '#10b981',
  disputed: '#ef4444',
  refunded: '#64748b',
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    const [
      userProfiles,
      allListings,
      escrowRows,
      activeListingRows,
    ] = await Promise.all([
      admin.users.list().catch(() => []),
      admin.listings.list().catch(() => []),
      admin.escrow.list().catch(() => []),
      listings.list({ status: 'active' }).catch(() => []),
    ]);

    const totalUsers = userProfiles.length;
    const activeListings = activeListingRows.length;
    const totalListings = allListings.length;

    const cases = escrowRows || [];
    const activeStatuses = ['awaiting_payment', 'payment_submitted', 'payment_verified', 'seller_notified',
      'item_ready', 'packaging_submitted', 'packaging_approved', 'pickup_scheduled', 'in_transit', 'delivered', 'buyer_confirmed'];

    const completedCases = cases.filter(c => ['funds_released', 'closed'].includes(c.status));
    const disputedCases = cases.filter(c => c.status === 'disputed');
    const totalVolume = cases.reduce((s, c) => s + Number(c.amount || 0), 0);
    const completedVolume = completedCases.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalRevenue = completedCases.reduce((s, c) => s + Number(c.fees || 0), 0);

    // Build monthly volume — last 8 months
    const now = new Date();
    const monthlyMap: Record<string, { volume: number; count: number; revenue: number }> = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = { volume: 0, count: 0, revenue: 0 };
    }
    cases.forEach(c => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].volume += Number(c.amount || 0);
        monthlyMap[key].count += 1;
        if (['funds_released', 'closed'].includes(c.status)) {
          monthlyMap[key].revenue += Number(c.fees || 0);
        }
      }
    });
    const monthlyVolume = Object.entries(monthlyMap).map(([key, val]) => ({
      month: MONTHS_SHORT[parseInt(key.split('-')[1]) - 1],
      ...val,
    }));

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    cases.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
    const statusBreakdown = Object.entries(statusCounts)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, color: STATUS_COLORS[name] || '#94a3b8' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Category breakdown
    const catMap: Record<string, { count: number; volume: number }> = {};
    allListings.forEach((row: any) => {
      const catName = row.categoryName || 'Other';
      if (!catMap[catName]) catMap[catName] = { count: 0, volume: 0 };
      catMap[catName].count += 1;
      catMap[catName].volume += Number(row.price || 0);
    });
    const categoryBreakdown = Object.entries(catMap)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.volume - a.volume);

    // Recent completions
    const recentCompletions = cases
      .filter(c => c.status === 'funds_released')
      .slice(-5)
      .reverse()
      .map(c => ({
        caseNumber: c.id.substring(0, 8).toUpperCase(),
        title: c.listing_title,
        amount: Number(c.amount),
        completedAt: c.created_at,
      }));

    setData({
      totalUsers: totalUsers || 0,
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      totalEscrowCases: cases.length,
      activeEscrowCases: cases.filter(c => activeStatuses.includes(c.status)).length,
      completedCases: completedCases.length,
      disputedCases: disputedCases.length,
      totalVolume,
      completedVolume,
      totalRevenue,
      avgCaseValue: cases.length > 0 ? totalVolume / cases.length : 0,
      completionRate: cases.length > 0 ? (completedCases.length / cases.length) * 100 : 0,
      disputeRate: cases.length > 0 ? (disputedCases.length / cases.length) * 100 : 0,
      monthlyVolume,
      statusBreakdown,
      categoryBreakdown,
      recentCompletions,
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics().finally(() => setLoading(false));
  }, [fetchAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    toast.success('Analytics refreshed');
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  if (!data) return null;

  const kpiCards = [
    { label: 'Total Users', value: data.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'registered accounts' },
    { label: 'Escrow Volume', value: formatCurrency(data.totalVolume), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', sub: `${data.totalEscrowCases} total cases` },
    { label: 'Platform Revenue', value: formatCurrency(data.totalRevenue), icon: Banknote, color: 'text-purple-600', bg: 'bg-purple-50', sub: `from ${data.completedCases} completed` },
    { label: 'Active Listings', value: data.activeListings.toLocaleString(), icon: ListChecks, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `of ${data.totalListings} total` },
    { label: 'Active Cases', value: data.activeEscrowCases.toLocaleString(), icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'in progress' },
    { label: 'Completed', value: data.completedCases.toLocaleString(), icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50', sub: `${data.completionRate.toFixed(1)}% completion rate` },
    { label: 'Disputed', value: data.disputedCases.toLocaleString(), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', sub: `${data.disputeRate.toFixed(1)}% dispute rate` },
    { label: 'Avg Case Value', value: formatCurrency(data.avgCaseValue), icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50', sub: 'per escrow case' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.name === 'Revenue' || p.name === 'Volume' ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Live platform performance metrics from the database</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiCards.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-border p-5">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
              <stat.icon className={cn('w-4 h-4', stat.color)} />
            </div>
            <p className="font-heading text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Monthly Volume Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-5">Monthly Escrow Volume (Last 8 Months)</h2>
          {data.monthlyVolume.some(m => m.volume > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.monthlyVolume} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false}
                  tickFormatter={v => v === 0 ? '$0' : `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="volume" name="Volume" fill="hsl(220, 65%, 18%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(158, 64%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
              <TrendingUp className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">No escrow data yet</p>
              <p className="text-xs mt-1">Volume will appear once cases are created</p>
            </div>
          )}
          {data.monthlyVolume.some(m => m.volume > 0) && (
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-[hsl(220,65%,18%)]" /> Volume
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-[hsl(158,64%,40%)]" /> Revenue
              </div>
            </div>
          )}
        </div>

        {/* Status Pie */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-5">Case Status Distribution</h2>
          {data.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={2}
                >
                  {data.statusBreakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value + ' cases', name]} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-[11px] text-foreground capitalize">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
              <ShieldCheck className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">No cases yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Monthly Case Count */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-5">Monthly Case Count</h2>
          {data.monthlyVolume.some(m => m.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.monthlyVolume} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="caseCountGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(220,65%,18%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(220,65%,18%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="Cases" stroke="hsl(220,65%,18%)" strokeWidth={2} fill="url(#caseCountGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>

        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-5">Monthly Revenue Trend</h2>
          {data.monthlyVolume.some(m => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.monthlyVolume} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(158,64%,40%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(158,64%,40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false}
                  tickFormatter={v => v === 0 ? '$0' : `$${(v / 1000).toFixed(1)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(158,64%,40%)" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Revenue data will appear once cases complete</div>
          )}
        </div>
      </div>

      {/* Category Breakdown Table */}
      {data.categoryBreakdown.length > 0 ? (
        <div className="bg-white rounded-xl border border-border overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-heading font-semibold text-sm text-foreground">Volume by Category</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Category', 'Cases', 'Total Volume', 'Avg Value', '% of Total'].map(h => (
                    <th key={h} className={cn('px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                      h === 'Category' ? 'text-left' : 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.categoryBreakdown.map(cat => {
                  const pct = data.totalVolume > 0 ? ((cat.volume / data.totalVolume) * 100) : 0;
                  return (
                    <tr key={cat.category} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-sm">{cat.category}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-muted-foreground">{cat.count}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-sm text-[hsl(var(--brand-navy))]">{formatCurrency(cat.volume)}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-muted-foreground">
                        {cat.count > 0 ? formatCurrency(cat.volume / cat.count) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[hsl(var(--brand-navy))] h-1.5 rounded-full transition-all"
                              style={{ width: `${pct.toFixed(1)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Platform Health */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Completion Rate',
            value: `${data.completionRate.toFixed(1)}%`,
            description: data.completionRate >= 80 ? 'Excellent' : data.completionRate >= 60 ? 'Good' : 'Needs attention',
            color: data.completionRate >= 80 ? 'text-emerald-600' : data.completionRate >= 60 ? 'text-amber-600' : 'text-red-600',
            bg: data.completionRate >= 80 ? 'bg-emerald-50 border-emerald-200' : data.completionRate >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
          },
          {
            label: 'Dispute Rate',
            value: `${data.disputeRate.toFixed(1)}%`,
            description: data.disputeRate <= 2 ? 'Very Low ✓' : data.disputeRate <= 5 ? 'Acceptable' : 'High — investigate',
            color: data.disputeRate <= 2 ? 'text-emerald-600' : data.disputeRate <= 5 ? 'text-amber-600' : 'text-red-600',
            bg: data.disputeRate <= 2 ? 'bg-emerald-50 border-emerald-200' : data.disputeRate <= 5 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
          },
          {
            label: 'Avg. Case Value',
            value: formatCurrency(data.avgCaseValue),
            description: 'Per escrow transaction',
            color: 'text-[hsl(var(--brand-navy))]',
            bg: 'bg-blue-50 border-blue-200',
          },
        ].map(item => (
          <div key={item.label} className={cn('rounded-xl border p-5 text-center', item.bg)}>
            <p className={cn('text-2xl font-bold font-heading', item.color)}>{item.value}</p>
            <p className="text-xs font-medium text-foreground mt-1">{item.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
