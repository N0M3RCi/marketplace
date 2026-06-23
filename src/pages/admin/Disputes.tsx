import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, AlertTriangle, CheckCircle, Eye, RefreshCw, Image as ImageIcon,
  Video, FileText as FileIcon, Download, ExternalLink, Clock,
  Filter, Loader2, User, Calendar, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { admin } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, formatDate, cn } from '@/lib/utils';
import { DISPUTE_REASONS, ESCROW_STATUS_CONFIG } from '@/constants';
import { toast } from 'sonner';
import type { EscrowStatus } from '@/types';

interface DisputeEvidence {
  id: string;
  submittedBy: string;
  submitterName: string;
  submitterRole: string;
  fileUrl: string;
  fileType: 'image' | 'video' | 'document';
  fileName?: string;
  description?: string;
  createdAt: string;
}

interface DisputeCase {
  id: string;
  caseNumber: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  disputeOpenedBy?: string;
  disputeReason?: string;
  disputeDescription?: string;
  disputeStatus?: string;
  disputeOutcome?: string;
  disputeAdminNotes?: string;
  disputeResolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  evidence: DisputeEvidence[];
}

export default function Disputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    let allCases: any[];
    try {
      allCases = await admin.escrow.list();
    } catch {
      toast.error('Failed to load disputes');
      return;
    }

    const data = (allCases || []).filter((c: any) => c.dispute_status);

    // Fetch evidence for each dispute
    const evidenceByCase: Record<string, DisputeEvidence[]> = {};
    for (const c of data) {
      try {
        const evData = await admin.disputes.evidence(c.id);
        if (evData && Array.isArray(evData)) {
          evidenceByCase[c.id] = evData.map((e: any) => ({
            id: e.id,
            submittedBy: e.uploaded_by,
            submitterName: e.username || 'Unknown',
            submitterRole: e.submitter_role || (e.uploaded_by === c.buyer_id ? 'buyer' : 'seller'),
            fileUrl: e.file_url,
            fileType: e.file_type as 'image' | 'video' | 'document',
            fileName: e.file_name,
            description: e.description,
            createdAt: e.created_at,
          }));
        }
      } catch {
        evidenceByCase[c.id] = [];
      }
    }

    setDisputes(data.map((c: any) => ({
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
      disputeOpenedBy: c.dispute_opened_by,
      disputeReason: c.dispute_reason,
      disputeDescription: c.dispute_description,
      disputeStatus: c.dispute_status,
      disputeOutcome: c.dispute_outcome,
      disputeAdminNotes: c.dispute_admin_notes,
      disputeResolvedAt: c.dispute_resolved_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      evidence: evidenceByCase[c.id] || [],
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDisputes().finally(() => setLoading(false));
  }, [fetchDisputes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDisputes();
    setRefreshing(false);
  };

  const handleResolve = async (dispute: DisputeCase, outcome: string) => {
    const note = adminNotes[dispute.id] || '';
    if (!note.trim() && outcome !== 'request_more_evidence') {
      toast.error('Please add decision notes before resolving');
      return;
    }

    setSaving(dispute.id);

    const outcomeLabels: Record<string, string> = {
      full_refund: 'Full Refund Issued to Buyer',
      partial_refund: 'Partial Refund Issued',
      release_funds: 'Funds Released to Seller',
      request_more_evidence: 'More Evidence Requested',
    };

    const newCaseStatus: Record<string, string> = {
      full_refund: 'refunded',
      partial_refund: 'refunded',
      release_funds: 'funds_released',
    };

    const caseUpdates: Record<string, any> = {
      dispute_status: outcome === 'request_more_evidence' ? 'under_review' : 'resolved',
      dispute_outcome: outcome,
      dispute_admin_notes: note,
      updated_at: new Date().toISOString(),
    };

    if (newCaseStatus[outcome]) {
      caseUpdates.status = newCaseStatus[outcome];
    }

    try {
      await admin.escrow.update(dispute.id, caseUpdates);
    } catch {
      toast.error('Failed to resolve dispute');
      setSaving(null);
      return;
    }

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const api = (path: string, body: any) => fetch(`/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

    // Add timeline
    await api('/escrow/timeline', {
      caseId: dispute.id,
      status: newCaseStatus[outcome] || dispute.status,
      label: `Dispute Resolved: ${outcomeLabels[outcome]}`,
      actorName: user?.username || 'Admin',
      actorRole: 'admin',
      notes: note,
    });

    // Notify both parties
    const notifications: any[] = [];
    if (outcome === 'full_refund' || outcome === 'partial_refund') {
      notifications.push({ user_id: dispute.buyerId, type: 'dispute_resolved', title: 'Dispute Resolved', message: `Your dispute for "${dispute.listingTitle}" has been resolved: ${outcomeLabels[outcome]}.`, case_id: dispute.id });
      notifications.push({ user_id: dispute.sellerId, type: 'dispute_resolved', title: 'Dispute Resolved', message: `The dispute for case ${dispute.caseNumber} has been resolved: ${outcomeLabels[outcome]}.`, case_id: dispute.id });
    } else if (outcome === 'release_funds') {
      notifications.push({ user_id: dispute.sellerId, type: 'funds_released', title: 'Funds Released', message: `Dispute resolved in your favor. ${formatCurrency(dispute.amount, dispute.currency)} released.`, case_id: dispute.id });
    } else {
      notifications.push({ user_id: dispute.disputeOpenedBy || dispute.buyerId, type: 'dispute_update', title: 'Additional Evidence Requested', message: `Admin has requested more evidence for dispute on case ${dispute.caseNumber}.`, case_id: dispute.id });
    }
    await Promise.all(notifications.map(n => api('/notifications', n)));

    // Audit log
    await api('/admin/audit-logs', { admin_id: user?.id, admin_name: user?.username || 'Admin', action: outcome === 'request_more_evidence' ? 'request_evidence' : 'resolve_dispute', entity_type: 'escrow_case', entity_id: dispute.id, details: `Dispute resolved: ${outcomeLabels[outcome]}` });

    toast.success(`Dispute resolved: ${outcomeLabels[outcome]}`);
    setAdminNotes(prev => ({ ...prev, [dispute.id]: '' }));
    setSaving(null);
    await fetchDisputes();
  };

  const filtered = disputes.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      d.caseNumber.toLowerCase().includes(q) ||
      d.buyerName.toLowerCase().includes(q) ||
      d.sellerName.toLowerCase().includes(q) ||
      d.listingTitle.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'open' && ['open', 'under_review'].includes(d.disputeStatus || '')) ||
      d.disputeStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCount = disputes.filter(d => ['open', 'under_review'].includes(d.disputeStatus || '')).length;
  const resolvedCount = disputes.filter(d => d.disputeStatus === 'resolved').length;

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Dispute Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Review and resolve disputes between buyers and sellers</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-heading text-red-700">{openCount}</p>
          <p className="text-xs text-red-600 mt-0.5">Open Disputes</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-heading text-amber-700">{disputes.filter(d => d.disputeStatus === 'under_review').length}</p>
          <p className="text-xs text-amber-600 mt-0.5">Under Review</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-heading text-emerald-700">{resolvedCount}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Resolved</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search disputes..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { value: 'open', label: `Open (${openCount})` },
            { value: 'under_review', label: 'Under Review' },
            { value: 'resolved', label: `Resolved (${resolvedCount})` },
            { value: 'all', label: 'All' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
              className={cn('px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                statusFilter === opt.value ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dispute Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-16 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
          <p className="font-heading font-semibold text-foreground mb-1">No disputes found</p>
          <p className="text-sm text-muted-foreground">Disputes will appear here when opened by buyers or sellers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(d => {
            const isOpen = ['open', 'under_review'].includes(d.disputeStatus || '');
            const isExpanded = expandedId === d.id;
            const openedByBuyer = d.disputeOpenedBy === d.buyerId;

            return (
              <div key={d.id} className={cn('bg-white rounded-xl border overflow-hidden transition-shadow',
                isOpen ? 'border-red-200 shadow-sm' : 'border-border')}>
                {/* Header */}
                <div className={cn('px-5 py-4 flex items-start justify-between gap-4',
                  isOpen ? 'bg-red-50/50' : 'bg-muted/20')}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{d.caseNumber}</span>
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold',
                        d.disputeStatus === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                        d.disputeStatus === 'under_review' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700')}>
                        {d.disputeStatus?.replace('_', ' ') || 'open'}
                      </span>
                      {d.disputeReason && (
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {DISPUTE_REASONS[d.disputeReason as keyof typeof DISPUTE_REASONS] || d.disputeReason}
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-[hsl(var(--brand-navy))]">
                        {formatCurrency(d.amount, d.currency)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-foreground mb-0.5">{d.listingTitle}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Opened by <span className="font-medium text-foreground ml-0.5">
                          {openedByBuyer ? `${d.buyerName} (Buyer)` : `${d.sellerName} (Seller)`}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(d.updatedAt)}
                      </span>
                      {d.evidence.length > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <ImageIcon className="w-3 h-3" />
                          {d.evidence.length} evidence file{d.evidence.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                    <Link to={`/admin/escrow/${d.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        <Eye className="w-3 h-3" /> Full Case
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border">
                    {/* Description */}
                    {d.disputeDescription && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> Dispute Description
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">{d.disputeDescription}</p>
                      </div>
                    )}

                    {/* Evidence Files */}
                    {d.evidence.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          Evidence Submitted ({d.evidence.length} files)
                        </p>
                        <div className="space-y-2">
                          {/* Group by submitter role */}
                          {(['buyer', 'seller'] as const).map(role => {
                            const roleEvidence = d.evidence.filter(e => e.submitterRole === role);
                            if (roleEvidence.length === 0) return null;
                            return (
                              <div key={role} className={cn('p-3 rounded-xl border',
                                role === 'buyer' ? 'bg-blue-50/50 border-blue-100' : 'bg-amber-50/50 border-amber-100')}>
                                <p className={cn('text-[11px] font-bold uppercase tracking-wider mb-2',
                                  role === 'buyer' ? 'text-blue-600' : 'text-amber-600')}>
                                  {role === 'buyer' ? `Buyer (${d.buyerName})` : `Seller (${d.sellerName})`} — {roleEvidence.length} file{roleEvidence.length > 1 ? 's' : ''}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {roleEvidence.map(ev => (
                                    <a key={ev.id} href={ev.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="group flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-xl hover:border-[hsl(var(--brand-navy))] transition-colors">
                                      {ev.fileType === 'image' ? (
                                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                                          <img src={ev.fileUrl} alt={ev.fileName || 'Evidence'} className="w-full h-full object-cover" />
                                        </div>
                                      ) : ev.fileType === 'video' ? (
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-border">
                                          <Video className="w-5 h-5 text-slate-500" />
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-border">
                                          <FileIcon className="w-5 h-5 text-slate-500" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate max-w-[100px]">{ev.fileName || 'File'}</p>
                                        {ev.description && <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{ev.description}</p>}
                                      </div>
                                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[hsl(var(--brand-navy))] flex-shrink-0" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {d.evidence.length === 0 && !d.disputeDescription && (
                      <div className="mt-4 py-4 text-center text-xs text-muted-foreground">
                        No additional details provided
                      </div>
                    )}

                    {/* Resolution Section */}
                    {isOpen && (
                      <div className="mt-5 pt-4 border-t border-border space-y-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" /> Resolve Dispute
                        </h3>

                        <div>
                          <label className="block text-xs font-medium mb-1.5">
                            Decision Notes <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Document your decision rationale thoroughly. This will be visible on the case record..."
                            value={adminNotes[d.id] || ''}
                            onChange={e => setAdminNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: 'full_refund', label: '↩ Full Refund to Buyer', cls: 'border-red-300 text-red-600 hover:bg-red-50', desc: 'Full amount refunded' },
                            { key: 'partial_refund', label: '↩ Partial Refund', cls: 'border-amber-300 text-amber-600 hover:bg-amber-50', desc: 'Partial resolution' },
                            { key: 'release_funds', label: '→ Release to Seller', cls: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50', desc: 'Seller wins' },
                            { key: 'request_more_evidence', label: '? Request Evidence', cls: 'border-blue-300 text-blue-600 hover:bg-blue-50', desc: 'Need more info' },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              disabled={saving === d.id}
                              onClick={() => handleResolve(d, opt.key)}
                              className={cn('p-3 rounded-xl border text-xs font-semibold text-left transition-colors', opt.cls,
                                saving === d.id && 'opacity-50 cursor-not-allowed')}>
                              <div className="font-bold mb-0.5">{opt.label}</div>
                              <div className="text-[10px] opacity-70 font-normal">{opt.desc}</div>
                            </button>
                          ))}
                        </div>

                        {saving === d.id && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resolved State */}
                    {d.disputeStatus === 'resolved' && (
                      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-800">Dispute Resolved</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          Outcome: <span className="font-bold capitalize">{d.disputeOutcome?.replace(/_/g, ' ')}</span>
                          {d.disputeResolvedAt && ` · ${formatDateTime(d.disputeResolvedAt)}`}
                        </p>
                        {d.disputeAdminNotes && (
                          <p className="text-xs text-emerald-600 mt-1.5 italic bg-emerald-100 rounded-lg px-3 py-2">
                            "{d.disputeAdminNotes}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
