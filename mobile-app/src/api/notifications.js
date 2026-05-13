// Notifications endpoints. The backend returns bare shapes here (no
// `{ success, data }` envelope) — keep that in mind when reading body.

import { api } from './client';

export async function listNotifications(limit = 50) {
  const res = await api.get('/notifications', { params: { limit } });
  return res.data.notifications ?? [];
}

export async function listUnreadNotifications() {
  const res = await api.get('/notifications/unread');
  return res.data.notifications ?? [];
}

export async function unreadCount() {
  const res = await api.get('/notifications/unread-count');
  return Number(res.data.count ?? 0);
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
