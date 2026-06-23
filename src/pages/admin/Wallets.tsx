import { useState, useEffect, useCallback } from 'react';
import {
  Search, Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2,
  Filter, ChevronDown, ChevronUp, DollarSign, TrendingUp, Users,
  Plus, Minus, AlertTriangle, CheckCircle, X, Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, getInitials, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminWallet {
  id: string;
  userId: string;
  username: string;
  email: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  updatedAt: string;
  transactionCount?: number;
}

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  createdAt: string;
}

interface AdjustForm {
  type: 'credit' | 'debit';
  amount: string;
  description: string;
}

const TX_TYPE_CONFIG: Record<string, { label: string; sign: '+' | '-'; color: string }> = {
  deposit:        { label: 'Deposit',         sign: '+', color: 'text-emerald-600' },
  withdrawal:     { label: 'Withdrawal',      sign: '-', color: 'text-red-500' },
  escrow_hold:    { label: 'Escrow Hold',     sign: '-', color: 'text-amber-600' },
  escrow_release: { label: 'Escrow Release',  sign: '+', color: 'text-emerald-600' },
  refund:         { label: 'Refund',          sign: '+', color: 'text-blue-600' },
  fee:            { label: 'Platform Fee',    sign: '-', color: 'text-slate-500' },
  payout:         { label: 'Payout',          sign: '+', color: 'text-emerald-600' },
  admin_credit:   { label: 'Admin Credit',    sign: '+', color: 'text-purple-600' },
  admin_debit:    { label: 'Admin Debit',     sign: '-', color: 'text-red-600' },
};

export default function AdminWallets() {
  const { user: adminUser } = useAuth();
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'username' | 'updated'>('balance');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [txMap, setTxMap] = useState<Record<string, WalletTx[]>>({});
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>({ type: 'credit', amount: '', description: '' });
  const [adjustLoading, setAdjustLoading] = useState(false);

  const authHeaders = (): Record<string, string> => {
    const t = localStorage.getItem('auth_token');
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  };

  const fetchWallets = useCallback(async () => {
    try {
      const data = await admin.wallets.list();
      const allTxs = await admin.wallets.transactions();

      const countMap: Record<string, number> = {};
      (allTxs || []).forEach((t: any) => {
        countMap[t.wallet_id] = (countMap[t.wallet_id] || 0) + 1;
      });

      setWallets((data || []).map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        username: w.username || 'Unknown',
        email: w.email || '',
        balance: Number(w.balance || 0),
        pendingBalance: Number(w.pending_balance || 0),
        currency: w.currency || 'USD',
        updatedAt: w.updated_at,
        transactionCount: countMap[w.id] || 0,
      })));
    } catch {
      toast.error('Failed to load wallets');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchWallets().finally(() => setLoading(false));
  }, [fetchWallets]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWallets();
    setRefreshing(false);
    toast.success('Refreshed');
  };

  const fetchTxForWallet = async (walletId: string) => {
    if (txMap[walletId]) return;
    setTxLoading(walletId);
    try {
      const data = await admin.wallets.walletTransactions(walletId);
      setTxMap(prev => ({
        ...prev,
        [walletId]: (data || []).map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          currency: t.currency || 'USD',
          status: t.status,
          description: t.description || '',
          createdAt: t.created_at,
        })),
      }));
    } catch {
      setTxMap(prev => ({ ...prev, [walletId]: [] }));
    }
    setTxLoading(null);
  };

  const toggleExpand = async (walletId: string) => {
    if (expandedId === walletId) {
      setExpandedId(null);
    } else {
      setExpandedId(walletId);
      await fetchTxForWallet(walletId);
    }
  };

  const handleAdjust = async () => {
    if (!adjustingId) return;
    const amount = parseFloat(adjustForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!adjustForm.description.trim()) { toast.error('Description is required'); return; }

    const wallet = wallets.find(w => w.id === adjustingId);
    if (!wallet) return;

    if (adjustForm.type === 'debit' && wallet.balance < amount) {
      toast.error('Insufficient balance for debit');
      return;
    }

    setAdjustLoading(true);

    const newBalance = adjustForm.type === 'credit'
      ? wallet.balance + amount
      : wallet.balance - amount;

    try {
      await admin.wallets.update(adjustingId, newBalance, wallet.pendingBalance);
    } catch {
      toast.error('Failed to update wallet');
      setAdjustLoading(false);
      return;
    }

    // Create wallet transaction via direct fetch
    const txType = adjustForm.type === 'credit' ? 'admin_credit' : 'admin_debit';
    try {
      await fetch('/api/admin/wallet-transactions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          wallet_id: adjustingId,
          type: txType,
          amount,
          currency: wallet.currency,
          status: 'completed',
          description: adjustForm.description.trim(),
          balance_after: newBalance,
        }),
      });
    } catch { /* tx log silently */ }

    // Audit log
    try {
      await fetch('/api/admin/audit-logs', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          admin_id: adminUser?.id,
          admin_name: adminUser?.username || 'Admin',
          action: `wallet_${adjustForm.type}`,
          entity_type: 'wallet',
          entity_id: adjustingId,
          details: `${adjustForm.type === 'credit' ? 'Credited' : 'Debited'} ${formatCurrency(amount)} ${adjustForm.type === 'credit' ? 'to' : 'from'} ${wallet.username}'s wallet. Reason: ${adjustForm.description}`,
        }),
      });
    } catch { /* audit log silently */ }

    toast.success(`${formatCurrency(amount)} ${adjustForm.type === 'credit' ? 'credited to' : 'debited from'} ${wallet.username}'s wallet`);
    setAdjustingId(null);
    setAdjustForm({ type: 'credit', amount: '', description: '' });
    setAdjustLoading(false);

    await fetchWallets();
    setTxMap(prev => { const next = { ...prev }; delete next[adjustingId!]; return next; });
  };

  const sorted = [...wallets].sort((a, b) => {
    if (sortBy === 'balance') return b.balance - a.balance;
    if (sortBy === 'username') return a.username.localeCompare(b.username);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const filtered = sorted.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return w.username.toLowerCase().includes(q) || w.email.toLowerCase().includes(q);
  });

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
  const totalPending = wallets.reduce((s, w) => s + w.pendingBalance, 0);

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: '#2A1A00' }}>Wallet Management</h1>
          <p className="text-sm mt-1" style={{ color: '#9A7C40' }}>View balances, transaction history, and manually adjust wallets</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg border transition-colors"
          style={{ border: '1px solid rgba(200,160,60,0.25)', color: '#9A7C40' }}>
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Wallets',    value: wallets.length.toString(),              icon: Users,        color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Platform Balance', value: formatCurrency(totalBalance),           icon: Wallet,       color: 'text-emerald-600',bg: 'bg-emerald-50' },
          { label: 'In Escrow',        value: formatCurrency(totalPending),           icon: DollarSign,   color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Total Holdings',   value: formatCurrency(totalBalance + totalPending), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}>
              <s.icon className={cn('w-4 h-4', s.color)} />
            </div>
            <p className={cn('font-heading font-bold text-lg', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by username or email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Sort:</span>
          {(['balance', 'username', 'updated'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={cn('px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors',
                sortBy === s ? 'bg-[hsl(var(--brand-navy))] text-white' : 'text-muted-foreground hover:bg-muted')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Wallet List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-border py-16 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No wallets found</p>
          </div>
        ) : filtered.map(wallet => {
          const isExpanded = expandedId === wallet.id;
          const isAdjusting = adjustingId === wallet.id;
          const txs = txMap[wallet.id] || [];

          return (
            <div key={wallet.id} className="bg-white rounded-xl border border-border overflow-hidden">
              {/* Wallet Row */}
              <div className="p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full navy-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {getInitials(wallet.username)}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{wallet.username}</p>
                  <p className="text-xs text-muted-foreground">{wallet.email}</p>
                </div>

                {/* Balance */}
                <div className="text-center hidden sm:block">
                  <p className="font-heading font-bold text-[hsl(var(--brand-navy))] text-base">{formatCurrency(wallet.balance, wallet.currency)}</p>
                  <p className="text-[11px] text-muted-foreground">Available</p>
                </div>

                {wallet.pendingBalance > 0 && (
                  <div className="text-center hidden md:block">
                    <p className="font-bold text-amber-600 text-sm">{formatCurrency(wallet.pendingBalance, wallet.currency)}</p>
                    <p className="text-[11px] text-muted-foreground">In Escrow</p>
                  </div>
                )}

                {/* Tx count */}
                <div className="text-center hidden lg:block">
                  <p className="font-bold text-foreground text-sm">{wallet.transactionCount}</p>
                  <p className="text-[11px] text-muted-foreground">Transactions</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => { setAdjustingId(isAdjusting ? null : wallet.id); setAdjustForm({ type: 'credit', amount: '', description: '' }); }}
                    className={cn('px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      isAdjusting ? 'bg-[hsl(var(--brand-navy))] text-white border-[hsl(var(--brand-navy))]' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                    Adjust
                  </button>
                  <button onClick={() => toggleExpand(wallet.id)}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Adjust Panel */}
              {isAdjusting && (
                <div className="px-4 pb-4 border-t border-border pt-4 bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--brand-navy))]/10 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-[hsl(var(--brand-navy))]" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">Manual Balance Adjustment</h3>
                    <button onClick={() => setAdjustingId(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Type</label>
                      <div className="flex gap-2">
                        {(['credit', 'debit'] as const).map(t => (
                          <button key={t} onClick={() => setAdjustForm(f => ({ ...f, type: t }))}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors capitalize',
                              adjustForm.type === t
                                ? t === 'credit' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-600 text-white border-red-600'
                                : 'border-border text-muted-foreground hover:bg-muted')}>
                            {t === 'credit' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Amount (USD)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="number" min="0.01" step="0.01"
                          value={adjustForm.amount}
                          onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Reason / Description <span className="text-red-500">*</span></label>
                      <input
                        value={adjustForm.description}
                        onChange={e => setAdjustForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Reason for adjustment..."
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {adjustForm.amount && Number(adjustForm.amount) > 0 && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground bg-white rounded-xl border border-border px-4 py-2.5">
                      <span>Current: <span className="font-bold text-foreground">{formatCurrency(wallet.balance)}</span></span>
                      <span className="text-muted-foreground/40">→</span>
                      <span>After: <span className={cn('font-bold', adjustForm.type === 'credit' ? 'text-emerald-600' : 'text-red-600')}>
                        {formatCurrency(adjustForm.type === 'credit' ? wallet.balance + Number(adjustForm.amount) : wallet.balance - Number(adjustForm.amount))}
                      </span></span>
                      {adjustForm.type === 'debit' && Number(adjustForm.amount) > wallet.balance && (
                        <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Exceeds balance</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <Button onClick={handleAdjust} disabled={adjustLoading || !adjustForm.amount || !adjustForm.description}
                      className={cn('gap-1.5', adjustForm.type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700', 'text-white border-0')}>
                      {adjustLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : adjustForm.type === 'credit' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      {adjustForm.type === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                    </Button>
                    <Button variant="outline" onClick={() => setAdjustingId(null)}>Cancel</Button>
                    <p className="text-[11px] text-muted-foreground ml-2">Action will be logged in audit trail</p>
                  </div>
                </div>
              )}

              {/* Transaction History */}
              {isExpanded && (
                <div className="border-t border-border">
                  <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Transaction History</h3>
                    <span className="text-xs text-muted-foreground">{wallet.transactionCount} total</span>
                  </div>

                  {txLoading === wallet.id ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : txs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">No transactions yet</div>
                  ) : (
                    <div className="divide-y divide-border max-h-64 overflow-y-auto">
                      {txs.map(tx => {
                        const cfg = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.deposit;
                        return (
                          <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                              cfg.sign === '+' ? 'bg-emerald-50' : 'bg-red-50')}>
                              {cfg.sign === '+' ? <ArrowDownLeft className={cn('w-3.5 h-3.5', cfg.color)} /> : <ArrowUpRight className={cn('w-3.5 h-3.5', cfg.color)} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{cfg.label}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{tx.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={cn('text-xs font-bold', cfg.color)}>
                                {cfg.sign}{formatCurrency(tx.amount, tx.currency)}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 hidden sm:block">
                              <p className="text-[11px] text-muted-foreground">{formatDateTime(tx.createdAt).split(',')[0]}</p>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full',
                                tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                tx.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700')}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}