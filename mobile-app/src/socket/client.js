// Socket.IO singleton. Connects with the current JWT in handshake.auth and
// exposes helpers to join/leave session + ambulance rooms. Re-connecting with
// a refreshed token is handled by disconnect()/connect() — the auth store
// drives that on token change.

import { io } from 'socket.io-client';
import { SOCKET_URL } from '../lib/config';
import { StorageKeys, getItem } from '../lib/storage';

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;
  const token = await getItem(StorageKeys.accessToken);
  if (!token) return null;

  socket?.disconnect();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function joinSession(sessionId) {
  socket?.emit('join_session', { sessionId });
}

export function leaveSession(sessionId) {
  socket?.emit('leave_session', { sessionId });
}

export function joinAmbulance(ambulanceId) {
  socket?.emit('join_ambulance', { ambulanceId });
}

export function leaveAmbulance(ambulanceId) {
  socket?.emit('leave_ambulance', { ambulanceId });
}
