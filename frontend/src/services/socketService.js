import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      console.log('Socket disconnected');
    }
  }

  // Join a session room for real-time updates
  joinSession(sessionId) {
    if (!this.socket) return;
    this.socket.emit('join_session', { sessionId });
    console.log(`Joining session room: ${sessionId}`);
  }

  // Leave a session room
  leaveSession(sessionId) {
    if (!this.socket) return;
    this.socket.emit('leave_session', { sessionId });
    console.log(`Leaving session room: ${sessionId}`);
  }

  // Send a message (real-time)
  sendMessage(sessionId, message, messageType = 'text', metadata = null) {
    if (!this.socket) return;
    this.socket.emit('message', {
      sessionId,
      message,
      messageType,
      metadata
    });
  }

  // Listen for new messages
  onMessage(callback) {
    if (!this.socket) return;
    this.socket.on('message', callback);
    this.socket.on('new_message', callback); // Also listen for API-triggered messages
  }

  // Remove message listener
  offMessage(callback) {
    if (!this.socket) return;
    this.socket.off('message', callback);
    this.socket.off('new_message', callback);
  }

  // Typing indicators
  startTyping(sessionId) {
    if (!this.socket) return;
    this.socket.emit('typing_start', { sessionId });
  }

  stopTyping(sessionId) {
    if (!this.socket) return;
    this.socket.emit('typing_stop', { sessionId });
  }

  onUserTyping(callback) {
    if (!this.socket) return;
    this.socket.on('user_typing', callback);
  }

  offUserTyping(callback) {
    if (!this.socket) return;
    this.socket.off('user_typing', callback);
  }

  // User presence
  onUserJoined(callback) {
    if (!this.socket) return;
    this.socket.on('user_joined', callback);
  }

  onUserLeft(callback) {
    if (!this.socket) return;
    this.socket.on('user_left', callback);
  }

  // Get online users
  getOnlineUsers(sessionId, callback) {
    if (!this.socket) return;
    this.socket.emit('get_online_users', { sessionId });
    this.socket.once('online_users', callback);
  }

  // Video room methods (multi-participant)
  joinVideoRoom(sessionId) {
    if (!this.socket) return;
    this.socket.emit('join_video_room', { sessionId });
    console.log(`📹 Joining video room for session: ${sessionId}`);
  }

  leaveVideoRoom(sessionId) {
    if (!this.socket) return;
    this.socket.emit('leave_video_room', { sessionId });
    console.log(`👋 Leaving video room for session: ${sessionId}`);
  }

  onVideoRoomJoined(callback) {
    if (!this.socket) return;
    this.socket.on('video_room_joined', callback);
  }

  onUserJoinedVideo(callback) {
    if (!this.socket) return;
    this.socket.on('user_joined_video', callback);
  }

  onUserLeftVideo(callback) {
    if (!this.socket) return;
    this.socket.on('user_left_video', callback);
  }

  offVideoRoomJoined(callback) {
    if (!this.socket) return;
    this.socket.off('video_room_joined', callback);
  }

  offUserJoinedVideo(callback) {
    if (!this.socket) return;
    this.socket.off('user_joined_video', callback);
  }

  offUserLeftVideo(callback) {
    if (!this.socket) return;
    this.socket.off('user_left_video', callback);
  }

  // WebRTC signaling for multi-participant rooms
  sendWebRTCSignal(sessionId, targetUserId, signalType, signalData) {
    if (!this.socket) return;
    this.socket.emit('webrtc_signal', {
      sessionId,
      targetUserId,
      signalType, // 'offer', 'answer', 'ice-candidate'
      signalData
    });
    console.log(`🔌 Sent WebRTC ${signalType} to user ${targetUserId || 'all'} in session ${sessionId}`);
  }

  onWebRTCSignal(callback) {
    if (!this.socket) return;
    this.socket.on('webrtc_signal', callback);
  }

  offWebRTCSignal(callback) {
    if (!this.socket) return;
    this.socket.off('webrtc_signal', callback);
  }

  // Deprecated 1:1 video call methods (kept for backward compatibility)
  requestVideoCall(sessionId, receiverId = null) {
    if (!this.socket) return;
    // If an offer is passed as the third argument, include it so the server can relay it to peers
    const offer = arguments.length >= 3 ? arguments[2] : null;
    const payload = { sessionId, receiverId };
    if (offer) payload.offer = offer;
    this.socket.emit('video_request', payload);
  }

  answerVideoCall(sessionId, callerId, accepted, answer = null) {
    if (!this.socket) return;
    this.socket.emit('video_answer', { sessionId, callerId, accepted, answer });
  }

  endVideoCall(sessionId) {
    if (!this.socket) return;
    this.socket.emit('video_end', { sessionId });
  }

  onVideoRequest(callback) {
    if (!this.socket) return;
    this.socket.on('video_request', callback);
  }

  onVideoAnswer(callback) {
    if (!this.socket) return;
    this.socket.on('video_answer', callback);
  }

  onVideoEnd(callback) {
    if (!this.socket) return;
    this.socket.on('video_end', callback);
  }

  // Deprecated ICE candidate method (use sendWebRTCSignal instead)
  sendIceCandidate(sessionId, candidate, targetUserId) {
    if (!this.socket) return;
    this.socket.emit('ice_candidate', { sessionId, candidate, targetUserId });
  }

  onIceCandidate(callback) {
    if (!this.socket) return;
    this.socket.on('ice_candidate', callback);
  }

  // Vital signs updates
  onVitalUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('vital_update', callback);
  }

  // Location updates
  onLocationUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('location_update', callback);
  }

  // Session ended event
  onSessionEnded(callback) {
    if (!this.socket) return;
    this.socket.on('session_ended', callback);
  }

  offSessionEnded(callback) {
    if (!this.socket) return;
    this.socket.off('session_ended', callback);
  }

  // Notifications
  onNotification(callback) {
    if (!this.socket) return;
    this.socket.on('notification', callback);
  }

  offNotification(callback) {
    if (!this.socket) return;
    this.socket.off('notification', callback);
  }

  // Generic event listener
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  emit(event, data) {
    if (!this.socket) return;
    this.socket.emit(event, data);
  }
}

// Export singleton instance
export default new SocketService();
