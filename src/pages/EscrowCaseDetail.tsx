import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, User, CreditCard, Package, Truck, CheckCircle,
  AlertTriangle, Clock, ExternalLink, Copy, Upload, X, Loader2,
  Bitcoin, Camera, Video, FileText, ChevronRight, Send, Image as ImageIcon
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { escrow, storage } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, formatDate, cn } from '@/lib/utils';
import { ESCROW_STATUS_CONFIG, DISPUTE_REASONS } from '@/constants';
import { generateQR, getNetworkSymbol } from '@/lib/qr';
import { toast } from 'sonner';
import type { EscrowStatus } from '@/types';

interface EscrowCaseData {
  id: string;
  caseNumber: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  listingTitle: string;
  listingId?: string;
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
  paymentAdminNotes?: string;
  sellerItemPhotos: string[];
  sellerPackagingPhotos: string[];
  sellerPackagingVideo?: string;
  sellerReadinessConfirmed: boolean;
  sellerEvidenceSubmittedAt?: string;
  sellerEvidenceStatus: string;
  courierName?: string;
  trackingNumber?: string;
  pickupDate?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryStatus?: string;
  deliveryNotes?: string;
  disputeStatus?: string;
  disputeReason?: string;
  disputeDescription?: string;
  disputeOutcome?: string;
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

interface PaymentAddress {
  id: string;
  cryptoAddress: string;
  cryptoNetwork: string;
  instructions: string;
  qrCodeUrl?: string;
}

const NETWORK_ICONS: Record<string, string> = {
  'USDT-TRC20': '₮', 'USDT-ERC20': '₮', 'BTC': '₿', 'ETH': 'Ξ', 'USDC-ERC20': '$', 'BNB-BEP20': '♦', 'SOL': '◎'
};

export default function EscrowCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [escrowCase, setEscrowCase] = useState<EscrowCaseData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [paymentAddress, setPaymentAddress] = useState<PaymentAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Payment submission form
  const [paymentForm, setPaymentForm] = useState({ txHash: '', amountSent: '', method: 'crypto' });
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Seller evidence form
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [itemPhotos, setItemPhotos] = useState<File[]>([]);
  const [packagingPhotos, setPackagingPhotos] = useState<File[]>([]);
  const [packagingVideoFile, setPackagingVideoFile] = useState<File | null>(null);
  const [readinessConfirmed, setReadinessConfirmed] = useState(false);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<'item' | 'packaging' | 'video'>('item');

  // Dispute form
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('item_not_received');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState<File[]>([]);
  const disputeFileRef = useRef<HTMLInputElement>(null);

  const fetchCase = async () => {
    if (!id || !user) return;

    try {
      const data = await escrow.get(id);

      setEscrowCase(data);

      // Fetch timeline
      try {
        const tl = await escrow.timeline(id);
        setTimeline((tl || []).map((t: any) => ({
          id: t.id, status: t.status, label: t.label, timestamp: t.timestamp || t.createdAt,
          actorName: t.actorName || t.actor_name, actorRole: t.actorRole || t.actor_role, notes: t.notes,
        })));
      } catch {
        setTimeline([]);
      }

      // Set payment address from the case data
      if (data.paymentAddress) {
        setPaymentAddress({
          id: '',
          cryptoAddress: data.paymentAddress,
          cryptoNetwork: data.paymentNetwork || '',
          instructions: data.paymentAdminNotes || '',
          qrCodeUrl: undefined,
        });
      }
    } catch {
      toast.error('Case not found');
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    fetchCase().finally(() => setLoading(false));
  }, [id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate QR code dynamically when payment address is available
  useEffect(() => {
    if (paymentAddress?.cryptoAddress) {
      generateQR(paymentAddress.cryptoAddress).then(setQrDataUrl);
    } else {
      setQrDataUrl(null);
    }
  }, [paymentAddress?.cryptoAddress]);

  const copyAddress = () => {
    if (paymentAddress) {
      navigator.clipboard.writeText(paymentAddress.cryptoAddress);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentForm.txHash.trim()) { toast.error('Transaction hash/reference is required'); return; }
    if (!paymentForm.amountSent || Number(paymentForm.amountSent) <= 0) { toast.error('Enter the amount you sent'); return; }
    setSaving(true);

    let proofUrl: string | null = null;
    if (paymentProofFile) {
      try {
        const result = await storage.upload(paymentProofFile);
        proofUrl = result.url;
      } catch {}
    }

    try {
      await escrow.update(id!, {
        status: 'payment_submitted',
        payment_address: paymentAddress?.cryptoAddress,
        payment_network: paymentAddress?.cryptoNetwork,
        payment_method: paymentForm.method,
        payment_reference: paymentForm.txHash.trim(),
        payment_amount_sent: Number(paymentForm.amountSent),
        payment_proof_url: proofUrl,
        payment_submitted_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error('Failed to submit payment: ' + (err.message || 'Unknown error'));
      setSaving(false);
      return;
    }

    try {
      await escrow.addTimeline({
        caseId: id, status: 'payment_submitted', label: 'Payment Proof Submitted by Buyer',
        actorName: user!.username || 'Buyer', actorRole: 'buyer',
        notes: `Tx: ${paymentForm.txHash.trim()} — ${formatCurrency(Number(paymentForm.amountSent), escrowCase!.currency)}`,
      });
    } catch {}

    toast.success('Payment proof submitted! Awaiting admin verification.');
    setShowPaymentForm(false);
    await fetchCase();
    setSaving(false);
  };

  const uploadEvidenceFiles = async (files: File[], _folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      try {
        const result = await storage.upload(file);
        urls.push(result.url);
      } catch {}
    }
    return urls;
  };

  const handleSubmitEvidence = async () => {
    if (itemPhotos.length === 0) { toast.error('At least 1 item photo is required'); return; }
    setEvidenceUploading(true);

    const [itemUrls, packagingUrls] = await Promise.all([
      uploadEvidenceFiles(itemPhotos, 'item'),
      uploadEvidenceFiles(packagingPhotos, 'packaging'),
    ]);

    let videoUrl: string | undefined;
    if (packagingVideoFile) {
      try {
        const result = await storage.upload(packagingVideoFile);
        videoUrl = result.url;
      } catch {}
    }

    try {
      await escrow.update(id!, {
        status: 'packaging_submitted',
        seller_item_photos: itemUrls,
        seller_packaging_photos: packagingUrls,
        seller_packaging_video: videoUrl || null,
        seller_readiness_confirmed: readinessConfirmed,
        seller_evidence_submitted_at: new Date().toISOString(),
        seller_evidence_status: 'pending',
      });
    } catch (err: any) {
      toast.error('Failed to submit evidence: ' + (err.message || 'Unknown error'));
      setEvidenceUploading(false);
      return;
    }

    try {
      await escrow.addTimeline({
        caseId: id, status: 'packaging_submitted', label: 'Seller Submitted Item & Packaging Evidence',
        actorName: user!.username || 'Seller', actorRole: 'seller',
        notes: `${itemUrls.length} item photos, ${packagingUrls.length} packaging photos${videoUrl ? ', 1 video' : ''}`,
      });
    } catch {}

    toast.success('Evidence submitted successfully! Awaiting admin approval.');
    setShowEvidenceForm(false);
    await fetchCase();
    setEvidenceUploading(false);
  };

  const handleConfirmReceipt = async () => {
    try {
      await escrow.update(id!, {
        status: 'buyer_confirmed',
        buyer_confirmed_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error('Failed to confirm: ' + (err.message || 'Unknown error'));
      return;
    }

    try {
      await escrow.addTimeline({
        caseId: id, status: 'buyer_confirmed', label: 'Buyer Confirmed Receipt of Item',
        actorName: user!.username || 'Buyer', actorRole: 'buyer',
      });
    } catch {}

    toast.success('Receipt confirmed! Admin will release funds to the seller.');
    await fetchCase();
  };

  const handleOpenDispute = async () => {
    if (!disputeDesc.trim()) { toast.error('Please describe the issue in detail'); return; }
    setSaving(true);

    try {
      await escrow.update(id!, {
        status: 'disputed',
        dispute_reason: disputeReason,
        dispute_description: disputeDesc,
        dispute_status: 'open',
      });
    } catch (err: any) {
      toast.error('Failed to open dispute: ' + (err.message || 'Unknown error'));
      setSaving(false);
      return;
    }

    // Upload evidence files if any
    for (const file of disputeEvidenceFiles) {
      try {
        const result = await storage.upload(file);
        // Store dispute evidence via the case notes for now
        if (result.url) {
          // Upload succeeded — the file is accessible
          console.log('Dispute evidence uploaded:', result.url);
        }
      } catch {}
    }

    try {
      await escrow.addTimeline({
        caseId: id, status: 'disputed', label: 'Dispute Opened',
        actorName: user!.username || 'User',
        actorRole: escrowCase!.buyerId === user!.id ? 'buyer' : 'seller',
        notes: `Reason: ${DISPUTE_REASONS[disputeReason as keyof typeof DISPUTE_REASONS]}${disputeEvidenceFiles.length > 0 ? ` · ${disputeEvidenceFiles.length} evidence file(s) uploaded` : ''}`,
      });
    } catch {}

    toast.success('Dispute submitted. Admin will review within 24 hours.');
    setShowDisputeForm(false);
    setDisputeEvidenceFiles([]);
    await fetchCase();
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <Navbar />
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
      </div>
    </div>
  );

  if (!escrowCase || !user) return null;

  const isBuyer = escrowCase.buyerId === user.id;
  const isSeller = escrowCase.sellerId === user.id;
  const isAdmin = user.role === 'admin';
  const canSubmitPayment = isBuyer && escrowCase.status === 'awaiting_payment' && !escrowCase.paymentSubmittedAt;
  const canSubmitEvidence = isSeller && ['seller_notified', 'item_ready'].includes(escrowCase.status);
  const canConfirmReceipt = isBuyer && escrowCase.status === 'delivered';
  const canOpenDispute = (isBuyer || isSeller) && ['in_transit', 'delivered', 'packaging_approved'].includes(escrowCase.status) && escrowCase.status !== 'disputed';
  const currentStep = Object.keys(ESCROW_STATUS_CONFIG).indexOf(escrowCase.status);

  return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground font-semibold">{escrowCase.caseNumber}</span>
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', ESCROW_STATUS_CONFIG[escrowCase.status]?.bg, ESCROW_STATUS_CONFIG[escrowCase.status]?.color)}>
                {ESCROW_STATUS_CONFIG[escrowCase.status]?.label || escrowCase.status}
              </span>
              {isBuyer && <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">You're the Buyer</span>}
              {isSeller && <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">You're the Seller</span>}
            </div>
            <h1 className="font-heading text-xl font-bold text-foreground">{escrowCase.listingTitle}</h1>
            <p className="text-muted-foreground text-sm mt-1">Created {formatDateTime(escrowCase.createdAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-heading text-[hsl(var(--brand-navy))]">{formatCurrency(escrowCase.amount, escrowCase.currency)}</p>
            <p className="text-xs text-muted-foreground">+ {formatCurrency(escrowCase.fees, escrowCase.currency)} platform fee</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* Parties */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" /> Transaction Parties
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className={cn('p-4 rounded-xl border', isBuyer ? 'bg-blue-50 border-blue-200' : 'bg-blue-50/50 border-blue-100')}>
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1.5">Buyer {isBuyer && '(You)'}</p>
                  <p className="font-bold text-sm">{escrowCase.buyerName}</p>
                </div>
                <div className={cn('p-4 rounded-xl border', isSeller ? 'bg-amber-50 border-amber-200' : 'bg-amber-50/50 border-amber-100')}>
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Seller {isSeller && '(You)'}</p>
                  <p className="font-bold text-sm">{escrowCase.sellerName}</p>
                </div>
              </div>
            </div>

            {/* ─── PAYMENT SECTION ─── */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <h2 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" /> Payment
                </h2>
                {escrowCase.paymentVerifiedAt && (
                  <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ Verified</span>
                )}
              </div>
              <div className="p-5 space-y-4">
                {/* Crypto Payment Address */}
                {isBuyer && paymentAddress && !escrowCase.paymentVerifiedAt && (
                  <div className="rounded-2xl border-2 border-[hsl(var(--brand-navy))]/20 bg-gradient-to-br from-[hsl(var(--brand-navy))]/3 to-transparent p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-[hsl(var(--brand-navy))] flex items-center justify-center text-white font-bold text-sm">
                        {NETWORK_ICONS[paymentAddress.cryptoNetwork] || '₮'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Send Payment To</p>
                        <p className="text-xs text-muted-foreground">{paymentAddress.cryptoNetwork}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 mb-4">
                      {(paymentAddress.qrCodeUrl || qrDataUrl) && (
                        <img src={qrDataUrl || paymentAddress.qrCodeUrl} alt="QR" className="w-24 h-24 rounded-xl border border-border bg-white p-1 flex-shrink-0" />
                      )}
                      {!paymentAddress.qrCodeUrl && !qrDataUrl && paymentAddress.cryptoAddress && (
                        <div className="w-24 h-24 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Wallet Address</p>
                        <div className="flex items-center gap-2 bg-white border-2 border-border rounded-xl px-3 py-2.5">
                          <code className="text-xs font-mono flex-1 break-all text-foreground">{paymentAddress.cryptoAddress}</code>
                          <button onClick={copyAddress} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1">
                            {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="p-3 bg-white rounded-xl border border-border">
                        <p className="text-[11px] text-muted-foreground">Amount to Send</p>
                        <p className="font-bold text-[hsl(var(--brand-navy))]">{formatCurrency(escrowCase.amount + escrowCase.fees, escrowCase.currency)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-border">
                        <p className="text-[11px] text-muted-foreground">Network</p>
                        <p className="font-bold">{paymentAddress.cryptoNetwork}</p>
                      </div>
                    </div>

                    {paymentAddress.instructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed mb-4">
                        ⚠️ {paymentAddress.instructions}
                      </div>
                    )}

                    {canSubmitPayment && !showPaymentForm && (
                      <Button onClick={() => setShowPaymentForm(true)} className="w-full navy-gradient text-white border-0 hover:opacity-90">
                        <Send className="w-4 h-4 mr-2" /> I've Sent the Payment
                      </Button>
                    )}
                  </div>
                )}

                {/* Payment Submission Form */}
                {showPaymentForm && canSubmitPayment && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <h3 className="font-semibold text-sm">Confirm Your Payment</h3>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Transaction Hash / Reference <span className="text-red-500">*</span></label>
                      <input value={paymentForm.txHash} onChange={e => setPaymentForm(p => ({ ...p, txHash: e.target.value }))}
                        placeholder="e.g. 0x1a2b3c4d... or payment reference"
                        className="w-full px-3 py-2.5 text-sm font-mono border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Amount You Sent <span className="text-red-500">*</span></label>
                      <input type="number" value={paymentForm.amountSent} onChange={e => setPaymentForm(p => ({ ...p, amountSent: e.target.value }))}
                        placeholder={String(escrowCase.amount + escrowCase.fees)}
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Upload Proof (screenshot / receipt)</label>
                      <div className="flex items-center gap-2">
                        <input type="file" accept="image/*,.pdf" onChange={e => setPaymentProofFile(e.target.files?.[0] || null)} className="hidden" ref={fileInputRef} />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs">
                          <Upload className="w-3.5 h-3.5 mr-1.5" /> {paymentProofFile ? paymentProofFile.name : 'Choose file'}
                        </Button>
                        {paymentProofFile && <button onClick={() => setPaymentProofFile(null)} className="text-muted-foreground hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSubmitPayment} disabled={saving} className="flex-1 navy-gradient text-white border-0 hover:opacity-90">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Submit Payment Proof
                      </Button>
                      <Button variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Payment submitted — awaiting review */}
                {escrowCase.paymentSubmittedAt && !escrowCase.paymentVerifiedAt && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Payment Submitted — Awaiting Verification</p>
                      <p className="text-xs text-amber-700 mt-0.5">Submitted {formatDateTime(escrowCase.paymentSubmittedAt)} · Tx: {escrowCase.paymentReference}</p>
                    </div>
                  </div>
                )}

                {/* Payment verified */}
                {escrowCase.paymentVerifiedAt && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Payment Verified by Administrator</p>
                      <p className="text-xs text-emerald-700 mt-0.5">{formatDateTime(escrowCase.paymentVerifiedAt)}</p>
                      {escrowCase.paymentAdminNotes && <p className="text-xs text-emerald-600 mt-1 italic">"{escrowCase.paymentAdminNotes}"</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── SELLER EVIDENCE SECTION ─── */}
            {(isSeller || escrowCase.sellerEvidenceSubmittedAt || escrowCase.sellerItemPhotos.length > 0) && (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <h2 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" /> Seller Item & Packaging Evidence
                  </h2>
                  {escrowCase.sellerEvidenceStatus === 'approved' && (
                    <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ Approved</span>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  {canSubmitEvidence && !showEvidenceForm && !escrowCase.sellerEvidenceSubmittedAt && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-sm font-semibold text-blue-800 mb-1">Action Required</p>
                      <p className="text-xs text-blue-700 mb-3 leading-relaxed">
                        The buyer's payment has been verified. Please upload photos of the item, packaging photos, and optionally a packaging video.
                      </p>
                      <Button onClick={() => setShowEvidenceForm(true)} className="navy-gradient text-white border-0 hover:opacity-90 text-sm">
                        <Camera className="w-4 h-4 mr-2" /> Submit Evidence
                      </Button>
                    </div>
                  )}

                  {showEvidenceForm && (
                    <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
                      <h3 className="font-semibold text-sm">Upload Evidence</h3>
                      <div className="flex gap-1 border-b border-border pb-3">
                        {(['item', 'packaging', 'video'] as const).map(tab => (
                          <button key={tab} onClick={() => setActiveEvidenceTab(tab)}
                            className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                              activeEvidenceTab === tab ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
                            {tab === 'item' ? `📷 Item Photos (${itemPhotos.length})` : tab === 'packaging' ? `📦 Packaging (${packagingPhotos.length})` : `🎥 Video`}
                          </button>
                        ))}
                      </div>

                      {activeEvidenceTab === 'item' && (
                        <FileUploadArea
                          files={itemPhotos} accept="image/*"
                          label="Item Photos (min. 1 required)"
                          onAdd={files => setItemPhotos(prev => [...prev, ...files].slice(0, 10))}
                          onRemove={idx => setItemPhotos(prev => prev.filter((_, i) => i !== idx))}
                        />
                      )}
                      {activeEvidenceTab === 'packaging' && (
                        <FileUploadArea
                          files={packagingPhotos} accept="image/*"
                          label="Packaging Photos"
                          onAdd={files => setPackagingPhotos(prev => [...prev, ...files].slice(0, 10))}
                          onRemove={idx => setPackagingPhotos(prev => prev.filter((_, i) => i !== idx))}
                        />
                      )}
                      {activeEvidenceTab === 'video' && (
                        <div>
                          <label className="block text-xs font-medium mb-2">Packaging Video (optional)</label>
                          {packagingVideoFile ? (
                            <div className="flex items-center gap-2 p-3 bg-white border border-border rounded-xl">
                              <Video className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs flex-1 truncate">{packagingVideoFile.name}</span>
                              <button onClick={() => setPackagingVideoFile(null)} className="text-muted-foreground hover:text-red-500">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="block">
                              <input type="file" accept="video/*" onChange={e => setPackagingVideoFile(e.target.files?.[0] || null)} className="hidden" />
                              <div className="border-2 border-dashed border-muted rounded-xl p-6 text-center cursor-pointer hover:border-[hsl(var(--brand-navy))]/50 transition-colors">
                                <Video className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">Click to upload packaging video</p>
                              </div>
                            </label>
                          )}
                        </div>
                      )}

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={readinessConfirmed} onChange={e => setReadinessConfirmed(e.target.checked)}
                          className="rounded accent-[hsl(var(--brand-navy))]" />
                        <span className="text-xs text-foreground">I confirm the item is accurately represented and ready for dispatch</span>
                      </label>

                      <div className="flex gap-2">
                        <Button onClick={handleSubmitEvidence} disabled={evidenceUploading || itemPhotos.length === 0}
                          className="flex-1 navy-gradient text-white border-0 hover:opacity-90">
                          {evidenceUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                          {evidenceUploading ? 'Uploading...' : 'Submit Evidence'}
                        </Button>
                        <Button variant="outline" onClick={() => setShowEvidenceForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {escrowCase.sellerItemPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Item Photos ({escrowCase.sellerItemPhotos.length})</p>
                      <div className="grid grid-cols-4 gap-2">
                        {escrowCase.sellerItemPhotos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="aspect-square rounded-xl overflow-hidden border border-border">
                            <img src={url} alt={`Item ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {escrowCase.sellerPackagingPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Packaging Photos ({escrowCase.sellerPackagingPhotos.length})</p>
                      <div className="grid grid-cols-4 gap-2">
                        {escrowCase.sellerPackagingPhotos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="aspect-square rounded-xl overflow-hidden border border-border">
                            <img src={url} alt={`Packaging ${i + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── DELIVERY ─── */}
            {escrowCase.courierName && (
              <div className="bg-white rounded-xl border border-border p-5">
                <h2 className="font-heading font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground" /> Delivery Information
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Courier', value: escrowCase.courierName },
                    { label: 'Tracking Number', value: escrowCase.trackingNumber || '—' },
                    { label: 'Pickup Date', value: escrowCase.pickupDate ? formatDate(escrowCase.pickupDate) : '—' },
                    { label: 'Est. Delivery', value: escrowCase.estimatedDeliveryDate ? formatDate(escrowCase.estimatedDeliveryDate) : '—' },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-xl bg-muted/50">
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      <p className={cn('text-xs font-medium mt-0.5', item.label === 'Tracking Number' && 'font-mono')}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold',
                    escrowCase.deliveryStatus === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>
                    {escrowCase.deliveryStatus?.replace(/_/g, ' ') || 'pending'}
                  </span>
                  {escrowCase.trackingNumber && (
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> Track Package
                    </Button>
                  )}
                </div>
                {escrowCase.deliveryNotes && (
                  <p className="mt-3 text-xs text-muted-foreground italic border-t border-border pt-3">{escrowCase.deliveryNotes}</p>
                )}
              </div>
            )}

            {/* ─── BUYER CONFIRM RECEIPT ─── */}
            {canConfirmReceipt && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
                <h3 className="font-heading font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Confirm Receipt
                </h3>
                <p className="text-sm text-emerald-700 mb-4 leading-relaxed">
                  Have you received your item and are you satisfied? Confirming allows the administrator to release funds to the seller.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleConfirmReceipt} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                    <CheckCircle className="w-4 h-4 mr-2" /> Confirm & Approve Release
                  </Button>
                  {!showDisputeForm && (
                    <Button variant="outline" onClick={() => setShowDisputeForm(true)} className="border-red-300 text-red-600 hover:bg-red-50">
                      Open Dispute Instead
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ─── DISPUTE ─── */}
            {escrowCase.disputeStatus && (
              <div className="bg-white rounded-xl border border-red-200 p-5">
                <h2 className="font-heading font-semibold text-sm text-red-700 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Dispute
                  <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{escrowCase.disputeStatus}</span>
                </h2>
                {escrowCase.disputeReason && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Reason: <span className="font-medium">{DISPUTE_REASONS[escrowCase.disputeReason as keyof typeof DISPUTE_REASONS]}</span>
                  </p>
                )}
                {escrowCase.disputeDescription && (
                  <p className="text-sm text-foreground bg-red-50 rounded-xl p-3 leading-relaxed">{escrowCase.disputeDescription}</p>
                )}
                {escrowCase.disputeOutcome && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                    <span className="font-semibold">Resolved: </span>{escrowCase.disputeOutcome.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            )}

            {canOpenDispute && !showDisputeForm && !escrowCase.disputeStatus && (
              <button onClick={() => setShowDisputeForm(true)}
                className="w-full p-4 rounded-xl border-2 border-dashed border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Open a Dispute
              </button>
            )}

            {showDisputeForm && (
              <div className="bg-white rounded-xl border border-red-200 p-5 space-y-4">
                <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Open Dispute
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Reason</label>
                  <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                    {Object.entries(DISPUTE_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Describe the Issue</label>
                  <textarea value={disputeDesc} onChange={e => setDisputeDesc(e.target.value)} rows={4}
                    placeholder="Provide detailed description..."
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
                </div>
                {/* Evidence Upload */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Upload Evidence (images, videos, documents)</label>
                  <input
                    type="file"
                    ref={disputeFileRef}
                    multiple
                    accept="image/*,video/mp4,video/quicktime,application/pdf,.doc,.docx"
                    onChange={e => setDisputeEvidenceFiles(prev => [...prev, ...Array.from(e.target.files || [])].slice(0, 10))}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2 mb-2">
                    {disputeEvidenceFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-lg text-xs">
                        {f.type.startsWith('image') ? <ImageIcon className="w-3 h-3 text-blue-500" /> : f.type.startsWith('video') ? <Video className="w-3 h-3 text-purple-500" /> : <FileText className="w-3 h-3 text-amber-500" />}
                        <span className="truncate max-w-[100px]">{f.name}</span>
                        <button onClick={() => setDisputeEvidenceFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3 text-muted-foreground hover:text-red-500" /></button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => disputeFileRef.current?.click()} className="text-xs">
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Add Files
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleOpenDispute} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white border-0 flex-1">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Submit Dispute
                  </Button>
                  <Button variant="outline" onClick={() => setShowDisputeForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {isAdmin && (
              <Link to={`/admin/escrow/${id}`}>
                <Button className="w-full navy-gradient text-white border-0 hover:opacity-90">
                  Manage in Admin Panel <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>

          {/* Right: Timeline */}
          <div>
            <div className="bg-white rounded-xl border border-border p-5 sticky top-24">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Transaction Timeline
              </h2>
              {timeline.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="w-7 h-7 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No events yet</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, idx) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          idx === timeline.length - 1 ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))]' : 'border-emerald-400 bg-emerald-400')}>
                          <CheckCircle className="w-2.5 h-2.5 text-white" />
                        </div>
                        {idx < timeline.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[16px] my-0.5" />}
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight">{event.label}</p>
                        {event.notes && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{event.notes}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDateTime(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileUploadArea({ files, accept, label, onAdd, onRemove }: {
  files: File[]; accept: string; label: string;
  onAdd: (files: File[]) => void; onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-2">{label}</label>
      <label className="block cursor-pointer">
        <input type="file" accept={accept} multiple onChange={e => onAdd(Array.from(e.target.files || []))} className="hidden" />
        <div className="border-2 border-dashed border-muted rounded-xl p-4 text-center hover:border-[hsl(var(--brand-navy))]/50 transition-colors">
          <Upload className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Click to add photos</p>
        </div>
      </label>
      {files.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mt-2">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
