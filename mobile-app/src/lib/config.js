// Resolves the API + socket URLs from app.config.js (`extra` field) with a
// safe fallback. Centralised so screens never reach into expo-constants directly.

import Constants from 'expo-constants';

const extra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  {};

export const API_URL = extra.apiUrl || 'http://localhost:5000/api/v1';
export const SOCKET_URL =
  extra.socketUrl || API_URL.replace(/\/api\/v\d+\/?$/, '');

// Origin of the web frontend — used to build public shared-session links
// (`${WEB_URL}/sessions/:id`). Falls back to the API origin.
export const WEB_URL =
  extra.webUrl || API_URL.replace(/\/api\/v\d+\/?$/, '');
