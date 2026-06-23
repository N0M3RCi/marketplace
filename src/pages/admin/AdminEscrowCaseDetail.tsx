import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, User, CreditCard, Package, Truck, CheckCircle, XCircle,
  AlertTriangle, Banknote, Clock, FileText, Download, ExternalLink, Plus,
  ChevronDown, ChevronUp, Loader2, Camera, Video, RefreshCw, MessageSquare,
  Hash, DollarSign, Calendar, MapPin, Image as ImageIcon, PlayCircle, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, formatDate, cn } from '@/lib/utils';
import { ESCROW_STATUS_CONFIG, DISPUTE_REASONS } from '@/constants';
import { toast } from 'sonner';
import type { EscrowStatus } from '@/types';

interface DBEscrowCase {
  id: string;
  caseNumber: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  listingTitle: string;
  amount: number;
  fees: number;
  currency: string;
  status: EscrowStatus;
  paymentAddress?: string;
  paymentNetwork?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentProofUrl?: string;
  paymentAmountSent?: number;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentRejectedAt?: string;
  paymentAdminNotes?: string;
  sellerItemPhotos: string[];
  sellerPackagingPhotos: string[];
  sellerPackagingVideo?: string;
  sellerReadinessConfirmed: boolean;
  sellerEvidenceSubmittedAt?: string;
  sellerEvidenceStatus: string;
  sellerEvidenceAdminNotes?: string;
  packagingApprovedAt?: string;
  courierName?: string;
  trackingNumber?: string;
  pickupDate?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryStatus?: string;
  deliveryNotes?: string;
  disputeOpenedBy?: string;
  disputeReason?: string;
  disputeDescription?: string;
  disputeStatus?: string;
  disputeOutcome?: string;
  disputeAdminNotes?: string;
  disputeResolvedAt?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  status: string;
  label: string;
  timestamp: string;
  actorName?: string;
  actorRole?: string;
  notes?: string;
}

const STATUS_FLOW: EscrowStatus[] = [
  'awaiting_payment', 'payment_submitted', 'payment_verified', 'seller_notified',
  'item_ready', 'packaging_submitted', 'packaging_approved', 'pickup_scheduled',
  'in_transit', 'delivered', 'buyer_confirmed', 'funds_released',
];

export default function AdminEscrowCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [escrowCase, setEscrowCase] = useState<DBEscrowCase | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    courierName: '', trackingNumber: '', pickupDate: '', estimatedDeliveryDate: '', notes: ''
  });
  const [expandedSection, setExpandedSection] = useState<string | null>('payment');

  const fetchCase = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('escrow_cases')
      .select(`
        *,
        buyer:user_profiles!escrow_cases_buyer_id_fkey(id, username, email),
        seller:user_profiles!escrow_cases_seller_id_fkey(id, username, email)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      toast.error('Escrow case not found');
      navigate('/admin/escrow');
      return;
    }

    setEscrowCase({
      id: data.id,
      caseNumber: data.case_number,
      buyerId: data.buyer_id,
      buyerName: data.buyer?.username || 'Unknown',
      buyerEmail: data.buyer?.email || '',
      sellerId: data.seller_id,
      sellerName: data.seller?.username || 'Unknown',
      sellerEmail: data.seller?.email || '',
      listingTitle: data.listing_title,
      amount: Number(data.amount),
      fees: Number(data.fees || 0),
      currency: data.currency || 'USD',
      status: data.status,
      paymentAddress: data.payment_address,
      paymentNetwork: data.payment_network,
      paymentMethod: data.payment_method,
      paymentReference: data.payment_reference,
      paymentProofUrl: data.payment_proof_url,
      paymentAmountSent: data.payment_amount_sent ? Number(data.payment_amount_sent) : undefined,
      paymentSubmittedAt: data.payment_submitted_at,
      paymentVerifiedAt: data.payment_verified_at,
      paymentRejectedAt: data.payment_rejected_at,
      paymentAdminNotes: data.payment_admin_notes,
      sellerItemPhotos: data.seller_item_photos || [],
      sellerPackagingPhotos: data.seller_packaging_photos || [],
      sellerPackagingVideo: data.seller_packaging_video,
      sellerReadinessConfirmed: data.seller_readiness_confirmed || false,
      sellerEvidenceSubmittedAt: data.seller_evidence_submitted_at,
      sellerEvidenceStatus: data.seller_evidence_status || 'pending',
      sellerEvidenceAdminNotes: data.seller_evidence_admin_notes,
      packagingApprovedAt: data.packaging_approved_at,
      courierName: data.courier_name,
      trackingNumber: data.tracking_number,
      pickupDate: data.pickup_date,
      estimatedDeliveryDate: data.estimated_delivery_date,
      actualDeliveryDate: data.actual_delivery_date,
      deliveryStatus: data.delivery_status,
      deliveryNotes: data.delivery_notes,
      disputeOpenedBy: data.dispute_opened_by,
      disputeReason: data.dispute_reason,
      disputeDescription: data.dispute_description,
      disputeStatus: data.dispute_status,
      disputeOutcome: data.dispute_outcome,
      disputeAdminNotes: data.dispute_admin_notes,
      disputeResolvedAt: data.dispute_resolved_at,
      adminNotes: data.admin_notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });

    // Fetch timeline
    const { data: tl } = await supabase
      .from('escrow_timeline')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: true });

    setTimeline((tl || []).map((t: any) => ({
      id: t.id,
      status: t.status,
      label: t.label,
      timestamp: t.timestamp || t.created_at,
      actorName: t.actor_name,
      actorRole: t.actor_role,
      notes: t.notes,
    })));
  }, [id, navigate]);

  useEffect(() => {
    setLoading(true);
    fetchCase().finally(() => setLoading(false));
  }, [fetchCase]);

  const addTimelineEvent = async (status: EscrowStatus | string, label: string, notes?: string) => {
    await supabase.from('escrow_timeline').insert({
      case_id: id,
      status,
      label,
      timestamp: new Date().toISOString(),
      actor_name: user?.username || 'Admin',
      actor_role: 'admin',
      notes: notes || null,
    });
  };

  const updateCase = async (updates: Record<string, any>, newStatus?: EscrowStatus, timelineLabel?: string, timelineNotes?: string) => {
    setSaving(true);
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (newStatus) payload.status = newStatus;

    const { error } = await supabase.from('escrow_cases').update(payload).eq('id', id);
    if (error) { toast.error('Update failed: ' + error.message); setSaving(false); return false; }

    if (newStatus && timelineLabel) {
      await addTimelineEvent(newStatus, timelineLabel, timelineNotes || adminNote || undefined);
    }

    // Send notification to relevant parties
    if (newStatus && escrowCase) {
      const notifMap: Partial<Record<EscrowStatus, { userId: string; title: string; message: string }[]>> = {
        payment_verified: [{ userId: escrowCase.sellerId, title: 'Payment Verified', message: `Payment for "${escrowCase.listingTitle}" has been verified. Please prepare your item.` }],
        seller_notified: [{ userId: escrowCase.sellerId, title: 'Action Required', message: `Please submit item photos and packaging evidence for case ${escrowCase.caseNumber}.` }],
        packaging_approved: [{ userId: escrowCase.sellerId, title: 'Packaging Approved', message: `Your packaging evidence has been approved. Prepare for pickup.` }],
        pickup_scheduled: [
          { userId: escrowCase.sellerId, title: 'Pickup Scheduled', message: `A courier has been arranged to collect your item.` },
          { userId: escrowCase.buyerId, title: 'Pickup Scheduled', message: `Your item is being collected from the seller.` }
        ],
        in_transit: [{ userId: escrowCase.buyerId, title: 'Item In Transit', message: `Your item is on its way! Track it in your escrow case.` }],
        delivered: [{ userId: escrowCase.buyerId, title: 'Item Delivered', message: `Your item has been delivered. Please confirm receipt.` }],
        funds_released: [{ userId: escrowCase.sellerId, title: 'Funds Released', message: `${formatCurrency(escrowCase.amount - escrowCase.fees, escrowCase.currency)} has been released to your wallet.` }],
        refunded: [{ userId: escrowCase.buyerId, title: 'Refund Issued', message: `A refund of ${formatCurrency(escrowCase.amount, escrowCase.currency)} has been issued.` }],
      };

      const notifs = notifMap[newStatus];
      if (notifs) {
        await Promise.all(notifs.map(n =>
          supabase.from('notifications').insert({
            user_id: n.userId,
            type: newStatus,
            title: n.title,
            message: n.message,
            case_id: id,
          })
        ));
      }
    }

    await fetchCase();
    setAdminNote('');
    setSaving(false);
    return true;
  };

  // ─── Admin Actions ─────────────────────────────────────────

  const handleVerifyPayment = async () => {
    const ok = await updateCase(
      { payment_verified_at: new Date().toISOString(), payment_admin_notes: adminNote || null },
      'payment_verified',
      'Payment Verified by Administrator',
    );
    if (ok) toast.success('Payment verified. Seller will be notified.');
  };

  const handleRejectPayment = async () => {
    const ok = await updateCase(
      { payment_rejected_at: new Date().toISOString(), payment_admin_notes: adminNote || null },
      'awaiting_payment',
      'Payment Rejected by Administrator',
      adminNote || 'Payment evidence was rejected.'
    );
    if (ok) toast.error('Payment rejected. Buyer will need to resubmit.');
  };

  const handleNotifySeller = async () => {
    const ok = await updateCase({}, 'seller_notified', 'Seller Notified to Submit Evidence');
    if (ok) toast.success('Seller notified to submit item and packaging evidence.');
  };

  const handleMarkItemReady = async () => {
    const ok = await updateCase({}, 'item_ready', 'Item Marked as Ready by Administrator');
    if (ok) toast.success('Item status updated to ready.');
  };

  const handleApprovePackaging = async () => {
    const ok = await updateCase(
      { seller_evidence_status: 'approved', packaging_approved_at: new Date().toISOString(), seller_evidence_admin_notes: adminNote || null },
      'packaging_approved',
      'Packaging Evidence Approved by Administrator',
    );
    if (ok) toast.success('Packaging approved! Ready to schedule pickup.');
  };

  const handleRejectPackaging = async () => {
    const ok = await updateCase(
      { seller_evidence_status: 'rejected', seller_evidence_admin_notes: adminNote || 'Evidence rejected, please resubmit.' },
      'seller_notified',
      'Packaging Evidence Rejected — Seller Asked to Resubmit',
    );
    if (ok) toast.error('Packaging rejected. Seller notified to resubmit.');
  };

  const handleScheduleDelivery = async () => {
    if (!deliveryForm.courierName || !deliveryForm.trackingNumber) {
      toast.error('Courier name and tracking number are required.');
      return;
    }
    const ok = await updateCase({
      courier_name: deliveryForm.courierName,
      tracking_number: deliveryForm.trackingNumber,
      pickup_date: deliveryForm.pickupDate || null,
      estimated_delivery_date: deliveryForm.estimatedDeliveryDate || null,
      delivery_notes: deliveryForm.notes || null,
      delivery_status: 'pickup_scheduled',
      pickup_scheduled_at: new Date().toISOString(),
    },
      'pickup_scheduled',
      `Pickup Scheduled — ${deliveryForm.courierName}`,
      `Tracking: ${deliveryForm.trackingNumber}`
    );
    if (ok) {
      toast.success('Delivery scheduled successfully.');
      setShowDeliveryForm(false);
      setDeliveryForm({ courierName: '', trackingNumber: '', pickupDate: '', estimatedDeliveryDate: '', notes: '' });
    }
  };

  const handleUpdateDeliveryStatus = async (deliveryStatus: string, newCaseStatus?: EscrowStatus) => {
    const statusLabels: Record<string, string> = {
      picked_up: 'Item Picked Up by Courier',
      in_transit: 'Item In Transit',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered to Buyer',
    };
    const ok = await updateCase(
      {
        delivery_status: deliveryStatus,
        ...(deliveryStatus === 'delivered' ? { actual_delivery_date: new Date().toISOString(), delivered_at: new Date().toISOString() } : {})
      },
      newCaseStatus,
      statusLabels[deliveryStatus] || deliveryStatus
    );
    if (ok) toast.success(`Delivery status updated to: ${deliveryStatus.replace(/_/g, ' ')}`);
  };

  const handleMarkDelivered = () => handleUpdateDeliveryStatus('delivered', 'delivered');

  const handleReleaseFunds = async () => {
    const netAmount = escrowCase!.amount - escrowCase!.fees;
    const ok = await updateCase(
      { funds_released_at: new Date().toISOString() },
      'funds_released',
      `Funds Released to ${escrowCase!.sellerName}`,
      adminNote || `${formatCurrency(netAmount, escrowCase!.currency)} released`
    );
    if (ok) toast.success(`${formatCurrency(netAmount, escrowCase!.currency)} released to ${escrowCase!.sellerName}.`);
  };

  const handleIssueRefund = async () => {
    const ok = await updateCase(
      { refunded_at: new Date().toISOString() },
      'refunded',
      `Refund Issued to ${escrowCase!.buyerName}`,
    );
    if (ok) toast.success(`Refund of ${formatCurrency(escrowCase!.amount, escrowCase!.currency)} issued.`);
  };

  const handleResolveDispute = async (outcome: string) => {
    const outcomeLabels: Record<string, string> = {
      full_refund: 'Full Refund Issued',
      partial_refund: 'Partial Refund Issued',
      release_funds: 'Funds Released to Seller',
      request_more_evidence: 'More Evidence Requested',
    };
    const newStatus = outcome === 'release_funds' ? 'funds_released' : outcome.includes('refund') ? 'refunded' : escrowCase!.status;
    const ok = await updateCase({
      dispute_status: 'resolved',
      dispute_outcome: outcome,
      dispute_admin_notes: adminNote,
      dispute_resolved_at: new Date().toISOString(),
      ...(outcome === 'full_refund' || outcome === 'partial_refund' ? { refunded_at: new Date().toISOString() } : {}),
      ...(outcome === 'release_funds' ? { funds_released_at: new Date().toISOString() } : {}),
    }, newStatus, `Dispute Resolved: ${outcomeLabels[outcome]}`);
    if (ok) toast.success(`Dispute resolved: ${outcomeLabels[outcome]}`);
  };

  const handleForceStatus = async (newStatus: EscrowStatus) => {
    const ok = await updateCase({}, newStatus, `Status Manually Set to "${ESCROW_STATUS_CONFIG[newStatus]?.label || newStatus}" by Admin`, adminNote || undefined);
    if (ok) toast.success(`Status updated to: ${ESCROW_STATUS_CONFIG[newStatus]?.label || newStatus}`);
  };

  const handleSaveAdminNotes = async () => {
    const { error } = await supabase.from('escrow_cases').update({ admin_notes: adminNote, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to save notes'); return; }
    toast.success('Admin notes saved');
    await fetchCase();
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  if (!escrowCase) return (
    <div className="p-8 text-center text-muted-foreground">Case not found</div>
  );

  const netAmount = escrowCase.amount - escrowCase.fees;
  const currentStepIndex = STATUS_FLOW.indexOf(escrowCase.status);
  const canVerifyPayment = escrowCase.status === 'payment_submitted' && !escrowCase.paymentVerifiedAt;
  const canNotifySeller = escrowCase.status === 'payment_verified';
  const canMarkItemReady = escrowCase.status === 'seller_notified';
  const canApprovePackaging = escrowCase.status === 'packaging_submitted' && escrowCase.sellerEvidenceStatus === 'pending';
  const canScheduleDelivery = escrowCase.status === 'packaging_approved' && !escrowCase.courierName;
  const hasDelivery = !!escrowCase.courierName;
  const canUpdateDelivery = hasDelivery && ['pickup_scheduled', 'in_transit', 'out_for_delivery'].includes(escrowCase.deliveryStatus || '');
  const canMarkDelivered = hasDelivery && escrowCase.status !== 'delivered' && escrowCase.status !== 'funds_released' && escrowCase.status !== 'refunded';
  const canReleaseFunds = ['buyer_confirmed', 'delivered'].includes(escrowCase.status);
  const canRefund = !['funds_released', 'refunded', 'closed'].includes(escrowCase.status);
  const hasActiveDispute = escrowCase.disputeStatus && escrowCase.disputeStatus !== 'resolved';

  const Section = ({ id: sId, title, icon: Icon, badge, children }: any) => (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
        onClick={() => setExpandedSection(expandedSection === sId ? null : sId)}
      >
        <h2 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" /> {title}
          {badge}
        </h2>
        {expandedSection === sId ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expandedSection === sId && <div className="px-5 pb-5 border-t border-border">{children}</div>}
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <button onClick={() => navigate('/admin/escrow')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Escrow Cases
      </button>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm font-semibold text-muted-foreground">{escrowCase.caseNumber}</span>
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', ESCROW_STATUS_CONFIG[escrowCase.status]?.bg, ESCROW_STATUS_CONFIG[escrowCase.status]?.color)}>
              {ESCROW_STATUS_CONFIG[escrowCase.status]?.label || escrowCase.status}
            </span>
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">{escrowCase.listingTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">Created {formatDateTime(escrowCase.createdAt)} · Updated {formatDateTime(escrowCase.updatedAt)}</p>
        </div>
        <div className="flex items-start gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold font-heading text-[hsl(var(--brand-navy))]">{formatCurrency(escrowCase.amount, escrowCase.currency)}</p>
            <p className="text-xs text-muted-foreground">Fee: {formatCurrency(escrowCase.fees, escrowCase.currency)}</p>
            <p className="text-xs font-medium text-emerald-600">Net: {formatCurrency(netAmount, escrowCase.currency)}</p>
          </div>
          <button onClick={() => { setLoading(true); fetchCase().finally(() => setLoading(false)); }}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-border p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case Progress</span>
          <span className="text-xs text-muted-foreground">{currentStepIndex >= 0 ? currentStepIndex + 1 : '?'} / {STATUS_FLOW.length}</span>
        </div>
        <div className="flex gap-0.5">
          {STATUS_FLOW.map((status, idx) => (
            <div key={status} title={ESCROW_STATUS_CONFIG[status]?.label}
              className={cn(
                'flex-1 h-2 rounded-sm transition-all',
                idx <= currentStepIndex ? 'bg-[hsl(var(--brand-emerald))]' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">Awaiting Payment</span>
          <span className="text-[10px] text-muted-foreground">Funds Released</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Case Management */}
        <div className="lg:col-span-2 space-y-4">

          {/* Parties */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" /> Transaction Parties
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">Buyer</p>
                <p className="font-bold text-sm text-foreground">{escrowCase.buyerName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{escrowCase.buyerEmail}</p>
                <p className="text-[11px] font-mono text-muted-foreground/60 mt-1">{escrowCase.buyerId}</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-2">Seller</p>
                <p className="font-bold text-sm text-foreground">{escrowCase.sellerName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{escrowCase.sellerEmail}</p>
                <p className="text-[11px] font-mono text-muted-foreground/60 mt-1">{escrowCase.sellerId}</p>
              </div>
            </div>
          </div>

          {/* ─── STEP 1: Payment Review ─── */}
          <Section id="payment" title="Step 1 — Payment Verification" icon={CreditCard}
            badge={escrowCase.paymentVerifiedAt
              ? <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Verified</span>
              : escrowCase.paymentRejectedAt
                ? <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rejected</span>
                : escrowCase.paymentSubmittedAt
                  ? <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Awaiting Review</span>
                  : <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Pending</span>
            }
          >
            <div className="pt-4 space-y-4">
              {escrowCase.paymentAddress && (
                <div className="p-3 bg-muted/30 rounded-xl border border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Address Assigned</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-white border border-border rounded px-2 py-1 flex-1 truncate">{escrowCase.paymentAddress}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{escrowCase.paymentNetwork}</span>
                  </div>
                </div>
              )}

              {escrowCase.paymentSubmittedAt ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Method', value: escrowCase.paymentMethod || 'Crypto' },
                      { label: 'Tx Reference', value: escrowCase.paymentReference || '—' },
                      { label: 'Amount Sent', value: escrowCase.paymentAmountSent ? formatCurrency(escrowCase.paymentAmountSent, escrowCase.currency) : '—' },
                      { label: 'Submitted At', value: formatDateTime(escrowCase.paymentSubmittedAt) },
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-xl bg-muted/50">
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                        <p className={cn('text-xs font-medium mt-0.5 break-all', item.label === 'Tx Reference' ? 'font-mono' : '')}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {escrowCase.paymentProofUrl && (
                    <div>
                      <p className="text-xs font-medium mb-2">Payment Proof</p>
                      <a href={escrowCase.paymentProofUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> View Proof Document
                      </a>
                    </div>
                  )}

                  {!escrowCase.paymentVerifiedAt && !escrowCase.paymentRejectedAt && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <div>
                        <label className="block text-xs font-medium mb-1.5">Admin Note (optional)</label>
                        <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                          placeholder="Add note for the record..."
                          className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleVerifyPayment} disabled={saving}
                          className="flex-1 bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Verify Payment
                        </Button>
                        <Button onClick={handleRejectPayment} disabled={saving} variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                          <XCircle className="w-4 h-4 mr-2" /> Reject Payment
                        </Button>
                      </div>
                    </div>
                  )}

                  {escrowCase.paymentVerifiedAt && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      Verified {formatDateTime(escrowCase.paymentVerifiedAt)}
                      {canNotifySeller && (
                        <Button onClick={handleNotifySeller} disabled={saving} size="sm"
                          className="ml-auto navy-gradient text-white border-0 text-xs h-7">
                          Notify Seller →
                        </Button>
                      )}
                    </div>
                  )}

                  {escrowCase.paymentAdminNotes && (
                    <div className="p-3 bg-muted/30 rounded-xl text-xs text-muted-foreground">
                      <span className="font-medium">Admin Note: </span>{escrowCase.paymentAdminNotes}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Waiting for buyer to submit payment proof</p>
                </div>
              )}
            </div>
          </Section>

          {/* ─── STEP 2: Seller Evidence ─── */}
          <Section id="seller" title="Step 2 — Seller Item & Packaging Evidence" icon={Package}
            badge={escrowCase.sellerEvidenceStatus === 'approved'
              ? <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Approved</span>
              : escrowCase.sellerEvidenceStatus === 'rejected'
                ? <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rejected</span>
                : escrowCase.sellerEvidenceSubmittedAt
                  ? <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Awaiting Review</span>
                  : null
            }
          >
            <div className="pt-4 space-y-4">
              {escrowCase.status === 'payment_verified' && !escrowCase.sellerEvidenceSubmittedAt && (
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700">Payment verified — send notification to seller to submit evidence</p>
                  <Button onClick={handleNotifySeller} disabled={saving} size="sm"
                    className="navy-gradient text-white border-0 text-xs h-7">
                    Notify Seller
                  </Button>
                </div>
              )}

              {canMarkItemReady && (
                <Button onClick={handleMarkItemReady} disabled={saving} variant="outline" className="w-full text-sm">
                  <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" /> Mark Item as Ready (Manual Confirmation)
                </Button>
              )}

              {escrowCase.sellerReadinessConfirmed && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> Seller confirmed item is ready for dispatch
                </div>
              )}

              {/* Item Photos */}
              {escrowCase.sellerItemPhotos.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Item Photos ({escrowCase.sellerItemPhotos.length})
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {escrowCase.sellerItemPhotos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="aspect-square rounded-xl overflow-hidden border border-border hover:border-[hsl(var(--brand-navy))] transition-colors group">
                        <img src={url} alt={`Item ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                  <ImageIcon className="w-4 h-4 opacity-40" /> No item photos submitted yet
                </div>
              )}

              {/* Packaging Photos */}
              {escrowCase.sellerPackagingPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Packaging Photos ({escrowCase.sellerPackagingPhotos.length})
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {escrowCase.sellerPackagingPhotos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="aspect-square rounded-xl overflow-hidden border border-border hover:border-[hsl(var(--brand-navy))] transition-colors group">
                        <img src={url} alt={`Package ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Packaging Video */}
              {escrowCase.sellerPackagingVideo && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <PlayCircle className="w-3.5 h-3.5" /> Packaging Video
                  </p>
                  <a href={escrowCase.sellerPackagingVideo} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-xl hover:bg-muted transition-colors">
                    <Video className="w-4 h-4 text-muted-foreground" /> View Packaging Video
                  </a>
                </div>
              )}

              {/* Evidence submitted, pending review */}
              {escrowCase.sellerEvidenceSubmittedAt && canApprovePackaging && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <span>Evidence submitted {formatDateTime(escrowCase.sellerEvidenceSubmittedAt)}</span>
                    <span className="font-semibold">Awaiting your review</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Admin Note</label>
                    <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Note for the record..."
                      className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleApprovePackaging} disabled={saving}
                      className="flex-1 bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0">
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve Evidence
                    </Button>
                    <Button onClick={handleRejectPackaging} disabled={saving} variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                      <XCircle className="w-4 h-4 mr-2" /> Reject & Request More
                    </Button>
                  </div>
                </div>
              )}

              {escrowCase.sellerEvidenceStatus === 'approved' && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <CheckCircle className="w-4 h-4" /> Evidence approved {escrowCase.packagingApprovedAt && `on ${formatDate(escrowCase.packagingApprovedAt)}`}
                  {escrowCase.sellerEvidenceAdminNotes && <span className="text-muted-foreground ml-1">— {escrowCase.sellerEvidenceAdminNotes}</span>}
                </div>
              )}
            </div>
          </Section>

          {/* ─── STEP 3: Delivery Management ─── */}
          <Section id="delivery" title="Step 3 — Delivery Management" icon={Truck}
            badge={escrowCase.deliveryStatus
              ? <span className="ml-2 text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full capitalize">{escrowCase.deliveryStatus.replace(/_/g, ' ')}</span>
              : null
            }
          >
            <div className="pt-4 space-y-4">
              {canScheduleDelivery && !showDeliveryForm && (
                <Button onClick={() => setShowDeliveryForm(true)} variant="outline" className="w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Schedule Pickup & Delivery
                </Button>
              )}

              {showDeliveryForm && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                  <h3 className="font-medium text-sm">Delivery Details</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Courier Name *', key: 'courierName', placeholder: 'FedEx, DHL, UPS...' },
                      { label: 'Tracking Number *', key: 'trackingNumber', placeholder: 'Tracking #' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium mb-1">{f.label}</label>
                        <input
                          value={(deliveryForm as any)[f.key]}
                          onChange={e => setDeliveryForm(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium mb-1">Pickup Date</label>
                      <input type="date" value={deliveryForm.pickupDate} onChange={e => setDeliveryForm(p => ({ ...p, pickupDate: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Estimated Delivery</label>
                      <input type="date" value={deliveryForm.estimatedDeliveryDate} onChange={e => setDeliveryForm(p => ({ ...p, estimatedDeliveryDate: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Notes</label>
                    <textarea value={deliveryForm.notes} onChange={e => setDeliveryForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                      placeholder="Insurance info, special instructions..."
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleScheduleDelivery} disabled={saving} className="navy-gradient text-white border-0 hover:opacity-90">
                      <Truck className="w-4 h-4 mr-2" /> Confirm Delivery Schedule
                    </Button>
                    <Button variant="outline" onClick={() => setShowDeliveryForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {hasDelivery && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Courier', value: escrowCase.courierName, icon: Truck },
                      { label: 'Tracking Number', value: escrowCase.trackingNumber, icon: Hash },
                      { label: 'Pickup Date', value: escrowCase.pickupDate ? formatDate(escrowCase.pickupDate) : '—', icon: Calendar },
                      { label: 'Est. Delivery', value: escrowCase.estimatedDeliveryDate ? formatDate(escrowCase.estimatedDeliveryDate) : '—', icon: Calendar },
                      ...(escrowCase.actualDeliveryDate ? [{ label: 'Delivered On', value: formatDate(escrowCase.actualDeliveryDate), icon: CheckCircle }] : []),
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-xl bg-muted/50 flex items-start gap-2.5">
                        <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] text-muted-foreground">{item.label}</p>
                          <p className={cn('text-xs font-medium mt-0.5', item.label === 'Tracking Number' && 'font-mono')}>{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {escrowCase.deliveryNotes && (
                    <p className="text-xs text-muted-foreground italic px-1">{escrowCase.deliveryNotes}</p>
                  )}

                  {/* Delivery Status Controls */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update Delivery Status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { status: 'picked_up', label: 'Mark Picked Up', color: 'border-blue-300 text-blue-600 hover:bg-blue-50' },
                        { status: 'in_transit', label: 'Mark In Transit', caseStatus: 'in_transit' as EscrowStatus, color: 'border-sky-300 text-sky-600 hover:bg-sky-50' },
                        { status: 'out_for_delivery', label: 'Out for Delivery', color: 'border-orange-300 text-orange-600 hover:bg-orange-50' },
                        { status: 'delivered', label: 'Mark Delivered', caseStatus: 'delivered' as EscrowStatus, color: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' },
                      ].map(({ status, label, caseStatus, color }) => (
                        <Button
                          key={status}
                          variant="outline"
                          disabled={saving}
                          onClick={() => handleUpdateDeliveryStatus(status, caseStatus)}
                          className={cn('text-xs', color)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!hasDelivery && !canScheduleDelivery && (
                <div className="py-4 text-center text-muted-foreground text-xs">
                  Delivery details will be available after packaging is approved
                </div>
              )}
            </div>
          </Section>

          {/* ─── STEP 4: Fund Release ─── */}
          <Section id="funds" title="Step 4 — Fund Release / Refund" icon={Banknote}>
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Escrow Amount', value: formatCurrency(escrowCase.amount, escrowCase.currency), color: '' },
                  { label: 'Platform Fee', value: `-${formatCurrency(escrowCase.fees, escrowCase.currency)}`, color: 'text-red-600' },
                  { label: 'Net to Seller', value: formatCurrency(netAmount, escrowCase.currency), color: 'text-emerald-600' },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-xl bg-muted/50 text-center">
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className={cn('font-bold text-sm mt-0.5', item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>

              {!hasActiveDispute && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Admin Note (optional)</label>
                    <input value={adminNote} onChange={e => setAdminNote(e.target.value)}
                      placeholder="Release or refund note..."
                      className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleReleaseFunds} disabled={saving || !canReleaseFunds}
                      className="flex-1 bg-[hsl(var(--brand-emerald))] hover:bg-[hsl(158,64%,32%)] text-white border-0">
                      <Banknote className="w-4 h-4 mr-2" /> Release Funds to Seller
                    </Button>
                    <Button onClick={handleIssueRefund} disabled={saving || !canRefund} variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                      <XCircle className="w-4 h-4 mr-2" /> Issue Refund to Buyer
                    </Button>
                  </div>
                  {!canReleaseFunds && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      Release funds available once buyer confirms delivery or item is delivered
                    </p>
                  )}
                </>
              )}

              {escrowCase.status === 'funds_released' && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <CheckCircle className="w-4 h-4" /> Funds released {escrowCase.updatedAt && `on ${formatDate(escrowCase.updatedAt)}`}
                </div>
              )}
              {escrowCase.status === 'refunded' && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <CheckCircle className="w-4 h-4" /> Refund issued to buyer
                </div>
              )}
            </div>
          </Section>

          {/* ─── Dispute Management ─── */}
          {(escrowCase.disputeStatus || hasActiveDispute) && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-red-50 border-b border-red-200">
                <h2 className="font-heading font-semibold text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Dispute Management
                </h2>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                  escrowCase.disputeStatus === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                )}>
                  {escrowCase.disputeStatus || 'open'}
                </span>
              </div>
              <div className="p-5 space-y-4">
                {escrowCase.disputeReason && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50 rounded-xl">
                      <p className="text-[11px] text-muted-foreground">Reason</p>
                      <p className="text-xs font-medium mt-0.5">{DISPUTE_REASONS[escrowCase.disputeReason as keyof typeof DISPUTE_REASONS] || escrowCase.disputeReason}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl">
                      <p className="text-[11px] text-muted-foreground">Opened By</p>
                      <p className="text-xs font-medium mt-0.5">{escrowCase.disputeOpenedBy === escrowCase.buyerId ? escrowCase.buyerName + ' (Buyer)' : escrowCase.sellerName + ' (Seller)'}</p>
                    </div>
                  </div>
                )}

                {escrowCase.disputeDescription && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-foreground leading-relaxed">{escrowCase.disputeDescription}</p>
                  </div>
                )}

                {hasActiveDispute && (
                  <div className="space-y-3 pt-2 border-t border-red-100">
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Admin Decision Notes</label>
                      <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3}
                        placeholder="Document your decision reasoning..."
                        className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { outcome: 'full_refund', label: 'Full Refund to Buyer', color: 'border-red-300 text-red-600 hover:bg-red-50' },
                        { outcome: 'partial_refund', label: 'Partial Refund', color: 'border-amber-300 text-amber-600 hover:bg-amber-50' },
                        { outcome: 'release_funds', label: 'Release to Seller', color: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' },
                        { outcome: 'request_more_evidence', label: 'Request More Evidence', color: 'border-blue-300 text-blue-600 hover:bg-blue-50' },
                      ].map(({ outcome, label, color }) => (
                        <Button key={outcome} variant="outline" disabled={saving}
                          onClick={() => handleResolveDispute(outcome)} className={cn('text-xs', color)}>
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {escrowCase.disputeStatus === 'resolved' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <p className="font-semibold text-emerald-700">Resolved</p>
                    <p className="text-emerald-600 mt-0.5">Outcome: {escrowCase.disputeOutcome?.replace(/_/g, ' ')}</p>
                    {escrowCase.disputeAdminNotes && <p className="text-muted-foreground mt-1">"{escrowCase.disputeAdminNotes}"</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Manual Status Override ─── */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-1 flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" /> Manual Status Override
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Force-set any status regardless of normal flow. Use with caution.</p>
            <div>
              <label className="block text-xs font-medium mb-1.5">Admin Note for Override</label>
              <input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Reason for override..."
                className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] mb-3" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {STATUS_FLOW.map(status => (
                <button
                  key={status}
                  disabled={saving || escrowCase.status === status}
                  onClick={() => handleForceStatus(status)}
                  className={cn(
                    'px-2.5 py-2 text-[11px] font-medium rounded-lg border transition-colors',
                    escrowCase.status === status
                      ? 'bg-[hsl(var(--brand-navy))] text-white border-[hsl(var(--brand-navy))]'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  )}
                >
                  {ESCROW_STATUS_CONFIG[status]?.label || status}
                </button>
              ))}
            </div>
          </div>

          {/* Admin Notes */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" /> Internal Admin Notes
            </h2>
            <textarea
              value={escrowCase.adminNotes || ''}
              onChange={e => setEscrowCase(prev => prev ? { ...prev, adminNotes: e.target.value } : prev)}
              rows={4}
              placeholder="Internal notes not visible to buyer or seller..."
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none"
            />
            <Button onClick={handleSaveAdminNotes} className="mt-3 navy-gradient text-white border-0 hover:opacity-90 text-xs" size="sm">
              Save Notes
            </Button>
          </div>
        </div>

        {/* Right: Timeline */}
        <div>
          <div className="bg-white rounded-xl border border-border p-5 sticky top-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Case Timeline
              </h2>
              <span className="text-xs text-muted-foreground">{timeline.length} events</span>
            </div>

            {timeline.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="w-7 h-7 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No timeline events yet</p>
              </div>
            ) : (
              <div className="space-y-0">
                {timeline.map((event, idx) => {
                  const cfg = ESCROW_STATUS_CONFIG[event.status as EscrowStatus];
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          idx === timeline.length - 1 ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))]' : 'border-emerald-400 bg-emerald-400'
                        )}>
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                        {idx < timeline.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[20px] my-0.5" />}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight">{event.label}</p>
                        {event.notes && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{event.notes}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-muted-foreground/60">{formatDateTime(event.timestamp)}</span>
                          {event.actorName && (
                            <>
                              <span className="text-[10px] text-muted-foreground/40">·</span>
                              <span className="text-[10px] text-muted-foreground/60">{event.actorName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


