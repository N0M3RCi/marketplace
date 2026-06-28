import type { EscrowStatus, DeliveryStatus, DisputeReason, NotificationType } from '@/types';

export const ESCROW_STATUS_CONFIG: Record<EscrowStatus, { label: string; color: string; bg: string; step: number }> = {
  awaiting_payment: { label: 'Awaiting Payment', color: 'text-amber-700', bg: 'bg-amber-100', step: 1 },
  payment_submitted: { label: 'Payment Submitted', color: 'text-blue-700', bg: 'bg-blue-100', step: 2 },
  payment_verified: { label: 'Payment Verified', color: 'text-emerald-700', bg: 'bg-emerald-100', step: 3 },
  seller_notified: { label: 'Seller Notified', color: 'text-cyan-700', bg: 'bg-cyan-100', step: 4 },
  item_ready: { label: 'Item Ready', color: 'text-indigo-700', bg: 'bg-indigo-100', step: 5 },
  packaging_submitted: { label: 'Packaging Submitted', color: 'text-violet-700', bg: 'bg-violet-100', step: 6 },
  packaging_approved: { label: 'Packaging Approved', color: 'text-teal-700', bg: 'bg-teal-100', step: 7 },
  pickup_scheduled: { label: 'Pickup Scheduled', color: 'text-orange-700', bg: 'bg-orange-100', step: 8 },
  in_transit: { label: 'In Transit', color: 'text-sky-700', bg: 'bg-sky-100', step: 9 },
  delivered: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100', step: 10 },
  buyer_confirmed: { label: 'Buyer Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-100', step: 11 },
  funds_released: { label: 'Funds Released', color: 'text-emerald-700', bg: 'bg-emerald-50', step: 12 },
  refunded: { label: 'Refunded', color: 'text-rose-700', bg: 'bg-rose-100', step: 13 },
  disputed: { label: 'Disputed', color: 'text-red-700', bg: 'bg-red-100', step: 0 },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100', step: 14 },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bg: 'bg-slate-100', step: 14 },
  closed: { label: 'Closed', color: 'text-slate-600', bg: 'bg-slate-100', step: 15 },
};

export const ESCROW_TIMELINE_STEPS: EscrowStatus[] = [
  'awaiting_payment',
  'payment_submitted',
  'payment_verified',
  'seller_notified',
  'item_ready',
  'packaging_submitted',
  'packaging_approved',
  'pickup_scheduled',
  'in_transit',
  'delivered',
  'buyer_confirmed',
  'funds_released',
];

export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
  pickup_scheduled: { label: 'Pickup Scheduled', color: 'text-amber-700', bg: 'bg-amber-100' },
  picked_up: { label: 'Picked Up', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_transit: { label: 'In Transit', color: 'text-sky-700', bg: 'bg-sky-100' },
  out_for_delivery: { label: 'Out for Delivery', color: 'text-orange-700', bg: 'bg-orange-100' },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

export const DISPUTE_REASONS: Record<DisputeReason, string> = {
  item_not_received: 'Item Not Received',
  wrong_item: 'Wrong Item',
  damaged_item: 'Damaged Item',
  counterfeit_item: 'Counterfeit Item',
  delivery_issue: 'Delivery Issue',
  other: 'Other',
};

export const NOTIFICATION_CONFIG: Record<NotificationType, { label: string; icon: string }> = {
  new_message: { label: 'New Message', icon: 'MessageSquare' },
  payment_submitted: { label: 'Payment Submitted', icon: 'CreditCard' },
  payment_verified: { label: 'Payment Verified', icon: 'CheckCircle' },
  seller_notified: { label: 'Seller Notified', icon: 'Bell' },
  item_approved: { label: 'Item Approved', icon: 'PackageCheck' },
  pickup_scheduled: { label: 'Pickup Scheduled', icon: 'Truck' },
  delivery_started: { label: 'Delivery Started', icon: 'Package' },
  delivered: { label: 'Delivered', icon: 'PackageOpen' },
  dispute_opened: { label: 'Dispute Opened', icon: 'AlertTriangle' },
  dispute_resolved: { label: 'Dispute Resolved', icon: 'Scale' },
  funds_released: { label: 'Funds Released', icon: 'Banknote' },
  refund_issued: { label: 'Refund Issued', icon: 'RefreshCcw' },
};

export const MOCK_USERS = [
  { id: 'admin-1', name: 'Alex Morgan', email: 'admin@safeescrow.com', role: 'admin' as const },
  { id: 'buyer-1', name: 'Jordan Smith', email: 'jordan@example.com', role: 'buyer' as const },
  { id: 'seller-1', name: 'Casey Williams', email: 'casey@example.com', role: 'seller' as const },
  { id: 'both-1', name: 'Riley Johnson', email: 'riley@example.com', role: 'both' as const },
];
