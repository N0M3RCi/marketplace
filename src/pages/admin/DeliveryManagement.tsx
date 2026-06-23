import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Truck, CheckCircle, Eye, Plus } from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import { Button } from '@/components/ui/button';
import { getEscrowCases, updateEscrowCase } from '@/lib/storage';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { EscrowCase, DeliveryStatus } from '@/types';
import { toast } from 'sonner';

const DELIVERY_STEPS: DeliveryStatus[] = ['pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const STEP_LABELS: Record<DeliveryStatus, string> = {
  pickup_scheduled: 'Pickup Scheduled', picked_up: 'Picked Up',
  in_transit: 'In Transit', out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
};

export default function DeliveryManagement() {
  const [cases, setCases] = useState<EscrowCase[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'all'>('all');

  useEffect(() => {
    setCases(getEscrowCases().filter(c => c.delivery));
  }, []);

  const filtered = cases.filter(c => {
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase()) || c.delivery?.courierName.toLowerCase().includes(search.toLowerCase()) || c.delivery?.trackingNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.delivery?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const advanceStatus = (caseId: string) => {
    const allCases = getEscrowCases();
    const c = allCases.find(c => c.id === caseId);
    if (!c || !c.delivery) return;
    const currentIdx = DELIVERY_STEPS.indexOf(c.delivery.status);
    if (currentIdx === DELIVERY_STEPS.length - 1) { toast.info('Already at final delivery status.'); return; }
    const nextStatus = DELIVERY_STEPS[currentIdx + 1];
    const updated: EscrowCase = {
      ...c,
      status: nextStatus === 'delivered' ? 'delivered' : c.status === 'pickup_scheduled' && nextStatus === 'picked_up' ? 'in_transit' : c.status,
      delivery: { ...c.delivery, status: nextStatus, ...(nextStatus === 'delivered' ? { actualDeliveryDate: new Date().toISOString() } : {}) },
      updatedAt: new Date().toISOString(),
      timeline: nextStatus === 'delivered' ? [...c.timeline, { id: `t${Date.now()}`, status: 'delivered', label: 'Package Delivered', timestamp: new Date().toISOString(), actorName: 'Alex Morgan', actorRole: 'Admin' }] : c.timeline,
    };
    updateEscrowCase(updated);
    setCases(prev => prev.map(p => p.id === caseId ? updated : p));
    toast.success(`Status updated to: ${STEP_LABELS[nextStatus]}`);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Delivery Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Track and manage all active deliveries</p>
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
          <p className="text-muted-foreground text-sm">Active deliveries will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                    {c.delivery && <StatusBadge status={c.delivery.status} type="delivery" />}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{c.listingTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium">{c.buyerName}</span> ← {c.delivery?.courierName}
                  </p>
                  {c.delivery && (
                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Tracking:</span>{' '}
                        <span className="font-mono font-medium">{c.delivery.trackingNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pickup:</span>{' '}
                        <span className="font-medium">{formatDate(c.delivery.pickupDate)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Est. Delivery:</span>{' '}
                        <span className="font-medium">{formatDate(c.delivery.estimatedDeliveryDate)}</span>
                      </div>
                      {c.delivery.actualDeliveryDate && (
                        <div>
                          <span className="text-muted-foreground">Delivered:</span>{' '}
                          <span className="font-medium text-emerald-600">{formatDate(c.delivery.actualDeliveryDate)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress bar */}
                  {c.delivery && (
                    <div className="mt-4">
                      <div className="flex items-center gap-1">
                        {DELIVERY_STEPS.map((step, idx) => {
                          const currentIdx = DELIVERY_STEPS.indexOf(c.delivery!.status);
                          const isCompleted = idx <= currentIdx;
                          return (
                            <div key={step} className="flex items-center flex-1">
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isCompleted ? 'bg-[hsl(var(--brand-emerald))]' : 'bg-border'}`} />
                              {idx < DELIVERY_STEPS.length - 1 && (
                                <div className={`h-0.5 flex-1 ${isCompleted && idx < currentIdx ? 'bg-[hsl(var(--brand-emerald))]' : 'bg-border'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        {DELIVERY_STEPS.map(step => (
                          <span key={step} className="text-[9px] text-muted-foreground/70 flex-1 text-center first:text-left last:text-right">
                            {STEP_LABELS[step].split(' ').slice(-1)[0]}
                          </span>
                        ))}
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
                  {c.delivery && c.delivery.status !== 'delivered' && (
                    <Button size="sm" onClick={() => advanceStatus(c.id)} className="navy-gradient text-white border-0 hover:opacity-90 text-xs gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Advance Status
                    </Button>
                  )}
                  {c.delivery?.status === 'delivered' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">Delivered</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
