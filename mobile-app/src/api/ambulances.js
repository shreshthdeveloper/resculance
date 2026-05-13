// Ambulance + ambulance-device endpoints. Device endpoints proxy through
// the backend to vehicleview.live — they need the device to have been
// authenticated first (POST /ambulances/devices/:id/authenticate).

import { api } from './client';

export async function getMyAmbulances() {
  const res = await api.get('/ambulances/my-ambulances');
  return res.data?.data?.ambulances ?? [];
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
  return res.data?.data?.ambulance;
}

export async function getAssignedUsers(ambulanceId) {
  const res = await api.get(`/ambulances/${ambulanceId}/assigned-users`);
  return res.data.data?.users ?? res.data.data ?? [];
}

export async function updateAmbulanceLocation(id, latitude, longitude) {
  await api.post(`/ambulances/${id}/location`, { latitude, longitude });
}

// --- Full CRUD (admin / superadmin) --------------------------------------

export async function createAmbulance(input) {
  const res = await api.post('/ambulances', input);
  return res.data?.data?.ambulance ?? res.data?.data;
}

export async function updateAmbulance(id, input) {
  const res = await api.put(`/ambulances/${id}`, input);
  return res.data?.data?.ambulance ?? res.data?.data;
}

export async function approveAmbulance(id) {
  await api.patch(`/ambulances/${id}/approve`);
}

export async function assignUserToAmbulance(ambulanceId, userId, assigningOrganizationId) {
  // Backend (ambulanceController.assignUser) expects:
  //   { userId, assigningOrganizationId? }
  // assigningOrganizationId is only needed when a superadmin is performing
  // the assignment — for hospital/fleet admins it's derived from the JWT.
  const body = assigningOrganizationId
    ? { userId, assigningOrganizationId }
    : { userId };
  await api.post(`/ambulances/${ambulanceId}/assign`, body);
}

export async function unassignUserFromAmbulance(ambulanceId, userId) {
  await api.delete(`/ambulances/${ambulanceId}/unassign/${userId}`);
}

export async function activateAmbulance(id) {
  await api.patch(`/ambulances/${id}/activate`);
}

export async function deactivateAmbulance(id) {
  await api.patch(`/ambulances/${id}/deactivate`);
}

export async function deleteAmbulance(id) {
  await api.delete(`/ambulances/${id}`);
}

// --- Devices (vehicleview.live proxy) -------------------------------------

export async function listAmbulanceDevices(ambulanceId) {
  const res = await api.get(`/ambulances/${ambulanceId}/devices`);
  return res.data.data?.devices ?? res.data.data ?? [];
}

// GET /ambulances/:ambulanceId/devices/location — last GPS for all of an
// ambulance's devices.
export async function getAmbulanceDevicesLocation(ambulanceId) {
  const res = await api.get(`/ambulances/${ambulanceId}/devices/location`);
  return res.data.data;
}

export async function getDeviceLocation(deviceId) {
  const res = await api.get(`/ambulances/devices/${deviceId}/location`);
  return res.data.data;
}

// Returns a media stream URL (camera channel) once the device has been
// authenticated. Useful when wiring up a live camera viewer.
export async function getDeviceStream(deviceId) {
  const res = await api.get(`/ambulances/devices/${deviceId}/stream`);
  return res.data.data;
}

export async function getDeviceData(deviceId, channel) {
  const res = await api.get(`/ambulances/devices/${deviceId}/data`, {
    params: channel ? { channel } : undefined,
  });
  return res.data.data;
}

export async function authenticateDevice(deviceId) {
  const res = await api.post(`/ambulances/devices/${deviceId}/authenticate`);
  return res.data.data;
}
