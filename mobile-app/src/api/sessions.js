import { api } from './client';

export async function listSessions(params = {}) {
  const res = await api.get('/sessions', { params });
  return res.data.data;
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
