import { z } from 'zod';

export const createEscrow = z.object({
  listingId: z.string().optional(),
  listingTitle: z.string().max(300).optional(),
  sellerId: z.string().uuid('Seller ID must be a valid UUID'),
  amount: z.number().positive('Amount must be positive').finite(),
  fees: z.number().min(0).default(0),
  currency: z.string().max(10).default('USD'),
});

export const updateEscrow = z.object({
  status: z.string().max(50).optional(),
  payment_address: z.string().max(200).optional(),
  payment_network: z.string().max(50).optional(),
  payment_method: z.string().max(50).optional(),
  payment_reference: z.string().max(200).optional(),
  payment_proof_url: z.string().max(500).optional(),
  payment_amount_sent: z.number().positive().optional(),
  payment_submitted_at: z.string().optional(),
  payment_verified_at: z.string().optional(),
  payment_admin_notes: z.string().max(2000).optional(),
  seller_item_photos: z.array(z.string()).optional(),
  seller_packaging_photos: z.array(z.string()).optional(),
  seller_packaging_video: z.string().max(500).optional(),
  seller_readiness_confirmed: z.boolean().optional(),
  seller_evidence_submitted_at: z.string().optional(),
  seller_evidence_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  courier_name: z.string().max(100).optional(),
  tracking_number: z.string().max(100).optional(),
  pickup_date: z.string().optional(),
  estimated_delivery_date: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  delivery_status: z.string().max(50).optional(),
  delivery_notes: z.string().max(2000).optional(),
  dispute_status: z.string().max(50).optional(),
  dispute_reason: z.string().max(500).optional(),
  dispute_description: z.string().max(5000).optional(),
  dispute_outcome: z.string().max(50).optional(),
  admin_notes: z.string().max(5000).optional(),
  payout_status: z.string().max(50).optional(),
  buyer_confirmed_at: z.string().optional(),
});

export const addTimeline = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  status: z.string().max(50).optional(),
  label: z.string().max(200).optional(),
  actorName: z.string().max(100).optional(),
  actorRole: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});