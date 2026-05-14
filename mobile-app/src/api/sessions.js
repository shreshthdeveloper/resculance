// Session + session-data endpoints. Sessions live under two REST prefixes
// on the backend:
//   /sessions/*           — metadata + session-data (notes/medications/files)
//   /patients/sessions/*  — full session detail (vitals + messages joined in)
// The wrappers below pick the right one per use case.

import { api } from './client';
import { API_URL } from '../lib/config';
import { StorageKeys, getItem } from '../lib/storage';

export async function listSessions(params = {}) {
  const res = await api.get('/sessions', { params });
  return res.data.data;
}

// GET /patients/sessions — the patients-route session listing. Distinct
// from /sessions (sessionController) in two important ways:
//
//   1. Supports a special `ambulanceId + limit=1` shortcut that returns
//      the latest session for an ambulance AND a `hasSession` boolean.
//      The boolean is true when a session exists on the backend even if
//      the API redacts its body (e.g. a hospital user looking at an
//      ambulance that's outbound for a different hospital). The web's
//      Onboarding page uses exactly this path to decide what action
//      buttons to render per ambulance.
//
//   2. `status='active'` is server-side expanded to
//      {status: {$in: ['onboarded', 'in_transit']}}, so the union of
//      in-flight sessions is just one call.
//
// Returns the raw `data` object: { sessions, pagination, hasSession }.
export async function listPatientSessions(params = {}) {
  const res = await api.get('/patients/sessions', { params });
  return res.data.data ?? { sessions: [], pagination: null, hasSession: false };
}

// Convenience wrapper that mirrors the web's fetchSessionForAmbulance:
// returns { session, redacted, hasSession }.
//
//   - session: the populated session, or null if none.
//   - redacted: true when the backend says hasSession but didn't return
//     the body (caller can't see the details).
//   - hasSession: raw flag straight from the backend.
export async function getActiveSessionForAmbulance(ambulanceId) {
  const data = await listPatientSessions({ ambulanceId, limit: 1 });
  const session = Array.isArray(data.sessions) && data.sessions.length > 0
    ? data.sessions[0]
    : null;
  const hasSession = !!data.hasSession;
  return {
    session,
    hasSession,
    redacted: hasSession && !session,
  };
}

// GET /sessions/stats — aggregate counts by status.
// Backend wraps in `{ stats: {...} }` (sessionController.js:195). Unwrap so
// callers get the flat counts object directly (total_sessions, onboarded,
// in_transit, offboarded, cancelled, avg_duration_minutes). The previous
// `res.data.data ?? {}` returned the wrapper itself, so every consumer read
// `undefined` for the counts.
export async function getSessionStats() {
  const res = await api.get('/sessions/stats');
  return res.data.data?.stats ?? res.data.data ?? {};
}

// Returns { session, vitals, communications }. Uses the patient-routes
// endpoint (not /sessions/:id) because only that one returns vitals +
// communications. /sessions/:id is metadata-only.
export async function getSession(id) {
  const res = await api.get(`/patients/sessions/${id}`);
  return res.data.data;
}

export async function offboardSession(id, treatmentNotes) {
  await api.patch(`/patients/sessions/${id}/offboard`, { treatmentNotes });
}

export async function sendMessage(sessionId, input) {
  const res = await api.post(`/patients/sessions/${sessionId}/messages`, input);
  return res.data.data;
}

export async function listMessages(sessionId, limit = 100) {
  const res = await api.get(`/patients/sessions/${sessionId}/messages`, {
    params: { limit },
  });
  return res.data.data.messages ?? [];
}

export async function markMessageRead(messageId) {
  await api.patch(`/patients/messages/${messageId}/read`);
}

export async function getUnreadMessageCount(sessionId) {
  const res = await api.get(`/patients/sessions/${sessionId}/unread-count`);
  // Backend returns `{ unreadCount: count }` (patientController.js:1360).
  // The original code read `data?.count`, which is always undefined → badge
  // never updated. Tolerate the legacy `count` shape too in case any
  // pre-refactor server is still in the wild.
  return Number(res.data.data?.unreadCount ?? res.data.data?.count ?? 0);
}

export async function addVitalSigns(patientId, input) {
  const res = await api.post(`/patients/${patientId}/vital-signs`, input);
  return res.data.data;
}

export async function listVitalSigns(patientId, limit = 20) {
  const res = await api.get(`/patients/${patientId}/vital-signs`, {
    params: { limit },
  });
  return res.data.data.vitalSigns ?? [];
}

// --- Session data (notes / medications / files) ----------------------------

// GET /sessions/:id/data — returns { notes, medications, files, counts }.
export async function listSessionData(sessionId) {
  const res = await api.get(`/sessions/${sessionId}/data`);
  return res.data.data ?? { notes: [], medications: [], files: [], counts: {} };
}

// POST /sessions/:id/data — add a typed entry: dataType ∈ {note, medication, file}.
export async function addSessionData(sessionId, dataType, content) {
  const res = await api.post(`/sessions/${sessionId}/data`, { dataType, content });
  return res.data.data;
}

// POST /sessions/:id/data/upload — multipart 'file'. file is a RN asset:
//   { uri, name, type }
export async function uploadSessionFile(sessionId, file, onProgress) {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name || 'upload',
    type: file.type || 'application/octet-stream',
  });
  const res = await api.post(`/sessions/${sessionId}/data/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
    onUploadProgress: onProgress
      ? (evt) => onProgress(evt.loaded, evt.total)
      : undefined,
  });
  return res.data.data;
}

// DELETE /sessions/:id/data/:dataId.
export async function deleteSessionData(sessionId, dataId) {
  await api.delete(`/sessions/${sessionId}/data/${dataId}`);
}

// Build a download URL for a session file. The endpoint streams the file
// behind auth — we attach the token as a query parameter so the WebView /
// system download manager can authenticate.
export async function buildSessionFileDownloadUrl(sessionId, dataId) {
  const token = await getItem(StorageKeys.accessToken);
  const base = API_URL.replace(/\/$/, '');
  // The /uploads static route lives at the API origin, not under /api/v1.
  // But the file-download endpoint /sessions/:id/data/files/:dataId/download
  // sits under the API base. Use the API base for download.
  const sep = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/sessions/${sessionId}/data/files/${dataId}/download${sep}`;
}
