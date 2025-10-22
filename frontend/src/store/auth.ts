import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      // Actions
      setUser: user =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
        }),

      setLoading: isLoading => set({ isLoading }),

      setError: error => set({ error }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post('/auth/login', { email, password });
          const data = response.data;

          set({
            user: data.user,
            isAuthenticated: true,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error: unknown) {
          const apiError = error as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          set({
            isLoading: false,
            error: apiError.response?.data?.message || apiError.message || 'Login failed',
          });
          return false;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post('/auth/register', { email, password, name });
          const data = response.data;

          set({
            user: data.user,
            isAuthenticated: true,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error: unknown) {
          const apiError = error as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          set({
            isLoading: false,
            error: apiError.response?.data?.message || apiError.message || 'Registration failed',
          });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          error: null,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const data = response.data;

          set({
            user: data.user,
            isAuthenticated: true,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });

          return true;
        } catch {
          // If refresh fails, logout the user
          get().logout();
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: state => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
