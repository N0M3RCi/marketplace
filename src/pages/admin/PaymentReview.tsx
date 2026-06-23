import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, CheckCircle, XCircle, Eye, AlertCircle, RefreshCw,
  Loader2, ExternalLink, Hash, DollarSign, Clock, User, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PaymentCase {
  id: string;
  caseNumber: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentAmountSent?: number;
  paymentProofUrl?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentRejectedAt?: string;
  paymentAdminNotes?: string;
  paymentNetwork?: string;
  paymentAddress?: string;
}

type FilterStatus = 'pending' | 'verified' | 'rejected' | 'all';

export default function PaymentReview() {
  const { user: adminUser } = useAuth();
  const [cases, setCases] = useState<PaymentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    let allCases: any[];
    try {
      allCases = await admin.escrow.list();
    } catch {
      toast.error('Failed to load payment reviews');
      return;
    }

    // Filter to cases with payment_submitted_at
    const filtered = (allCases || []).filter((c: any) => c.payment_submitted_at);

    setCases(filtered.map((c: any) => ({
      id: c.id,
      caseNumber: c.case_number,
      listingTitle: c.listing_title,
      buyerId: c.buyer_id,
      buyerName: c.buyer_name || 'Unknown',
      sellerId: c.seller_id,
      sellerName: c.seller_name || 'Unknown',
      amount: Number(c.amount),
      currency: c.currency || 'USD',
      status: c.status,
      paymentMethod: c.payment_method,
      paymentReference: c.payment_reference,
      paymentAmountSent: c.payment_amount_sent ? Number(c.payment_amount_sent) : undefined,
      paymentProofUrl: c.payment_proof_url,
      paymentSubmittedAt: c.payment_submitted_at,
      paymentVerifiedAt: c.payment_verified_at,
      paymentRejectedAt: c.payment_rejected_at,
      paymentAdminNotes: c.payment_admin_notes,
      paymentNetwork: c.payment_network,
      paymentAddress: c.payment_address,
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCases().finally(() => setLoading(false));
  }, [fetchCases]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const handleVerify = async (c: PaymentCase) => {
    setProcessingId(c.id);

    try {
      await admin.escrow.update(c.id, {
        status: 'payment_verified',
        payment_verified_at: new Date().toISOString(),
        payment_admin_notes: rejectNotes[c.id] || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error('Failed to verify: ' + err.message);
      setProcessingId(null);
      return;
    }

    // Timeline event via direct API call
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const api = (path: string, body: any) => fetch(`/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

    await api('/escrow/timeline', {
      caseId: c.id,
      status: 'payment_verified',
      label: 'Payment Verified by Administrator',
      actorName: adminUser?.username || 'Admin',
      actorRole: 'admin',
      notes: rejectNotes[c.id] || null,
    });

    // Notify seller & buyer via direct API
    await api('/notifications', { user_id: c.sellerId, type: 'payment_verified', title: 'Payment Verified', message: `Payment for "${c.listingTitle}" has been verified. Please prepare your item and submit evidence.`, case_id: c.id });
    await api('/notifications', { user_id: c.buyerId, type: 'payment_verified', title: 'Your Payment Was Verified', message: `Your payment for "${c.listingTitle}" has been verified. The seller has been notified.`, case_id: c.id });

    // Audit log via direct API
    await api('/admin/audit-logs', { admin_id: adminUser?.id, admin_name: adminUser?.username || 'Admin', action: 'verify_payment', entity_type: 'escrow_case', entity_id: c.id, details: `Payment verified for case ${c.caseNumber} — ${formatCurrency(c.amount, c.currency)}` });

    toast.success(`Payment verified for ${c.caseNumber}`);
    setProcessingId(null);
    await fetchCases();
  };

  const handleReject = async (c: PaymentCase) => {
    const notes = rejectNotes[c.id];
    if (!notes?.trim()) { toast.error('Please provide a rejection reason'); return; }

    setProcessingId(c.id);

    try {
      await admin.escrow.update(c.id, {
        status: 'awaiting_payment',
        payment_admin_notes: notes,
        payment_submitted_at: null,
        payment_proof_url: null,
        payment_reference: null,
        payment_amount_sent: null,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error('Failed to reject: ' + err.message);
      setProcessingId(null);
      return;
    }

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const api = (path: string, body: any) => fetch(`/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

    // Timeline
    await api('/escrow/timeline', { caseId: c.id, status: 'awaiting_payment', label: 'Payment Rejected by Administrator', actorName: adminUser?.username || 'Admin', actorRole: 'admin', notes });

    // Notify buyer
    await api('/notifications', { user_id: c.buyerId, type: 'payment_rejected', title: 'Payment Rejected', message: `Your payment proof for "${c.listingTitle}" was rejected. Reason: ${notes}. Please resubmit.`, case_id: c.id });

    // Audit log
    await api('/admin/audit-logs', { admin_id: adminUser?.id, admin_name: adminUser?.username || 'Admin', action: 'reject_payment', entity_type: 'escrow_case', entity_id: c.id, details: `Payment rejected for case ${c.caseNumber} — Reason: ${notes}` });

    toast.error(`Payment rejected for ${c.caseNumber}`);
    setRejectNotes(prev => { const next = { ...prev }; delete next[c.id]; return next; });
    setProcessingId(null);
    await fetchCases();
  };

  const getPaymentStatus = (c: PaymentCase): FilterStatus => {
    if (c.paymentVerifiedAt) return 'verified';
    if (c.paymentRejectedAt || c.status === 'awaiting_payment') return 'rejected';
    return 'pending';
  };

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || c.caseNumber.toLowerCase().includes(q)
      || c.buyerName.toLowerCase().includes(q)
      || c.listingTitle.toLowerCase().includes(q);
    const ps = getPaymentStatus(c);
    const matchStatus = filterStatus === 'all' || ps === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = cases.filter(c => getPaymentStatus(c) === 'pending').length;
  const verifiedCount = cases.filter(c => getPaymentStatus(c) === 'verified').length;
  const rejectedCount = cases.filter(c => getPaymentStatus(c) === 'rejected').length;

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Payment Review</h1>
          <p className="text-muted-foreground text-sm mt-1">Verify or reject crypto payment proof submitted by buyers</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">{pendingCount} pending</span>
            </div>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending Review', value: pendingCount, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Verified',       value: verifiedCount, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Rejected',       value: rejectedCount, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.bg, s.border)}>
            <p className={cn('text-2xl font-bold font-heading', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by case number, buyer, or listing..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(['pending', 'verified', 'rejected', 'all'] as FilterStatus[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors',
                filterStatus === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
              {s} {s !== 'all' && `(${s === 'pending' ? pendingCount : s === 'verified' ? verifiedCount : rejectedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Cases */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">
              {filterStatus === 'pending' ? 'No pending reviews' : 'No results found'}
            </p>
            <p className="text-muted-foreground text-sm">
              {filterStatus === 'pending'
                ? 'All payment submissions have been reviewed.'
                : 'Try changing the filter or search term.'}
            </p>
          </div>
        ) : filtered.map(c => {
          const ps = getPaymentStatus(c);
          const isExpanded = expandedId === c.id;
          const isProcessing = processingId === c.id;

          const statusConfig = {
            pending:  { label: 'Awaiting Review', bg: 'bg-amber-100',  color: 'text-amber-700' },
            verified: { label: 'Verified',         bg: 'bg-emerald-100',color: 'text-emerald-700' },
            rejected: { label: 'Rejected',          bg: 'bg-red-100',   color: 'text-red-700' },
          }[ps];

          return (
            <div key={c.id} className={cn('bg-white rounded-xl border overflow-hidden transition-all',
              ps === 'pending' ? 'border-amber-200' : 'border-border')}>

              {/* Header row */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{c.caseNumber}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', statusConfig.bg, statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{c.listingTitle}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Buyer: <span className="font-medium text-foreground ml-0.5">{c.buyerName}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Seller: <span className="font-medium text-foreground ml-0.5">{c.sellerName}</span>
                      </span>
                    </div>
                  </div>

                  {/* Amount + CTA */}
                  <div className="flex items-start gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[hsl(var(--brand-navy))]">{formatCurrency(c.amount, c.currency)}</p>
                      {c.paymentAmountSent && (
                        <p className="text-xs text-muted-foreground">Sent: {formatCurrency(c.paymentAmountSent, c.currency)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Link to={`/admin/escrow/${c.id}`}>
                        <Button variant="outline" size="sm" className="w-full text-xs gap-1">
                          <Eye className="w-3.5 h-3.5" /> View Case
                        </Button>
                      </Link>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        {isExpanded ? 'Collapse' : 'Details'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick evidence preview */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Method', value: c.paymentMethod || 'Crypto', icon: Hash },
                    { label: 'Tx Reference', value: c.paymentReference || '—', icon: Hash, mono: true },
                    { label: 'Network', value: c.paymentNetwork || '—', icon: DollarSign },
                    { label: 'Submitted', value: c.paymentSubmittedAt ? formatDateTime(c.paymentSubmittedAt).split(',')[0] : '—', icon: Clock },
                  ].map(item => (
                    <div key={item.label} className="p-2.5 rounded-xl bg-muted/40 border border-border">
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      <p className={cn('text-xs font-medium mt-0.5 truncate', item.mono && 'font-mono')}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                  {/* Payment address */}
                  {c.paymentAddress && (
                    <div className="p-3 bg-muted/30 rounded-xl border border-border">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment Address</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-white border border-border rounded px-2 py-1 flex-1 break-all">{c.paymentAddress}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{c.paymentNetwork}</span>
                      </div>
                    </div>
                  )}

                  {/* Proof URL */}
                  {c.paymentProofUrl && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Payment Proof</p>
                      <a href={c.paymentProofUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-xl hover:bg-muted transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> View Proof Document / Screenshot
                      </a>
                    </div>
                  )}

                  {/* Prior admin notes */}
                  {c.paymentAdminNotes && (
                    <div className="p-3 bg-muted/30 rounded-xl text-xs text-muted-foreground">
                      <span className="font-medium">Prior admin note: </span>{c.paymentAdminNotes}
                    </div>
                  )}

                  {/* Verified/Rejected info */}
                  {c.paymentVerifiedAt && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      Verified on {formatDateTime(c.paymentVerifiedAt)}
                    </div>
                  )}
                  {c.paymentRejectedAt && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      Rejected on {formatDateTime(c.paymentRejectedAt)}
                    </div>
                  )}

                  {/* Action panel for pending */}
                  {ps === 'pending' && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div>
                        <label className="block text-xs font-medium mb-1.5">
                          Admin Note <span className="text-red-500">*</span>
                          <span className="text-muted-foreground font-normal ml-1">(required for rejection)</span>
                        </label>
                        <input
                          value={rejectNotes[c.id] || ''}
                          onChange={e => setRejectNotes(p => ({ ...p, [c.id]: e.target.value }))}
                          placeholder="Reason for rejection, or optional note for verification..."
                          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleVerify(c)}
                          disabled={isProcessing}
                          className="flex-1 bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Verify Payment
                        </Button>
                        <Button
                          onClick={() => handleReject(c)}
                          disabled={isProcessing}
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Reject Payment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
