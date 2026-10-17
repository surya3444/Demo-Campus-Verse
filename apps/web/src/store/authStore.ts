import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@campus-verse/shared';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;

  setAuth: (user: AuthUser, accessToken: string, expiresIn: number) => void;
  setAccessToken: (accessToken: string, expiresIn: number) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  logout: () => void;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      expiresAt: null,

      setAuth: (user, accessToken, expiresIn) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          expiresAt: Date.now() + expiresIn * 1000,
        }),

      setAccessToken: (accessToken, expiresIn) =>
        set({
          accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          expiresAt: null,
        }),

      isTokenExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        // Consider expired if less than 90 seconds remaining. With a 60-second
        // refresh poll, a 30s margin was too tight — the proactive scheduler
        // could miss the window and let requests go out with an actually-expired
        // token, falling back to the reactive 401 path on every page.
        return Date.now() > expiresAt - 90_000;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        expiresAt: state.expiresAt,
      }),
    }
  )
);
