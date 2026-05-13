const jwt = require('jsonwebtoken');
const { SOCKET_EVENTS } = require('../config/constants');
const mediasoupService = require('../services/mediasoupService');

let ioInstance = null;

const authenticateSocket = (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      console.warn('Socket auth failed: no token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    console.warn('Socket auth failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
};

const socketHandler = (io) => {
  ioInstance = io;
  io.use(authenticateSocket);

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    console.log(`✅ Socket connected: user=${socket.user.id} role=${socket.user.role}`);
    socket.activeVideoSessions = new Set();

    socket.join(`user_${socket.user.id}`);

    socket.on(SOCKET_EVENTS.JOIN_AMBULANCE, (data = {}) => {
      const { ambulanceId } = data;
      if (!ambulanceId) return;
      socket.join(`ambulance_${ambulanceId}`);
      socket.emit('joined_ambulance', { success: true, ambulanceId });
    });

    socket.on(SOCKET_EVENTS.LEAVE_AMBULANCE, (data = {}) => {
      const { ambulanceId } = data;
      if (!ambulanceId) return;
      socket.leave(`ambulance_${ambulanceId}`);
    });

    socket.on('leave_session', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      socket.leave(`session_${sessionId}`);
      socket.to(`session_${sessionId}`).emit('user_left', {
        sessionId,
        userId: socket.user.id,
        userName: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim()
      });
    });

    socket.on(SOCKET_EVENTS.VITAL_UPDATE, (data = {}) => {
      const { sessionId, vitals } = data;
      if (!sessionId) return;
      io.to(`session_${sessionId}`).emit(SOCKET_EVENTS.VITAL_UPDATE, {
        sessionId,
        vitals,
        timestamp: new Date().toISOString(),
        updatedBy: socket.user.id
      });
    });

    socket.on(SOCKET_EVENTS.LOCATION_UPDATE, (data = {}) => {
      const { ambulanceId, latitude, longitude } = data;
      if (!ambulanceId) return;
      io.to(`ambulance_${ambulanceId}`).emit(SOCKET_EVENTS.LOCATION_UPDATE, {
        ambulanceId,
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
    });

    socket.on(SOCKET_EVENTS.MESSAGE, (data = {}) => {
      const { sessionId, message, messageType, metadata } = data;
      if (!sessionId) return;
      io.to(`session_${sessionId}`).emit(SOCKET_EVENTS.MESSAGE, {
        sessionId,
        senderId: socket.user.id,
        senderFirstName: socket.user.firstName,
        senderLastName: socket.user.lastName,
        senderRole: socket.user.role,
        message,
        messageType: messageType || 'text',
        metadata,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('typing_start', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      socket.to(`session_${sessionId}`).emit('user_typing', {
        sessionId,
        userId: socket.user.id,
        userName: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim(),
        userRole: socket.user.role,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      socket.to(`session_${sessionId}`).emit('user_typing', {
        sessionId,
        userId: socket.user.id,
        isTyping: false
      });
    });

    socket.on('message_read', (data = {}) => {
      const { sessionId, messageId } = data;
      if (!sessionId || !messageId) return;
      io.to(`session_${sessionId}`).emit('message_read', {
        sessionId,
        messageId,
        userId: socket.user.id,
        readAt: new Date().toISOString()
      });
    });

    socket.on('get_online_users', (data = {}) => {
      const { sessionId } = data;
      const room = io.sockets.adapter.rooms.get(`session_${sessionId}`);
      const onlineUsers = [];
      if (room) {
        for (const socketId of room) {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.user) {
            onlineUsers.push({
              id: s.user.id,
              firstName: s.user.firstName,
              lastName: s.user.lastName,
              role: s.user.role,
              email: s.user.email
            });
          }
        }
      }
      socket.emit('online_users', { sessionId, users: onlineUsers });
    });

    socket.on('join_session', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      socket.join(`session_${sessionId}`);
      socket.to(`session_${sessionId}`).emit('user_joined', {
        sessionId,
        userId: socket.user.id,
        userName: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim(),
        userRole: socket.user.role
      });
      socket.emit('joined_session', { success: true, sessionId });
    });

    // Legacy 1:1 call events (kept for backward compatibility)
    socket.on(SOCKET_EVENTS.CALL_REQUEST, (data = {}) => {
      const { sessionId, receiverId } = data;
      if (!sessionId) return;
      io.to(`session_${sessionId}`).emit(SOCKET_EVENTS.CALL_REQUEST, {
        sessionId,
        callerId: socket.user.id,
        callerRole: socket.user.role,
        receiverId,
        timestamp: new Date().toISOString()
      });
    });
    socket.on(SOCKET_EVENTS.CALL_ANSWER, (data = {}) => {
      const { sessionId, callerId, accepted } = data;
      if (!sessionId) return;
      io.to(`session_${sessionId}`).emit(SOCKET_EVENTS.CALL_ANSWER, {
        sessionId,
        responderId: socket.user.id,
        callerId,
        accepted,
        timestamp: new Date().toISOString()
      });
    });
    socket.on(SOCKET_EVENTS.CALL_END, (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      io.to(`session_${sessionId}`).emit(SOCKET_EVENTS.CALL_END, {
        sessionId,
        endedBy: socket.user.id,
        timestamp: new Date().toISOString()
      });
    });

    // Multi-participant video rooms
    socket.on('join_video_room', (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      const roomName = `video_session_${sessionId}`;
      socket.join(roomName);

      const room = io.sockets.adapter.rooms.get(roomName);
      const participants = [];
      if (room) {
        for (const socketId of room) {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.user && s.user.id !== socket.user.id) {
            participants.push({
              id: s.user.id,
              firstName: s.user.firstName,
              lastName: s.user.lastName,
              role: s.user.role
            });
          }
        }
      }

      socket.emit('video_room_joined', { sessionId, participants });
      socket.to(roomName).emit('user_joined_video', {
        sessionId,
        userId: socket.user.id,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        role: socket.user.role,
        timestamp: new Date().toISOString()
      });
      socket.activeVideoSessions.add(sessionId);
    });

    socket.on('leave_video_room', async (data = {}) => {
      const { sessionId } = data;
      if (!sessionId) return;
      const roomName = `video_session_${sessionId}`;
      socket.leave(roomName);
      try { await mediasoupService.cleanupPeer(sessionId, socket.user.id); } catch (e) { console.error(e); }
      socket.activeVideoSessions.delete(sessionId);
      socket.to(roomName).emit('user_left_video', {
        sessionId,
        userId: socket.user.id,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('webrtc_signal', (data = {}) => {
      const { sessionId, targetUserId, signalType, signalData } = data;
      if (!sessionId) return;
      const payload = {
        sessionId,
        fromUserId: socket.user.id,
        fromUserFirstName: socket.user.firstName,
        fromUserLastName: socket.user.lastName,
        signalType,
        signalData,
        timestamp: new Date().toISOString()
      };
      if (targetUserId) {
        io.to(`user_${targetUserId}`).emit('webrtc_signal', payload);
      } else {
        socket.to(`video_session_${sessionId}`).emit('webrtc_signal', payload);
      }
    });

    // --- Mediasoup SFU ---
    socket.on('getRouterRtpCapabilities', async (data = {}, cb) => {
      try {
        const rtpCapabilities = await mediasoupService.getRtpCapabilities(data.sessionId);
        cb && cb({ success: true, rtpCapabilities });
      } catch (e) {
        cb && cb({ success: false, error: e.message });
      }
    });

    socket.on('createWebRtcTransport', async (data = {}, cb) => {
      try {
        const opts = await mediasoupService.createWebRtcTransport(data.sessionId, socket.user.id);
        cb && cb({ success: true, ...opts });
      } catch (e) {
        cb && cb({ success: false, error: e.message });
      }
    });

    socket.on('connectWebRtcTransport', async (data = {}, cb) => {
      try {
        await mediasoupService.connectTransport(data.transportId, data.dtlsParameters);
        cb && cb({ success: true });
      } catch (e) {
        cb && cb({ success: false, error: e.message });
      }
    });

    socket.on('produce', async (data = {}, cb) => {
      try {
        const producerId = await mediasoupService.produce(
          data.transportId, data.kind, data.rtpParameters, data.sessionId, socket.user.id
        );
        socket.to(`video_session_${data.sessionId}`).emit('newProducer', {
          producerId,
          userId: socket.user.id,
          userName: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim(),
          kind: data.kind
        });
        cb && cb({ success: true, producerId });
      } catch (e) {
        cb && cb({ success: false, error: e.message });
      }
    });

    socket.on('consume', async (data = {}, cb) => {
      try {
        const params = await mediasoupService.consume(
          data.transportId, data.producerId, data.rtpCapabilities, data.sessionId, socket.user.id
        );
        if (!params) return cb && cb({ success: false, error: 'Cannot consume this producer' });
        cb && cb({ success: true, ...params });
      } catch (e) {
        cb && cb({ success: false, error: e.message });
      }
    });

    socket.on('resumeConsumer', async (data = {}, cb) => {
      try { await mediasoupService.resumeConsumer(data.consumerId); cb && cb({ success: true }); }
      catch (e) { cb && cb({ success: false, error: e.message }); }
    });
    socket.on('pauseConsumer', async (data = {}, cb) => {
      try { await mediasoupService.pauseConsumer(data.consumerId); cb && cb({ success: true }); }
      catch (e) { cb && cb({ success: false, error: e.message }); }
    });
    socket.on('getProducers', (data = {}, cb) => {
      try {
        const producers = mediasoupService.getProducersInSession(data.sessionId, socket.user.id);
        cb && cb({ success: true, producers });
      } catch (e) {
        cb && cb({ success: false, error: e.message });
      }
    });

    socket.on('emergency_alert', (data = {}) => {
      const { ambulanceId, sessionId, alertType, message } = data;
      if (!ambulanceId) return;
      io.to(`ambulance_${ambulanceId}`).emit('emergency_alert', {
        ambulanceId,
        sessionId,
        alertType,
        message,
        userId: socket.user.id,
        userRole: socket.user.role,
        timestamp: new Date().toISOString()
      });
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, async (reason) => {
      console.log(`❌ Socket disconnected: user=${socket.user.id} reason=${reason}`);
      if (socket.activeVideoSessions && socket.activeVideoSessions.size > 0) {
        for (const sessionId of socket.activeVideoSessions) {
          try {
            await mediasoupService.cleanupPeer(sessionId, socket.user.id);
            socket.to(`video_session_${sessionId}`).emit('user_left_video', {
              sessionId,
              userId: socket.user.id,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.error('Error cleaning up mediasoup session', sessionId, e.message);
          }
        }
      }
    });

    socket.on('error', (error) => console.error('Socket error:', error));
  });

  io.on('error', (e) => console.error('Socket.IO error:', e));
  console.log('✅ Socket.IO handler initialized');
};

const emitNotification = (userId, notification) => {
  if (ioInstance) ioInstance.to(`user_${userId}`).emit('notification', notification);
};

const emitBulkNotifications = (notifications) => {
  if (ioInstance && Array.isArray(notifications)) {
    notifications.forEach((n) => {
      if (n.userId) ioInstance.to(`user_${n.userId}`).emit('notification', n);
    });
  }
};

const emitToSession = (sessionId, event, payload) => {
  if (ioInstance) ioInstance.to(`session_${sessionId}`).emit(event, payload);
};

const emitToAmbulance = (ambulanceId, event, payload) => {
  if (ioInstance) ioInstance.to(`ambulance_${ambulanceId}`).emit(event, payload);
};

module.exports = socketHandler;
module.exports.emitNotification = emitNotification;
module.exports.emitBulkNotifications = emitBulkNotifications;
module.exports.emitToSession = emitToSession;
module.exports.emitToAmbulance = emitToAmbulance;
