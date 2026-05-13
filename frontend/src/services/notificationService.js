import api from './api';

const notificationService = {
  // Get all notifications
  async getNotifications(limit = 50, offset = 0) {
    const response = await api.get('/notifications', { params: { limit, offset } });
    return response.data;
  },

  // Get unread notifications
  async getUnreadNotifications() {
    const response = await api.get('/notifications/unread');
    return response.data;
  },

  // Get unread count
  async getUnreadCount() {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  // Mark notification as read
  async markAsRead(notificationId) {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  // Mark all as read
  async markAllAsRead() {
    const response = await api.patch('/notifications/mark-all-read');
    return response.data;
  },

  // Delete notification
  async deleteNotification(notificationId) {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  // Delete all notifications
  async deleteAllNotifications() {
    const response = await api.delete('/notifications');
    return response.data;
  }
};

export default notificationService;
