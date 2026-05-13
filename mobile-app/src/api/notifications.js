import { api } from './client';

export async function listNotifications(limit = 50) {
  const res = await api.get('/notifications', { params: { limit } });
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
