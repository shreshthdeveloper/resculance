import api from './api';

const chatService = {
  // Get all messages for a session
  async getMessages(sessionId, limit = 100) {
    const response = await api.get(`/patients/sessions/${sessionId}/messages`, {
      params: { limit }
    });
    return response.data;
  },

  // Send a message in a session
  async sendMessage(sessionId, message, messageType = 'text', metadata = null) {
    const response = await api.post(`/patients/sessions/${sessionId}/messages`, {
      message,
      messageType,
      metadata
    });
    return response.data;
  },

  // Mark a message as read
  async markAsRead(messageId) {
    const response = await api.patch(`/patients/messages/${messageId}/read`);
    return response.data;
  },

  // Get unread message count for a session
  async getUnreadCount(sessionId) {
    const response = await api.get(`/patients/sessions/${sessionId}/unread-count`);
    return response.data;
  }
};

export default chatService;
