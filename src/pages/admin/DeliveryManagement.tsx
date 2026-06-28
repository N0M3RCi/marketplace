import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Truck, CheckCircle, Eye, ArrowLeft, ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/client';
import { getEscrowCases, updateEscrowCase } from '@/lib/storage';
import { formatDate } from '@/lib/utils';
import type { EscrowCase, DeliveryStatus } from '@/types';
import { toast } from 'sonner';

const DELIVERY_STEPS: DeliveryStatus[] = ['pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const STEP_LABELS: Record<DeliveryStatus, string> = {
  pickup_scheduled: 'Pickup Scheduled', picked_up: 'Picked Up',
  in_transit: 'In Transit', out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
};

/** Map flat DB row to EscrowCase with nested delivery object */
function toEscrowCase(row: any): EscrowCase | null {
  if (!row.delivery_status) return null;
  return {
    id: row.id,
    buyerId: row.buyer_id || row.buyerId || '',
    buyerName: row.buyer_name || row.buyerName || '',
    sellerId: row.seller_id || row.sellerId || '',
    sellerName: row.seller_name || row.sellerName || '',
    listingId: row.listing_id || '',
    listingTitle: row.listing_title || '',
    amount: Number(row.amount) || 0,
    fees: Number(row.fees) || 0,
    currency: row.currency || 'USD',
    status: row.status || 'awaiting_payment',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    timeline: [],
    delivery: {
      id: row.delivery_id || `del-${row.id}`,
      caseId: row.id,
      courierName: row.courier_name || row.courierName || '',
      trackingNumber: row.tracking_number || row.trackingNumber || '',
      pickupDate: row.pickup_date || '',
      estimatedDeliveryDate: row.estimated_delivery_date || '',
      actualDeliveryDate: row.actual_delivery_date || undefined,
      status: row.delivery_status as DeliveryStatus,
      notes: row.delivery_notes || '',
      createdBy: 'Admin',
      createdAt: row.created_at || '',
    },
  };
}

/** Determine escrow status to set based on delivery transition */
function escrowStatusForDelivery(prevDeliveryStatus: DeliveryStatus, nextDeliveryStatus: DeliveryStatus, currentEscrowStatus: string): string {
  if (nextDeliveryStatus === 'delivered') return 'delivered';
  if (nextDeliveryStatus === 'picked_up' && currentEscrowStatus === 'pickup_scheduled') return 'in_transit';
  if (nextDeliveryStatus === 'in_transit' && (currentEscrowStatus === 'pickup_scheduled' || currentEscrowStatus === 'in_transit')) return 'in_transit';
  return currentEscrowStatus;
}

export default function DeliveryManagement() {
  const [cases, setCases] = useState<EscrowCase[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const rows = await admin.escrow.list();
      const mapped = rows.map(toEscrowCase).filter(Boolean) as EscrowCase[];
      setCases(mapped);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = cases.filter(c => {
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase()) || c.delivery?.courierName.toLowerCase().includes(search.toLowerCase()) || c.delivery?.trackingNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.delivery?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const advanceStatus = async (caseId: string) => {
    setUpdating(caseId);
    try {
      const c = cases.find(c => c.id === caseId);
      if (!c || !c.delivery) return;
      const currentIdx = DELIVERY_STEPS.indexOf(c.delivery.status);
      if (currentIdx === DELIVERY_STEPS.length - 1) { toast.info('Already at final delivery status.'); return; }
      const nextStatus = DELIVERY_STEPS[currentIdx + 1];
      const escrowStatus = escrowStatusForDelivery(c.delivery.status, nextStatus, c.status);

      await admin.escrow.updateDeliveryStatus(caseId, nextStatus, escrowStatus);
      // Also update in localStorage mock for consistency
      const allCases = getEscrowCases();
      const localC = allCases.find(lc => lc.id === caseId);
      if (localC && localC.delivery) {
        updateEscrowCase({ ...localC, delivery: { ...localC.delivery, status: nextStatus, ...(nextStatus === 'delivered' ? { actualDeliveryDate: new Date().toISOString() } : {}) }, status: escrowStatus as any });
      }

      toast.success(`Status advanced to: ${STEP_LABELS[nextStatus]}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to advance status');
    } finally {
      setUpdating(null);
    }
  };

  const revertStatus = async (caseId: string) => {
    setUpdating(caseId);
    try {
      const c = cases.find(c => c.id === caseId);
      if (!c || !c.delivery) return;
      const currentIdx = DELIVERY_STEPS.indexOf(c.delivery.status);
      if (currentIdx <= 0) { toast.info('Already at initial delivery status.'); return; }
      const prevStatus = DELIVERY_STEPS[currentIdx - 1];

      await admin.escrow.updateDeliveryStatus(caseId, prevStatus);
      // Also update in localStorage mock for consistency
      const allCases = getEscrowCases();
      const localC = allCases.find(lc => lc.id === caseId);
      if (localC && localC.delivery) {
        updateEscrowCase({ ...localC, delivery: { ...localC.delivery, status: prevStatus, actualDeliveryDate: undefined }, updatedAt: new Date().toISOString() });
      }

      toast.success(`Status reverted to: ${STEP_LABELS[prevStatus]}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revert status');
    } finally {
      setUpdating(null);
    }
  };

  const jumpToStatus = async (caseId: string, targetStatus: DeliveryStatus) => {
    setUpdating(caseId);
    try {
      const c = cases.find(c => c.id === caseId);
      if (!c || !c.delivery) return;
      const currentIdx = DELIVERY_STEPS.indexOf(c.delivery.status);
      const targetIdx = DELIVERY_STEPS.indexOf(targetStatus);
      if (currentIdx === targetIdx) return;

      const escrowStatus = targetIdx > currentIdx
        ? escrowStatusForDelivery(c.delivery.status, targetStatus, c.status)
        : c.status;

      await admin.escrow.updateDeliveryStatus(caseId, targetStatus, escrowStatus);
      // Update localStorage mock too
      const allCases = getEscrowCases();
      const localC = allCases.find(lc => lc.id === caseId);
      if (localC && localC.delivery) {
        updateEscrowCase({
          ...localC,
          delivery: {
            ...localC.delivery,
            status: targetStatus,
            ...(targetStatus === 'delivered' ? { actualDeliveryDate: new Date().toISOString() } : targetIdx < currentIdx ? { actualDeliveryDate: undefined } : {}),
          },
          status: escrowStatus as any,
          updatedAt: new Date().toISOString(),
        });
      }

      toast.success(`Status changed to: ${STEP_LABELS[targetStatus]}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-20 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Delivery Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage all active deliveries</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={loadData}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by case ID, courier, or tracking #..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterStatus('all')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted'}`}>
            All ({cases.length})
          </button>
          {DELIVERY_STEPS.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${filterStatus === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted'}`}>
              {STEP_LABELS[s]} ({cases.filter(c => c.delivery?.status === s).length})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">No deliveries found</p>
          <p className="text-muted-foreground text-sm">Active deliveries will appear here once escrow cases have delivery tracking set up</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => {
            const currentIdx = DELIVERY_STEPS.indexOf(c.delivery?.status || 'pickup_scheduled');
            return (
              <div key={c.id} className="bg-white rounded-xl border border-border p-5 transition-shadow hover:shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                      {c.delivery && <StatusBadge status={c.delivery.status} type="delivery" />}
                    </div>
                    <h3 className="font-semibold text-sm text-foreground truncate">{c.listingTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">{c.buyerName}</span> &larr; {c.delivery?.courierName}
                    </p>
                    {c.delivery && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Tracking:</span>{' '}
                          <span className="font-mono font-medium">{c.delivery.trackingNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pickup:</span>{' '}
                          <span className="font-medium">{c.delivery.pickupDate ? formatDate(c.delivery.pickupDate) : '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Delivery:</span>{' '}
                          <span className="font-medium">{c.delivery.estimatedDeliveryDate ? formatDate(c.delivery.estimatedDeliveryDate) : '—'}</span>
                        </div>
                        {c.delivery.actualDeliveryDate && (
                          <div>
                            <span className="text-muted-foreground">Delivered:</span>{' '}
                            <span className="font-medium text-emerald-600">{formatDate(c.delivery.actualDeliveryDate)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clickable progress bar */}
                    {c.delivery && (
                      <div className="mt-4">
                        <div className="flex items-center gap-1">
                          {DELIVERY_STEPS.map((step, idx) => {
                            const isCompleted = idx <= currentIdx;
                            const isUpdating = updating === c.id;
                            return (
                              <div key={step} className="flex items-center flex-1">
                                <button
                                  onClick={() => !isUpdating && jumpToStatus(c.id, step)}
                                  disabled={isUpdating}
                                  title={`Set status to: ${STEP_LABELS[step]}`}
                                  className={`w-5 h-5 rounded-full flex-shrink-0 transition-all ${
                                    isCompleted ? 'bg-[hsl(var(--brand-emerald))]' : 'bg-border hover:bg-muted-foreground/30'
                                  } ${!isUpdating ? 'cursor-pointer hover:scale-110' : 'cursor-wait'} flex items-center justify-center`}
                                >
                                  {isCompleted && idx === currentIdx && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </button>
                                {idx < DELIVERY_STEPS.length - 1 && (
                                  <div className={`h-0.5 flex-1 ${idx < currentIdx ? 'bg-[hsl(var(--brand-emerald))]' : 'bg-border'}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-1.5">
                          {DELIVERY_STEPS.map((step, idx) => {
                            const isCurrent = idx === currentIdx;
                            return (
                              <button
                                key={step}
                                onClick={() => !(updating === c.id) && jumpToStatus(c.id, step)}
                                disabled={updating === c.id}
                                className={`text-[10px] leading-tight transition-colors text-center first:text-left last:text-right ${
                                  isCurrent
                                    ? 'text-[hsl(var(--brand-emerald))] font-semibold'
                                    : idx < currentIdx
                                    ? 'text-muted-foreground/80'
                                    : 'text-muted-foreground/50 hover:text-muted-foreground/80'
                                } ${!(updating === c.id) ? 'cursor-pointer' : 'cursor-wait'}`}
                              >
                                {STEP_LABELS[step]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link to={`/admin/escrow/${c.id}`}>
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> View Case
                      </Button>
                    </Link>

                    {/* Revert button — shown when not at first step */}
                    {c.delivery && currentIdx > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revertStatus(c.id)}
                        disabled={updating === c.id}
                        className="w-full text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {updating === c.id ? 'Updating...' : 'Revert Status'}
                      </Button>
                    )}

                    {/* Advance button — shown when not at final step */}
                    {c.delivery && currentIdx < DELIVERY_STEPS.length - 1 && (
                      <Button
                        size="sm"
                        onClick={() => advanceStatus(c.id)}
                        disabled={updating === c.id}
                        className="w-full text-xs gap-1.5 navy-gradient text-white border-0 hover:opacity-90"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {updating === c.id ? 'Updating...' : 'Advance Status'}
                      </Button>
                    )}

                    {/* Delivered badge — shown at final step */}
                    {c.delivery?.status === 'delivered' && (
                      <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-700">Delivered</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}