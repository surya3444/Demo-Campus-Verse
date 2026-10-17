'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { authApi, refreshAccessToken, endSessionIfUnrecoverable } from '@/lib/api';
import { toast } from 'sonner';
import type { AuthUser } from '@campus-verse/shared';

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Single global scheduler so we have ONE polling loop regardless of how many
// components mount useAuth. Multiple intervals = multiple parallel refreshes
// racing each other = false-positive logouts.
let schedulerSubscribers = 0;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let focusHandler: (() => void) | null = null;
let lastTickAt = 0;

const tick = async () => {
  const { isAuthenticated, accessToken, isTokenExpired } = useAuthStore.getState();
  if (!isAuthenticated || !accessToken) return;
  if (!isTokenExpired()) return;
  lastTickAt = Date.now();
  try {
    const { accessToken: nextToken, expiresIn } = await refreshAccessToken();
    useAuthStore.getState().setAccessToken(nextToken, expiresIn);
  } catch (err) {
    // Transient (network/5xx) → keep session, next tick retries. Genuine 401 →
    // session is dead and unrefreshable; re-auth is the only recovery. This is
    // what catches a doomed session even while idle on a page (e.g. the AI chat).
    endSessionIfUnrecoverable(err);
  }
};

function startScheduler() {
  schedulerSubscribers++;
  if (schedulerInterval) return;

  // Background tabs throttle setInterval (Chrome → ≥1 min, Safari similar).
  // 30s gives us at least one usable tick per minute even when throttled.
  schedulerInterval = setInterval(tick, 30_000);
  // Run once on startup too, in case the persisted token is already near expiry
  // when the app rehydrates.
  void tick();

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // The critical fix: when the tab becomes visible again after being
    // backgrounded (where setInterval was throttled / paused), refresh
    // PROACTIVELY before the user can click anything that fires an API call.
    // Without this, the first menu click after idle hits a 401 and races
    // through the reactive refresh path — which often loses to itself when
    // multiple parallel page-load fetches all 401 simultaneously.
    visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return;
      // Coalesce — don't fire if a tick just ran in the last 5 seconds.
      if (Date.now() - lastTickAt < 5_000) return;
      void tick();
    };
    focusHandler = () => {
      if (Date.now() - lastTickAt < 5_000) return;
      void tick();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', focusHandler);
  }
}

function stopScheduler() {
  schedulerSubscribers = Math.max(0, schedulerSubscribers - 1);
  if (schedulerSubscribers === 0) {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
      if (focusHandler) {
        window.removeEventListener('focus', focusHandler);
        focusHandler = null;
      }
    }
  }
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, setAuth, logout: clearAuth } = useAuthStore();
  const { setAvailableBranches, initializeBranchSelection, clearBranch } = useBranchStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    startScheduler();
    return stopScheduler;
  }, [isAuthenticated, accessToken]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const response = await authApi.login(email, password);

        if (response.success) {
          const { user: authUser, accessToken: token, expiresIn } = response.data;

          setAuth(authUser, token, expiresIn);

          // S1-07: Initialize branch selection with auto-select for single-branch users
          if (authUser.branches && authUser.branches.length > 0) {
            initializeBranchSelection(authUser.branches, authUser.accessScope?.type);
          }

          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [setAuth, initializeBranchSelection]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Continue with logout even if API fails
    }
    clearAuth();
    clearBranch();
    toast.success('Logged out successfully');
    router.push('/login');
  }, [clearAuth, clearBranch, router]);

  const refreshProfile = useCallback(async (): Promise<void> => {
    try {
      const response = await authApi.getProfile();
      if (response.success) {
        const authUser = response.data;
        const currentToken = useAuthStore.getState().accessToken;
        const currentExpiry = useAuthStore.getState().expiresAt;

        if (currentToken && currentExpiry) {
          const remainingSeconds = Math.floor((currentExpiry - Date.now()) / 1000);
          setAuth(authUser, currentToken, remainingSeconds);

          if (authUser.branches && authUser.branches.length > 0) {
            setAvailableBranches(authUser.branches);
          }
        }
      }
    } catch {
      // Failed to refresh profile
    }
  }, [setAuth, setAvailableBranches]);

  return {
    user,
    isAuthenticated,
    isLoading: false,
    login,
    logout,
    refreshProfile,
  };
}
