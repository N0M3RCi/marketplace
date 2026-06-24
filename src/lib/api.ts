import * as client from './client';
import type { Listing, Category, Conversation, Message } from '@/types';

// ─── Categories ──────────────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  return client.categories.list();
}

// ─── Listings ─────────────────────────────────────────────────
export async function fetchListings(opts?: {
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}): Promise<Listing[]> {
  const params: Record<string, string> = {};
  if (opts?.categoryId) params.categoryId = opts.categoryId;
  if (opts?.search) params.search = opts.search;
  if (opts?.minPrice) params.minPrice = String(opts.minPrice);
  if (opts?.maxPrice) params.maxPrice = String(opts.maxPrice);
  if (opts?.sort) params.sort = opts.sort;
  return client.listings.list(Object.keys(params).length ? params : undefined);
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  return client.listings.get(id);
}

export async function createListing(listing: Partial<Listing> & { sellerId: string }): Promise<Listing> {
  return client.listings.create(listing);
}

// ─── Favorites ────────────────────────────────────────────────
export async function toggleFavorite(listingId: string, userId: string): Promise<boolean> {
  const result = await client.favorites.toggle(listingId);
  return result.favorited;
}

export async function fetchFavorites(userId: string): Promise<string[]> {
  return client.favorites.list();
}

// ─── Conversations ────────────────────────────────────────────
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  return client.conversations.list();
}

export async function getOrCreateConversation(
  listingId: string,
  listingTitle: string,
  buyerId: string,
  sellerId: string
): Promise<string> {
  const result = await client.conversations.getOrCreate({ listingId, listingTitle, buyerId, sellerId });
  return result.id;
}

// ─── Messages ─────────────────────────────────────────────────
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  return client.messages.list(conversationId);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  isBuyer: boolean
): Promise<Message> {
  return client.messages.send(conversationId, content, isBuyer);
}

export async function markConversationRead(conversationId: string, userId: string, isBuyer: boolean) {
  return client.conversations.markRead(conversationId, isBuyer);
}

// ─── Notifications ────────────────────────────────────────────
export async function fetchNotifications(userId: string) {
  return client.notifications.list(30);
}

export async function markNotificationRead(notifId: string) {
  return client.notifications.markRead(notifId);
}

export async function markAllNotificationsRead() {
  return client.notifications.markAllRead();
}