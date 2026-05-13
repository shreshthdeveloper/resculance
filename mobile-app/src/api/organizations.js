// Organization list / lookup + full CRUD (superadmin only on the backend).
//
// Backend: GET /organizations returns { organizations, pagination }. Filters:
//   type: 'hospital' | 'fleet_owner'
//   status: 'active' | 'inactive' | 'suspended'

import { api } from './client';

export async function listOrganizations({
  type,
  status = 'active',
  limit = 200,
  search,
} = {}) {
  const params = { limit };
  if (status) params.status = status;
  if (type) params.type = type;
  if (search) params.search = search;
  const res = await api.get('/organizations', { params });
  return res.data?.data?.organizations ?? [];
}

export async function getOrganization(id) {
  const res = await api.get(`/organizations/${id}`);
  return res.data?.data?.organization ?? res.data?.data;
}

// POST /organizations — superadmin only. Required fields:
//   name, type ('hospital' | 'fleet_owner'), email
// Optional: code, phone, address, city, state, country, postalCode,
//           registrationNumber, licenseNumber.
export async function createOrganization(input) {
  const res = await api.post('/organizations', input);
  return res.data?.data?.organization ?? res.data?.data;
}

export async function updateOrganization(id, input) {
  const res = await api.put(`/organizations/${id}`, input);
  return res.data?.data?.organization ?? res.data?.data;
}

export async function deactivateOrganization(id) {
  await api.patch(`/organizations/${id}/deactivate`);
}

export async function suspendOrganization(id, reason) {
  await api.patch(`/organizations/${id}/suspend`, reason ? { reason } : undefined);
}

export async function activateOrganization(id) {
  await api.patch(`/organizations/${id}/activate`);
}

export async function deleteOrganization(id) {
  await api.delete(`/organizations/${id}`);
}
