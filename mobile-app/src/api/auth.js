import { api } from './client';

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data;
}

export async function getProfile() {
  const res = await api.get('/auth/profile');
  return res.data.data.user;
}
