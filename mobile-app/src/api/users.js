// Users CRUD wrappers. Backend routes are at /users/* and gated by
// requirePermission(CREATE_USER / UPDATE_USER / DELETE_USER / APPROVE_USER)
// on the backend — the mobile UI gates with the same permissions util so
// users only see actions they can actually perform.

import { api } from './client';

export async function listUsers(params = {}) {
  // Backend supports: organizationId, role, status, search, limit, page.
  const res = await api.get('/users', { params });
  return res.data?.data ?? { users: [], pagination: null };
}

export async function getUser(id) {
  const res = await api.get(`/users/${id}`);
  return res.data?.data?.user ?? res.data?.data;
}

export async function createUser(input) {
  // Same payload shape as POST /auth/register, with organizationId required
  // for non-superadmin creators (the backend enforces it).
  const res = await api.post('/users', input);
  return res.data?.data?.user ?? res.data?.data;
}

export async function updateUser(id, input) {
  const res = await api.put(`/users/${id}`, input);
  return res.data?.data?.user ?? res.data?.data;
}

export async function approveUser(id) {
  await api.patch(`/users/${id}/approve`);
}

export async function suspendUser(id, reason) {
  await api.patch(`/users/${id}/suspend`, reason ? { reason } : undefined);
}

export async function activateUser(id) {
  await api.patch(`/users/${id}/activate`);
}

export async function deleteUser(id) {
  await api.delete(`/users/${id}`);
}

// POST /users/:id/profile-image — multipart 'avatar'. Pass a RN asset:
//   { uri, name, type }
export async function uploadUserProfileImage(id, file) {
  const form = new FormData();
  form.append('avatar', {
    uri: file.uri,
    name: file.name || 'avatar.jpg',
    type: file.type || 'image/jpeg',
  });
  const res = await api.post(`/users/${id}/profile-image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
  return res.data?.data?.user ?? res.data?.data;
}
