// Auth state — keeps the current user in memory and persists tokens to secure
// storage. `bootstrap()` is called once at app start to rehydrate from disk.
// On token loss (401 → refresh failed), the API client calls `signOut()` via
// the onUnauthorized hook wired up in the root layout.

import { create } from 'zustand';
import { login as loginApi, getProfile } from '../api/auth';
import { clearTokens } from '../api/client';
import { StorageKeys, getItem, removeItem, setItem } from '../lib/storage';
import { connectSocket, disconnectSocket } from '../socket/client';

const THEME_KEY = 'rsl_theme_preference';

export const useAuth = create((set, get) => ({
  status: 'loading',
  user: null,
  // 'light' | 'dark' | 'system' — kept in this store so the whole app
  // re-renders when it changes (it gates useTheme()).
  themePreference: 'system',
  // Superadmin "viewing as" org. Mirrors the frontend pattern: a superadmin
  // has no org of their own, so org-scoped screens (sessions, ambulances,
  // patients) need an explicit selection before the backend will return data.
  // null until the superadmin picks one. Other roles ignore this entirely.
  activeOrg: null,

  setThemePreference(pref) {
    set({ themePreference: pref });
    setItem(THEME_KEY, pref).catch(() => {});
  },

  // Persist + apply the superadmin's selected org. Pass `null` to clear.
  async setActiveOrg(org) {
    set({ activeOrg: org });
    if (org) {
      await setItem(StorageKeys.activeOrg, JSON.stringify(org)).catch(() => {});
    } else {
      await removeItem(StorageKeys.activeOrg).catch(() => {});
    }
  },

  async bootstrap() {
    try {
      // Restore the theme preference first so the splash → app transition
      // doesn't briefly flash the wrong palette.
      const storedPref = await getItem(THEME_KEY);
      if (storedPref === 'light' || storedPref === 'dark' || storedPref === 'system') {
        set({ themePreference: storedPref });
      }

      const token = await getItem(StorageKeys.accessToken);
      if (!token) {
        set({ status: 'unauthenticated', user: null, activeOrg: null });
        return;
      }
      // Prefer cached user for snappy boot; refresh in background.
      const cached = await getItem(StorageKeys.user);
      if (cached) {
        try {
          set({ user: JSON.parse(cached), status: 'authenticated' });
        } catch {}
      }
      // Rehydrate the superadmin's "viewing as" org from storage. Safe to
      // do for any role — non-superadmins just never consult this value.
      try {
        const cachedOrg = await getItem(StorageKeys.activeOrg);
        if (cachedOrg) set({ activeOrg: JSON.parse(cachedOrg) });
      } catch {}
      // Verify token is still good (also triggers refresh on 401).
      const user = await getProfile();
      const slim = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        // `phone` was previously omitted from the cached slim object, so the
        // edit-profile screen initialised its phone field to '' even when the
        // backend had a real number — and saving an unchanged form would then
        // clear it server-side (updateProfile treats '' as a real value).
        phone: user.phone ?? '',
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        organization: user.organizationId
          ? {
              id: user.organizationId,
              name: user.organizationName ?? '',
              code: user.organizationCode ?? '',
              type: user.organizationType ?? '',
            }
          : null,
      };
      await setItem(StorageKeys.user, JSON.stringify(slim));
      set({ user: slim, status: 'authenticated' });
      await connectSocket();
    } catch {
      // /auth/profile failed and refresh didn't recover — fall through to login.
      await clearTokens();
      set({ status: 'unauthenticated', user: null, activeOrg: null });
    }
  },

  async signIn(email, password) {
    const { user, accessToken, refreshToken } = await loginApi(email, password);
    await setItem(StorageKeys.accessToken, accessToken);
    await setItem(StorageKeys.refreshToken, refreshToken);
    await setItem(StorageKeys.user, JSON.stringify(user));
    // Fresh session — don't carry a previous superadmin's selection.
    await removeItem(StorageKeys.activeOrg).catch(() => {});
    set({ user, status: 'authenticated', activeOrg: null });
    await connectSocket();
  },

  async signOut() {
    if (get().status === 'unauthenticated') return;
    disconnectSocket();
    await clearTokens();
    await removeItem(StorageKeys.activeOrg).catch(() => {});
    set({ user: null, status: 'unauthenticated', activeOrg: null });
  },
}));
