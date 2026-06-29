import { useState, useEffect } from 'react';
import {
  TrendingUp, ShieldCheck, Users, ArrowRight, Star, ChevronRight,
  Lock, Zap, Eye, BadgeCheck, Package, CheckCircle2, Clock,
  Banknote, Truck, MessageSquare, Award, Activity,
  UserPlus, Search, FileCheck, Send, Camera, MapPin, ThumbsUp, Wallet,
  Bell, Image, CheckSquare, Coins, CircleDollarSign } from
'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import ListingCard from '@/components/features/ListingCard';
import { LiquidGlassBackground, GlassCard, GlassPill, GlassButton } from '@/components/features/LiquidGlass';
import type { Listing, Category } from '@/types';

const BUYER_STEPS = [
{ step: 1, title: 'Create & Verify Account', description: 'Sign up with your email, verify with OTP, and set your password. Your identity is secured from the start.', icon: UserPlus },
{ step: 2, title: 'Browse Listings', description: 'Explore curated, admin-approved listings across Electronics, Luxury Watches, Jewelry, Vehicles, and more.', icon: Search },
{ step: 3, title: 'Initiate Escrow Case', description: 'Click "Buy with Escrow" on any listing. A case is created with a unique ID (e.g. ESC-2024-A7XB), locking in the terms.', icon: FileCheck },
{ step: 4, title: 'Send Crypto Payment', description: 'You receive the admin\'s crypto address. Send the exact amount in BTC, USDT (TRC20), or USDC (ERC20) — plus the 3% escrow fee.', icon: Coins },
{ step: 5, title: 'Admin Verifies Funds', description: 'Our team manually confirms your transaction on the blockchain. This typically takes under 30 minutes after network confirmation.', icon: ShieldCheck },
{ step: 6, title: 'Seller Ships Item', description: 'Once payment is verified, the seller is notified to package and ship. Admin reviews photo and video evidence before approving dispatch.', icon: Truck },
{ step: 7, title: 'Receive Your Item', description: 'You receive the item. Inspect it carefully — you have a review window to confirm everything is as described.', icon: Package },
{ step: 8, title: 'Confirm & Release Funds', description: 'Once satisfied, confirm receipt on your dashboard. Funds are immediately released to the seller. Done!', icon: ThumbsUp }];


const SELLER_STEPS = [
{ step: 1, title: 'Receive Escrow Notification', description: 'You get notified instantly when a buyer opens an escrow case for your listing. Review the case details on your dashboard.', icon: Bell },
{ step: 2, title: 'Await Payment Confirmation', description: 'Admin monitors the blockchain for the buyer\'s crypto payment. You\'ll be updated the moment funds are verified and secured in escrow.', icon: Clock },
{ step: 3, title: 'Photograph Your Item', description: 'Once payment is confirmed, take high-quality photos of the item — all angles, any defects, serial numbers. Upload them as evidence.', icon: Camera },
{ step: 4, title: 'Package & Record Video', description: 'Package the item securely. Record a short video showing the item being sealed. This protects you from false damage claims.', icon: Image },
{ step: 5, title: 'Admin Approves Evidence', description: 'Our team reviews your packaging evidence. If everything checks out, you\'ll receive approval to proceed with shipping.', icon: CheckSquare },
{ step: 6, title: 'Ship with Tracking', description: 'Use a reliable courier (DHL, FedEx, UPS). Enter the tracking number in your escrow case. Admin monitors the shipment status.', icon: MapPin },
{ step: 7, title: 'Buyer Confirms Receipt', description: 'Once the buyer confirms they received the item in good condition, funds are released from escrow directly to your wallet.', icon: CheckCircle2 },
{ step: 8, title: 'Withdraw Your Earnings', description: 'Funds appear in your SafeEscrow wallet. Withdraw to your preferred crypto address — BTC, USDT, or USDC — at any time.', icon: Wallet }];


const CRYPTO_METHODS = [
{
  symbol: 'BTC',
  name: 'Bitcoin',
  network: 'Bitcoin Network',
  color: '#F7931A',
  bgColor: 'rgba(247,147,26,0.12)',
  borderColor: 'rgba(247,147,26,0.30)',
  minDeposit: '0.001 BTC',
  confirmations: '3 confirmations (~30 min)',
  note: 'Best for large transactions. Highest security.',
  emoji: '₿'
},
{
  symbol: 'USDT',
  name: 'Tether',
  network: 'USDT-TRC20 (Tron)',
  color: '#26A17B',
  bgColor: 'rgba(38,161,123,0.12)',
  borderColor: 'rgba(38,161,123,0.30)',
  minDeposit: '10 USDT',
  confirmations: '20 confirmations (~2 min)',
  note: 'Fastest and lowest fees. Most popular.',
  emoji: '₮'
},
{
  symbol: 'USDC',
  name: 'USD Coin',
  network: 'USDC-ERC20 (Ethereum)',
  color: '#2775CA',
  bgColor: 'rgba(39,117,202,0.12)',
  borderColor: 'rgba(39,117,202,0.30)',
  minDeposit: '10 USDC',
  confirmations: '12 confirmations (~3 min)',
  note: 'Fully regulated stablecoin. USDC = 1 USD.',
  emoji: '$'
}];


// Live escrow case preview — mock data for the hero card
const LIVE_STEPS = [
{ label: 'Payment Verified', done: true, icon: CheckCircle2 },
{ label: 'Seller Packaging', done: true, icon: Package },
{ label: 'Admin Approved', done: true, icon: BadgeCheck },
{ label: 'Item Dispatched', done: true, icon: Truck },
{ label: 'Buyer Confirmation', done: true, icon: CheckCircle2 }];


const TRUST_BADGES = [
{ icon: Lock, label: 'End-to-End Escrow', sub: 'Every step verified' },
{ icon: BadgeCheck, label: 'Identity Verified', sub: 'All sellers screened' },
{ icon: Award, label: 'Dispute Protection', sub: '100% buyer guarantee' },
{ icon: Activity, label: 'Live Admin Oversight', sub: 'Real-time monitoring' }];


const RECENT_ACTIVITY: { user: string; action: string; item: string; amount: string; time: string; }[] = [];


function EscrowInstructions() {
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');
  const steps = activeTab === 'buyer' ? BUYER_STEPS : SELLER_STEPS;

  return (
    <section className="relative py-20 overflow-hidden" style={{ background: 'rgba(255,248,210,0.42)' }}>
      <LiquidGlassBackground />
      <div className="absolute top-0 inset-x-0 h-24 z-10" style={{ background: 'linear-gradient(to bottom, #FFFDF5 0%, transparent 100%)' }} />
      <div className="absolute bottom-0 inset-x-0 h-24 z-10" style={{ background: 'linear-gradient(to top, #FFFDF5 0%, transparent 100%)' }} />

      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="text-center mb-12">
          <GlassPill className="mx-auto mb-4">
            <ShieldCheck className="w-3 h-3" style={{ color: '#C68C00' }} />
            <span style={{ color: '#8B6000', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Complete Guide</span>
          </GlassPill>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-3 text-center" style={{ color: '#1A1000' }}>How Escrow Works</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: '#7A5C20' }}>Every transaction is personally managed by our admin team. No funds move without verification.


          </p>
        </div>

        {/* Buyer / Seller Tab Toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex p-1.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(240,184,0,0.28)', backdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(180,130,0,0.10)' }}>
            {(['buyer', 'seller'] as const).map((tab) =>
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={activeTab === tab ?
              { background: 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(180,130,0,0.35)' } :
              { color: '#7A5C20' }
              }>

                {tab === 'buyer' ? <Banknote className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                {tab === 'buyer' ? 'I\'m Buying' : 'I\'m Selling'}
              </button>
            )}
          </div>
        </div>

        {/* Steps Grid — 4 per row, 2 rows of 4 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16 items-stretch">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="relative flex">
                {/* Connector arrow (desktop only, not after last in each row) */}
                {idx % 4 !== 3 && idx < steps.length - 1 &&
                <div className="hidden lg:flex absolute top-[22px] -right-3 z-10 items-center justify-center w-6 h-6">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(240,184,0,0.18)', border: '1px solid rgba(240,184,0,0.38)' }}>
                      <ArrowRight className="w-2.5 h-2.5" style={{ color: '#C68000' }} />
                    </div>
                  </div>
                }
                <div className="w-full rounded-2xl flex flex-col hover:-translate-y-1 transition-transform duration-300 cursor-default overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.78)',
                  border: activeTab === 'buyer' ? '1px solid rgba(240,184,0,0.28)' : '1px solid rgba(39,117,202,0.22)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 2px 16px rgba(180,130,0,0.07), inset 0 1px 0 rgba(255,255,255,0.90)'
                }}>
                  {/* Coloured top accent bar */}
                  <div className="h-0.5 w-full"
                  style={{ background: activeTab === 'buyer' ?
                    'linear-gradient(90deg, rgba(240,184,0,0.60), rgba(255,215,0,0.30))' :
                    'linear-gradient(90deg, rgba(39,117,202,0.55), rgba(38,161,123,0.30))' }} />

                  <div className="flex flex-col flex-1 p-4">
                    {/* Step badge + icon row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: activeTab === 'buyer' ?
                        'linear-gradient(135deg, rgba(240,184,0,0.22) 0%, rgba(255,215,0,0.14) 100%)' :
                        'linear-gradient(135deg, rgba(39,117,202,0.15) 0%, rgba(38,161,123,0.12) 100%)',
                        border: activeTab === 'buyer' ? '1px solid rgba(240,184,0,0.40)' : '1px solid rgba(39,117,202,0.32)'
                      }}>
                        <Icon className="w-4 h-4" style={{ color: activeTab === 'buyer' ? '#C68000' : '#2775CA' }} />
                      </div>
                      <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded-full"
                      style={{
                        background: activeTab === 'buyer' ? 'rgba(240,184,0,0.14)' : 'rgba(39,117,202,0.12)',
                        border: activeTab === 'buyer' ? '1px solid rgba(240,184,0,0.32)' : '1px solid rgba(39,117,202,0.26)',
                        color: activeTab === 'buyer' ? '#9A6000' : '#1A4A8A'
                      }}>0{step.step}</span>
                    </div>

                    {/* Title */}
                    <h3 className="font-heading font-bold text-[12px] leading-snug mb-2" style={{ color: '#1A1000' }}>
                      {step.title}
                    </h3>

                    {/* Description — line-clamp keeps all cards same height */}
                    <p className="text-[11px] leading-relaxed line-clamp-4" style={{ color: '#7A5C20', lineHeight: 1.65 }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>);
          })}
        </div>

        {/* Crypto Payment Section */}
        <div className="mb-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(to right, transparent, rgba(240,184,0,0.40))' }} />
              <GlassPill>
                <Coins className="w-3 h-3" style={{ color: '#B87000' }} />
                <span style={{ color: '#8B6000', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Accepted Payments</span>
              </GlassPill>
              <div className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(to left, transparent, rgba(240,184,0,0.40))' }} />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2" style={{ color: '#1A1000' }}>Supported Crypto Currencies</h3>
            <p className="text-sm" style={{ color: '#7A5C20' }}>All payments are verified on-chain by our admin team before funds are secured in escrow</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {CRYPTO_METHODS.map((crypto) =>
            <GlassCard key={crypto.symbol} tint="white" intensity="medium" className="overflow-hidden">
                {/* Header band */}
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${crypto.borderColor}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
                  style={{ background: crypto.bgColor, border: `1.5px solid ${crypto.borderColor}`, color: crypto.color }}>
                      {crypto.emoji}
                    </div>
                    <div>
                      <p className="text-base font-bold font-heading" style={{ color: '#1A1000' }}>{crypto.symbol}</p>
                      <p className="text-xs" style={{ color: '#9A7C40' }}>{crypto.name}</p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: crypto.bgColor, border: `1px solid ${crypto.borderColor}`, color: crypto.color }}>
                        LIVE
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-xl" style={{ background: crypto.bgColor, border: `1px solid ${crypto.borderColor}` }}>
                    <p className="text-[11px] font-semibold" style={{ color: crypto.color }}>{crypto.network}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#9A7C40' }}>Min. Deposit</span>
                    <span className="text-xs font-bold" style={{ color: '#1A1000' }}>{crypto.minDeposit}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs flex-shrink-0" style={{ color: '#9A7C40' }}>Confirmation</span>
                    <span className="text-xs font-medium text-right" style={{ color: '#1A1000' }}>{crypto.confirmations}</span>
                  </div>
                  <div className="pt-2" style={{ borderTop: '1px solid rgba(240,184,0,0.14)' }}>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#7A5C20' }}>{crypto.note}</p>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        {/* Important notice */}
        <div className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(240,184,0,0.28)', backdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(180,130,0,0.08)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(240,184,0,0.18)', border: '1px solid rgba(240,184,0,0.40)' }}>
            <Lock className="w-5 h-5" style={{ color: '#B87000' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold mb-1" style={{ color: '#1A1000' }}>Important: Always use the SafeEscrow payment address</p>
            <p className="text-xs leading-relaxed" style={{ color: '#7A5C20', lineHeight: 1.7 }}>
              Never send crypto directly to a seller. Payment addresses are generated per-transaction by our admin team and
              provided inside your escrow case. Funds sent outside the platform cannot be recovered. If in doubt,
              contact our support before sending.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
            {CRYPTO_METHODS.map((c) =>
            <div key={c.symbol} className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black"
              style={{ background: c.bgColor, border: `1px solid ${c.borderColor}`, color: c.color }}>{c.emoji}</div>
                <span className="text-[9px] font-bold" style={{ color: c.color }}>{c.symbol}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </section>);

}

export default function Index() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/featured-listings')
      .then(res => res.json())
      .then(data => {
        setFeaturedListings(data || []);
      })
      .catch(() => {})
      .finally(() => setFeaturedLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/categories?homepage=true')
      .then(res => res.json())
      .then(data => setCategories(data || []))
      .catch(() => {});
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  };

  const listingsWithFav = featuredListings.map((l) => ({ ...l, isFavorited: favorites.includes(l.id) }));

  return (
    <div className="min-h-screen" style={{ background: '#FFFDF5' }}>
      <Navbar />

      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden min-h-[600px] lg:min-h-[780px] flex items-center">
        <LiquidGlassBackground />

        {/* Bottom fade to cream */}
        <div className="absolute bottom-0 left-0 right-0 h-32 z-10"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, #FFFDF5 100%)' }} />

        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-12 xl:gap-16 items-center">

            {/* ── Left: Headline + CTAs ── */}
            <div>
              {/* Live badge */}
              <div className="flex items-center gap-3 mb-7">
                <GlassPill>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#16a34a' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#22c55e' }} />
                  </span>
                  <span style={{ color: '#166534', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Escrow Protection</span>
                </GlassPill>



              </div>

              {/* Main headline — 3 lines for max impact */}
              <h1 className="font-heading font-bold leading-[1.06] mb-5" style={{ color: '#1A1000' }}>
                <span className="block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]">The Marketplace</span>
                <span className="block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]">to Buy &amp; Sell</span>
                <span
                  className="block text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]"
                  style={{
                    background: 'linear-gradient(135deg, #B87000 0%, #E8A800 35%, #F0B800 55%, #C68000 80%, #9A5800 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>With Maximum Security


                </span>
              </h1>

              <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-[480px]" style={{ color: '#6B5020', lineHeight: 1.7 }}>Every transaction is personally overseen by our expert team, beginning with payment verification to ensure clear and secure business handling.

              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <GlassButton variant="secondary" onClick={() => navigate('/marketplace')}>
                  Explore Listings <ArrowRight className="w-4 h-4" />
                </GlassButton>
                <GlassButton variant="primary" onClick={() => navigate('/login')}>
                  Start for Free
                </GlassButton>
              </div>

              {/* Social proof row */}





















            </div>

            {/* ── Right: Live Escrow Preview Card ── */}
            <div className="hidden lg:block">
              <GlassCard tint="white" intensity="heavy" className="overflow-visible" border>
                {/* Card Header */}
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(240,184,0,0.18)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(240,184,0,0.20)', border: '1px solid rgba(240,184,0,0.40)' }}>
                        <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#B87000' }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#1A1000' }}>Escrow Transaction Process</p>
                        <p className="text-[10px]" style={{ color: '#9A7C40' }}>Quick Steps</p>
                      </div>
                    </div>





                  </div>

                  {/* Item info */}













                </div>

                {/* Timeline progress */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-4" style={{ color: '#B89A60' }}>Transaction Progress</p>
                  <div className="space-y-3">
                    {LIVE_STEPS.map((s, idx) => {
                      const Icon = s.icon;
                      const isActive = (s as any).active;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          {/* Connector line above */}
                          <div className="flex flex-col items-center">
                            {idx > 0 &&
                            <div className="w-px h-3 -mt-3 mb-0"
                            style={{ background: LIVE_STEPS[idx - 1].done ? 'rgba(22,163,74,0.45)' : 'rgba(200,180,140,0.30)' }} />
                            }
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={
                            s.done ?
                            { background: 'rgba(22,163,74,0.15)', border: '1.5px solid rgba(22,163,74,0.45)' } :
                            isActive ?
                            { background: 'rgba(240,184,0,0.20)', border: '1.5px solid rgba(240,184,0,0.55)', boxShadow: '0 0 8px rgba(240,184,0,0.25)' } :
                            { background: 'rgba(200,180,140,0.10)', border: '1px solid rgba(200,180,140,0.25)' }
                            }>
                              <Icon className="w-3.5 h-3.5"
                              style={{ color: s.done ? '#16a34a' : isActive ? '#C68000' : '#C8B48C' }} />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium"
                            style={{ color: s.done ? '#1A1000' : isActive ? '#8B5500' : '#C8B48C' }}>
                              {s.label}
                            </p>
                          </div>
                          {s.done &&
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.30)', color: '#16a34a' }}>
                              <CheckCircle2 className="w-2.5 h-2.5" /> Done
                            </span>
                          }
                          {isActive &&
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(240,184,0,0.18)', border: '1px solid rgba(240,184,0,0.50)', color: '#9A5800' }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#C68000' }} /> Next
                            </span>
                          }
                        </div>);

                    })}
                  </div>
                </div>

                {/* Parties */}
                <div className="px-5 pb-4 pt-1" style={{ borderTop: '1px solid rgba(240,184,0,0.14)' }}>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {[
                    { role: 'Buyer Secured 🔒', name: 'A. Thompson', avatar: 'photo-1507003211169-0a1dd7228f2d', icon: Banknote },
                    { role: 'Seller Verified ✅', name: 'M. Chen', avatar: 'photo-1472099645785-5658abf4ff4e', icon: Package }].
                    map((p, i) =>
                    <div key={p.role} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-center"
                    style={i === 0 ? { background: 'linear-gradient(135deg, rgba(240,184,0,0.14) 0%, rgba(255,215,0,0.08) 100%)', border: '1.5px solid rgba(240,184,0,0.35)', boxShadow: '0 2px 12px rgba(180,130,0,0.10)' } : { background: 'linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(16,185,129,0.08) 100%)', border: '1.5px solid rgba(22,163,74,0.32)', boxShadow: '0 2px 12px rgba(22,163,74,0.10)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={i === 0 ? { background: 'rgba(240,184,0,0.20)', border: '1px solid rgba(240,184,0,0.45)' } : { background: 'rgba(22,163,74,0.16)', border: '1px solid rgba(22,163,74,0.40)' }}>
                          <p.icon className="w-5 h-5" style={{ color: i === 0 ? '#B87000' : '#16a34a' }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-snug" style={{ color: i === 0 ? '#8B5500' : '#166534' }}>{p.role}</p>

                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin note */}
                <div className="mx-5 mb-5 px-3.5 py-2.5 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>

                  <p className="text-[11px] leading-relaxed" style={{ color: '#1e40af' }}>
                    <span className="font-semibold">Secure. Safe. Reliable:</span> All milestones and evidence are recorded for audit.
                  </p>
                </div>
              </GlassCard>

              {/* Floating activity strip below the card */}
              <div className="mt-3 px-1">
                {RECENT_ACTIVITY.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg mb-1"
                    style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(240,184,0,0.14)' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: '#4A3000' }}>{a.user}</span>
                      <span style={{ color: '#9A7C40' }}>{a.action}</span>
                      <span className="font-medium" style={{ color: '#6B5020' }}>{a.item}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold" style={{ color: '#C68000' }}>{a.amount}</span>
                      <span style={{ color: '#B89A60' }}>{a.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── Trust Badges Bar ─── */}
      <div className="relative" style={{ background: 'rgba(255,255,255,0.80)', borderTop: '1px solid rgba(240,184,0,0.18)', borderBottom: '1px solid rgba(240,184,0,0.18)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
            {TRUST_BADGES.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div key={b.label}
                className="flex items-center gap-2 sm:gap-3.5 py-4 sm:py-5 px-3 sm:px-6"
                style={{ borderRight: idx < TRUST_BADGES.length - 1 ? '1px solid rgba(240,184,0,0.14)' : 'none' }}>
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(240,184,0,0.14)', border: '1px solid rgba(240,184,0,0.30)' }}>
                    <Icon className="w-4 h-4" style={{ color: '#B87000' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1A1000' }}>{b.label}</p>
                    <p className="text-xs" style={{ color: '#9A7C40' }}>{b.sub}</p>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </div>

      {/* ─── Categories ─── */}
      <section className="py-20 overflow-hidden" style={{ background: 'linear-gradient(180deg, #FFFDF5 0%, rgba(255,248,220,0.50) 50%, #FFFDF5 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <GlassPill className="mb-4">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E8A800' }} />
                <span style={{ color: '#8B6000', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Curated Markets</span>
              </GlassPill>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold leading-tight" style={{ color: '#1A1000' }}>
                Browse by Category
              </h2>
              <p className="mt-2 text-sm" style={{ color: '#9A7C40' }}>Every listing is admin-verified before going live</p>
            </div>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 flex-shrink-0 group"
              style={{ background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(240,184,0,0.32)', color: '#B87000', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(180,130,0,0.10)' }}
              onMouseEnter={(e) => {(e.currentTarget as HTMLElement).style.background = 'rgba(255,248,210,0.96)';(e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,184,0,0.60)';}}
              onMouseLeave={(e) => {(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.80)';(e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,184,0,0.32)';}}>
              View All Listings <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Dynamic Category Cards */}
          {(() => {
            const topCategories = categories
              .filter(c => !c.parentId)
              .sort((a, b) => b.listingCount - a.listingCount)
              .slice(0, 4);

            if (topCategories.length === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: '#9A7C40' }}>No categories selected for the homepage yet</p>
                </div>
              );
            }

            const iconToEmoji: Record<string, string> = {
              Laptop: '💻', Watch: '⌚', Car: '🚗', Gem: '💎', Palette: '🎨',
              Trophy: '🏆', Music: '🎵', Building2: '🏢', Tag: '🏷️', Shirt: '👕',
              Shoe: '👟', Book: '📚', BookOpen: '📖', Phone: '📱', Camera: '📷',
              Headphones: '🎧', Gamepad: '🎮', Sparkles: '✨', Heart: '❤️',
              Star: '⭐', Zap: '⚡', Sun: '☀️', Moon: '🌙', Globe: '🌍',
              Home: '🏠', Wrench: '🔧'
            };

            const styleThemes = [
              {
                // Hero card (index 0) - dark amber/gold
                container: 'lg:row-span-2 min-h-[320px] lg:min-h-[480px]',
                bg: 'linear-gradient(145deg, #1A0E00 0%, #2E1A00 40%, #3D2500 70%, #1A0E00 100%)',
                border: 'rgba(240,184,0,0.28)',
                shadow: '0 8px 48px rgba(180,130,0,0.18)',
                textColor: '#FFFDF5',
                accentColor: '#F0C040',
                metaColor: 'rgba(255,253,245,0.55)',
                badgeBg: 'rgba(240,184,0,0.20)',
                badgeBorder: 'rgba(240,184,0,0.40)',
                badgeText: '#F0C040',
                iconBg: 'rgba(240,184,0,0.15)',
                iconBorder: 'rgba(240,184,0,0.35)',
                topLine: 'linear-gradient(90deg, transparent 0%, rgba(240,184,0,0.60) 50%, transparent 100%)',
                tagColor: 'rgba(240,184,0,0.70)',
              },
              {
                // Wide card (index 1) - blue
                container: 'lg:col-span-2 min-h-[180px] lg:min-h-[220px]',
                bg: 'linear-gradient(135deg, #F8FCFF 0%, #EAF3FF 50%, #D8EDFF 100%)',
                border: 'rgba(39,117,202,0.22)',
                shadow: '0 4px 32px rgba(39,117,202,0.10)',
                textColor: '#0D1E3A',
                accentColor: '#2775CA',
                metaColor: 'rgba(39,117,202,0.70)',
                badgeBg: 'rgba(39,117,202,0.12)',
                badgeBorder: 'rgba(39,117,202,0.25)',
                badgeText: '#2775CA',
                iconBg: 'rgba(39,117,202,0.12)',
                iconBorder: 'rgba(39,117,202,0.25)',
                topLine: 'linear-gradient(90deg, transparent, rgba(39,117,202,0.45), transparent)',
                tagColor: 'rgba(39,117,202,0.65)',
              },
              {
                // Regular card (index 2) - warm orange
                container: 'min-h-[180px] lg:min-h-[240px]',
                bg: 'linear-gradient(135deg, #FFF9F2 0%, #FFF0E0 50%, #FFE8CC 100%)',
                border: 'rgba(200,100,30,0.18)',
                shadow: '0 4px 28px rgba(200,100,30,0.08)',
                textColor: '#2A1200',
                accentColor: '#C06820',
                metaColor: 'rgba(140,70,20,0.70)',
                badgeBg: 'rgba(220,120,40,0.12)',
                badgeBorder: 'rgba(220,120,40,0.28)',
                badgeText: '#C06820',
                iconBg: 'rgba(220,120,40,0.12)',
                iconBorder: 'rgba(220,120,40,0.28)',
                topLine: 'linear-gradient(90deg, transparent, rgba(220,120,40,0.45), transparent)',
                tagColor: 'rgba(180,80,20,0.65)',
              },
              {
                // Regular card (index 3) - green
                container: 'min-h-[180px] lg:min-h-[240px]',
                bg: 'linear-gradient(135deg, #F2F8F0 0%, #E4F2E0 50%, #D6ECD2 100%)',
                border: 'rgba(34,130,40,0.18)',
                shadow: '0 4px 28px rgba(34,130,40,0.08)',
                textColor: '#0A2010',
                accentColor: '#1A8024',
                metaColor: 'rgba(20,100,28,0.70)',
                badgeBg: 'rgba(34,130,40,0.10)',
                badgeBorder: 'rgba(34,130,40,0.22)',
                badgeText: '#1A8024',
                iconBg: 'rgba(34,130,40,0.10)',
                iconBorder: 'rgba(34,130,40,0.22)',
                topLine: 'linear-gradient(90deg, transparent, rgba(34,130,40,0.40), transparent)',
                tagColor: 'rgba(20,100,28,0.65)',
              },
            ];

            return (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] grid-rows-[auto] gap-5">
                {topCategories.map((cat, idx) => {
                  const theme = styleThemes[idx];
                  const emoji = iconToEmoji[cat.icon] || '🏷️';
                  return (
                    <Link
                      key={cat.id}
                      to={`/marketplace?category=${cat.slug}`}
                      className={`group relative overflow-hidden rounded-3xl flex flex-col justify-end transition-all duration-500 ${theme.container}`}
                      style={{
                        background: theme.bg,
                        border: `1px solid ${theme.border}`,
                        boxShadow: `${theme.shadow}, inset 0 1px 0 rgba(255,255,255,${idx === 0 ? '0.06' : '0.95'})`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = idx === 0
                          ? '0 20px 64px rgba(180,130,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)'
                          : `0 16px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = `${theme.shadow}, inset 0 1px 0 rgba(255,255,255,${idx === 0 ? '0.06' : '0.95'})`;
                      }}
                    >
                      {/* Background image (if uploaded) */}
                      {cat.imageUrl && (
                        <>
                          <img src={cat.imageUrl} alt={cat.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            style={{ opacity: 0.30, mixBlendMode: 'luminosity' }} />
                          <div className="absolute inset-0" style={{
                            background: idx === 0
                              ? 'linear-gradient(to top, rgba(26,14,0,0.95) 0%, rgba(26,14,0,0.65) 40%, rgba(26,14,0,0.15) 100%)'
                              : 'linear-gradient(to top, rgba(255,253,245,0.92) 0%, rgba(255,253,245,0.55) 50%, rgba(255,253,245,0.10) 100%)',
                          }} />
                        </>
                      )}

                      {/* Top accent line */}
                      {idx === 0 && (
                        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: theme.topLine }} />
                      )}
                      {idx > 0 && (
                        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: theme.topLine }} />
                      )}

                      {/* Decorative radial glow for regular cards */}
                      {idx > 0 && (
                        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                          style={{ background: `radial-gradient(circle at top right, ${theme.accentColor}22 0%, transparent 70%)` }} />
                      )}

                      <div className="relative z-10 p-7" style={idx > 0 ? { padding: '1.5rem' } : {}}>
                        {idx === 0 ? (
                          <>
                            <div className="flex items-start justify-between mb-5">
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                                style={{ background: theme.iconBg, border: `1px solid ${theme.iconBorder}`, backdropFilter: 'blur(12px)' }}>{emoji}</div>
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`, color: theme.badgeText }}>FEATURED</span>
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: theme.tagColor }}>{cat.name}</p>
                            <h3 className="font-heading text-2xl font-bold mb-2 leading-tight" style={{ color: theme.textColor }}>{cat.name}</h3>
                            <p className="text-xs leading-relaxed mb-5" style={{ color: theme.metaColor }}>Admin-verified listings with escrow protection on every purchase.</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold" style={{ color: theme.accentColor }}>{cat.listingCount} listing{cat.listingCount !== 1 ? 's' : ''}</span>
                              <div className="flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 group-hover:gap-2.5" style={{ color: theme.accentColor }}>
                                Browse <ArrowRight className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-end justify-between" style={idx === 1 ? {} : {}}>
                            <div>
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                                style={{ background: theme.iconBg, border: `1px solid ${theme.iconBorder}` }}>{emoji}</div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: theme.tagColor }}>{cat.name}</p>
                              <h3 className="font-heading text-xl font-bold" style={{ color: theme.textColor }}>
                                {idx === 1 ? cat.name : cat.name}
                              </h3>
                              <p className="text-xs mt-1" style={{ color: theme.metaColor }}>{cat.listingCount} listing{cat.listingCount !== 1 ? 's' : ''}</p>
                            </div>
                            {idx === 1 ? (
                              <div className="text-right flex-shrink-0 ml-6">
                                <p className="text-2xl font-black font-heading" style={{ color: theme.accentColor }}>{cat.listingCount}+</p>
                                <p className="text-[11px]" style={{ color: theme.metaColor }}>active listing{cat.listingCount !== 1 ? 's' : ''}</p>
                                <div className="mt-3 flex items-center gap-1 text-xs font-semibold justify-end transition-all duration-200 group-hover:gap-2" style={{ color: theme.accentColor }}>
                                  Explore <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            ) : (
                              <ArrowRight className="w-5 h-5 mb-1 transition-transform duration-200 group-hover:translate-x-1" style={{ color: theme.accentColor }} />
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ─── Featured Listings ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold" style={{ color: '#1A1000' }}>Featured Listings</h2>

          </div>
          <Link to="/marketplace" className="flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: '#C68000' }}>
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`skel-${i}`} className="rounded-xl overflow-hidden animate-pulse"
                style={{ background: 'rgba(200,160,60,0.08)', border: '1px solid rgba(200,160,60,0.12)' }}>
                <div className="h-40" style={{ background: 'rgba(200,160,60,0.10)' }} />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded" style={{ background: 'rgba(200,160,60,0.12)' }} />
                  <div className="h-3 w-1/2 rounded" style={{ background: 'rgba(200,160,60,0.08)' }} />
                </div>
              </div>
            ))
          ) : listingsWithFav.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-sm" style={{ color: '#9A7C40' }}>No featured listings yet</p>
            </div>
          ) : (
            listingsWithFav.slice(0, 12).map((listing) =>
              <ListingCard key={listing.id} listing={listing} onFavorite={toggleFavorite} />
            )
          )}
        </div>
      </section>

      {/* ─── Escrow Instructions ─── */}
      <EscrowInstructions />

      {/* ─── Testimonial / Trust Amplifier ─── */}


































      {/* ─── CTA Section ─── */}

























      {/* ─── Footer ─── */}
      <footer style={{ borderTop: '1px solid rgba(240,184,0,0.18)', background: 'rgba(255,250,225,0.60)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(240,184,0,0.25)', border: '1px solid rgba(240,184,0,0.45)' }}>
                <ShieldCheck className="w-3 h-3" style={{ color: '#B87000' }} />
              </div>
              <span className="font-heading font-bold text-sm" style={{ color: '#4A3000' }}>Safe Buy Market</span>
            </div>
            <p className="text-xs" style={{ color: '#9A7C40' }}>© 2026 Safe Buy Market. Administrator-controlled escrow protection for every transaction.</p>
            <div className="flex gap-4 text-xs">
              {['Privacy', 'Terms', 'Support'].map((link) =>
              <a key={link} href="#" className="transition-colors" style={{ color: '#9A7C40' }}
              onMouseEnter={(e) => {(e.currentTarget as HTMLElement).style.color = '#C68000';}}
              onMouseLeave={(e) => {(e.currentTarget as HTMLElement).style.color = '#9A7C40';}}>
                  {link}
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>);

}