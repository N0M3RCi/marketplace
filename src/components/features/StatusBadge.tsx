import { cn } from '@/lib/utils';
import { ESCROW_STATUS_CONFIG, DELIVERY_STATUS_CONFIG } from '@/constants';
import type { EscrowStatus, DeliveryStatus } from '@/types';

interface StatusBadgeProps {
  status: EscrowStatus | DeliveryStatus | string;
  type?: 'escrow' | 'delivery' | 'payment' | 'payout' | 'dispute';
  size?: 'sm' | 'md';
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-100' },
  verified: { label: 'Verified', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

const PAYOUT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  approved: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-100' },
  released: { label: 'Released', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  paid: { label: 'Paid', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  refunded: { label: 'Refunded', color: 'text-rose-700', bg: 'bg-rose-100' },
};

const DISPUTE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-red-700', bg: 'bg-red-100' },
  under_review: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-100' },
  resolved: { label: 'Resolved', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  closed: { label: 'Closed', color: 'text-slate-600', bg: 'bg-slate-100' },
};

export default function StatusBadge({ status, type = 'escrow', size = 'sm' }: StatusBadgeProps) {
  let config: { label: string; color: string; bg: string } | undefined;

  if (type === 'escrow') {
    config = ESCROW_STATUS_CONFIG[status as EscrowStatus];
  } else if (type === 'delivery') {
    config = DELIVERY_STATUS_CONFIG[status as DeliveryStatus];
  } else if (type === 'payment') {
    config = PAYMENT_STATUS_CONFIG[status];
  } else if (type === 'payout') {
    config = PAYOUT_STATUS_CONFIG[status];
  } else if (type === 'dispute') {
    config = DISPUTE_STATUS_CONFIG[status];
  }

  if (!config) {
    return (
      <span className={cn('inline-flex items-center font-medium rounded-full capitalize', size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs', 'bg-slate-100 text-slate-600')}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
      config.bg, config.color
    )}>
      {config.label}
    </span>
  );
}
