import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Send, MessageSquare, Search, ArrowLeft, Package,
  ChevronRight, ShieldCheck
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchConversations, fetchMessages, sendMessage, markConversationRead
} from '@/lib/api';
import { formatRelativeTime, formatDateTime, getInitials } from '@/lib/utils';
import type { Message } from '@/types';
import { toast } from 'sonner';

interface ConvRow {
  id: string;
  participants: string[];
  participantNames: string[];
  listingId?: string;
  listingTitle?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  otherUser?: { id: string; name: string; avatar?: string };
  buyerId: string;
  sellerId: string;
}

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(searchParams.get('conv'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [convsLoading, setConvsLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    setConvsLoading(true);
    fetchConversations(user.id)
      .then(setConversations)
      .catch(() => toast.error('Failed to load conversations'))
      .finally(() => setConvsLoading(false));
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId || !user) return;
    setMsgsLoading(true);
    const conv = conversations.find(c => c.id === activeConvId);
    const isBuyer = conv?.buyerId === user.id;

    fetchMessages(activeConvId)
      .then(msgs => {
        setMessages(msgs);
        scrollToBottom();
        markConversationRead(activeConvId, user.id, isBuyer ?? true).catch(() => {});
        // Reset unread
        setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unreadCount: 0 } : c));
      })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setMsgsLoading(false));

    // Polling every 4 seconds
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchMessages(activeConvId).then(msgs => {
        setMessages(prev => {
          if (prev.length !== msgs.length) {
            scrollToBottom();
            return msgs;
          }
          return prev;
        });
      }).catch(() => {});
    }, 4000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConvId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvId || !user || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const conv = conversations.find(c => c.id === activeConvId);
    const isBuyer = conv?.buyerId === user.id;

    // Optimistic update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversationId: activeConvId,
      senderId: user.id,
      senderName: user.username,
      content,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    try {
      const sent = await sendMessage(activeConvId, user.id, content, isBuyer ?? true);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
      setConversations(prev => prev.map(c =>
        c.id === activeConvId ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() } : c
      ));
    } catch {
      toast.error('Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const filteredConvs = conversations.filter(c =>
    !search || c.otherUser?.name.toLowerCase().includes(search.toLowerCase()) ||
    c.listingTitle?.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FFFDF5' }}>
      <Navbar />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-0 h-[calc(100vh-64px)]">
        <div className="flex w-full gap-4 h-full">

          {/* SIDEBAR */}
          <div className={`${activeConvId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 flex-shrink-0 bg-white rounded-2xl border border-border overflow-hidden`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-border">
              <h1 className="font-heading font-bold text-lg text-foreground">Messages</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search conversations…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] bg-background"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {convsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contact a seller from any listing to start
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/marketplace')}>
                    Browse Listings
                  </Button>
                </div>
              ) : (
                filteredConvs.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => { setActiveConvId(conv.id); setShowSidebar(false); }}
                    className={`w-full text-left px-4 py-3.5 hover:bg-muted/40 transition-colors border-b border-border/50 flex items-start gap-3 ${activeConvId === conv.id ? 'bg-[hsl(var(--brand-navy))]/5 border-l-2 border-l-[hsl(var(--brand-navy))]' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--brand-navy))] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {conv.otherUser?.avatar ? (
                        <img src={conv.otherUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(conv.otherUser?.name || '?')
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{conv.otherUser?.name || 'Unknown'}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                          {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ''}
                        </span>
                      </div>
                      {conv.listingTitle && (
                        <p className="text-[10px] text-[hsl(var(--brand-navy))] font-medium truncate mb-0.5 flex items-center gap-1">
                          <Package className="w-2.5 h-2.5 flex-shrink-0" /> {conv.listingTitle}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate">{conv.lastMessage || 'No messages yet'}</p>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 min-w-[18px] h-[18px] rounded-full bg-[hsl(var(--brand-navy))] text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* MAIN CHAT AREA */}
          <div className={`${!activeConvId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white rounded-2xl border border-border overflow-hidden min-w-0`}>
            {!activeConvId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl navy-gradient flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-heading font-bold text-lg text-foreground mb-2">Your Messages</h2>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Select a conversation to start chatting, or message a seller from any listing.
                </p>
                <Button className="mt-6 navy-gradient text-white border-0 hover:opacity-90" onClick={() => navigate('/marketplace')}>
                  Browse Listings
                </Button>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
                  <button onClick={() => setActiveConvId(null)} className="md:hidden p-1 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[hsl(var(--brand-navy))] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {activeConv?.otherUser?.avatar ? (
                      <img src={activeConv.otherUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(activeConv?.otherUser?.name || '?')
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{activeConv?.otherUser?.name}</p>
                    {activeConv?.listingTitle && (
                      <Link
                        to={`/listing/${activeConv.listingId}`}
                        className="text-[11px] text-[hsl(var(--brand-navy))] hover:underline flex items-center gap-1 truncate"
                      >
                        <Package className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{activeConv.listingTitle}</span>
                      </Link>
                    )}
                  </div>

                  {activeConv?.listingId && (
                    <Link to={`/listing/${activeConv.listingId}`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5 hidden sm:flex">
                        <ShieldCheck className="w-3.5 h-3.5" /> View Listing
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {msgsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="w-8 h-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isOwn = msg.senderId === user.id;
                        const prevMsg = idx > 0 ? messages[idx - 1] : null;
                        const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center justify-center my-3">
                                <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                  {new Date(msg.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            )}
                            <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                              {!isOwn && (
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                                  {getInitials(msg.senderName)}
                                </div>
                              )}
                              <div className={`max-w-[70%] group`}>
                                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn
                                  ? 'bg-[hsl(var(--brand-navy))] text-white rounded-br-md'
                                  : 'bg-muted text-foreground rounded-bl-md'
                                }`}>
                                  {msg.content}
                                </div>
                                <p className={`text-[10px] text-muted-foreground mt-1 ${isOwn ? 'text-right' : ''}`}>
                                  {formatRelativeTime(msg.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border">
                  <form onSubmit={handleSend} className="flex items-end gap-2">
                    <textarea
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      className="flex-1 px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-navy))] resize-none min-h-[44px] max-h-32 bg-background"
                      style={{ height: 'auto' }}
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="w-11 h-11 p-0 navy-gradient text-white border-0 hover:opacity-90 flex-shrink-0 rounded-xl"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
