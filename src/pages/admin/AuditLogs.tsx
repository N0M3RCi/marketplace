import { useState, useEffect, useCallback } from 'react';
import { admin } from '@/lib/client';
import { formatDateTime } from '@/lib/utils';
import { Search, Shield, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  PAYMENT_VERIFIED: 'bg-emerald-100 text-emerald-700',
  PACKAGING_APPROVED: 'bg-blue-100 text-blue-700',
  DELIVERY_CREATED: 'bg-amber-100 text-amber-700',
  FUNDS_RELEASED: 'bg-purple-100 text-purple-700',
  USER_VERIFIED: 'bg-teal-100 text-teal-700',
  PAYMENT_REJECTED: 'bg-red-100 text-red-700',
  DISPUTE_RESOLVED: 'bg-indigo-100 text-indigo-700',
  REFUND_ISSUED: 'bg-rose-100 text-rose-700',
  verify_payment: 'bg-emerald-100 text-emerald-700',
  reject_payment: 'bg-red-100 text-red-700',
  wallet_credit: 'bg-emerald-100 text-emerald-700',
  wallet_debit: 'bg-red-100 text-red-700',
  send_message: 'bg-blue-100 text-blue-700',
  resolve_dispute: 'bg-indigo-100 text-indigo-700',
  payout_paid: 'bg-purple-100 text-purple-700',
};

interface AuditEntry {
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

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      const data = await admin.auditLogs.list();
      setLogs((data || []).map((l: any) => ({
        id: l.id,
        adminId: l.admin_id,
        adminName: l.admin_name || 'Admin',
        action: l.action,
        entityType: l.entity_type,
        entityId: l.entity_id,
        details: l.details,
        ipAddress: l.ip_address || '-',
        createdAt: l.created_at,
      })));
    } catch {
      toast.error('Failed to load audit logs');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  const filtered = logs.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.adminName.toLowerCase().includes(search.toLowerCase()) ||
    l.entityId.toLowerCase().includes(search.toLowerCase()) ||
    l.details.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#C68000' }} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold" style={{ color: '#2A1A00' }}>Audit Logs</h1>
        <p className="text-sm mt-1" style={{ color: '#9A7C40' }}>Complete trace of all administrator actions. All escrow actions are logged and traceable.</p>
      </div>

      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-white" />
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  {logs.length === 0 ? 'No audit logs recorded yet' : 'No logs match your search'}
                </td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full navy-gradient flex items-center justify-center flex-shrink-0">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-medium">{log.adminName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700'}`}>
                      {log.action.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs">
                        <span className="text-muted-foreground">{log.entityType}:</span>{' '}
                        <span className="font-mono font-medium">{log.entityId.substring(0, 12)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[250px] truncate">{log.details}</td>
                  <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}