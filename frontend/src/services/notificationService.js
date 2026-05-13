import api from './api';

// Backend now returns the standard `{ success, message, data }` envelope on
// every notifications endpoint. During the deploy window where one side may
// still be on the old code path, we tolerate the legacy bare shape too.
const unwrap = (response, fallback = {}) =>
  response?.data?.data ?? response?.data ?? fallback;

const notificationService = {
  async getNotifications(limit = 50, offset = 0) {
    const response = await api.get('/notifications', { params: { limit, offset } });
    return unwrap(response, { notifications: [] });
  },

  async getUnreadNotifications() {
    const response = await api.get('/notifications/unread');
    return unwrap(response, { notifications: [] });
  },

  async getUnreadCount() {
    const response = await api.get('/notifications/unread-count');
    return unwrap(response, { count: 0 });
  },

  async markAsRead(notificationId) {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return unwrap(response, {});
  },

  async markAllAsRead() {
    const response = await api.patch('/notifications/mark-all-read');
    return unwrap(response, {});
  },

  async deleteNotification(notificationId) {
    const response = await api.delete(`/notifications/${notificationId}`);
    return unwrap(response, {});
  },

  async deleteAllNotifications() {
    const response = await api.delete('/notifications');
    return unwrap(response, {});
  }
};

export default notificationService;
