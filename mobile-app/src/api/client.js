// Axios instance for the resculance backend.
//
// - Reads accessToken/refreshToken from secure storage on every request.
// - On a 401, swaps in a fresh access token via /auth/refresh-token and retries
//   the original request once. Concurrent 401s share a single refresh promise.
// - On refresh failure, clears stored tokens and fires the onUnauthorized hook
//   so the auth store can flip the user back to the login screen.

import axios from 'axios';
import { API_URL } from '../lib/config';
import { StorageKeys, getItem, removeItem, setItem } from '../lib/storage';

let unauthorizedHandler = null;

export function setOnUnauthorized(fn) {
  unauthorizedHandler = fn;
}

// Set by the auth store at startup. The API client uses these to:
//   - read the current user's role (to decide whether to inject org id)
//   - read the superadmin's "viewing as" org id
// Wired through a setter rather than imported directly to avoid a circular
// dependency (store → api/client → store).
let getAuthContext = () => ({ role: null, activeOrgId: null });
export function setAuthContextProvider(fn) {
  getAuthContext = fn;
}

// Endpoints whose JWT-only behaviour we don't want to override. These either
// don't accept organizationId or have role-specific semantics where adding
// the param would change the response shape.
const SKIP_ORG_INJECTION = [
  '/auth/',
  '/notifications',
  '/ambulances/my-ambulances',
  '/dashboard/stats',
  '/organizations', // the list endpoint itself
];

function shouldInjectOrgId(config) {
  const url = config?.url ?? '';
  if (SKIP_ORG_INJECTION.some((p) => url.startsWith(p) || url.includes(p))) return false;
  return true;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await getItem(StorageKeys.accessToken);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Superadmin only: inject the "viewing as" org id into requests that need
  // it. The backend refuses to guess for superadmin and returns 400 otherwise
  // (see sessionController.js / userController.js / ambulanceController.js).
  // We attach it as a query param — the backend reads from req.query for the
  // endpoints used by the mobile app.
  const ctx = getAuthContext();
  if (ctx.role === 'superadmin' && ctx.activeOrgId && shouldInjectOrgId(config)) {
    config.params = config.params ?? {};
    // Don't overwrite an explicit organizationId that the caller already set.
    if (config.params.organizationId == null) {
      config.params.organizationId = ctx.activeOrgId;
    }
  }
  return config;
});

// Single in-flight refresh — prevents N parallel failed requests from each
// hitting /auth/refresh-token.
let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await getItem(StorageKeys.refreshToken);
      if (!refreshToken) return null;
      // Use a bare axios call to avoid the interceptor loop.
      const res = await axios.post(`${API_URL}/auth/refresh-token`, {
        refreshToken,
      });
      const next = res.data?.data?.accessToken;
      if (!next) return null;
      await setItem(StorageKeys.accessToken, next);
      return next;
    } catch {
      return null;
    } finally {
      // Release the lock on next tick so concurrent callers all see the result.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry) {
      // Don't try to refresh from the refresh endpoint itself.
      const isRefreshCall = original.url?.includes('/auth/refresh-token');
      if (isRefreshCall) {
        await clearTokens();
        unauthorizedHandler?.();
        return Promise.reject(error);
      }

      original._retry = true;
      const next = await refreshAccessToken();
      if (next) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${next}`;
        return api.request(original);
      }
      await clearTokens();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export async function clearTokens() {
  await removeItem(StorageKeys.accessToken);
  await removeItem(StorageKeys.refreshToken);
  await removeItem(StorageKeys.user);
}

// Extracts a useful error message from the backend's `{ success, message }`
// shape, falling back to the axios error message.
export function errorMessage(err) {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? 'Request failed';
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
