// Collaboration requests + the partnerships that result from them.
//
// Backend model:
//   - Hospital or fleet creates a CollaborationRequest targeted at the other
//     side. The recipient can accept, reject, or the requester can cancel.
//   - On accept, a Partnership row is created (or healed if there's a
//     dangling one). Partnerships are queryable via /partnerships/my.
//
// All routes require auth. Create/accept/reject/cancel are admin-only on
// either side (HOSPITAL_ADMIN | HOSPITAL_STAFF | FLEET_ADMIN | FLEET_STAFF).

import { api } from './client';

// GET /collaborations — list requests visible to the user. Optional params:
//   status: 'pending' | 'approved' | 'rejected' | 'cancelled'
//   direction: 'incoming' | 'outgoing'  (frontend-friendly filter)
export async function listCollaborations(params = {}) {
  const res = await api.get('/collaborations', { params });
  return (
    res.data.data?.collaborations ??
    res.data.data?.requests ??
    res.data.data ??
    []
  );
}

export async function getCollaboration(id) {
  const res = await api.get(`/collaborations/${id}`);
  return res.data.data?.collaboration ?? res.data.data;
}

// POST /collaborations — requesterOrganizationId comes from the JWT; payload
// is { targetOrganizationId, message? } typically.
export async function createCollaboration(input) {
  const res = await api.post('/collaborations', input);
  return res.data.data;
}

export async function acceptCollaboration(id, message) {
  const res = await api.patch(`/collaborations/${id}/accept`, { message });
  return res.data.data;
}

export async function rejectCollaboration(id, message) {
  const res = await api.patch(`/collaborations/${id}/reject`, { message });
  return res.data.data;
}

export async function cancelCollaboration(id) {
  const res = await api.patch(`/collaborations/${id}/cancel`);
  return res.data.data;
}

// GET /collaborations/partnerships/my — the active partnerships for the
// caller's organization (hospitals see their fleets; fleets see their
// hospitals).
export async function listMyPartnerships() {
  const res = await api.get('/collaborations/partnerships/my');
  return (
    res.data.data?.partnerships ??
    res.data.data ??
    []
  );
}
