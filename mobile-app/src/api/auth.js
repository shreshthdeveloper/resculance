// Auth-related endpoints. The login/refresh tokens are handled inside the
// axios interceptor (api/client.js); these are the user-facing calls.

import { api } from './client';

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data;
}

export async function getProfile() {
  const res = await api.get('/auth/profile');
  return res.data.data.user;
}

// PUT /auth/profile — partial update of the current user. The backend
// accepts camelCase keys and returns the updated user record.
export async function updateProfile(input) {
  const res = await api.put('/auth/profile', input);
  return res.data.data?.user ?? res.data.data;
}

// PUT /auth/change-password — { currentPassword, newPassword }.
export async function changePassword(currentPassword, newPassword) {
  const res = await api.put('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return res.data;
}

// POST /auth/profile/image — multipart 'avatar' field. Pass a React-Native
// file object: { uri, name, type }.
export async function uploadProfileImage(file) {
  const form = new FormData();
  form.append('avatar', {
    uri: file.uri,
    name: file.name || 'avatar.jpg',
    type: file.type || 'image/jpeg',
  });
  const res = await api.post('/auth/profile/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data, // axios would otherwise stringify FormData
  });
  return res.data.data?.user ?? res.data.data;
}

// POST /auth/forgot-password — fire-and-forget email trigger.
export async function forgotPassword(email) {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
}
