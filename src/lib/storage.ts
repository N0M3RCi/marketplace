import type { User, EscrowCase, Notification } from '@/types';
import { MOCK_USERS, MOCK_ESCROW_CASES, MOCK_NOTIFICATIONS } from '@/lib/mockData';

const STORAGE_KEYS = {
  CURRENT_USER: 'safeescrow_current_user',
  ESCROW_CASES: 'safeescrow_cases',
  NOTIFICATIONS: 'safeescrow_notifications',
};

// Current User
export function getCurrentUser(): User | null {
  const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (stored) {
    try { return JSON.parse(stored); } catch { return null; }
  }
  return null;
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

export function loginAs(userId: string): User | null {
  const user = MOCK_USERS.find(u => u.id === userId);
  if (user) { setCurrentUser(user); return user; }
  return null;
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

// Escrow Cases
export function getEscrowCases(): EscrowCase[] {
  const stored = localStorage.getItem(STORAGE_KEYS.ESCROW_CASES);
  if (stored) {
    try { return JSON.parse(stored); } catch { return MOCK_ESCROW_CASES; }
  }
  return MOCK_ESCROW_CASES;
}

export function saveEscrowCases(cases: EscrowCase[]): void {
  localStorage.setItem(STORAGE_KEYS.ESCROW_CASES, JSON.stringify(cases));
}

export function getEscrowCaseById(id: string): EscrowCase | undefined {
  return getEscrowCases().find(c => c.id === id);
}

export function updateEscrowCase(updated: EscrowCase): void {
  const cases = getEscrowCases();
  const idx = cases.findIndex(c => c.id === updated.id);
  if (idx !== -1) {
    cases[idx] = updated;
    saveEscrowCases(cases);
  }
}

// Notifications
export function getNotifications(userId?: string): Notification[] {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  let notifications: Notification[] = MOCK_NOTIFICATIONS;
  if (stored) {
    try { notifications = JSON.parse(stored); } catch { notifications = MOCK_NOTIFICATIONS; }
  }
  if (userId) return notifications.filter(n => n.userId === userId);
  return notifications;
}

export function markNotificationRead(notifId: string): void {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  const notifications: Notification[] = stored ? JSON.parse(stored) : MOCK_NOTIFICATIONS;
  const idx = notifications.findIndex(n => n.id === notifId);
  if (idx !== -1) {
    notifications[idx].isRead = true;
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }
}

export function markAllNotificationsRead(userId: string): void {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  let notifications: Notification[] = stored ? JSON.parse(stored) : MOCK_NOTIFICATIONS;
  notifications = notifications.map(n => n.userId === userId ? { ...n, isRead: true } : n);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}
