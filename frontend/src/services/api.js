import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh.
//
// IMPORTANT: skip the refresh-on-401 dance for the auth endpoints themselves.
// Without this guard, a 401 from `/auth/login` (wrong credentials) gets
// caught here, the interceptor finds no refreshToken in localStorage (the
// user hasn't logged in yet), and propagates a misleading
// "No refresh token available" error instead of the real "Invalid email
// or password" from the backend.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh-token') ||
      url.includes('/auth/register');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        // No refresh token → user was never logged in (or already logged
        // out). Don't redirect — just propagate the original 401 so the
        // calling code can decide what to do.
        if (!refreshToken) {
          return Promise.reject(error);
        }

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/auth/refresh-token`,
          { refreshToken }
        );

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Real refresh failure — the stored refresh token is bad / expired
        // / signed with a different secret. Clear and bounce to login.
        localStorage.clear();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
