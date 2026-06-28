import type {
  User, Category, Listing, EscrowCase, Notification, Wallet,
  AuditLog, AnalyticsData, Conversation, Message
} from '@/types';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Electronics', slug: 'electronics', icon: 'Cpu', listingCount: 248, color: 'text-blue-600' },
  { id: 'cat-2', name: 'Luxury Watches', slug: 'watches', icon: 'Watch', listingCount: 89, color: 'text-amber-600' },
  { id: 'cat-3', name: 'Vehicles', slug: 'vehicles', icon: 'Car', listingCount: 124, color: 'text-slate-600' },
  { id: 'cat-4', name: 'Real Estate', slug: 'real-estate', icon: 'Building2', listingCount: 67, color: 'text-green-600' },
  { id: 'cat-5', name: 'Art & Collectibles', slug: 'art', icon: 'Palette', listingCount: 156, color: 'text-purple-600' },
  { id: 'cat-6', name: 'Jewelry', slug: 'jewelry', icon: 'Gem', listingCount: 203, color: 'text-rose-600' },
  { id: 'cat-7', name: 'Sports Equipment', slug: 'sports', icon: 'Dumbbell', listingCount: 91, color: 'text-orange-600' },
  { id: 'cat-8', name: 'Musical Instruments', slug: 'music', icon: 'Music', listingCount: 74, color: 'text-indigo-600' },
];

export const MOCK_USERS: User[] = [
  {
    id: 'admin-1', name: 'Alex Morgan', email: 'admin@safeescrow.com',
    role: 'admin', isVerified: true, isActive: true,
    createdAt: '2024-01-01T00:00:00Z', totalTransactions: 0, rating: 5.0,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces'
  },
  {
    id: 'buyer-1', name: 'Jordan Smith', email: 'jordan@example.com',
    role: 'buyer', isVerified: true, isActive: true,
    createdAt: '2024-02-15T00:00:00Z', totalTransactions: 12, rating: 4.8,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces'
  },
  {
    id: 'seller-1', name: 'Casey Williams', email: 'casey@example.com',
    role: 'seller', isVerified: true, isActive: true,
    createdAt: '2024-01-20T00:00:00Z', totalTransactions: 34, rating: 4.9,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces'
  },
  {
    id: 'both-1', name: 'Riley Johnson', email: 'riley@example.com',
    role: 'both', isVerified: true, isActive: true,
    createdAt: '2024-03-10T00:00:00Z', totalTransactions: 8, rating: 4.7,
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=faces'
  },
  {
    id: 'buyer-2', name: 'Sam Torres', email: 'sam@example.com',
    role: 'buyer', isVerified: false, isActive: true,
    createdAt: '2024-05-01T00:00:00Z', totalTransactions: 2, rating: 4.5,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces'
  },
  {
    id: 'seller-2', name: 'Morgan Lee', email: 'morgan@example.com',
    role: 'seller', isVerified: true, isActive: true,
    createdAt: '2024-02-28T00:00:00Z', totalTransactions: 19, rating: 4.6,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces'
  },
];

export const MOCK_LISTINGS: Listing[] = [
  {
    id: 'listing-1', title: 'Apple MacBook Pro 16" M3 Max — Mint Condition',
    description: 'Barely used MacBook Pro 16" with M3 Max chip, 64GB RAM, 1TB SSD. Original packaging included. Less than 50 charge cycles. Perfect for professional creative work.',
    price: 3200, currency: 'USD', categoryId: 'cat-1', categoryName: 'Electronics',
    sellerId: 'seller-1', sellerName: 'Casey Williams', sellerRating: 4.9,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&h=400&fit=crop',
    ],
    condition: 'like-new', location: 'New York, NY', status: 'active',
    createdAt: '2024-05-20T10:00:00Z', viewCount: 342,
  },
  {
    id: 'listing-2', title: 'Rolex Submariner Date 41mm — Box & Papers',
    description: 'Authentic Rolex Submariner Date ref. 126610LN in stainless steel. Complete set with original box, papers, extra links. Purchased 2022, excellent condition.',
    price: 15500, currency: 'USD', categoryId: 'cat-2', categoryName: 'Luxury Watches',
    sellerId: 'both-1', sellerName: 'Riley Johnson', sellerRating: 4.7,
    images: [
      'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600&h=400&fit=crop',
    ],
    condition: 'like-new', location: 'Beverly Hills, CA', status: 'active',
    createdAt: '2024-05-18T14:30:00Z', viewCount: 891,
  },
  {
    id: 'listing-3', title: '2021 Tesla Model S Plaid — Full Self-Driving',
    description: 'One-owner Tesla Model S Plaid in Midnight Silver Metallic. FSD capability, 22" wheels, premium audio, 18,400 miles. No accidents, clean title.',
    price: 72000, currency: 'USD', categoryId: 'cat-3', categoryName: 'Vehicles',
    sellerId: 'seller-2', sellerName: 'Morgan Lee', sellerRating: 4.6,
    images: [
      'https://images.unsplash.com/photo-1619767886558-efdc259b6e09?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1536700503339-1e4b06520771?w=600&h=400&fit=crop',
    ],
    condition: 'good', location: 'Austin, TX', status: 'active',
    createdAt: '2024-05-15T09:00:00Z', viewCount: 1247,
  },
  {
    id: 'listing-4', title: 'Original Banksy Print — "Girl with Balloon" Signed',
    description: 'Authenticated Banksy screen print, "Girl with Balloon" from the 2004 edition. Authentication certificate from Pest Control included. Gallery framed.',
    price: 28000, currency: 'USD', categoryId: 'cat-5', categoryName: 'Art & Collectibles',
    sellerId: 'seller-1', sellerName: 'Casey Williams', sellerRating: 4.9,
    images: [
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=600&h=400&fit=crop',
    ],
    condition: 'new', location: 'London, UK', status: 'active',
    createdAt: '2024-05-12T16:00:00Z', viewCount: 567,
  },
  {
    id: 'listing-5', title: 'Gibson Les Paul Custom 1959 Reissue',
    description: 'Gibson Custom Shop 1959 Les Paul Standard reissue, VOS finish in Lemon Burst. Played only at home studio, perfect frets, original case included.',
    price: 6800, currency: 'USD', categoryId: 'cat-8', categoryName: 'Musical Instruments',
    sellerId: 'both-1', sellerName: 'Riley Johnson', sellerRating: 4.7,
    images: [
      'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=600&h=400&fit=crop',
    ],
    condition: 'like-new', location: 'Nashville, TN', status: 'active',
    createdAt: '2024-05-10T11:00:00Z', viewCount: 234,
  },
  {
    id: 'listing-6', title: 'Cartier Love Bracelet — Yellow Gold, Size 18',
    description: 'Authentic Cartier Love Bracelet in 18k yellow gold, size 18. Purchased at Cartier boutique. Full set with screwdriver, box and original receipt.',
    price: 7200, currency: 'USD', categoryId: 'cat-6', categoryName: 'Jewelry',
    sellerId: 'seller-2', sellerName: 'Morgan Lee', sellerRating: 4.6,
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&h=400&fit=crop',
    ],
    condition: 'like-new', location: 'Miami, FL', status: 'active',
    createdAt: '2024-05-08T13:00:00Z', viewCount: 445,
  },
];

export const MOCK_ESCROW_CASES: EscrowCase[] = [
  {
    id: 'ESC-2024-001', buyerId: 'buyer-1', buyerName: 'Jordan Smith',
    sellerId: 'seller-1', sellerName: 'Casey Williams',
    listingId: 'listing-1', listingTitle: 'Apple MacBook Pro 16" M3 Max',
    amount: 3200, fees: 96, currency: 'USD',
    status: 'packaging_submitted',
    createdAt: '2024-05-20T10:30:00Z', updatedAt: '2024-05-22T14:00:00Z',
    notes: 'Buyer verified via bank transfer confirmation.',
    paymentEvidence: {
      id: 'pay-001', caseId: 'ESC-2024-001',
      method: 'Bank Transfer', referenceNumber: 'TXN-889234',
      amount: 3200, submittedAt: '2024-05-20T12:00:00Z',
      files: [{ id: 'f1', name: 'bank_receipt.pdf', url: '/mock/receipt.pdf', type: 'document', size: 245000, uploadedAt: '2024-05-20T12:00:00Z' }],
      status: 'verified', reviewedBy: 'Alex Morgan', reviewedAt: '2024-05-20T15:00:00Z',
    },
    sellerEvidence: {
      id: 'sev-001', caseId: 'ESC-2024-001',
      itemPhotos: [
        { id: 'f2', name: 'item_front.jpg', url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', type: 'image', size: 1200000, uploadedAt: '2024-05-22T10:00:00Z' },
        { id: 'f3', name: 'item_back.jpg', url: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400', type: 'image', size: 980000, uploadedAt: '2024-05-22T10:00:00Z' },
      ],
      packagingPhotos: [
        { id: 'f4', name: 'package_ready.jpg', url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400', type: 'image', size: 870000, uploadedAt: '2024-05-22T11:00:00Z' },
      ],
      readinessConfirmed: true, submittedAt: '2024-05-22T11:30:00Z',
      status: 'pending',
    },
    timeline: [
      { id: 't1', status: 'awaiting_payment', label: 'Order Created', timestamp: '2024-05-20T10:30:00Z', actorName: 'Jordan Smith', actorRole: 'Buyer' },
      { id: 't2', status: 'payment_submitted', label: 'Payment Submitted', timestamp: '2024-05-20T12:00:00Z', actorName: 'Jordan Smith', actorRole: 'Buyer', notes: 'Bank transfer TXN-889234' },
      { id: 't3', status: 'payment_verified', label: 'Payment Verified', timestamp: '2024-05-20T15:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't4', status: 'seller_notified', label: 'Seller Notified', timestamp: '2024-05-20T15:05:00Z', actorName: 'System', actorRole: 'System' },
      { id: 't5', status: 'item_ready', label: 'Item Readiness Confirmed', timestamp: '2024-05-21T09:00:00Z', actorName: 'Casey Williams', actorRole: 'Seller' },
      { id: 't6', status: 'packaging_submitted', label: 'Packaging Evidence Submitted', timestamp: '2024-05-22T11:30:00Z', actorName: 'Casey Williams', actorRole: 'Seller' },
    ],
  },
  {
    id: 'ESC-2024-002', buyerId: 'buyer-2', buyerName: 'Sam Torres',
    sellerId: 'both-1', sellerName: 'Riley Johnson',
    listingId: 'listing-2', listingTitle: 'Rolex Submariner Date 41mm',
    amount: 15500, fees: 465, currency: 'USD',
    status: 'in_transit',
    createdAt: '2024-05-15T09:00:00Z', updatedAt: '2024-05-21T10:00:00Z',
    paymentEvidence: {
      id: 'pay-002', caseId: 'ESC-2024-002',
      method: 'Wire Transfer', referenceNumber: 'WIRE-44521',
      amount: 15500, submittedAt: '2024-05-15T11:00:00Z',
      files: [], status: 'verified', reviewedBy: 'Alex Morgan', reviewedAt: '2024-05-15T14:00:00Z',
    },
    sellerEvidence: {
      id: 'sev-002', caseId: 'ESC-2024-002',
      itemPhotos: [{ id: 'f5', name: 'watch_front.jpg', url: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=400', type: 'image', size: 1100000, uploadedAt: '2024-05-17T10:00:00Z' }],
      packagingPhotos: [{ id: 'f6', name: 'watch_packed.jpg', url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400', type: 'image', size: 900000, uploadedAt: '2024-05-17T11:00:00Z' }],
      readinessConfirmed: true, submittedAt: '2024-05-17T11:30:00Z',
      status: 'approved', reviewedBy: 'Alex Morgan', reviewedAt: '2024-05-18T09:00:00Z',
    },
    delivery: {
      id: 'del-001', caseId: 'ESC-2024-002',
      courierName: 'FedEx Priority', trackingNumber: 'FX789234561US',
      pickupDate: '2024-05-19T10:00:00Z', estimatedDeliveryDate: '2024-05-23T17:00:00Z',
      status: 'in_transit', notes: 'Signature required upon delivery. Insured for $20,000.',
      createdBy: 'Alex Morgan', createdAt: '2024-05-19T08:00:00Z',
    },
    timeline: [
      { id: 't1', status: 'awaiting_payment', label: 'Order Created', timestamp: '2024-05-15T09:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer' },
      { id: 't2', status: 'payment_submitted', label: 'Payment Submitted', timestamp: '2024-05-15T11:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer' },
      { id: 't3', status: 'payment_verified', label: 'Payment Verified', timestamp: '2024-05-15T14:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't4', status: 'seller_notified', label: 'Seller Notified', timestamp: '2024-05-15T14:05:00Z', actorName: 'System', actorRole: 'System' },
      { id: 't5', status: 'item_ready', label: 'Item Readiness Confirmed', timestamp: '2024-05-16T10:00:00Z', actorName: 'Riley Johnson', actorRole: 'Seller' },
      { id: 't6', status: 'packaging_submitted', label: 'Packaging Evidence Submitted', timestamp: '2024-05-17T11:30:00Z', actorName: 'Riley Johnson', actorRole: 'Seller' },
      { id: 't7', status: 'packaging_approved', label: 'Packaging Approved', timestamp: '2024-05-18T09:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't8', status: 'pickup_scheduled', label: 'Pickup Scheduled', timestamp: '2024-05-19T08:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin', notes: 'FedEx pickup confirmed for May 19' },
      { id: 't9', status: 'in_transit', label: 'In Transit', timestamp: '2024-05-19T14:00:00Z', actorName: 'FedEx', actorRole: 'Courier' },
    ],
  },
  {
    id: 'ESC-2024-003', buyerId: 'buyer-1', buyerName: 'Jordan Smith',
    sellerId: 'seller-2', sellerName: 'Morgan Lee',
    listingId: 'listing-6', listingTitle: 'Cartier Love Bracelet',
    amount: 7200, fees: 216, currency: 'USD',
    status: 'disputed',
    createdAt: '2024-05-10T08:00:00Z', updatedAt: '2024-05-20T11:00:00Z',
    dispute: {
      id: 'dis-001', caseId: 'ESC-2024-003',
      openedBy: 'buyer-1', openedByName: 'Jordan Smith', openedByRole: 'buyer',
      reason: 'wrong_item',
      description: 'Received item does not match listing description. The bracelet has visible scratches not mentioned and appears to be a different size than stated.',
      evidence: [
        { id: 'df1', name: 'received_item.jpg', url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400', type: 'image', size: 800000, uploadedAt: '2024-05-20T10:00:00Z' },
        { id: 'df2', name: 'comparison.jpg', url: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400', type: 'image', size: 750000, uploadedAt: '2024-05-20T10:05:00Z' },
      ],
      status: 'under_review', createdAt: '2024-05-20T09:00:00Z',
    },
    timeline: [
      { id: 't1', status: 'awaiting_payment', label: 'Order Created', timestamp: '2024-05-10T08:00:00Z', actorName: 'Jordan Smith', actorRole: 'Buyer' },
      { id: 't2', status: 'payment_submitted', label: 'Payment Submitted', timestamp: '2024-05-10T10:00:00Z', actorName: 'Jordan Smith', actorRole: 'Buyer' },
      { id: 't3', status: 'payment_verified', label: 'Payment Verified', timestamp: '2024-05-10T13:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't4', status: 'seller_notified', label: 'Seller Notified', timestamp: '2024-05-10T13:05:00Z', actorName: 'System', actorRole: 'System' },
      { id: 't5', status: 'packaging_approved', label: 'Packaging Approved', timestamp: '2024-05-12T09:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't6', status: 'in_transit', label: 'In Transit', timestamp: '2024-05-13T14:00:00Z', actorName: 'UPS', actorRole: 'Courier' },
      { id: 't7', status: 'delivered', label: 'Delivered', timestamp: '2024-05-18T11:00:00Z', actorName: 'UPS', actorRole: 'Courier' },
      { id: 't8', status: 'disputed', label: 'Dispute Opened by Buyer', timestamp: '2024-05-20T09:00:00Z', actorName: 'Jordan Smith', actorRole: 'Buyer', notes: 'Wrong item received' },
    ],
  },
  {
    id: 'ESC-2024-004', buyerId: 'buyer-2', buyerName: 'Sam Torres',
    sellerId: 'seller-1', sellerName: 'Casey Williams',
    listingId: 'listing-4', listingTitle: 'Banksy Print — Girl with Balloon',
    amount: 28000, fees: 840, currency: 'USD',
    status: 'funds_released',
    createdAt: '2024-04-20T10:00:00Z', updatedAt: '2024-05-05T16:00:00Z',
    payout: {
      id: 'payout-001', caseId: 'ESC-2024-004',
      sellerId: 'seller-1', sellerName: 'Casey Williams',
      amount: 28000, fees: 840, netAmount: 27160, currency: 'USD',
      status: 'paid', releaseDate: '2024-05-05T14:00:00Z', paidAt: '2024-05-05T16:00:00Z',
      approvedBy: 'Alex Morgan', notes: 'Payout completed via bank transfer.',
      createdAt: '2024-05-05T12:00:00Z',
    },
    timeline: [
      { id: 't1', status: 'awaiting_payment', label: 'Order Created', timestamp: '2024-04-20T10:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer' },
      { id: 't2', status: 'payment_submitted', label: 'Payment Submitted', timestamp: '2024-04-20T12:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer' },
      { id: 't3', status: 'payment_verified', label: 'Payment Verified', timestamp: '2024-04-20T15:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't4', status: 'packaging_approved', label: 'Packaging Approved', timestamp: '2024-04-22T11:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
      { id: 't5', status: 'delivered', label: 'Delivered', timestamp: '2024-04-28T14:00:00Z', actorName: 'DHL', actorRole: 'Courier' },
      { id: 't6', status: 'buyer_confirmed', label: 'Buyer Confirmed Receipt', timestamp: '2024-04-29T10:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer' },
      { id: 't7', status: 'funds_released', label: 'Funds Released to Seller', timestamp: '2024-05-05T14:00:00Z', actorName: 'Alex Morgan', actorRole: 'Admin' },
    ],
  },
  {
    id: 'ESC-2024-005', buyerId: 'buyer-1', buyerName: 'Jordan Smith',
    sellerId: 'seller-2', sellerName: 'Morgan Lee',
    listingId: 'listing-5', listingTitle: 'Gibson Les Paul Custom 1959',
    amount: 6800, fees: 204, currency: 'USD',
    status: 'awaiting_payment',
    createdAt: '2024-05-23T08:00:00Z', updatedAt: '2024-05-23T08:00:00Z',
    timeline: [
      { id: 't1', status: 'awaiting_payment', label: 'Order Created', timestamp: '2024-05-23T08:00:00Z', actorName: 'Jordan Smith', actorRole: 'Buyer' },
    ],
  },
  {
    id: 'ESC-2024-006', buyerId: 'buyer-2', buyerName: 'Sam Torres',
    sellerId: 'seller-2', sellerName: 'Morgan Lee',
    listingId: 'listing-3', listingTitle: '2021 Tesla Model S Plaid',
    amount: 72000, fees: 2160, currency: 'USD',
    status: 'payment_submitted',
    createdAt: '2024-05-22T15:00:00Z', updatedAt: '2024-05-22T17:00:00Z',
    paymentEvidence: {
      id: 'pay-003', caseId: 'ESC-2024-006',
      method: 'Cashier Check', referenceNumber: 'CC-992145',
      amount: 72000, submittedAt: '2024-05-22T17:00:00Z',
      files: [{ id: 'f7', name: 'cashier_check.pdf', url: '/mock/check.pdf', type: 'document', size: 300000, uploadedAt: '2024-05-22T17:00:00Z' }],
      status: 'pending',
    },
    timeline: [
      { id: 't1', status: 'awaiting_payment', label: 'Order Created', timestamp: '2024-05-22T15:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer' },
      { id: 't2', status: 'payment_submitted', label: 'Payment Submitted', timestamp: '2024-05-22T17:00:00Z', actorName: 'Sam Torres', actorRole: 'Buyer', notes: 'Cashier check CC-992145' },
    ],
  },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1', userId: 'buyer-1', type: 'payment_verified',
    title: 'Payment Verified', message: 'Your payment for Apple MacBook Pro has been verified by the administrator.',
    caseId: 'ESC-2024-001', isRead: false, createdAt: '2024-05-20T15:00:00Z',
  },
  {
    id: 'notif-2', userId: 'buyer-1', type: 'dispute_opened',
    title: 'Dispute Opened', message: 'Your dispute for Cartier Love Bracelet is under review.',
    caseId: 'ESC-2024-003', isRead: false, createdAt: '2024-05-20T09:05:00Z',
  },
  {
    id: 'notif-3', userId: 'admin-1', type: 'payment_submitted',
    title: 'Payment Submitted — Review Required', message: 'Sam Torres submitted payment for 2021 Tesla Model S Plaid. Review and verify.',
    caseId: 'ESC-2024-006', isRead: false, createdAt: '2024-05-22T17:05:00Z',
  },
  {
    id: 'notif-4', userId: 'admin-1', type: 'dispute_opened',
    title: 'Dispute Requires Review', message: 'Jordan Smith opened a dispute for Cartier Love Bracelet — Wrong Item.',
    caseId: 'ESC-2024-003', isRead: false, createdAt: '2024-05-20T09:00:00Z',
  },
  {
    id: 'notif-5', userId: 'seller-1', type: 'seller_notified',
    title: 'Payment Received — Prepare Item', message: 'Payment for Apple MacBook Pro has been verified. Please prepare and photograph the item.',
    caseId: 'ESC-2024-001', isRead: true, createdAt: '2024-05-20T15:05:00Z',
  },
  {
    id: 'notif-6', userId: 'seller-1', type: 'funds_released',
    title: 'Funds Released', message: 'Payment of $27,160.00 for Banksy Print has been released to your wallet.',
    caseId: 'ESC-2024-004', isRead: true, createdAt: '2024-05-05T16:00:00Z',
  },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-1', adminId: 'admin-1', adminName: 'Alex Morgan', action: 'PAYMENT_VERIFIED', entityType: 'EscrowCase', entityId: 'ESC-2024-006', details: 'Payment evidence verified for $72,000 Tesla transaction', ipAddress: '192.168.1.1', createdAt: '2024-05-22T18:00:00Z' },
  { id: 'log-2', adminId: 'admin-1', adminName: 'Alex Morgan', action: 'PACKAGING_APPROVED', entityType: 'EscrowCase', entityId: 'ESC-2024-002', details: 'Packaging evidence approved for Rolex Submariner', ipAddress: '192.168.1.1', createdAt: '2024-05-18T09:00:00Z' },
  { id: 'log-3', adminId: 'admin-1', adminName: 'Alex Morgan', action: 'DELIVERY_CREATED', entityType: 'Delivery', entityId: 'del-001', details: 'FedEx delivery scheduled for ESC-2024-002', ipAddress: '192.168.1.1', createdAt: '2024-05-19T08:00:00Z' },
  { id: 'log-4', adminId: 'admin-1', adminName: 'Alex Morgan', action: 'FUNDS_RELEASED', entityType: 'Payout', entityId: 'payout-001', details: 'Funds released: $27,160 to Casey Williams for ESC-2024-004', ipAddress: '192.168.1.1', createdAt: '2024-05-05T16:00:00Z' },
  { id: 'log-5', adminId: 'admin-1', adminName: 'Alex Morgan', action: 'USER_VERIFIED', entityType: 'User', entityId: 'seller-1', details: 'Seller Casey Williams identity verified', ipAddress: '192.168.1.1', createdAt: '2024-01-20T12:00:00Z' },
];

export const MOCK_ANALYTICS: AnalyticsData = {
  totalUsers: 1284,
  activeUsers: 892,
  listingsCreated: 4721,
  activeEscrowCases: 47,
  completedTransactions: 1893,
  disputedTransactions: 23,
  totalEscrowVolume: 8_432_500,
  revenueGenerated: 252_975,
  monthlyVolume: [
    { month: 'Dec', volume: 520000, count: 87 },
    { month: 'Jan', volume: 680000, count: 112 },
    { month: 'Feb', volume: 750000, count: 128 },
    { month: 'Mar', volume: 890000, count: 145 },
    { month: 'Apr', volume: 1020000, count: 167 },
    { month: 'May', volume: 1180000, count: 189 },
  ],
  statusBreakdown: [
    { status: 'Completed', count: 1893, color: '#10B981' },
    { status: 'In Progress', count: 47, color: '#3B82F6' },
    { status: 'Disputed', count: 23, color: '#EF4444' },
    { status: 'Refunded', count: 18, color: '#F59E0B' },
    { status: 'Closed', count: 156, color: '#6B7280' },
  ],
  categoryBreakdown: [
    { category: 'Electronics', count: 523, volume: 1890000 },
    { category: 'Vehicles', count: 124, volume: 3200000 },
    { category: 'Watches', count: 89, volume: 1120000 },
    { category: 'Art', count: 156, volume: 890000 },
    { category: 'Jewelry', count: 203, volume: 680000 },
    { category: 'Other', count: 342, volume: 652500 },
  ],
};

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1', participants: ['buyer-1', 'seller-1'],
    participantNames: ['Jordan Smith', 'Casey Williams'],
    listingId: 'listing-1', listingTitle: 'Apple MacBook Pro 16"',
    lastMessage: 'Can you provide more photos of the battery health?',
    lastMessageAt: '2024-05-23T09:00:00Z', unreadCount: 2,
    buyerId: 'buyer-1', sellerId: 'seller-1',
  },
  {
    id: 'conv-2', participants: ['buyer-2', 'both-1'],
    participantNames: ['Sam Torres', 'Riley Johnson'],
    listingId: 'listing-2', listingTitle: 'Rolex Submariner Date',
    lastMessage: 'Box and papers are included, confirmed.',
    lastMessageAt: '2024-05-22T14:30:00Z', unreadCount: 0,
    buyerId: 'buyer-2', sellerId: 'both-1',
  },
];

export const MOCK_MESSAGES: Message[] = [
  { id: 'msg-1', conversationId: 'conv-1', senderId: 'buyer-1', senderName: 'Jordan Smith', content: 'Hi, is the MacBook still available?', createdAt: '2024-05-22T10:00:00Z', isRead: true },
  { id: 'msg-2', conversationId: 'conv-1', senderId: 'seller-1', senderName: 'Casey Williams', content: 'Yes, absolutely! The MacBook is in excellent condition, less than 50 charge cycles.', createdAt: '2024-05-22T10:15:00Z', isRead: true },
  { id: 'msg-3', conversationId: 'conv-1', senderId: 'buyer-1', senderName: 'Jordan Smith', content: 'Great! Can you provide more photos of the battery health?', createdAt: '2024-05-23T09:00:00Z', isRead: false },
];
