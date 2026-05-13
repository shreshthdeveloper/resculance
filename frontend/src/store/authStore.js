import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      // legacy alias used by other components
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      initialize: async () => {
        const token = localStorage.getItem('accessToken');
        const storedUser = get().user;

        if (token) {
          // Always attempt to refresh the authoritative profile from the server when we have a token.
          // This ensures fields like organizationId/organizationType createdAt etc. are present
          // even if the persisted user shape is older or incomplete.
          try {
            set({ loading: true });
            const response = await authService.getProfile();
            const user = response.data?.data?.user || response.data?.user || null;
            set({
              user,
              accessToken: token,
              token: token,
              refreshToken: localStorage.getItem('refreshToken'),
              isAuthenticated: !!user,
              loading: false,
            });
          } catch (error) {
            console.error('Failed to initialize auth (profile refresh):', error);
            // If profile refresh fails, clear local tokens and stored user to force a re-login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            set({
              user: null,
              accessToken: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              loading: false,
            });
          }
        }
      },

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          console.log('AuthStore: Calling authService.login');
          const response = await authService.login(email, password);
          console.log('AuthStore: Login response:', response);
          
          const { accessToken, refreshToken, user } = response.data?.data || {};
          console.log('AuthStore: Extracted tokens and user:', { accessToken: !!accessToken, refreshToken: !!refreshToken, user });
          
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          
          set({
            user,
            accessToken,
            token: accessToken,
            refreshToken,
            isAuthenticated: true,
            loading: false,
          });
          
          console.log('AuthStore: State updated, isAuthenticated:', true);
          // Refresh full profile from server to ensure consistent shape (organizationId, createdAt etc.)
          try {
            const profileResp = await authService.getProfile();
            const profileUser = profileResp.data?.data?.user || profileResp.data?.user || null;
            if (profileUser) set({ user: profileUser });
          } catch (e) {
            // non-fatal: keep lightweight login user if profile fetch fails
            console.warn('Failed to fetch profile after login', e);
          }

          return response;
        } catch (error) {
          console.error('AuthStore: Login error:', error);
          // Prefer backend 'error' field, then 'message', then fallback to axios message
          const serverMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Login failed';
          set({ loading: false, error: serverMsg });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      getProfile: async () => {
        set({ loading: true });
        try {
          const response = await authService.getProfile();
          const user = response.data?.data?.user || response.data?.user || null;
          set({ user, loading: false, isAuthenticated: !!user });
          return response;
        } catch (error) {
          set({ loading: false, error: error.response?.data?.message });
          throw error;
        }
      },

      updateProfile: async (userData) => {
        set({ loading: true });
        try {
          const response = await authService.updateProfile(userData);
          // After updating profile, refresh the profile from server
          const profileResp = await authService.getProfile();
          const user = profileResp.data?.data?.user || profileResp.data?.user || null;
          set({ user, loading: false });
          return response;
        } catch (error) {
          set({ loading: false, error: error.response?.data?.message });
          throw error;
        }
      },

      setUser: (userData) => {
        set({ user: userData });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
