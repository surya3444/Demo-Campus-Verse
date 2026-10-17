import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { secureStorage } from '../services/secureStorage';
import { authApi, UserProfile, LoginCredentials } from '../api/auth';

// Create MMKV instance for fast storage
const storage = new MMKV();

// Custom storage adapter for Zustand
const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: unknown) => {
    if (typeof value === 'string') {
      storage.set(name, value);
    } else if (value != null) {
      storage.set(name, JSON.stringify(value));
    }
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

export interface Child {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  rollNumber?: string;
  profileImage?: string;
}

interface AuthState {
  // State
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedBranchId: string | null;
  selectedChild: Child | null;
  children: Child[];

  // Computed
  isParent: boolean;
  isStudent: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setBranch: (branchId: string) => Promise<void>;
  selectChild: (child: Child) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      selectedBranchId: null,
      selectedChild: null,
      children: [],

      // Computed getters (recalculated when state changes)
      get isParent() {
        const user = get().user;
        return user?.roleCode?.toLowerCase() === 'parent' || false;
      },

      get isStudent() {
        const user = get().user;
        return user?.roleCode?.toLowerCase() === 'student' || false;
      },

      // Initialize - check for existing tokens
      initialize: async () => {
        try {
          const accessToken = await secureStorage.getAccessToken();

          if (!accessToken) {
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          // Try to get current user
          const user = await authApi.getMe();
          const children = user.parentInfo?.children || [];
          let branchId = await secureStorage.getBranchId();

          // If branch ID not in storage, derive from user and persist it
          if (!branchId && user.branches?.length > 0) {
            const defaultBranch = user.branches.find((b) => b.isDefault);
            branchId = defaultBranch?.branchId || user.branches[0]?.branchId || null;
            if (branchId) {
              await secureStorage.setBranchId(branchId);
            }
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            children,
            selectedBranchId: branchId || null,
            selectedChild: children[0] || null,
          });
        } catch {
          // Token invalid or expired
          await secureStorage.clearAll();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            selectedBranchId: null,
            selectedChild: null,
            children: [],
          });
        }
      },

      // Login
      login: async (credentials: LoginCredentials) => {
        const response = await authApi.login(credentials);

        // Store tokens securely
        await secureStorage.setTokens(response.accessToken, response.refreshToken);

        // Set default branch
        const defaultBranch = response.user.branches.find((b) => b.isDefault);
        const branchId = defaultBranch?.branchId || response.user.branches[0]?.branchId;

        if (branchId) {
          await secureStorage.setBranchId(branchId);
        }

        // Extract children for parent users
        const children = response.user.parentInfo?.children || [];

        set({
          user: response.user,
          isAuthenticated: true,
          selectedBranchId: branchId || null,
          children,
          selectedChild: children[0] || null,
        });
      },

      // Logout
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore logout API errors
        }

        await secureStorage.clearAll();

        set({
          user: null,
          isAuthenticated: false,
          selectedBranchId: null,
          selectedChild: null,
          children: [],
        });
      },

      // Refresh user data
      refreshUser: async () => {
        try {
          const user = await authApi.getMe();
          const children = user.parentInfo?.children || [];

          set({
            user,
            children,
            selectedChild: get().selectedChild || children[0] || null,
          });
        } catch {
          // If refresh fails, logout
          await get().logout();
        }
      },

      // Set branch
      setBranch: async (branchId: string) => {
        await secureStorage.setBranchId(branchId);
        set({ selectedBranchId: branchId });
      },

      // Select child (for parent users)
      selectChild: (child: Child) => {
        set({ selectedChild: child });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist non-sensitive data
      partialize: (state) => ({
        selectedBranchId: state.selectedBranchId,
        selectedChild: state.selectedChild,
      }),
    }
  )
);

// Helper hooks
export const useIsParent = () =>
  useAuthStore((state) => state.user?.roleCode?.toLowerCase() === 'parent');
export const useIsStudent = () =>
  useAuthStore((state) => state.user?.roleCode?.toLowerCase() === 'student');
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useSelectedChild = () => useAuthStore((state) => state.selectedChild);
export const useChildren = () => useAuthStore((state) => state.children);
