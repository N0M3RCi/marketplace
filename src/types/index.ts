export type UserRole = 'admin' | 'buyer' | 'seller' | 'both';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  totalTransactions: number;
  rating: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  listingCount: number;
  color: string;
  parentId?: string | null;
  homepageFeatured?: boolean;
  imageUrl?: string | null;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  categoryId: string;
  categoryName: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  images: string[];
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor';
  location: string;
  status: 'active' | 'sold' | 'pending' | 'suspended';
  createdAt: string;
  viewCount: number;
  isFavorited?: boolean;
}

export type EscrowStatus =
  | 'awaiting_payment'
  | 'payment_submitted'
  | 'payment_verified'
  | 'seller_notified'
  | 'item_ready'
  | 'packaging_submitted'
  | 'packaging_approved'
  | 'pickup_scheduled'
  | 'in_transit'
  | 'delivered'
  | 'buyer_confirmed'
  | 'funds_released'
  | 'refunded'
  | 'disputed'
  | 'completed'
  | 'cancelled'
  | 'closed';

export interface EscrowCase {
  id: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  listingId: string;
  listingTitle: string;
  amount: number;
  fees: number;
  currency: string;
  status: EscrowStatus;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
  paymentEvidence?: PaymentEvidence;
  sellerEvidence?: SellerEvidence;
  delivery?: Delivery;
  payout?: Payout;
  dispute?: Dispute;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  status: EscrowStatus;
  label: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  notes?: string;
}

export interface PaymentEvidence {
  id: string;
  caseId: string;
  method: string;
  referenceNumber: string;
  amount: number;
  submittedAt: string;
  files: EvidenceFile[];
  status: 'pending' | 'verified' | 'rejected';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface SellerEvidence {
  id: string;
  caseId: string;
  itemPhotos: EvidenceFile[];
  packagingPhotos: EvidenceFile[];
  packagingVideo?: EvidenceFile;
  readinessConfirmed: boolean;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface EvidenceFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'document';
  size: number;
  uploadedAt: string;
}

export type DeliveryStatus =
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered';

export interface Delivery {
  id: string;
  caseId: string;
  courierName: string;
  trackingNumber: string;
  pickupDate: string;
  estimatedDeliveryDate: string;
  actualDeliveryDate?: string;
  status: DeliveryStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type PayoutStatus = 'pending' | 'approved' | 'released' | 'paid' | 'refunded';

export interface Payout {
  id: string;
  caseId: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  fees: number;
  netAmount: number;
  currency: string;
  status: PayoutStatus;
  releaseDate?: string;
  paidAt?: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

export type DisputeReason =
  | 'item_not_received'
  | 'wrong_item'
  | 'damaged_item'
  | 'counterfeit_item'
  | 'delivery_issue'
  | 'other';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type DisputeOutcome = 'full_refund' | 'partial_refund' | 'release_funds' | 'request_more_evidence' | null;

export interface Dispute {
  id: string;
  caseId: string;
  openedBy: string;
  openedByName: string;
  openedByRole: 'buyer' | 'seller';
  reason: DisputeReason;
  description: string;
  evidence: EvidenceFile[];
  status: DisputeStatus;
  outcome?: DisputeOutcome;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export type NotificationType =
  | 'new_message'
  | 'payment_submitted'
  | 'payment_verified'
  | 'seller_notified'
  | 'item_approved'
  | 'pickup_scheduled'
  | 'delivery_started'
  | 'delivered'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'funds_released'
  | 'refund_issued';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  caseId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  caseId?: string;
  type: 'deposit' | 'withdrawal' | 'escrow_hold' | 'escrow_release' | 'fee' | 'refund';
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  listingsCreated: number;
  activeEscrowCases: number;
  completedTransactions: number;
  disputedTransactions: number;
  totalEscrowVolume: number;
  revenueGenerated: number;
  monthlyVolume: { month: string; volume: number; count: number }[];
  statusBreakdown: { status: string; count: number; color: string }[];
  categoryBreakdown: { category: string; count: number; volume: number }[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: string[];
  listingId?: string;
  listingTitle?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  buyerId: string;
  sellerId: string;
}

export interface AppState {
  currentUser: User | null;
  notifications: Notification[];
}
