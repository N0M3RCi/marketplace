
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, TrendingUp,
  ShieldCheck, Plus, RefreshCw, DollarSign, Copy, Check,
  Banknote, Lock, CheckCircle2, AlertTriangle, Bitcoin, QrCode
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

interface WalletData {
  id: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'escrow_hold' | 'escrow_release' | 'refund' | 'fee' | 'payout';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  description: string;
  referenceId?: string;
  balanceAfter?: number;
  createdAt: string;
}

const TX_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; sign: '+' | '-' }> = {
  deposit: { label: 'Deposit', icon: ArrowDownLeft, color: 'text-emerald-600', sign: '+' },
  withdrawal: { label: 'Withdrawal', icon: ArrowUpRight, color: 'text-red-500', sign: '-' },
  escrow_hold: { label: 'Escrow Hold', icon: Lock, color: 'text-amber-600', sign: '-' },
  escrow_release: { label: 'Escrow Released', icon: CheckCircle2, color: 'text-emerald-600', sign: '+' },
  refund: { label: 'Refund', icon: ArrowDownLeft, color: 'text-blue-600', sign: '+' },
  fee: { label: 'Platform Fee', icon: DollarSign, color: 'text-slate-500', sign: '-' },
  payout: { label: 'Payout', icon: Banknote, color: 'text-emerald-600', sign: '+' },
};

interface CryptoAddress {
  currency: string;
  address: string;
  network: string;
  instructions: string;
}

const CRYPTO_ICONS: Record<string, { symbol: string; color: string; bg: string; desc: string }> = {
  BTC:  { symbol: '₿', color: '#F7931A', bg: 'rgba(247,147,26,0.15)',  desc: 'Bitcoin' },
  USDT: { symbol: '₮', color: '#26A17B', bg: 'rgba(38,161,123,0.15)', desc: 'Tether USD' },
  USDC: { symbol: '$', color: '#2775CA', bg: 'rgba(39,117,202,0.15)',  desc: 'USD Coin' },
};

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [cryptoAddresses, setCryptoAddresses] = useState<CryptoAddress[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState<string>('BTC');
  const [copied, setCopied] = useState(false);

  const fetchCryptoAddresses = useCallback(async () => {
    const { data } = await supabase
      .from('payment_addresses')
      .select('cryptoAddress, cryptoNetwork, instructions')
      .eq('isActive', true);
    if (data && data.length > 0) {
      setCryptoAddresses(data.map((r: any) => ({
        currency: r.method === 'crypto' ? (r.cryptoAddress?.startsWith('1') || r.cryptoAddress?.startsWith('3') || r.cryptoAddress?.startsWith('bc1') ? 'BTC' : 'USDT') : 'USDC',
        address: r.cryptoAddress,
        network: r.cryptoNetwork,
        instructions: r.instructions || '',
      })));
    }
  }, []);

  const fetchWallet = useCallback(async () => {
    if (!user) return;

    // Fetch or create wallet
    const { data: initialData, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let walletData = initialData;

    if (error || !walletData) {
      // Create wallet if not exists
      const { data: created } = await supabase
        .from('wallets')
        .insert({ user_id: user.id, balance: 0, pending_balance: 0, currency: 'USD' })
        .select()
        .single();
      walletData = created;
    }

    if (walletData) {
      setWallet({
        id: walletData.id,
        balance: Number(walletData.balance),
        pendingBalance: Number(walletData.pending_balance),
        currency: walletData.currency || 'USD',
        updatedAt: walletData.updated_at,
      });
    }

    // Fetch transactions
    const { data: txData } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setTransactions(
      (txData || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency || 'USD',
        status: t.status,
        description: t.description || '',
        referenceId: t.reference_id,
        balanceAfter: t.balance_after ? Number(t.balance_after) : undefined,
        createdAt: t.created_at,
      }))
    );
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    fetchCryptoAddresses();
    fetchWallet().finally(() => setLoading(false));
  }, [user, fetchWallet, fetchCryptoAddresses, navigate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWallet();
    setRefreshing(false);
    toast.success('Wallet refreshed');
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCryptoEntry = cryptoAddresses.find(c => c.currency === selectedCrypto);

  const filteredTx = activeFilter === 'all'
    ? transactions
    : transactions.filter(t => t.type === activeFilter);

  const totalDeposited = transactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const totalEscrowHeld = transactions.filter(t => t.type === 'escrow_hold' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#090907' }}>
      <div className="w-8 h-8 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#090907' }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>My Wallet</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Manage your escrow balance and transactions</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Balance Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {/* Main Balance Card */}
          <div className="sm:col-span-2 relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, rgba(255,215,60,0.20) 0%, rgba(255,255,255,0.08) 50%, rgba(255,215,60,0.12) 100%)', border: '1px solid rgba(255,215,60,0.25)', backdropFilter: 'blur(16px)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4 opacity-80">
                <WalletIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Available Balance</span>
              </div>
              <p className="text-4xl font-heading font-bold mb-1">
                {formatCurrency(wallet?.balance || 0, wallet?.currency)}
              </p>
              <p className="text-white/60 text-xs">
                Last updated: {wallet?.updatedAt ? formatRelativeTime(wallet.updatedAt) : 'Just now'}
              </p>
              <div className="mt-5 flex gap-3">
                <Button
                  size="sm"
                  className="bg-white text-[hsl(var(--brand-navy))] hover:bg-white/90 font-semibold text-xs"
                  onClick={() => setShowDeposit(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Funds
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 text-xs"
                  onClick={() => toast.info('Withdrawal request — contact support')}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Withdraw
                </Button>
              </div>
            </div>
          </div>

          {/* Pending Balance */}
          <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,215,60,0.15)' }}>
                <Lock className="w-5 h-5" style={{ color: 'rgba(255,215,60,0.80)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>In Escrow</p>
              <p className="text-2xl font-heading font-bold mt-1" style={{ color: 'rgba(255,255,255,0.90)' }}>
                {formatCurrency(wallet?.pendingBalance || 0, wallet?.currency)}
              </p>
            </div>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Funds held pending transaction completion
            </p>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Deposited', value: formatCurrency(totalDeposited, wallet?.currency), icon: ArrowDownLeft },
            { label: 'Transactions', value: transactions.length.toString(), icon: TrendingUp },
            { label: 'Escrow Activity', value: formatCurrency(totalEscrowHeld, wallet?.currency), icon: ShieldCheck },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,215,60,0.12)' }}>
                <stat.icon className="w-4 h-4" style={{ color: 'rgba(255,215,60,0.75)' }} />
              </div>
              <p className="font-heading font-bold text-lg" style={{ color: 'rgba(255,255,255,0.90)' }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Crypto Deposit Modal */}
        {showDeposit && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)' }}>
            <div className="rounded-2xl w-full max-w-md overflow-hidden" style={{ background: '#0c0c0c', border: '1px solid rgba(255,224,0,0.18)', boxShadow: '0 32px 100px rgba(0,0,0,0.85)' }}>

              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,224,0,0.15)' }}>
                    <DollarSign className="w-4 h-4" style={{ color: '#FFE000' }} />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-sm" style={{ color: 'rgba(255,255,255,0.92)' }}>Deposit Crypto</h2>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Send crypto to your escrow wallet</p>
                  </div>
                </div>
                <button onClick={() => setShowDeposit(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-lg leading-none"
                  style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.90)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'}>✕</button>
              </div>

              <div className="p-6 space-y-4">
                {/* Currency selector */}
                <div>
                  <p className="text-xs font-medium mb-2.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Select currency</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['BTC', 'USDT', 'USDC'] as const).map(cur => {
                      const cfg = CRYPTO_ICONS[cur];
                      const isActive = selectedCrypto === cur;
                      return (
                        <button
                          key={cur}
                          onClick={() => setSelectedCrypto(cur)}
                          className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all"
                          style={isActive
                            ? { background: cfg.bg, border: `1px solid ${cfg.color}40`, boxShadow: `0 0 20px ${cfg.color}20` }
                            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <span className="text-xl font-bold" style={{ color: isActive ? cfg.color : 'rgba(255,255,255,0.50)' }}>{cfg.symbol}</span>
                          <span className="text-[11px] font-bold" style={{ color: isActive ? cfg.color : 'rgba(255,255,255,0.55)' }}>{cur}</span>
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{cfg.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeCryptoEntry ? (
                  <>
                    {/* Network badge */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CRYPTO_ICONS[selectedCrypto]?.color || '#FFE000' }} />
                      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Network:</span>
                      <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>{activeCryptoEntry.network}</span>
                    </div>

                    {/* Address block */}
                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CRYPTO_ICONS[selectedCrypto]?.color || '#FFE000'}28` }}>
                      <div className="px-3 py-2" style={{ background: `${CRYPTO_ICONS[selectedCrypto]?.color || '#FFE000'}10` }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.40)' }}>
                          {selectedCrypto} Deposit Address
                        </p>
                      </div>
                      <div className="p-3" style={{ background: 'rgba(0,0,0,0.40)' }}>
                        <p className="font-mono text-sm break-all leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {activeCryptoEntry.address}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopyAddress(activeCryptoEntry.address)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all"
                        style={{
                          background: copied ? 'rgba(52,211,153,0.12)' : `${CRYPTO_ICONS[selectedCrypto]?.color || '#FFE000'}15`,
                          borderTop: `1px solid ${CRYPTO_ICONS[selectedCrypto]?.color || '#FFE000'}20`,
                          color: copied ? 'rgba(52,211,153,0.90)' : (CRYPTO_ICONS[selectedCrypto]?.color || '#FFE000'),
                        }}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Address Copied!' : 'Copy Address'}
                      </button>
                    </div>

                    {/* Instructions */}
                    {activeCryptoEntry.instructions && (
                      <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(255,224,0,0.06)', border: '1px solid rgba(255,224,0,0.14)' }}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,224,0,0.75)' }} />
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          {activeCryptoEntry.instructions}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <QrCode className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.25)' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>No address configured for {selectedCrypto}</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Contact admin to set up {selectedCrypto} deposits</p>
                  </div>
                )}

                {/* Notice */}
                <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.14)' }}>
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'rgba(52,211,153,0.75)' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(52,211,153,0.70)' }}>
                    After sending, your balance will be credited once the admin verifies the transaction on-chain. This typically takes 15–60 minutes.
                  </p>
                </div>

                <button
                  onClick={() => setShowDeposit(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="font-heading font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>Transaction History</h2>
            {/* Filter tabs */}
            <div className="flex gap-1 flex-wrap">
              {(['all', 'deposit', 'withdrawal', 'escrow_hold', 'escrow_release', 'refund']).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors capitalize',
                    activeFilter === filter ? '' : ''
                  )} style={activeFilter === filter
                      ? { background: 'rgba(255,215,60,0.18)', border: '1px solid rgba(255,215,60,0.28)', color: 'rgba(255,235,100,0.92)' }
                      : { color: 'rgba(255,255,255,0.42)' }
                  }
                >
                  {filter === 'escrow_hold' ? 'Held' : filter === 'escrow_release' ? 'Released' : filter}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <WalletIcon className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">No transactions yet</p>
              <p className="text-xs mt-1">Add funds to get started</p>
              <Button
                size="sm"
                className="mt-4 navy-gradient text-white border-0"
                onClick={() => setShowDeposit(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Funds
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTx.map(tx => {
                const config = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.deposit;
                const Icon = config.icon;
                const isCredit = config.sign === '+';
                return (
                  <div key={tx.id} className="flex items-center gap-4 px-6 py-4 transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isCredit ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)' }}>
                      <Icon className="w-4 h-4" style={{ color: isCredit ? 'rgba(52,211,153,0.85)' : 'rgba(239,68,68,0.80)' }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{config.label}</p>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          tx.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        )}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.40)' }}>{tx.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatRelativeTime(tx.createdAt)}</p>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-heading font-bold text-sm" style={{ color: isCredit ? 'rgba(52,211,153,0.90)' : 'rgba(239,68,68,0.85)' }}>
                        {config.sign}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                      {tx.balanceAfter !== undefined && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Balance: {formatCurrency(tx.balanceAfter, tx.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security notice */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)' }}>
          <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'rgba(52,211,153,0.80)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(52,211,153,0.90)' }}>Wallet Security</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(52,211,153,0.65)' }}>
              All funds are held in a regulated escrow account. Withdrawals require admin approval.
              Every transaction is logged and audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
