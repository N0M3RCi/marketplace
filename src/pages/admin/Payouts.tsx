import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Banknote, CheckCircle, Eye, DollarSign, RefreshCw,
  Clock, XCircle, Hash, Calendar, User, ExternalLink, Filter,
  Loader2, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Payout {
  id: string;
  payoutNumber: string;
  caseId: string;
  caseNumber: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  amount: number;
  fees: number;
  netAmount: number;
  currency: string;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled';
  paymentMethod?: string;
  paymentReference?: string;
  approvedBy?: string;
  approvedAt?: string;
  releasedAt?: string;
  paidAt?: string;
  releaseDate?: string;
  adminNotes?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Pending',    bg: 'bg-amber-100',  color: 'text-amber-700' },
  approved:   { label: 'Approved',   bg: 'bg-blue-100',   color: 'text-blue-700' },
  processing: { label: 'Processing', bg: 'bg-sky-100',    color: 'text-sky-700' },
  paid:       { label: 'Paid',       bg: 'bg-emerald-100',color: 'text-emerald-700' },
  failed:     { label: 'Failed',     bg: 'bg-red-100',    color: 'text-red-700' },
  cancelled:  { label: 'Cancelled',  bg: 'bg-slate-100',  color: 'text-slate-600' },
};

export default function Payouts() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPayouts = useCallback(async () => {
    let escrowCases: any[] = [];
    let payoutsData: any[] = [];

    try {
      escrowCases = await admin.escrow.list();
    } catch {
      toast.error('Failed to load payouts');
      return;
    }

    try {
      payoutsData = await admin.payouts.list();
    } catch {
      payoutsData = [];
    }

    if (payoutsData && payoutsData.length > 0) {
      setPayouts(payoutsData.map((p: any) => ({
        id: p.id,
        payoutNumber: p.payout_number,
        caseId: p.case_id,
        caseNumber: p.case_number || p.case?.case_number || '',
        listingTitle: p.listing_title || p.case?.listing_title || '',
        sellerId: p.seller_id,
        sellerName: p.seller?.username || 'Unknown',
        sellerEmail: p.seller?.email || '',
        amount: Number(p.amount),
        fees: Number(p.fees || 0),
        netAmount: Number(p.net_amount || (p.amount - (p.fees || 0))),
        currency: p.currency || 'USD',
        status: p.status || 'pending',
        paymentMethod: p.payment_method,
        paymentReference: p.payment_reference,
        approvedBy: p.approved_by,
        approvedAt: p.approved_at,
        releasedAt: p.released_at,
        paidAt: p.paid_at,
        releaseDate: p.release_date,
        adminNotes: p.notes || p.admin_notes,
        createdAt: p.created_at,
      })));
      return;
    }

    // Fetch seller info for each case
    const sellerInfoMap: Record<string, { id: string; username: string; email: string }> = {};
    escrowCases.forEach((c: any) => {
      sellerInfoMap[c.seller_id] = { id: c.seller_id, username: c.seller_name || 'Unknown', email: '' };
    });

    // Fallback: generate payout records from escrow cases
    const relevantStatuses = ['buyer_confirmed', 'funds_released', 'refunded', 'disputed'];
    const syntheticPayouts: Payout[] = escrowCases
      .filter((c: any) => relevantStatuses.includes(c.status))
      .map((c: any) => {
        const amount = Number(c.amount);
        const fees = Number(c.fees || 0);
        const si = sellerInfoMap[c.seller_id] || {};
        return {
          id: `payout-${c.id}`,
          payoutNumber: `PAY-${c.case_number}`,
          caseId: c.id,
          caseNumber: c.case_number,
          listingTitle: c.listing_title,
          sellerId: c.seller_id,
          sellerName: si.username || 'Unknown',
          sellerEmail: si.email || '',
          amount,
          fees,
          netAmount: amount - fees,
          currency: c.currency || 'USD',
          status: c.status === 'funds_released' ? 'paid' :
                  c.status === 'refunded' ? 'cancelled' :
                  c.status === 'buyer_confirmed' ? 'approved' : 'pending',
          paidAt: c.funds_released_at,
          createdAt: c.created_at,
        };
      });
    setPayouts(syntheticPayouts);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPayouts().finally(() => setLoading(false));
  }, [fetchPayouts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPayouts();
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const updatePayoutStatus = async (payout: Payout, newStatus: Payout['status'], extra: Record<string, any> = {}) => {
    setSaving(true);

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const api = (path: string, body: any) => fetch(`/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

    const timelineLabel = newStatus === 'paid' ? 'Funds Released to Seller' :
                          newStatus === 'cancelled' ? 'Payout Cancelled' :
                          newStatus === 'approved' ? 'Payout Approved' : `Payout ${newStatus}`;

    const caseUpdates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (newStatus === 'paid') {
      caseUpdates.status = 'funds_released';
    } else if (newStatus === 'cancelled') {
      caseUpdates.status = 'refunded';
    }

    if (Object.keys(caseUpdates).length > 1) {
      try {
        await admin.escrow.update(payout.caseId, caseUpdates);
      } catch {
        toast.error('Failed to update payout');
        setSaving(false);
        return;
      }
    }

    // Add timeline event
    await api('/escrow/timeline', {
      caseId: payout.caseId,
      status: newStatus === 'paid' ? 'funds_released' : newStatus,
      label: timelineLabel,
      actorName: user?.username || 'Admin',
      actorRole: 'admin',
      notes: adminNote || extra.notes || null,
    });

    // Notify seller
    if (newStatus === 'paid') {
      await api('/notifications', { user_id: payout.sellerId, type: 'funds_released', title: 'Funds Released', message: `${formatCurrency(payout.netAmount, payout.currency)} has been released to you for case ${payout.caseNumber}.`, case_id: payout.caseId });
    } else if (newStatus === 'cancelled') {
      await api('/notifications', { user_id: payout.sellerId, type: 'refund_issued', title: 'Payout Cancelled', message: `Your payout for case ${payout.caseNumber} has been cancelled.`, case_id: payout.caseId });
    }

    // Audit log
    await api('/admin/audit-logs', { admin_id: user?.id, admin_name: user?.username || 'Admin', action: `payout_${newStatus}`, entity_type: 'payout', entity_id: payout.id, details: `Payout ${newStatus} for case ${payout.caseNumber}` });

    toast.success(`Payout ${newStatus}`);
    setSelectedPayout(null);
    setAdminNote('');
    setPaymentRef('');
    await fetchPayouts();
    setSaving(false);
  };

  const handleApprove = (p: Payout) => updatePayoutStatus(p, 'approved');
  const handleRelease = (p: Payout) => updatePayoutStatus(p, 'paid', { reference: paymentRef });
  const handleCancel = (p: Payout) => updatePayoutStatus(p, 'cancelled');

  const filtered = payouts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.payoutNumber.toLowerCase().includes(q) ||
      p.caseNumber.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q) ||
      p.listingTitle.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPaid = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.netAmount, 0);
  const totalPending = payouts.filter(p => ['pending', 'approved'].includes(p.status)).reduce((s, p) => s + p.netAmount, 0);
  const totalFees = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.fees, 0);
  const pendingApproval = payouts.filter(p => p.status === 'pending').length;
  const pendingRelease = payouts.filter(p => p.status === 'approved').length;

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Payout Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Approve and release seller payouts</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Payouts', value: payouts.length.toString(), icon: Banknote, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'all time' },
          { label: 'Total Paid Out', value: formatCurrency(totalPaid), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `${payouts.filter(p => p.status === 'paid').length} paid` },
          { label: 'Pending Release', value: formatCurrency(totalPending), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', sub: `${pendingApproval + pendingRelease} payouts` },
          { label: 'Platform Revenue', value: formatCurrency(totalFees), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'from completed' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-border p-4">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
              <stat.icon className={cn('w-4.5 h-4.5', stat.color)} />
            </div>
            <p className="font-heading font-bold text-lg text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Action Alerts */}
      {(pendingApproval > 0 || pendingRelease > 0) && (
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {pendingApproval > 0 && (
            <button onClick={() => setStatusFilter('pending')}
              className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">{pendingApproval} Payout{pendingApproval > 1 ? 's' : ''} Awaiting Approval</p>
                <p className="text-[11px] text-amber-700">Buyer has confirmed receipt</p>
              </div>
            </button>
          )}
          {pendingRelease > 0 && (
            <button onClick={() => setStatusFilter('approved')}
              className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-left">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-800">{pendingRelease} Payout{pendingRelease > 1 ? 's' : ''} Ready to Release</p>
                <p className="text-[11px] text-blue-700">Approved — awaiting fund transfer</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by payout #, case #, or seller..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 flex-wrap">
            {['all', 'pending', 'approved', 'paid', 'cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors',
                  statusFilter === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Payout ID', 'Case', 'Seller', 'Amount', 'Fee', 'Net Payout', 'Status', 'Date', ''].map(h => (
                  <th key={h} className={cn('px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                    ['Amount', 'Fee', 'Net Payout'].includes(h) ? 'text-right' : 'text-left')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Banknote className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No payouts found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Payouts are created when buyers confirm receipt</p>
                  </td>
                </tr>
              ) : filtered.map(p => {
                const sc = STATUS_CONFIG[p.status];
                return (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3 h-3 text-muted-foreground/40" />
                        <span className="font-mono text-xs font-medium text-muted-foreground">{p.payoutNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link to={`/admin/escrow/${p.caseId}`}
                        className="flex items-center gap-1 text-xs font-mono font-medium text-[hsl(var(--brand-navy))] hover:underline">
                        {p.caseNumber} <ArrowUpRight className="w-3 h-3" />
                      </Link>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{p.listingTitle}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[hsl(var(--brand-navy))]/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-[hsl(var(--brand-navy))]" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{p.sellerName}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{p.sellerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="px-4 py-3.5 text-right text-xs text-red-500">-{formatCurrency(p.fees, p.currency)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-bold text-[hsl(var(--brand-emerald))]">{formatCurrency(p.netAmount, p.currency)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold', sc?.bg, sc?.color)}>
                        {sc?.label || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Link to={`/admin/escrow/${p.caseId}`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        {p.status === 'pending' && (
                          <Button size="sm" onClick={() => handleApprove(p)}
                            className="h-7 text-[11px] px-2.5 navy-gradient text-white border-0 hover:opacity-90">
                            Approve
                          </Button>
                        )}
                        {p.status === 'approved' && (
                          <Button size="sm" onClick={() => setSelectedPayout(p)}
                            className="h-7 text-[11px] px-2.5 bg-[hsl(var(--brand-emerald))] text-white border-0 hover:bg-[hsl(158,64%,32%)]">
                            Release
                          </Button>
                        )}
                        {['pending', 'approved'].includes(p.status) && (
                          <Button size="sm" variant="outline" onClick={() => handleCancel(p)}
                            className="h-7 text-[11px] px-2 border-red-200 text-red-600 hover:bg-red-50">
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Release Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPayout(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <h2 className="font-heading font-bold text-lg text-foreground mb-1">Release Funds</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Transfer <span className="font-bold text-[hsl(var(--brand-emerald))]">{formatCurrency(selectedPayout.netAmount, selectedPayout.currency)}</span> to <span className="font-semibold">{selectedPayout.sellerName}</span>
            </p>

            <div className="space-y-4">
              {/* Breakdown */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                {[
                  { label: 'Escrow Amount', value: formatCurrency(selectedPayout.amount, selectedPayout.currency) },
                  { label: 'Platform Fee', value: `-${formatCurrency(selectedPayout.fees, selectedPayout.currency)}`, cls: 'text-red-600' },
                  { label: 'Net to Seller', value: formatCurrency(selectedPayout.netAmount, selectedPayout.currency), cls: 'text-emerald-600 font-bold' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={row.cls}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Payment Reference / Tx ID (optional)</label>
                <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. Bank transfer ref, crypto tx hash..."
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Admin Notes (optional)</label>
                <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                  placeholder="Note for the record..."
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => handleRelease(selectedPayout)} disabled={saving}
                className="flex-1 bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
                Confirm Release
              </Button>
              <Button variant="outline" onClick={() => setSelectedPayout(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
