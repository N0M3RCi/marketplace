import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Bell, Search, Menu, X, ChevronDown, LogOut, Settings, User, LayoutDashboard, MessageSquare, Wallet, Plus, DollarSign } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { fetchNotifications, markAllNotificationsRead } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { useCurrencyStore, SUPPORTED_CURRENCIES } from '@/lib/currencyStore';
import type { Notification } from '@/types';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { displayCurrency, setDisplayCurrency, rates, loadRates } = useCurrencyStore();

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  useEffect(() => {
    if (user) {
      fetchNotifications(user.id).then(setNotifications).catch(() => {});
    }
  }, [user, location.pathname]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/marketplace?search=${encodeURIComponent(searchQuery)}`);
  };

  const isAdmin = user?.role === 'admin';
  const displayName = user?.username || user?.email?.split('@')[0] || '';

  return (
    <nav className="sticky top-0 z-50" style={{
      background: 'rgba(255,253,245,0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(240,184,0,0.22)',
      boxShadow: '0 2px 20px rgba(180,130,0,0.08)',
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(240,184,0,0.30) 0%, rgba(220,160,0,0.50) 100%)', border: '1px solid rgba(200,140,0,0.45)', boxShadow: '0 2px 8px rgba(180,130,0,0.18)' }}>
              <Shield className="w-4 h-4" style={{ color: '#8B5500' }} />
            </div>
            <span className="font-heading font-bold text-lg" style={{ color: '#1A1000' }}>
              Safe Buy<span style={{ color: '#C68000' }}> Market</span>
            </span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
              <input
                type="text"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(240,184,0,0.28)',
                  color: '#1A1000',
                  boxShadow: 'inset 0 1px 3px rgba(180,130,0,0.06)',
                }}
              />
            </div>
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin">
                    <button
                      className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(240,184,0,0.12)', border: '1px solid rgba(240,184,0,0.28)', color: '#7A5000' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.22)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.12)'; }}
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" /> Admin
                    </button>
                  </Link>
                )}

                {isAdmin && (
                  <Link to="/sell" className="hidden md:block">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)', border: '1px solid rgba(200,140,0,0.40)', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(180,130,0,0.28)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #D09000 0%, #E0A800 100%)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'; }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Listing
                    </button>
                  </Link>
                )}

                {/* Messages */}
                <Link to="/messages">
                  <button
                    className="p-2 rounded-lg transition-all"
                    style={{ color: '#8B6020' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C68000'; (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.10)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8B6020'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </Link>

                {/* Currency Selector */}
                <div className="relative">
                  <button
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(240,184,0,0.10)', border: '1px solid rgba(240,184,0,0.22)', color: '#7A5000' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.18)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.10)'; }}
                    onClick={() => { setIsCurrencyOpen(!isCurrencyOpen); setIsNotifOpen(false); setIsUserMenuOpen(false); }}
                  >
                    <DollarSign className="w-3 h-3" />
                    <span>{displayCurrency}</span>
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>

                  {isCurrencyOpen && (
                    <div className="absolute right-0 top-full mt-2 w-40 rounded-2xl z-50 overflow-hidden" style={{
                      background: 'rgba(255,253,240,0.98)',
                      border: '1px solid rgba(240,184,0,0.28)',
                      backdropFilter: 'blur(24px)',
                      boxShadow: '0 12px 48px rgba(180,130,0,0.18)',
                    }}>
                      <div className="py-1.5 max-h-64 overflow-y-auto">
                        {SUPPORTED_CURRENCIES.map(c => (
                          <button key={c.code} onClick={() => { setDisplayCurrency(c.code); setIsCurrencyOpen(false); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors"
                            style={{ color: displayCurrency === c.code ? '#C68000' : '#4A3000', background: displayCurrency === c.code ? 'rgba(240,184,0,0.10)' : 'transparent' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.08)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = displayCurrency === c.code ? 'rgba(240,184,0,0.10)' : 'transparent'; }}>
                            <span className="w-5 text-center font-medium">{c.symbol}</span>
                            <span className="flex-1 text-left font-medium">{c.code}</span>
                            <span className="text-[10px]" style={{ color: '#9A7C40' }}>{c.label.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="relative">
                  <button
                    className="relative p-2 rounded-lg transition-all"
                    style={{ color: '#8B6020' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#C68000'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,184,0,0.10)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8B6020'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    onClick={() => { setIsNotifOpen(!isNotifOpen); setIsUserMenuOpen(false); }}
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {isNotifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl z-50 overflow-hidden" style={{
                      background: 'rgba(255,253,240,0.98)',
                      border: '1px solid rgba(240,184,0,0.28)',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      boxShadow: '0 12px 48px rgba(180,130,0,0.18), inset 0 1px 0 rgba(255,255,255,0.90)',
                    }}>
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(240,184,0,0.15)' }}>
                        <span className="font-heading font-semibold text-sm" style={{ color: '#1A1000' }}>Notifications</span>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs font-medium hover:underline" style={{ color: '#C68000' }}>Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto scrollbar-thin">
                        {notifications.length === 0 ? (
                          <p className="text-center text-sm py-8" style={{ color: '#9A7C40' }}>No notifications</p>
                        ) : (
                          notifications.slice(0, 8).map(notif => (
                            <div
                              key={notif.id}
                              className="px-4 py-3 cursor-pointer transition-colors last:border-0"
                              style={{ borderBottom: '1px solid rgba(240,184,0,0.08)', background: !notif.isRead ? 'rgba(240,184,0,0.06)' : 'transparent' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.10)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !notif.isRead ? 'rgba(240,184,0,0.06)' : 'transparent'; }}
                              onClick={() => { if (notif.caseId) navigate(`/escrow/${notif.caseId}`); setIsNotifOpen(false); }}
                            >
                              <div className="flex items-start gap-3">
                                {!notif.isRead && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#E8A800' }} />}
                                <div className={cn('flex-1', !notif.isRead ? '' : 'ml-5')}>
                                  <p className="text-sm font-medium" style={{ color: '#1A1000' }}>{notif.title}</p>
                                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#7A5C20' }}>{notif.message}</p>
                                  <p className="text-xs mt-1" style={{ color: '#B89A60' }}>{formatRelativeTime(notif.createdAt)}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsNotifOpen(false); }}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl transition-all"
                    style={{ color: '#4A3000' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(240,184,0,0.10)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(240,184,0,0.35) 0%, rgba(220,160,0,0.55) 100%)', border: '1.5px solid rgba(200,140,0,0.50)', color: '#6B4000' }}>
                      {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(displayName)}
                    </div>
                    <span className="hidden md:block text-sm font-semibold" style={{ color: '#1A1000' }}>{displayName.split(' ')[0]}</span>
                    <ChevronDown className="hidden md:block w-3.5 h-3.5" style={{ color: '#9A7C40' }} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl z-50 overflow-hidden" style={{
                      background: 'rgba(255,253,240,0.98)',
                      border: '1px solid rgba(240,184,0,0.28)',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      boxShadow: '0 12px 48px rgba(180,130,0,0.18), inset 0 1px 0 rgba(255,255,255,0.90)',
                    }}>
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(240,184,0,0.15)' }}>
                        <p className="font-semibold text-sm" style={{ color: '#1A1000' }}>{displayName}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#9A7C40' }}>{user.email}</p>
                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold"
                          style={{ background: 'rgba(240,184,0,0.22)', border: '1px solid rgba(240,184,0,0.42)', color: '#7A5000' }}>
                          {user.role}
                        </span>
                      </div>
                      <div className="py-1.5">
                        {[
                          { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                          { to: '/messages',  icon: MessageSquare,   label: 'Messages' },
                          { to: '/wallet',    icon: Wallet,          label: 'My Wallet' },
                          ...(isAdmin ? [{ to: '/sell', icon: Plus, label: 'Create Listing' }] : []),
                          { to: '/profile',   icon: User,            label: 'Profile' },
                        ].map(({ to, icon: Icon, label }) => (
                          <Link
                            key={to} to={to}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all"
                            style={{ color: '#5C4010' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,184,0,0.08)'; (e.currentTarget as HTMLElement).style.color = '#1A1000'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#5C4010'; }}
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#C68000' }} />
                            {label}
                          </Link>
                        ))}
                        <div className="mx-3 my-1" style={{ height: '1px', background: 'rgba(240,184,0,0.15)' }} />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all"
                          style={{ color: 'rgba(180,40,40,0.80)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,60,60,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(200,30,30,0.95)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(180,40,40,0.80)'; }}
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <button
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{ color: '#6B5020' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1000'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6B5020'; }}
                  >
                    Sign In
                  </button>
                </Link>
                <Link to="/login">
                  <button
                    className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)', border: '1px solid rgba(200,140,0,0.40)', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(180,130,0,0.28)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #D09000 0%, #E0A800 100%)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'; }}
                  >
                    Get Started
                  </button>
                </Link>
              </div>
            )}

            <button className="md:hidden p-2 rounded-lg transition-all" style={{ color: '#6B5020' }} onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-3 space-y-1" style={{ borderTop: '1px solid rgba(240,184,0,0.18)' }}>
            <form onSubmit={handleSearch} className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#C68000' }} />
                <input
                  type="text" placeholder="Search listings..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(240,184,0,0.28)', color: '#1A1000' }}
                />
              </div>
            </form>
            {['Browse Listings,/marketplace', 'My Dashboard,/dashboard', 'Messages,/messages', 'My Wallet,/wallet', 'Create Listing,/sell', 'Admin Panel,/admin'].map(item => {
              const [label, path] = item.split(',');
              if ((label === 'My Dashboard' || label === 'Messages' || label === 'My Wallet') && !user) return null;
              if (label === 'Create Listing' && !isAdmin) return null;
              if (label === 'Admin Panel' && !isAdmin) return null;
              return (
                <Link key={path} to={path} className="block px-3 py-2 text-sm rounded-lg transition-colors" style={{ color: '#6B5020' }} onClick={() => setIsMenuOpen(false)}>{label}</Link>
              );
            })}
          </div>
        )}
      </div>

      {(isNotifOpen || isUserMenuOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setIsNotifOpen(false); setIsUserMenuOpen(false); }} />
      )}
    </nav>
  );
}
