// Notifications endpoints. Backend now returns the standard
// `{ success, message, data }` envelope. Pre-refactor servers returned the
// payload at the top level; we tolerate both shapes for the deploy window.

import { api } from './client';

function unwrap(res, fallback = {}) {
  return res?.data?.data ?? res?.data ?? fallback;
}

export async function listNotifications(limit = 50) {
  const res = await api.get('/notifications', { params: { limit } });
  return unwrap(res, {}).notifications ?? [];
}

export async function listUnreadNotifications() {
  const res = await api.get('/notifications/unread');
  return unwrap(res, {}).notifications ?? [];
}

export async function unreadCount() {
  const res = await api.get('/notifications/unread-count');
  return Number(unwrap(res, {}).count ?? 0);
}

export async function markRead(id) {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllRead() {
  await api.patch('/notifications/mark-all-read');
}

export async function deleteNotification(id) {
  await api.delete(`/notifications/${id}`);
}

export async function deleteAllNotifications() {
  await api.delete('/notifications');
}
