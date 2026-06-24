import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, Eye, Filter, RefreshCw, Plus, AlertCircle, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/client';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { EscrowStatus } from '@/types';
import { ESCROW_STATUS_CONFIG } from '@/constants';
import { toast } from 'sonner';

interface CaseRow {
  id: string;
  caseNumber: string;
  listingTitle: string;
  buyerName: string;
  sellerName: string;
  amount: number;
  fees: number;
  currency: string;
  status: EscrowStatus;
  createdAt: string;
  updatedAt: string;
  hasPaymentSubmitted: boolean;
  hasSellerEvidence: boolean;
  hasDispute: boolean;
}

const ALL_STATUSES: EscrowStatus[] = [
  'awaiting_payment', 'payment_submitted', 'payment_verified', 'seller_notified',
  'item_ready', 'packaging_submitted', 'packaging_approved', 'pickup_scheduled',
  'in_transit', 'delivered', 'buyer_confirmed', 'funds_released', 'refunded', 'disputed', 'completed', 'cancelled', 'closed'
];

export default function EscrowCases() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EscrowStatus | 'all'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    let data;
    try {
      data = await admin.escrow.list();
    } catch (err: any) {
      toast.error('Failed to load escrow cases');
      return;
    }

    setCases((data || []).map((c: any) => ({
      id: c.id,
      caseNumber: c.case_number,
      listingTitle: c.listing_title,
      buyerName: c.buyer_name || 'Unknown',
      sellerName: c.seller_name || 'Unknown',
      amount: Number(c.amount),
      fees: Number(c.fees || 0),
      currency: c.currency || 'USD',
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      hasPaymentSubmitted: !!c.payment_submitted_at,
      hasSellerEvidence: !!c.seller_evidence_submitted_at,
      hasDispute: !!c.dispute_status,
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCases().finally(() => setLoading(false));
  }, [fetchCases]);

  const handleDeleteCase = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this escrow case? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await admin.escrow.delete(id);
      toast.success('Escrow case deleted');
      await fetchCases();
    } catch (err: any) {
      toast.error('Failed to delete case: ' + (err.message || 'Unknown error'));
    }
    setDeletingId(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
  };

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.caseNumber.toLowerCase().includes(q) ||
      c.buyerName.toLowerCase().includes(q) ||
      c.sellerName.toLowerCase().includes(q) ||
      c.listingTitle.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingPayments = cases.filter(c => c.status === 'payment_submitted').length;
  const pendingEvidence = cases.filter(c => c.status === 'packaging_submitted').length;
  const activeDisputes = cases.filter(c => c.hasDispute && c.status === 'disputed').length;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Escrow Cases</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} of {cases.length} cases</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Alert Counters */}
      {(pendingPayments > 0 || pendingEvidence > 0 || activeDisputes > 0) && (
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {pendingPayments > 0 && (
            <button onClick={() => setStatusFilter('payment_submitted')}
              className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">{pendingPayments} Payment{pendingPayments > 1 ? 's' : ''} to Review</p>
                <p className="text-[11px] text-amber-700">Buyer payment proof submitted</p>
              </div>
            </button>
          )}
          {pendingEvidence > 0 && (
            <button onClick={() => setStatusFilter('packaging_submitted')}
              className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-colors text-left">
              <AlertCircle className="w-5 h-5 text-violet-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-violet-800">{pendingEvidence} Evidence to Review</p>
                <p className="text-[11px] text-violet-700">Seller packaging submitted</p>
              </div>
            </button>
          )}
          {activeDisputes > 0 && (
            <button onClick={() => setStatusFilter('disputed')}
              className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-left">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-800">{activeDisputes} Active Dispute{activeDisputes > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-red-700">Requires admin resolution</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by case #, buyer, seller, or item..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as EscrowStatus | 'all')}
            className="px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white">
            <option value="all">All Statuses ({cases.length})</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{ESCROW_STATUS_CONFIG[s]?.label || s} ({cases.filter(c => c.status === s).length})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Filter Pills */}
      <div className="flex gap-2 flex-wrap mb-5">
        {[
          { value: 'all', label: 'All' },
          { value: 'payment_submitted', label: '🔔 Payment Review' },
          { value: 'packaging_submitted', label: '📦 Evidence Review' },
          { value: 'pickup_scheduled', label: '🚚 Pickup' },
          { value: 'in_transit', label: '✈️ In Transit' },
          { value: 'disputed', label: '⚠️ Disputed' },
          { value: 'funds_released', label: '✅ Completed' },
        ].map(opt => (
          <button key={opt.value} onClick={() => setStatusFilter(opt.value as EscrowStatus | 'all')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
              statusFilter === opt.value
                ? 'bg-[hsl(var(--brand-navy))] text-white border-[hsl(var(--brand-navy))]'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            )}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-border p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buyer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seller</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No cases found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground font-medium">{c.caseNumber}</span>
                        {c.hasDispute && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Has dispute" />}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-xs truncate max-w-[140px]">{c.listingTitle}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-foreground">{c.buyerName}</td>
                    <td className="px-4 py-3.5 text-xs text-foreground">{c.sellerName}</td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-bold text-xs text-[hsl(var(--brand-navy))]">{formatCurrency(c.amount, c.currency)}</p>
                      <p className="text-[10px] text-muted-foreground">fee: {formatCurrency(c.fees, c.currency)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold', ESCROW_STATUS_CONFIG[c.status]?.bg, ESCROW_STATUS_CONFIG[c.status]?.color)}>
                        {ESCROW_STATUS_CONFIG[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link to={`/admin/escrow/${c.id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--brand-navy))] hover:underline whitespace-nowrap">
                          <Eye className="w-3.5 h-3.5" /> Manage
                        </Link>
                        <button
                          onClick={() => handleDeleteCase(c.id)}
                          disabled={deletingId === c.id}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                          title="Delete case"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
