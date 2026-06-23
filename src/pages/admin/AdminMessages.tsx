import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, MessageSquare, Send, RefreshCw, Loader2, User,
  ChevronRight, Clock, ShieldCheck, Eye, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime, formatDateTime, getInitials, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminConversation {
  id: string;
  listingId?: string;
  listingTitle?: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  buyerUnread: number;
  sellerUnread: number;
  createdAt: string;
}

interface AdminMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  isAdminMessage?: boolean;
}

export default function AdminMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<AdminConversation | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendAs, setSendAs] = useState<'admin' | 'buyer' | 'seller'>('admin');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, listing_id, listing_title, buyer_id, seller_id,
        last_message, last_message_at, buyer_unread, seller_unread, created_at,
        buyer:user_profiles!conversations_buyer_id_fkey(id, username),
        seller:user_profiles!conversations_seller_id_fkey(id, username)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) { toast.error('Failed to load conversations'); return; }

    setConversations((data || []).map((c: any) => ({
      id: c.id,
      listingId: c.listing_id,
      listingTitle: c.listing_title,
      buyerId: c.buyer_id,
      buyerName: c.buyer?.username || 'Unknown Buyer',
      sellerId: c.seller_id,
      sellerName: c.seller?.username || 'Unknown Seller',
      lastMessage: c.last_message,
      lastMessageAt: c.last_message_at,
      buyerUnread: c.buyer_unread || 0,
      sellerUnread: c.seller_unread || 0,
      createdAt: c.created_at,
    })));
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, conversation_id, sender_id, content, is_read, created_at,
        sender:user_profiles!messages_sender_id_fkey(id, username)
      `)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) return;

    setMessages((data || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender?.username || 'Unknown',
      content: m.content,
      isRead: m.is_read,
      createdAt: m.created_at,
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  // Poll messages when a conversation is selected
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedConv) return;

    fetchMessages(selectedConv.id);
    pollRef.current = setInterval(() => fetchMessages(selectedConv.id), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedConv, fetchMessages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConv = async (conv: AdminConversation) => {
    setSelectedConv(conv);
    setMessagesLoading(true);
    await fetchMessages(conv.id);
    setMessagesLoading(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);

    // Determine sender ID based on sendAs
    let actualSenderId: string;
    let senderLabel: string;

    if (sendAs === 'buyer') {
      actualSenderId = selectedConv.buyerId;
      senderLabel = selectedConv.buyerName;
    } else if (sendAs === 'seller') {
      actualSenderId = selectedConv.sellerId;
      senderLabel = selectedConv.sellerName;
    } else {
      // Admin sends as themselves — use buyer ID as fallback for DB constraint
      actualSenderId = user?.id || selectedConv.buyerId;
      senderLabel = `Admin (${user?.username || 'Admin'})`;
    }

    const messageContent = sendAs === 'admin'
      ? `[ADMIN] ${newMessage.trim()}`
      : newMessage.trim();

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConv.id,
      sender_id: actualSenderId,
      content: messageContent,
      is_read: false,
    });

    if (error) { toast.error('Failed to send message'); setSending(false); return; }

    // Update conversation last message
    await supabase.from('conversations').update({
      last_message: messageContent.substring(0, 100),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', selectedConv.id);

    // Log admin action
    await supabase.from('audit_logs').insert({
      admin_id: user?.id,
      admin_name: user?.username || 'Admin',
      action: 'send_message',
      entity_type: 'conversation',
      entity_id: selectedConv.id,
      details: `Admin sent message as ${senderLabel} in conversation about "${selectedConv.listingTitle || 'unlisted item'}"`,
    });

    setNewMessage('');
    await fetchMessages(selectedConv.id);
    setSending(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    if (selectedConv) await fetchMessages(selectedConv.id);
    setRefreshing(false);
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.buyerName.toLowerCase().includes(q) ||
      c.sellerName.toLowerCase().includes(q) ||
      (c.listingTitle || '').toLowerCase().includes(q);
  });

  const totalUnread = conversations.reduce((s, c) => s + c.buyerUnread + c.sellerUnread, 0);

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--brand-navy))]" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Message Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View all conversations and reply as admin, buyer, or seller
            {totalUnread > 0 && (
              <span className="ml-2 text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                {totalUnread} unread
              </span>
            )}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Admin Impersonation Notice */}
      <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Admin Moderation Mode</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            You can send messages as <strong>Admin</strong> (prefixed with [ADMIN]), or on behalf of the <strong>Buyer</strong> or <strong>Seller</strong> for dispute resolution purposes.
            All admin actions are logged in the audit trail.
          </p>
        </div>
      </div>

      <div className="flex gap-5 h-[calc(100vh-320px)] min-h-[500px]">
        {/* Left: Conversation List */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" placeholder="Search conversations..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[hsl(var(--brand-navy))] bg-muted/30" />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">No conversations</p>
              </div>
            ) : filtered.map(conv => {
              const isSelected = selectedConv?.id === conv.id;
              const unreadTotal = conv.buyerUnread + conv.sellerUnread;

              return (
                <button key={conv.id} onClick={() => handleSelectConv(conv)}
                  className={cn('w-full p-3.5 text-left transition-colors',
                    isSelected ? 'bg-[hsl(var(--brand-navy))]/5 border-l-2 border-l-[hsl(var(--brand-navy))]' : 'hover:bg-muted/30')}>
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 relative">
                      <div className="w-9 h-9 rounded-full bg-[hsl(var(--brand-navy))]/10 flex items-center justify-center text-[hsl(var(--brand-navy))] text-xs font-bold">
                        {getInitials(conv.buyerName)}
                      </div>
                      {unreadTotal > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-[9px] text-white font-bold">{unreadTotal > 9 ? '9+' : unreadTotal}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-foreground truncate">{conv.buyerName} ↔ {conv.sellerName}</p>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(conv.lastMessageAt)}</span>
                        )}
                      </div>
                      {conv.listingTitle && (
                        <p className="text-[10px] text-[hsl(var(--brand-navy))] font-medium truncate mb-0.5">{conv.listingTitle}</p>
                      )}
                      {conv.lastMessage ? (
                        <p className="text-[11px] text-muted-foreground truncate">{conv.lastMessage}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/50 italic">No messages yet</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Message Thread */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-border overflow-hidden">
          {!selectedConv ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-15" />
              <p className="font-medium text-sm">Select a conversation</p>
              <p className="text-xs mt-1">Choose a conversation from the list to view messages</p>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-sm text-foreground">{selectedConv.buyerName} ↔ {selectedConv.sellerName}</h2>
                  </div>
                  {selectedConv.listingTitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      About: <span className="font-medium text-[hsl(var(--brand-navy))]">{selectedConv.listingTitle}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-3 h-3 text-blue-600" />
                    </div>
                    <span>B: {selectedConv.buyerUnread} unread</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                      <User className="w-3 h-3 text-amber-600" />
                    </div>
                    <span>S: {selectedConv.sellerUnread} unread</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : messages.map(msg => {
                  const isBuyer = msg.senderId === selectedConv.buyerId;
                  const isSeller = msg.senderId === selectedConv.sellerId;
                  const isAdmin = msg.content.startsWith('[ADMIN]');

                  return (
                    <div key={msg.id} className={cn('flex gap-2.5', isBuyer ? 'flex-row' : 'flex-row-reverse')}>
                      {/* Avatar */}
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-1',
                        isAdmin ? 'bg-[hsl(var(--brand-navy))] text-white' :
                        isBuyer ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}>
                        {isAdmin ? '⚙' : getInitials(msg.senderName)}
                      </div>

                      <div className={cn('max-w-[70%]', isBuyer ? '' : '')}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {isAdmin ? `Admin` : msg.senderName}
                            {isAdmin && <span className="ml-1 text-[9px] bg-[hsl(var(--brand-navy))]/10 text-[hsl(var(--brand-navy))] px-1 py-0.5 rounded">ADMIN</span>}
                            {isBuyer && !isAdmin && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">Buyer</span>}
                            {isSeller && !isAdmin && <span className="ml-1 text-[9px] bg-amber-100 text-amber-600 px-1 py-0.5 rounded">Seller</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">{formatRelativeTime(msg.createdAt)}</span>
                        </div>
                        <div className={cn('px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                          isAdmin ? 'bg-[hsl(var(--brand-navy))] text-white rounded-tl-sm' :
                          isBuyer ? 'bg-blue-50 text-foreground border border-blue-100 rounded-tl-sm' :
                          'bg-amber-50 text-foreground border border-amber-100 rounded-tr-sm')}>
                          {isAdmin ? msg.content.replace('[ADMIN] ', '') : msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Message */}
              <div className="p-4 border-t border-border">
                {/* Send-As Selector */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground font-medium">Reply as:</span>
                  <div className="flex gap-1">
                    {([
                      { key: 'admin', label: 'Admin', cls: 'bg-[hsl(var(--brand-navy))] text-white' },
                      { key: 'buyer', label: `${selectedConv.buyerName} (Buyer)`, cls: 'bg-blue-600 text-white' },
                      { key: 'seller', label: `${selectedConv.sellerName} (Seller)`, cls: 'bg-amber-600 text-white' },
                    ] as const).map(opt => (
                      <button key={opt.key} onClick={() => setSendAs(opt.key)}
                        className={cn('px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors',
                          sendAs === opt.key ? opt.cls : 'bg-muted text-muted-foreground hover:text-foreground')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    rows={2}
                    placeholder={
                      sendAs === 'admin' ? 'Type admin message... (will be prefixed with [ADMIN])' :
                      sendAs === 'buyer' ? `Reply as ${selectedConv.buyerName}...` :
                      `Reply as ${selectedConv.sellerName}...`
                    }
                    className="flex-1 px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none"
                  />
                  <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}
                    className={cn('self-end h-11 gap-1.5',
                      sendAs === 'admin' ? 'navy-gradient text-white border-0' :
                      sendAs === 'buyer' ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' :
                      'bg-amber-600 hover:bg-amber-700 text-white border-0')}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Press Enter to send · Shift+Enter for new line · All messages logged in audit trail</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
