import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Eye, Package } from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import { Button } from '@/components/ui/button';
import { getEscrowCases, updateEscrowCase } from '@/lib/storage';
import { formatDateTime } from '@/lib/utils';
import type { EscrowCase } from '@/types';
import { toast } from 'sonner';

export default function SellerVerification() {
  const [cases, setCases] = useState<EscrowCase[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    setCases(getEscrowCases().filter(c => c.sellerEvidence));
  }, []);

  const filtered = cases.filter(c => {
    if (!c.sellerEvidence) return false;
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase()) || c.sellerName.toLowerCase().includes(search.toLowerCase()) || c.listingTitle.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.sellerEvidence.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleApprove = (caseId: string) => {
    const allCases = getEscrowCases();
    const c = allCases.find(c => c.id === caseId);
    if (!c || !c.sellerEvidence) return;
    const updated: EscrowCase = {
      ...c, status: 'packaging_approved', updatedAt: new Date().toISOString(),
      sellerEvidence: { ...c.sellerEvidence, status: 'approved', reviewedBy: 'Alex Morgan', reviewedAt: new Date().toISOString() },
      timeline: [...c.timeline, { id: `t${Date.now()}`, status: 'packaging_approved', label: 'Packaging Approved', timestamp: new Date().toISOString(), actorName: 'Alex Morgan', actorRole: 'Admin' }],
    };
    updateEscrowCase(updated);
    setCases(prev => prev.map(p => p.id === caseId ? updated : p));
    toast.success(`Packaging approved for ${c.id}`);
  };

  const handleReject = (caseId: string) => {
    const allCases = getEscrowCases();
    const c = allCases.find(c => c.id === caseId);
    if (!c || !c.sellerEvidence) return;
    const updated: EscrowCase = {
      ...c, updatedAt: new Date().toISOString(),
      sellerEvidence: { ...c.sellerEvidence, status: 'rejected', reviewedBy: 'Alex Morgan', reviewedAt: new Date().toISOString() },
    };
    updateEscrowCase(updated);
    setCases(prev => prev.map(p => p.id === caseId ? updated : p));
    toast.error(`Packaging rejected for ${c.id} — Seller notified to re-submit.`);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Seller Verification Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">Review item photos, packaging photos, and seller readiness confirmation</p>
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
              className={`px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors ${filterStatus === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted'}`}>
              {s} {s !== 'all' && `(${cases.filter(c => c.sellerEvidence?.status === s).length})`}
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
                  <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                  {c.sellerEvidence && <StatusBadge status={c.sellerEvidence.status} type="payment" />}
                </div>
                <h3 className="font-semibold text-sm text-foreground">{c.listingTitle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Seller: <span className="font-medium text-foreground">{c.sellerName}</span></p>
                {c.sellerEvidence && (
                  <p className="text-xs text-muted-foreground mt-0.5">Submitted: {formatDateTime(c.sellerEvidence.submittedAt)}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link to={`/admin/escrow/${c.id}`}>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Full Review
                  </Button>
                </Link>
                {c.sellerEvidence?.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => handleApprove(c.id)} className="bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0 text-xs gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(c.id)} className="border-red-300 text-red-600 hover:bg-red-50 text-xs gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Photo preview */}
            {c.sellerEvidence && (
              <div className="flex gap-3 flex-wrap">
                {c.sellerEvidence.itemPhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-medium">item</span>
                  </div>
                ))}
                {c.sellerEvidence.packagingPhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-border">
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-medium">pkg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
