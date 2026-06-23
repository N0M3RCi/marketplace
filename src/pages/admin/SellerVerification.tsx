import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Eye, Package, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/client';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EvidenceCase {
  id: string;
  caseNumber: string;
  listingTitle: string;
  sellerName: string;
  sellerId: string;
  buyerId: string;
  status: string;
  sellerEvidenceStatus: string;
  sellerEvidenceSubmittedAt: string | null;
  sellerItemPhotos: string[];
  sellerPackagingPhotos: string[];
  sellerPackagingVideo: string | null;
  sellerReadinessConfirmed: boolean;
}

export default function SellerVerification() {
  const [cases, setCases] = useState<EvidenceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    let allCases: any[];
    try {
      allCases = await admin.escrow.list();
    } catch {
      toast.error('Failed to load cases');
      return;
    }

    // Filter to cases that have seller evidence data (packaging_submitted status or evidence submitted)
    const relevant = (allCases || []).filter((c: any) =>
      c.seller_evidence_submitted_at || c.status === 'packaging_submitted' || c.status === 'seller_notified'
    );

    setCases(relevant.map((c: any) => ({
      id: c.id,
      caseNumber: c.case_number,
      listingTitle: c.listing_title,
      sellerName: c.seller_name || 'Unknown',
      sellerId: c.seller_id,
      buyerId: c.buyer_id,
      status: c.status,
      sellerEvidenceStatus: c.seller_evidence_status || 'pending',
      sellerEvidenceSubmittedAt: c.seller_evidence_submitted_at,
      sellerItemPhotos: c.seller_item_photos || [],
      sellerPackagingPhotos: c.seller_packaging_photos || [],
      sellerPackagingVideo: c.seller_packaging_video,
      sellerReadinessConfirmed: c.seller_readiness_confirmed || false,
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
  };

  const handleAction = async (c: EvidenceCase, approve: boolean) => {
    setProcessingId(c.id);
    const newStatus = approve ? 'packaging_approved' : 'seller_notified';
    const evStatus = approve ? 'approved' : 'rejected';

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      await admin.escrow.update(c.id, {
        status: newStatus,
        seller_evidence_status: evStatus,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(`Failed to ${approve ? 'approve' : 'reject'} evidence`);
      setProcessingId(null);
      return;
    }

    // Timeline event
    await fetch(`/api/escrow/timeline`, {
      method: 'POST', headers,
      body: JSON.stringify({
        caseId: c.id,
        status: newStatus,
        label: approve ? 'Packaging Approved by Administrator' : 'Packaging Evidence Rejected — Seller Asked to Resubmit',
        actorName: 'Admin',
        actorRole: 'admin',
        notes: null,
      }),
    });

    toast.success(approve ? `Packaging approved for ${c.caseNumber}` : `Packaging rejected for ${c.caseNumber}`);
    setProcessingId(null);
    await fetchCases();
  };

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.caseNumber.toLowerCase().includes(q) ||
      c.sellerName.toLowerCase().includes(q) ||
      c.listingTitle.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || c.sellerEvidenceStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#C68000' }} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: '#2A1A00' }}>Seller Verification Queue</h1>
          <p className="text-sm mt-1" style={{ color: '#9A7C40' }}>Review item photos, packaging photos, and seller readiness confirmation</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ border: '1px solid rgba(200,160,60,0.25)' }}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors',
                filterStatus === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
              {s} {s !== 'all' && `(${cases.filter(c => c.sellerEvidenceStatus === s).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">No submissions to review</p>
            <p className="text-muted-foreground text-sm">No seller evidence submissions match this filter.</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{c.caseNumber}</span>
                  <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold',
                    c.sellerEvidenceStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    c.sellerEvidenceStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700')}>
                    {c.sellerEvidenceStatus}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-foreground">{c.listingTitle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Seller: <span className="font-medium text-foreground">{c.sellerName}</span></p>
                {c.sellerEvidenceSubmittedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">Submitted: {formatDateTime(c.sellerEvidenceSubmittedAt)}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link to={`/admin/escrow/${c.id}`}>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Full Review
                  </Button>
                </Link>
                {c.sellerEvidenceStatus === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => handleAction(c, true)} disabled={processingId === c.id}
                      className="bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0 text-xs gap-1.5">
                      {processingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAction(c, false)} disabled={processingId === c.id}
                      className="border-red-300 text-red-600 hover:bg-red-50 text-xs gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Photos */}
            <div className="flex gap-3 flex-wrap">
              {c.sellerItemPhotos.map((url, i) => (
                <div key={`item-${i}`} className="relative group">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`Item ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-medium">item</span>
                </div>
              ))}
              {c.sellerPackagingPhotos.map((url, i) => (
                <div key={`pkg-${i}`} className="relative group">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`Package ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-medium">pkg</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}