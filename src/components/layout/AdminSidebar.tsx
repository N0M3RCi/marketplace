import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ListChecks, FolderOpen, Wallet, Scale,
  ShieldCheck, Truck, AlertTriangle, Banknote, BarChart3, FileText,
  ChevronRight, Shield, Bitcoin, MessageSquare, FolderKanban, Star, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',          path: '/admin',                    exact: true },
  { icon: Users,           label: 'Users',              path: '/admin/users' },
  { icon: ListChecks,      label: 'Listings',           path: '/admin/listings' },
  { icon: FolderKanban,    label: 'Categories',         path: '/admin/categories' },
  { icon: LayoutGrid,      label: 'Homepage Categories', path: '/admin/homepage-categories' },
  { icon: Star,            label: 'Featured Listings',   path: '/admin/featured-listings' },
  { icon: MessageSquare,   label: 'Messages',           path: '/admin/messages' },
  { icon: FolderOpen,      label: 'Escrow Cases',       path: '/admin/escrow' },
  { icon: Wallet,          label: 'Wallet Management',  path: '/admin/wallets' },
  { icon: ShieldCheck,     label: 'Payment Review',     path: '/admin/payments' },
  { icon: Bitcoin,         label: 'Payment Settings',   path: '/admin/payment-settings' },
  { icon: FileText,        label: 'Seller Verification',path: '/admin/seller-verification' },
  { icon: Truck,           label: 'Delivery Management',path: '/admin/delivery' },
  { icon: AlertTriangle,   label: 'Disputes',           path: '/admin/disputes' },
  { icon: Banknote,        label: 'Payouts',            path: '/admin/payouts' },
  { icon: BarChart3,       label: 'Analytics',          path: '/admin/analytics' },
  { icon: Scale,           label: 'Audit Logs',         path: '/admin/audit-logs' },
];

export default function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 flex-shrink-0 min-h-screen flex flex-col" style={{
      background: 'rgba(255,253,240,0.96)',
      borderRight: '1px solid rgba(240,184,0,0.22)',
      boxShadow: '2px 0 20px rgba(180,130,0,0.06)',
    }}>
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(240,184,0,0.18)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(240,184,0,0.30) 0%, rgba(220,160,0,0.50) 100%)',
            border: '1px solid rgba(200,140,0,0.45)',
            boxShadow: '0 2px 8px rgba(180,130,0,0.18)',
          }}>
            <Shield className="w-4 h-4" style={{ color: '#7A4500' }} />
          </div>
          <div>
            <span className="font-heading font-bold text-sm" style={{ color: '#1A1000' }}>
              Safe<span style={{ color: '#C68000' }}>Escrow</span>
            </span>
            <p className="text-[10px] -mt-0.5" style={{ color: '#9A7C40' }}>Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
              style={isActive
                ? {
                    background: 'linear-gradient(135deg, rgba(240,184,0,0.22) 0%, rgba(255,215,0,0.18) 100%)',
                    border: '1px solid rgba(240,184,0,0.40)',
                    color: '#7A5000',
                    boxShadow: '0 2px 8px rgba(180,130,0,0.10)',
                  }
                : { color: '#7A5C30', border: '1px solid transparent' }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.08)';
                  (e.currentTarget as HTMLElement).style.color = '#4A3000';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#7A5C30';
                }
              }}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? '#C68000' : '#9A7C40' }} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5" style={{ color: '#C68000' }} />}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(240,184,0,0.15)' }}>
        <NavLink
          to="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ color: '#9A7C40' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.08)';
            (e.currentTarget as HTMLElement).style.color = '#4A3000';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#9A7C40';
          }}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Marketplace
        </NavLink>
      </div>
    </aside>
  );
}
