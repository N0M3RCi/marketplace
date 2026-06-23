import { useState, useEffect } from 'react';
import { Settings, Save, Plus, Copy, CheckCircle, Bitcoin, Shield, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PaymentSetting {
  id: string;
  cryptoAddress: string;
  cryptoNetwork: string;
  qrCodeUrl?: string;
  instructions: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

const NETWORKS = [
  { value: 'USDT-TRC20', label: 'USDT (TRC-20 / Tron)', symbol: '₮', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'USDT-ERC20', label: 'USDT (ERC-20 / Ethereum)', symbol: '₮', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'BTC', label: 'Bitcoin (BTC)', symbol: '₿', color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'ETH', label: 'Ethereum (ETH)', symbol: 'Ξ', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { value: 'USDC-ERC20', label: 'USDC (ERC-20)', symbol: '$', color: 'text-blue-500', bg: 'bg-blue-50' },
  { value: 'BNB-BEP20', label: 'BNB (BEP-20 / BSC)', symbol: '♦', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { value: 'SOL', label: 'Solana (SOL)', symbol: '◎', color: 'text-purple-600', bg: 'bg-purple-50' },
];

export default function PaymentSettings() {
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    cryptoAddress: '',
    cryptoNetwork: 'USDT-TRC20',
    instructions: 'Send the exact amount to the address above. Include your Case ID in the transaction memo/reference. Payment confirmation may take 10–30 minutes.',
    qrCodeUrl: '',
  });

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to load payment settings'); return; }
    setSettings((data || []).map((s: any) => ({
      id: s.id,
      cryptoAddress: s.crypto_address,
      cryptoNetwork: s.crypto_network,
      qrCodeUrl: s.qr_code_url,
      instructions: s.instructions || '',
      isActive: s.is_active,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })));
  };

  useEffect(() => {
    setLoading(true);
    fetchSettings().finally(() => setLoading(false));
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Address copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAdd = async () => {
    if (!form.cryptoAddress.trim()) { toast.error('Crypto address is required'); return; }
    setSaving(true);

    const { data, error } = await supabase
      .from('payment_settings')
      .insert({
        crypto_address: form.cryptoAddress.trim(),
        crypto_network: form.cryptoNetwork,
        instructions: form.instructions.trim(),
        qr_code_url: form.qrCodeUrl.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to add payment address'); setSaving(false); return; }

    toast.success('Payment address added successfully');
    setShowAddForm(false);
    setForm({ cryptoAddress: '', cryptoNetwork: 'USDT-TRC20', instructions: 'Send the exact amount to the address above. Include your Case ID in the transaction memo/reference. Payment confirmation may take 10–30 minutes.', qrCodeUrl: '' });
    await fetchSettings();
    setSaving(false);
  };

  const handleUpdate = async (id: string, updates: Partial<PaymentSetting>) => {
    const { error } = await supabase
      .from('payment_settings')
      .update({
        crypto_address: updates.cryptoAddress,
        crypto_network: updates.cryptoNetwork,
        instructions: updates.instructions,
        is_active: updates.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) { toast.error('Failed to update'); return; }
    toast.success('Settings updated');
    await fetchSettings();
    setEditingId(null);
  };

  const handleToggleActive = async (s: PaymentSetting) => {
    await handleUpdate(s.id, { ...s, isActive: !s.isActive });
  };

  const getNetworkConfig = (network: string) => NETWORKS.find(n => n.value === network) || NETWORKS[0];

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Payment Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage crypto payment addresses shown to buyers</p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="navy-gradient text-white border-0 hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Address
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">How Payment Addresses Work</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            Buyers are shown the <strong>active</strong> payment address when they need to make a payment for an escrow case.
            Once the buyer sends funds, they submit their transaction hash as proof. Admin then verifies and advances the case.
            You can have multiple addresses but only <strong>active</strong> ones are shown to buyers.
          </p>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-[hsl(var(--brand-navy))]/20 p-6 mb-6 shadow-sm">
          <h2 className="font-heading font-semibold text-foreground mb-5">Add Payment Address</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Network / Currency</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {NETWORKS.map(net => (
                  <button
                    key={net.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, cryptoNetwork: net.value }))}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all',
                      form.cryptoNetwork === net.value
                        ? 'border-[hsl(var(--brand-navy))] bg-[hsl(var(--brand-navy))]/5 text-[hsl(var(--brand-navy))]'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    )}
                  >
                    <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', net.bg, net.color)}>
                      {net.symbol}
                    </span>
                    <span className="truncate">{net.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Wallet Address <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.cryptoAddress}
                onChange={e => setForm(p => ({ ...p, cryptoAddress: e.target.value }))}
                placeholder="e.g. TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
                className="w-full px-4 py-2.5 text-sm font-mono border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Payment Instructions</label>
              <textarea
                value={form.instructions}
                onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">QR Code Image URL <span className="text-muted-foreground text-xs">(optional)</span></label>
              <input
                type="url"
                value={form.qrCodeUrl}
                onChange={e => setForm(p => ({ ...p, qrCodeUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAdd}
                disabled={saving || !form.cryptoAddress.trim()}
                className="navy-gradient text-white border-0 hover:opacity-90"
              >
                {saving ? 'Saving...' : 'Save Address'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Address List */}
      {settings.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <Bitcoin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">No payment addresses configured</p>
          <p className="text-sm text-muted-foreground mb-4">Add at least one crypto address to accept escrow payments</p>
          <Button onClick={() => setShowAddForm(true)} className="navy-gradient text-white border-0">
            <Plus className="w-4 h-4 mr-2" /> Add First Address
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {settings.map(s => {
            const net = getNetworkConfig(s.cryptoNetwork);
            const isEditing = editingId === s.id;

            return (
              <div key={s.id} className={cn(
                'bg-white rounded-xl border p-5 transition-all',
                s.isActive ? 'border-emerald-200 shadow-sm' : 'border-border opacity-70'
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0', net.bg, net.color)}>
                      {net.symbol}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground">{net.label}</p>
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                          s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        )}>
                          {s.isActive ? '● Active' : '○ Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.cryptoNetwork}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(s)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                        s.isActive
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                      )}
                    >
                      {s.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => setEditingId(isEditing ? null : s.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                </div>

                {/* Address display */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 min-w-0">
                    <code className="text-xs font-mono text-foreground truncate">{s.cryptoAddress}</code>
                    <button
                      onClick={() => copyToClipboard(s.cryptoAddress, s.id)}
                      className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === s.id ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {s.qrCodeUrl && (
                    <img src={s.qrCodeUrl} alt="QR Code" className="w-12 h-12 rounded-lg border border-border object-contain bg-white" />
                  )}
                </div>

                {/* Instructions */}
                {s.instructions && (
                  <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.instructions}</p>
                  </div>
                )}

                {/* Edit Form */}
                {isEditing && (
                  <EditAddressForm
                    setting={s}
                    onSave={(updates) => handleUpdate(s.id, updates)}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditAddressForm({
  setting,
  onSave,
  onCancel,
}: {
  setting: PaymentSetting;
  onSave: (updates: Partial<PaymentSetting>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    cryptoAddress: setting.cryptoAddress,
    cryptoNetwork: setting.cryptoNetwork,
    instructions: setting.instructions,
  });

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5">Network</label>
          <select
            value={form.cryptoNetwork}
            onChange={e => setForm(p => ({ ...p, cryptoNetwork: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white"
          >
            {NETWORKS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5">Wallet Address</label>
          <input
            type="text"
            value={form.cryptoAddress}
            onChange={e => setForm(p => ({ ...p, cryptoAddress: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm font-mono border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))]"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5">Instructions</label>
        <textarea
          value={form.instructions}
          onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} className="bg-[hsl(var(--brand-emerald))] text-white hover:bg-[hsl(158,64%,32%)] border-0 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel} className="text-xs">Cancel</Button>
      </div>
    </div>
  );
}
