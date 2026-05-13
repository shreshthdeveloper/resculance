import { api } from './client';

export async function getMyAmbulances() {
  const res = await api.get('/ambulances/my-ambulances');
  return res.data.data.ambulances ?? [];
}

// Superadmin-friendly ambulance list — uses /ambulances (with the active
// org id auto-injected by the API client) instead of /my-ambulances. For
// a superadmin who has selected an org this returns that org's fleet; for
// other roles you should use getMyAmbulances() which is staff-assigned-only.
export async function listAmbulancesForOrg(params = {}) {
  const res = await api.get('/ambulances', { params });
  return res.data?.data?.ambulances ?? [];
}

export async function getAmbulance(id) {
  const res = await api.get(`/ambulances/${id}`);
  return res.data.data.ambulance;
}

export async function updateAmbulanceLocation(id, latitude, longitude) {
  await api.post(`/ambulances/${id}/location`, { latitude, longitude });
}
