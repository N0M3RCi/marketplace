import { supabase } from '@/lib/supabase';
import type { Listing, Category, Conversation, Message } from '@/types';

// ─── Categories ──────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon || 'Tag',
    listingCount: c.listing_count || 0,
    color: c.color || 'text-gray-600',
  }));
}

// ─── Listings ─────────────────────────────────────────────────

export async function fetchListings(opts?: {
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}): Promise<Listing[]> {
  let query = supabase
    .from('listings')
    .select(`
      *,
      categories(name),
      user_profiles!listings_seller_id_fkey(username, rating)
    `)
    .eq('status', 'active');

  if (opts?.categoryId) query = query.eq('category_id', opts.categoryId);
  if (opts?.search) query = query.ilike('title', `%${opts.search}%`);
  if (opts?.minPrice) query = query.gte('price', opts.minPrice);
  if (opts?.maxPrice) query = query.lte('price', opts.maxPrice);

  if (opts?.sort === 'price-asc') query = query.order('price', { ascending: true });
  else if (opts?.sort === 'price-desc') query = query.order('price', { ascending: false });
  else if (opts?.sort === 'popular') query = query.order('view_count', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((l: any) => ({
    id: l.id,
    title: l.title,
    description: l.description || '',
    price: Number(l.price),
    currency: l.currency || 'USD',
    categoryId: l.category_id,
    categoryName: l.categories?.name || '',
    sellerId: l.seller_id,
    sellerName: l.user_profiles?.username || 'Unknown',
    sellerRating: Number(l.user_profiles?.rating) || 5,
    images: l.images || [],
    condition: l.condition || 'good',
    location: l.location || '',
    status: l.status,
    createdAt: l.created_at,
    viewCount: l.view_count || 0,
  }));
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      categories(name),
      user_profiles!listings_seller_id_fkey(id, username, rating, email, avatar_url, is_verified, total_transactions)
    `)
    .eq('id', id)
    .single();

  if (error) return null;
  if (!data) return null;

  // Increment view count
  await supabase.from('listings').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);

  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    price: Number(data.price),
    currency: data.currency || 'USD',
    categoryId: data.category_id,
    categoryName: data.categories?.name || '',
    sellerId: data.seller_id,
    sellerName: data.user_profiles?.username || 'Unknown',
    sellerRating: Number(data.user_profiles?.rating) || 5,
    images: data.images || [],
    condition: data.condition || 'good',
    location: data.location || '',
    status: data.status,
    createdAt: data.created_at,
    viewCount: (data.view_count || 0) + 1,
    sellerProfile: data.user_profiles,
  } as any;
}

export async function createListing(listing: Partial<Listing> & { sellerId: string }): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: listing.currency || 'USD',
      category_id: listing.categoryId,
      seller_id: listing.sellerId,
      images: listing.images || [],
      condition: listing.condition || 'good',
      location: listing.location || '',
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Favorites ────────────────────────────────────────────────

export async function toggleFavorite(listingId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .single();

  if (existing) {
    await supabase.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
    return false;
  } else {
    await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
    return true;
  }
}

export async function fetchFavorites(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId);
  return (data || []).map((f: any) => f.listing_id);
}

// ─── Conversations ────────────────────────────────────────────

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      buyer:user_profiles!conversations_buyer_id_fkey(id, username, avatar_url),
      seller:user_profiles!conversations_seller_id_fkey(id, username, avatar_url)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((c: any) => {
    const isBuyer = c.buyer_id === userId;
    const other = isBuyer ? c.seller : c.buyer;
    const otherName = other?.username || 'Unknown';
    const unread = isBuyer ? c.buyer_unread : c.seller_unread;
    return {
      id: c.id,
      participants: [c.buyer_id, c.seller_id],
      participantNames: [c.buyer?.username || '', c.seller?.username || ''],
      listingId: c.listing_id,
      listingTitle: c.listing_title,
      lastMessage: c.last_message,
      lastMessageAt: c.last_message_at,
      unreadCount: unread || 0,
      otherUser: { id: other?.id, name: otherName, avatar: other?.avatar_url },
      buyerId: c.buyer_id,
      sellerId: c.seller_id,
    } as any;
  });
}

export async function getOrCreateConversation(
  listingId: string,
  listingTitle: string,
  buyerId: string,
  sellerId: string
): Promise<string> {
  // Check existing
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .eq('seller_id', sellerId)
    .single();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      listing_id: listingId,
      listing_title: listingTitle,
      buyer_id: buyerId,
      seller_id: sellerId,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ─── Messages ─────────────────────────────────────────────────

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, user_profiles!messages_sender_id_fkey(username)`)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((m: any) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    senderName: m.user_profiles?.username || 'Unknown',
    content: m.content,
    createdAt: m.created_at,
    isRead: m.is_read,
  }));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  isBuyer: boolean
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select(`*, user_profiles!messages_sender_id_fkey(username)`)
    .single();

  if (error) throw error;

  // Update conversation last message + unread
  const unreadField = isBuyer ? 'seller_unread' : 'buyer_unread';
  await supabase
    .from('conversations')
    .update({
      last_message: content,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      [unreadField]: supabase.rpc as any,
    })
    .eq('id', conversationId);

  // Simpler update for last message
  await supabase
    .from('conversations')
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    senderName: data.user_profiles?.username || 'Unknown',
    content: data.content,
    createdAt: data.created_at,
    isRead: data.is_read,
  };
}

export async function markConversationRead(conversationId: string, userId: string, isBuyer: boolean) {
  // Mark messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId);

  // Reset unread count
  const field = isBuyer ? 'buyer_unread' : 'seller_unread';
  await supabase.from('conversations').update({ [field]: 0 }).eq('id', conversationId);
}

// ─── Notifications ────────────────────────────────────────────

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data || []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    caseId: n.case_id,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

export async function markNotificationRead(notifId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
}
