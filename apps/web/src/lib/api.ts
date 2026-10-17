import axios, { AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true, // Enable cookies for refresh token
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
//
// If the stored access token is already expired by the time the request fires
// (common when a background tab had its setInterval throttled past expiry, or
// after the device woke from sleep), refresh BEFORE sending. Without this, the
// request would 401 and rely on the reactive retry — and if that refresh hits
// a Redis blip, the user gets booted instead of the request just succeeding.
api.interceptors.request.use(async (config) => {
  const state = useAuthStore.getState();
  const { selectedBranchId } = useBranchStore.getState();

  const url = config.url || '';
  // Don't try to refresh for unauthenticated endpoints (login, signup, the
  // refresh call itself, password reset, etc.). They never need an access
  // token and refreshing here would just recurse / waste a round-trip.
  const isAuthBootstrap =
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/verify-email') ||
    url.includes('/auth/resend-verification');

  if (state.isAuthenticated && state.accessToken && !isAuthBootstrap && state.isTokenExpired()) {
    try {
      const { accessToken: nextToken, expiresIn } = await refreshAccessToken();
      useAuthStore.getState().setAccessToken(nextToken, expiresIn);
      config.headers.Authorization = `Bearer ${nextToken}`;
    } catch {
      // Don't block the request on a failed proactive refresh — the response
      // interceptor still has a reactive retry that will handle a 401 (and
      // only logs out on genuine auth failures).
      if (state.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    }
  } else if (state.accessToken) {
    config.headers.Authorization = `Bearer ${state.accessToken}`;
  }

  // Per-request overrides (e.g. loading a transfer target branch's classes)
  // take precedence over the globally selected branch.
  if (selectedBranchId && !config.headers['X-Branch-Id']) {
    config.headers['X-Branch-Id'] = selectedBranchId;
  }

  return config;
});

/**
 * The server's refresh-failure code, if the refresh failed with a genuine auth
 * 401 (missing cookie, expired/invalid/revoked token, inactive user). Returns
 * null for transient failures (network, timeout, 5xx, infra 403). Used to decide
 * recovery — see endSessionIfUnrecoverable.
 */
export function getRefreshFailureCode(error: unknown): string | null {
  const e = error as AxiosError<{ error?: { code?: string } }>;
  if (e?.response?.status !== 401) return null;
  return e.response?.data?.error?.code || 'UNKNOWN';
}

/**
 * Handle a failed token refresh.
 *
 * - TRANSIENT failure (network, timeout, 5xx, infra 403 → getRefreshFailureCode
 *   returns null): do NOTHING. Keep the session; the next request / 30s tick
 *   retries. This is the "refresh and continue" path for the normal case.
 *
 * - GENUINE auth failure (a real 401 from /auth/refresh: missing/expired/invalid
 *   refresh token, inactive user): the session is UNRECOVERABLE. The access token
 *   is expired AND it cannot be refreshed, so every API call will 401 — there is
 *   no token that can make them work again without re-authenticating. Leaving the
 *   user "logged in" here just yields permanently dead APIs. So we sign out once,
 *   cleanly, with the reason on the URL, so they can re-auth and APIs work again.
 *   With the hardened cookie an active session always refreshes, so this should
 *   only ever fire when the session is genuinely beyond saving.
 */
export function endSessionIfUnrecoverable(error: unknown): void {
  const code = getRefreshFailureCode(error);
  if (!code) return; // transient — keep the session and retry later
  console.warn(`[auth] session unrecoverable (${code}) — re-authentication required`);
  useAuthStore.getState().logout();
  try {
    useBranchStore.getState().clearBranch();
  } catch {
    /* branch store may not be initialised — non-fatal */
  }
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('lastRefreshFailure', code);
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?reason=${encodeURIComponent(code)}`;
    }
  }
}

// Response interceptor
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
      _skipErrorToast?: boolean;
    };

    // S1-16: Handle permission errors with toast notification — only for
    // actions the user took. A forbidden GET is a background lookup (a filter
    // dropdown, a settings read); pages render their own empty state for it.
    const isRead = (originalRequest.method ?? 'get').toLowerCase() === 'get';
    if (error.response?.status === 403 && !isRead && !originalRequest._skipErrorToast) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage, {
        description: 'Contact your administrator to request access.',
        duration: 5000,
      });
    }

    // Handle token refresh — but only when the failing request was authenticated
    // (sent an Authorization header). 401s from public/login routes shouldn't
    // trigger refresh + logout side effects.
    const wasAuthed = !!originalRequest.headers?.Authorization;
    const isRefreshCall = originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && wasAuthed && !isRefreshCall) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { setAccessToken } = useAuthStore.getState();

        // Bypass the api instance — this hits axios directly so a 401 on
        // refresh doesn't recurse back into this handler.
        const { accessToken, expiresIn } = await refreshAccessToken();
        setAccessToken(accessToken, expiresIn);

        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        // Transient → keep session and retry later. Genuine 401 → session is
        // dead, every call will 401, so re-auth is the only way to working APIs.
        endSessionIfUnrecoverable(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Bare axios refresh helper — bypasses the api instance's interceptors so a
// failed refresh doesn't recurse through the 401 handler and can't cause a
// double-logout. Used by both the proactive scheduler in useAuth and the
// reactive 401 handler below.
let inflightRefresh: Promise<{ accessToken: string; expiresIn: number }> | null = null;

export async function refreshAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 15000 }
      );
      const payload = response.data?.data ?? response.data;
      if (!payload?.accessToken || typeof payload.expiresIn !== 'number') {
        throw new Error('Refresh response missing accessToken/expiresIn');
      }
      return { accessToken: payload.accessToken, expiresIn: payload.expiresIn };
    } finally {
      // Whether the call succeeded or failed, clear the singleton so a future
      // call can attempt again — but only after a tiny delay to coalesce
      // anything that fired in the same tick.
      setTimeout(() => {
        inflightRefresh = null;
      }, 50);
    }
  })();
  return inflightRefresh;
}

// Auth API functions
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
  }) => {
    const response = await api.put('/auth/me', data);
    return response.data;
  },

  uploadAvatar: async (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string, confirmPassword: string) => {
    const response = await api.post('/auth/reset-password', {
      token,
      password,
      confirmPassword,
    });
    return response.data;
  },

  // Organization Signup
  signup: async (data: {
    organizationName: string;
    institutionType: 'school' | 'college' | 'university';
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  getSignupStatus: async (email: string) => {
    const response = await api.get('/auth/signup-status', { params: { email } });
    return response.data;
  },

  switchOrganization: async (tenantId: string) => {
    const response = await api.post('/auth/switch-organization', { tenantId });
    return response.data;
  },
};

// Organization API functions
/**
 * Cross-institution ("All institutions") rollups for central university
 * staff. None of these take X-Branch-Id — the server resolves the branch set
 * from the caller's access scope and groups results by institution.
 */
export const centralApi = {
  getScope: async () => {
    const response = await api.get('/central/scope');
    return response.data;
  },
  getOverview: async () => {
    const response = await api.get('/central/overview');
    return response.data;
  },
  getFinance: async () => {
    const response = await api.get('/central/finance');
    return response.data;
  },
  getAdmissions: async () => {
    const response = await api.get('/central/admissions');
    return response.data;
  },
  getHr: async () => {
    const response = await api.get('/central/hr');
    return response.data;
  },
  getAcademics: async () => {
    const response = await api.get('/central/academics');
    return response.data;
  },
};

/** The branch's current academic batch — reports that need one default to it. */
async function currentBatchId(): Promise<string | undefined> {
  const r = await api.get('/organization/academic-batches/current').catch(() => null);
  return r?.data?.data?._id;
}

export const organizationApi = {
  /** Headline counts for the Organization overview page. */
  getOverview: async () => {
    const response = await api.get('/organization/overview');
    return response.data;
  },

  // Departments overview (read model for /organization/departments; CRUD in hrApi)
  getDepartmentsOverview: async () => {
    const response = await api.get('/organization/departments/overview');
    return response.data;
  },

  /** A department's staff and students with their emails and sign-in status. */
  getDepartmentPeople: async (departmentId: string) => {
    const response = await api.get(`/organization/departments/${departmentId}/people`);
    return response.data;
  },

  /** Every subject with the semesters it's in and each section's teacher. */
  getSubjectUsage: async () => {
    const response = await api.get('/organization/subjects/usage');
    return response.data;
  },

  // Institutions (constituent institutions of a university tenant)
  getInstitutions: async (params?: { status?: 'active' | 'archived' }) => {
    const response = await api.get('/organization/institutions', { params });
    return response.data;
  },

  createInstitution: async (data: {
    name: string;
    code: string;
    kind?: string;
    settings?: { admissionPrefix?: string; logo?: string; letterhead?: string };
  }) => {
    const response = await api.post('/organization/institutions', data);
    return response.data;
  },

  updateInstitution: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/organization/institutions/${id}`, data);
    return response.data;
  },

  deleteInstitution: async (id: string) => {
    const response = await api.delete(`/organization/institutions/${id}`);
    return response.data;
  },

  // Programs (degree programs offered by a department, e.g. B.Tech CSE, MBA).
  // Branch-scoped: the list and create routes require X-Branch-Id.
  getPrograms: async (params?: {
    departmentId?: string;
    status?: 'active' | 'archived';
    search?: string;
  }) => {
    const response = await api.get('/organization/programs', { params });
    return response.data;
  },

  createProgram: async (data: {
    /** Owning department; omit for a program run by a whole institution (MBBS). */
    departmentId?: string;
    institutionId?: string;
    name: string;
    code: string;
    degreeType: 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate';
    durationYears: number;
    /** Derived on the server from the year patterns. */
    totalSemesters?: number;
    termPattern?: 'semester' | 'annual' | 'trimester';
    /** One pattern per year, e.g. ['annual', 'semester', 'semester', 'semester']. */
    yearPatterns?: Array<'annual' | 'semester' | 'trimester'>;
    specialization?: string;
  }) => {
    const response = await api.post('/organization/programs', data);
    return response.data;
  },

  updateProgram: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/organization/programs/${id}`, data);
    return response.data;
  },

  deleteProgram: async (id: string) => {
    const response = await api.delete(`/organization/programs/${id}`);
    return response.data;
  },

  // Branches
  getBranches: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const response = await api.get('/organization/branches', { params });
    return response.data;
  },

  getBranch: async (id: string) => {
    const response = await api.get(`/organization/branches/${id}`);
    return response.data;
  },

  createBranch: async (data: {
    name: string;
    code: string;
    institutionType: 'school' | 'college' | 'university';
    location: { city: string; state: string; country?: string; pincode?: string };
    contact?: { phone?: string; email?: string };
  }) => {
    const response = await api.post('/organization/branches', data);
    return response.data;
  },

  updateBranch: async (
    id: string,
    data: {
      name?: string;
      code?: string;
      institutionType?: 'school' | 'college' | 'university';
      location?: { city?: string; state?: string; country?: string; pincode?: string };
      contact?: { phone?: string; email?: string };
      status?: 'active' | 'inactive';
    }
  ) => {
    const response = await api.put(`/organization/branches/${id}`, data);
    return response.data;
  },

  deleteBranch: async (id: string) => {
    const response = await api.delete(`/organization/branches/${id}`);
    return response.data;
  },

  getBranchStats: async (id: string) => {
    const response = await api.get(`/organization/branches/${id}/stats`);
    return response.data;
  },

  // Roles
  getRoles: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get('/organization/roles', { params });
    return response.data;
  },

  getRole: async (id: string) => {
    const response = await api.get(`/organization/roles/${id}`);
    return response.data;
  },

  getAssignableRoles: async () => {
    const response = await api.get('/organization/roles/assignable');
    return response.data;
  },

  createRole: async (data: {
    name: string;
    code: string;
    description?: string;
    level: number;
    permissions: Record<string, string[]>;
  }) => {
    const response = await api.post('/organization/roles', data);
    return response.data;
  },

  updateRole: async (
    id: string,
    data: {
      name?: string;
      code?: string;
      description?: string;
      level?: number;
      permissions?: Record<string, string[]>;
    }
  ) => {
    const response = await api.put(`/organization/roles/${id}`, data);
    return response.data;
  },

  deleteRole: async (id: string) => {
    const response = await api.delete(`/organization/roles/${id}`);
    return response.data;
  },

  // Users
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    roleId?: string;
    branchId?: string;
  }) => {
    const response = await api.get('/organization/users', { params });
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await api.get(`/organization/users/${id}`);
    return response.data;
  },

  createUser: async (data: {
    email: string;
    phone?: string;
    password?: string;
    profile: { firstName: string; lastName: string; displayName?: string; gender?: string };
    roleId: string;
    accessScope: {
      type: 'global' | 'institution' | 'branch' | 'department' | 'program';
      institutionIds?: string[];
      branchIds: string[];
      departmentIds?: string[];
      programIds?: string[];
    };
    validUntil?: string | null;
  }) => {
    const response = await api.post('/organization/users', data);
    return response.data;
  },

  updateUser: async (
    id: string,
    data: {
      email?: string;
      phone?: string;
      profile?: { firstName?: string; lastName?: string; displayName?: string; gender?: string };
      roleId?: string;
      accessScope?: {
        type: 'global' | 'institution' | 'branch' | 'department' | 'program';
        institutionIds?: string[];
        branchIds: string[];
        departmentIds?: string[];
        programIds?: string[];
      };
      validUntil?: string | null;
    }
  ) => {
    const response = await api.put(`/organization/users/${id}`, data);
    return response.data;
  },

  updateUserStatus: async (id: string, status: 'active' | 'inactive') => {
    const response = await api.put(`/organization/users/${id}/status`, { status });
    return response.data;
  },

  resetUserPassword: async (id: string) => {
    const response = await api.post(`/organization/users/${id}/reset-password`);
    return response.data;
  },

  deleteUser: async (id: string) => {
    const response = await api.delete(`/organization/users/${id}`);
    return response.data;
  },

  // Profile (combined settings)
  getProfile: async () => {
    const response = await api.get('/organization/profile');
    return response.data;
  },

  // General settings
  getSettings: async () => {
    const response = await api.get('/organization/settings');
    return response.data;
  },

  updateSettings: async (data: {
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    fiscalYearStart?: string;
    /** Turns department scope into a real narrowing filter (default off). */
    enforceDepartmentScope?: boolean;
  }) => {
    const response = await api.put('/organization/settings', data);
    return response.data;
  },

  // Contact information
  getContact: async () => {
    const response = await api.get('/organization/contact');
    return response.data;
  },

  updateContact: async (data: {
    email?: string;
    phone?: string;
    website?: string;
    address?: {
      /** Canonical street field (addressSchema). */
      line1?: string;
      /** @deprecated legacy alias for line1 — still accepted server-side. */
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      pincode?: string;
    };
  }) => {
    const response = await api.put('/organization/contact', data);
    return response.data;
  },

  // Legal information
  getLegalInfo: async () => {
    const response = await api.get('/organization/legal');
    return response.data;
  },

  updateLegalInfo: async (data: {
    entityName?: string;
    gstNumber?: string;
    panNumber?: string;
    registrationNumber?: string;
    board?: string;
  }) => {
    const response = await api.put('/organization/legal', data);
    return response.data;
  },

  // Branding
  getBranding: async () => {
    const response = await api.get('/organization/branding');
    return response.data;
  },

  updateBranding: async (data: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  }) => {
    const response = await api.put('/organization/branding', data);
    return response.data;
  },

  // Modules
  getModules: async () => {
    const response = await api.get('/organization/modules');
    return response.data;
  },

  updateModules: async (modules: string[]) => {
    const response = await api.put('/organization/modules', { modules });
    return response.data;
  },

  // Academic Hierarchy Configuration
  getAcademicHierarchy: async (branchId?: string) => {
    const response = await api.get('/organization/academic-hierarchy', {
      params: branchId ? { branchId } : {},
    });
    return response.data;
  },

  updateAcademicHierarchy: async (
    data: {
      levels: Array<{
        key: string;
        label: string;
        labelPlural: string;
        isLeaf: boolean;
        order: number;
      }>;
    },
    branchId?: string
  ) => {
    const response = await api.put('/organization/academic-hierarchy', data, {
      params: branchId ? { branchId } : {},
    });
    return response.data;
  },

  resetAcademicHierarchy: async (branchId?: string) => {
    const response = await api.post('/organization/academic-hierarchy/reset', undefined, {
      params: branchId ? { branchId } : {},
    });
    return response.data;
  },

  // Scheduled Jobs
  getScheduledJobs: async (params?: { type?: string; isActive?: boolean }) => {
    const response = await api.get('/organization/scheduled-jobs', { params });
    return response.data;
  },

  getScheduledJob: async (id: string) => {
    const response = await api.get(`/organization/scheduled-jobs/${id}`);
    return response.data;
  },

  getScheduledJobTemplates: async () => {
    const response = await api.get('/organization/scheduled-jobs/templates');
    return response.data;
  },

  createScheduledJob: async (data: {
    name: string;
    code: string;
    description?: string;
    type: 'report' | 'notification' | 'sync' | 'cleanup' | 'reminder' | 'custom';
    schedule: {
      type: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
      time?: string;
      dayOfWeek?: number;
      dayOfMonth?: number;
      cronExpression?: string;
      timezone?: string;
    };
    config: {
      module: string;
      action: string;
      params?: Record<string, unknown>;
      recipients?: string[];
    };
    branchId?: string;
  }) => {
    const response = await api.post('/organization/scheduled-jobs', data);
    return response.data;
  },

  updateScheduledJob: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/organization/scheduled-jobs/${id}`, data);
    return response.data;
  },

  toggleScheduledJobStatus: async (id: string, isActive: boolean) => {
    const response = await api.put(`/organization/scheduled-jobs/${id}/status`, { isActive });
    return response.data;
  },

  deleteScheduledJob: async (id: string) => {
    const response = await api.delete(`/organization/scheduled-jobs/${id}`);
    return response.data;
  },

  runScheduledJobNow: async (id: string) => {
    const response = await api.post(`/organization/scheduled-jobs/${id}/run`);
    return response.data;
  },

  getScheduledJobExecutions: async (id: string, params?: { limit?: number }) => {
    const response = await api.get(`/organization/scheduled-jobs/${id}/executions`, { params });
    return response.data;
  },

  // Branch Settings
  getBranchSettings: async (branchId: string) => {
    const response = await api.get(`/organization/branches/${branchId}/settings`);
    return response.data;
  },

  updateBranchSettings: async (
    branchId: string,
    data: {
      taxSettings?: { gstRate?: number; igstRate?: number; cessRate?: number };
      feeRules?: {
        lateFeePercentage?: number;
        gracePeriodDays?: number;
        lateFeeMaxAmount?: number;
      };
      communicationSettings?: {
        smsEnabled?: boolean;
        emailEnabled?: boolean;
        whatsappEnabled?: boolean;
      };
      weeklyOffs?: number[];
      approvalEmailSettings?: {
        enabled?: boolean;
        triggers?: { onRequest?: boolean; onApproval?: boolean; onRejection?: boolean };
        recipients?: {
          includeRequester?: boolean;
          includeApprover?: boolean;
          additionalEmails?: string[];
        };
      };
      sortSettings?: {
        students?: { field: string; order: 'asc' | 'desc' };
        staff?: { field: string; order: 'asc' | 'desc' };
        transactions?: { field: string; order: 'asc' | 'desc' };
      };
      branding?: {
        logo?: string;
        primaryColor?: string;
        secondaryColor?: string;
      };
    }
  ) => {
    const response = await api.put(`/organization/branches/${branchId}/settings`, data);
    return response.data;
  },

  getEffectiveBranchSettings: async (branchId: string) => {
    const response = await api.get(`/organization/branches/${branchId}/settings/effective`);
    return response.data;
  },

  addBranchHoliday: async (
    branchId: string,
    holiday: { date: string; name: string; type: 'public' | 'custom' }
  ) => {
    const response = await api.post(
      `/organization/branches/${branchId}/settings/holidays`,
      holiday
    );
    return response.data;
  },

  removeBranchHoliday: async (branchId: string, holidayDate: string) => {
    const response = await api.delete(`/organization/branches/${branchId}/settings/holidays`, {
      data: { date: holidayDate },
    });
    return response.data;
  },

  // Custom Fields
  getCustomFields: async (params?: { module?: string; status?: string }) => {
    const response = await api.get('/organization/custom-fields', { params });
    return response.data;
  },

  getCustomFieldsByModule: async (module: string) => {
    const response = await api.get(`/organization/custom-fields/module/${module}`);
    return response.data;
  },

  getCustomField: async (id: string) => {
    const response = await api.get(`/organization/custom-fields/${id}`);
    return response.data;
  },

  createCustomField: async (data: {
    module: 'admission' | 'student' | 'staff' | 'fee' | 'attendance';
    fieldName: string;
    fieldKey: string;
    fieldType:
      | 'text'
      | 'number'
      | 'date'
      | 'select'
      | 'multiselect'
      | 'checkbox'
      | 'file'
      | 'textarea';
    options?: string[];
    required?: boolean;
    showInList?: boolean;
    showInFilters?: boolean;
  }) => {
    const response = await api.post('/organization/custom-fields', data);
    return response.data;
  },

  updateCustomField: async (
    id: string,
    data: {
      fieldName?: string;
      fieldType?:
        | 'text'
        | 'number'
        | 'date'
        | 'select'
        | 'multiselect'
        | 'checkbox'
        | 'file'
        | 'textarea';
      options?: string[];
      required?: boolean;
      showInList?: boolean;
      showInFilters?: boolean;
      status?: 'active' | 'inactive';
    }
  ) => {
    const response = await api.put(`/organization/custom-fields/${id}`, data);
    return response.data;
  },

  deleteCustomField: async (id: string) => {
    const response = await api.delete(`/organization/custom-fields/${id}`);
    return response.data;
  },

  reorderCustomFields: async (data: { fieldIds: string[] }) => {
    const response = await api.put('/organization/custom-fields/reorder', data);
    return response.data;
  },

  // Approvals
  getPendingApprovals: async (params?: { type?: string }) => {
    const response = await api.get('/organization/approvals', { params });
    return response.data;
  },

  getApprovalHistory: async (params?: { type?: string; limit?: number }) => {
    const response = await api.get('/organization/approvals/history', { params });
    return response.data;
  },

  undoConcessionApproval: async (id: string, reason?: string) => {
    const response = await api.post(`/organization/approvals/concession/${id}/undo`, { reason });
    return response.data;
  },

  undoFeeCancellation: async (id: string, reason?: string) => {
    const response = await api.post(`/organization/approvals/fee-cancellation/${id}/undo`, {
      reason,
    });
    return response.data;
  },

  // Approval Settings
  getApprovalSettings: async () => {
    const response = await api.get('/organization/approval-settings');
    return response.data;
  },

  updateApprovalEmailSettings: async (
    entityType: 'concession' | 'feeCancellation' | 'leave' | 'certificate',
    data: {
      enabled?: boolean;
      notifyOnRequest?: boolean;
      notifyOnApproval?: boolean;
      notifyOnRejection?: boolean;
      notifyOnUndo?: boolean;
      recipientRoles?: string[];
      emailTemplateId?: string;
    }
  ) => {
    const response = await api.put(`/organization/approval-settings/email/${entityType}`, data);
    return response.data;
  },

  updateAutoApproveThreshold: async (data: { concession?: number; feeCancellation?: number }) => {
    const response = await api.put('/organization/approval-settings/auto-approve', data);
    return response.data;
  },

  updateEscalationSettings: async (data: {
    enabled?: boolean;
    escalateAfterDays?: number;
    escalationRoles?: string[];
  }) => {
    const response = await api.put('/organization/approval-settings/escalation', data);
    return response.data;
  },

  // Onboarding
  getOnboardingStatus: async () => {
    const response = await api.get('/organization/onboarding/status');
    return response.data;
  },

  completeOnboarding: async () => {
    const response = await api.put('/organization/onboarding/complete');
    return response.data;
  },

  // Infrastructure - Buildings
  getBuildings: async (params?: Record<string, unknown>) => {
    const response = await api.get('/organization/infrastructure/buildings', { params });
    return response.data;
  },
  getBuilding: async (id: string) => {
    const response = await api.get(`/organization/infrastructure/buildings/${id}`);
    return response.data;
  },
  createBuilding: async (data: Record<string, unknown>) => {
    const response = await api.post('/organization/infrastructure/buildings', data);
    return response.data;
  },
  updateBuilding: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/organization/infrastructure/buildings/${id}`, data);
    return response.data;
  },
  deleteBuilding: async (id: string) => {
    const response = await api.delete(`/organization/infrastructure/buildings/${id}`);
    return response.data;
  },

  // Infrastructure - Floors
  addFloor: async (buildingId: string, data: Record<string, unknown>) => {
    const response = await api.post(
      `/organization/infrastructure/buildings/${buildingId}/floors`,
      data
    );
    return response.data;
  },
  updateFloor: async (buildingId: string, floorId: string, data: Record<string, unknown>) => {
    const response = await api.put(
      `/organization/infrastructure/buildings/${buildingId}/floors/${floorId}`,
      data
    );
    return response.data;
  },
  removeFloor: async (buildingId: string, floorId: string) => {
    const response = await api.delete(
      `/organization/infrastructure/buildings/${buildingId}/floors/${floorId}`
    );
    return response.data;
  },

  // Infrastructure - Rooms
  getInfraRooms: async (params?: Record<string, unknown>) => {
    const response = await api.get('/organization/infrastructure/rooms', { params });
    return response.data;
  },
  getInfraRoom: async (id: string) => {
    const response = await api.get(`/organization/infrastructure/rooms/${id}`);
    return response.data;
  },
  createInfraRoom: async (data: Record<string, unknown>) => {
    const response = await api.post('/organization/infrastructure/rooms', data);
    return response.data;
  },
  updateInfraRoom: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/organization/infrastructure/rooms/${id}`, data);
    return response.data;
  },
  deleteInfraRoom: async (id: string) => {
    const response = await api.delete(`/organization/infrastructure/rooms/${id}`);
    return response.data;
  },

  // Infrastructure - Stats
  getInfraStats: async () => {
    const response = await api.get('/organization/infrastructure/stats');
    return response.data;
  },
};

// Global search (top bar / ⌘K): every group is permission- and scope-checked server-side.
export const searchApi = {
  search: async (q: string) => {
    const response = await api.get('/search', { params: { q } });
    return response.data as { success: boolean; data: Record<string, SearchHit[]> };
  },
};

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  meta?: Record<string, unknown>;
}

// Dashboard API
export const dashboardApi = {
  // Owner/Admin Dashboard (cross-branch)
  getOwnerKPIs: async (branchIds?: string[]) => {
    const params = branchIds?.length ? { branchIds: branchIds.join(',') } : {};
    const response = await api.get('/dashboard/owner/kpis', { params });
    return response.data;
  },

  getOwnerStudentMetrics: async (branchIds?: string[]) => {
    const params = branchIds?.length ? { branchIds: branchIds.join(',') } : {};
    const response = await api.get('/dashboard/owner/students', { params });
    return response.data;
  },

  getOwnerFinanceMetrics: async (branchIds?: string[]) => {
    const params = branchIds?.length ? { branchIds: branchIds.join(',') } : {};
    const response = await api.get('/dashboard/owner/finance', { params });
    return response.data;
  },

  getOwnerAttendanceMetrics: async (branchIds?: string[]) => {
    const params = branchIds?.length ? { branchIds: branchIds.join(',') } : {};
    const response = await api.get('/dashboard/owner/attendance', { params });
    return response.data;
  },

  getOwnerStaffMetrics: async (branchIds?: string[]) => {
    const params = branchIds?.length ? { branchIds: branchIds.join(',') } : {};
    const response = await api.get('/dashboard/owner/staff', { params });
    return response.data;
  },

  getOwnerAdmissionMetrics: async (branchIds?: string[]) => {
    const params = branchIds?.length ? { branchIds: branchIds.join(',') } : {};
    const response = await api.get('/dashboard/owner/admissions', { params });
    return response.data;
  },

  // Alerts
  getAlerts: async (branchId?: string) => {
    const params = branchId ? { branchId } : {};
    const response = await api.get('/dashboard/alerts', { params });
    return response.data;
  },

  // Setup Checklist (admin)
  getSetupStatus: async () => {
    const response = await api.get('/dashboard/setup-status');
    return response.data;
  },

  dismissSetupTask: async (taskId: string) => {
    const response = await api.post('/dashboard/setup-status/dismiss', { taskId });
    return response.data;
  },

  // Branch Dashboard
  getBranchKPIs: async () => {
    const response = await api.get('/dashboard/branch/kpis');
    return response.data;
  },

  /** Departments (dean / campus) or sections (HOD / program) under the caller's scope. */
  getScopeBreakdown: async () => {
    const response = await api.get('/dashboard/scope/breakdown');
    return response.data;
  },

  getBranchTodaySummary: async () => {
    const response = await api.get('/dashboard/branch/today');
    return response.data;
  },

  // Teacher Dashboard
  getTeacherDashboard: async () => {
    const response = await api.get('/dashboard/teacher');
    return response.data;
  },

  // Student Dashboard
  getStudentDashboard: async () => {
    const response = await api.get('/dashboard/student');
    return response.data;
  },
};

// AI assistant — conversation history (CRUD; streaming lives in lib/chatApi.ts)
type StoredMsg = { role: 'user' | 'assistant'; content: string };
export const aiApi = {
  listConversations: async (params?: { page?: number; limit?: number }) => {
    const res = await api.get('/ai/conversations', { params });
    return res.data; // { data: [...], meta }
  },
  getConversation: async (id: string) => {
    const res = await api.get(`/ai/conversations/${id}`);
    return res.data.data as { _id: string; title: string; messages: StoredMsg[] };
  },
  createConversation: async (messages: StoredMsg[]) => {
    const res = await api.post('/ai/conversations', { messages });
    return res.data.data as { _id: string; title: string };
  },
  saveConversation: async (id: string, messages: StoredMsg[]) => {
    const res = await api.put(`/ai/conversations/${id}`, { messages });
    return res.data.data as { _id: string; title: string };
  },
  renameConversation: async (id: string, title: string) => {
    await api.patch(`/ai/conversations/${id}`, { title });
  },
  deleteConversation: async (id: string) => {
    await api.delete(`/ai/conversations/${id}`);
  },
};

// Activity / audit logs API
export const auditApi = {
  getLogs: async (params: Record<string, unknown>) => {
    const response = await api.get('/audit/logs', { params });
    return response.data; // { success, data: [...], meta }
  },
  getModules: async () => {
    const response = await api.get('/audit/modules');
    return response.data.data as string[];
  },
  exportLogs: async (params: Record<string, unknown>) => {
    const response = await api.get('/audit/logs/export', { params, responseType: 'blob' });
    return response.data as Blob;
  },
};

// Admissions API
export const admissionsApi = {
  // Pipeline (Kanban)
  getPipeline: async (params?: { search?: string; source?: string }) => {
    const response = await api.get('/admissions/pipeline', { params });
    return response.data;
  },

  moveCard: async (id: string, type: 'lead' | 'application', toStage: string, notes?: string) => {
    const response = await api.put(`/admissions/pipeline/${id}/move`, { type, toStage, notes });
    return response.data;
  },

  convertLead: async (
    leadId: string,
    data: {
      academicBatchId: string;
      classId: string;
      sectionId?: string;
      student?: { dateOfBirth?: string; gender?: string };
      contact?: { address?: { city?: string; state?: string; pincode?: string; country?: string } };
    }
  ) => {
    const response = await api.post(`/admissions/pipeline/${leadId}/convert`, data);
    return response.data;
  },

  // Leads
  getLeads: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
    source?: string;
  }) => {
    const response = await api.get('/admissions/leads', { params });
    return response.data;
  },

  getLeadStats: async () => {
    const response = await api.get('/admissions/leads/stats');
    return response.data;
  },

  getLead: async (id: string) => {
    const response = await api.get(`/admissions/leads/${id}`);
    return response.data;
  },

  createLead: async (data: {
    firstName: string;
    lastName: string;
    contact: { phone: string; email?: string };
    interestedIn: { classId?: string; stream?: string };
    source: string;
    sourceDetails?: string;
    referredBy?: string;
    parents?: {
      father?: { name: string; phone?: string };
      mother?: { name: string; phone?: string };
    };
    notes?: string;
    customFields?: Record<string, unknown>;
  }) => {
    const response = await api.post('/admissions/leads', data);
    return response.data;
  },

  updateLead: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admissions/leads/${id}`, data);
    return response.data;
  },

  updateLeadStage: async (id: string, stage: string, notes?: string) => {
    const response = await api.put(`/admissions/leads/${id}/stage`, { stage, notes });
    return response.data;
  },

  addFollowup: async (
    id: string,
    data: { type: string; notes: string; nextFollowupDate?: string }
  ) => {
    const response = await api.post(`/admissions/leads/${id}/followup`, data);
    return response.data;
  },

  completeFollowup: async (
    leadId: string,
    followupIndex: number,
    data: {
      outcome: 'interested' | 'not_interested' | 'no_response' | 'callback_requested' | 'converted';
      notes?: string;
      nextFollowupDate?: string;
    }
  ) => {
    const response = await api.put(
      `/admissions/leads/${leadId}/followup/${followupIndex}/complete`,
      data
    );
    return response.data;
  },

  deleteLead: async (id: string) => {
    const response = await api.delete(`/admissions/leads/${id}`);
    return response.data;
  },

  // Followups
  getFollowupsDue: async (params?: {
    date?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/admissions/leads/followups/due', { params });
    return response.data;
  },

  getOverdueFollowups: async (params?: { assignedTo?: string; page?: number; limit?: number }) => {
    const response = await api.get('/admissions/leads/followups/overdue', { params });
    return response.data;
  },

  getFollowupStats: async (assignedTo?: string) => {
    const response = await api.get('/admissions/leads/followups/stats', {
      params: assignedTo ? { assignedTo } : undefined,
    });
    return response.data;
  },

  // Bulk Upload
  getApplicationsTemplate: async () => {
    const response = await api.get('/admissions/bulk-upload/applications/template');
    return response.data;
  },

  getLeadsTemplate: async () => {
    const response = await api.get('/admissions/bulk-upload/leads/template');
    return response.data;
  },

  bulkUploadApplications: async (academicBatchId: string, data: Array<Record<string, unknown>>) => {
    const response = await api.post('/admissions/bulk-upload/applications', {
      academicBatchId,
      data,
    });
    return response.data;
  },

  bulkUploadLeads: async (data: Array<Record<string, unknown>>) => {
    const response = await api.post('/admissions/bulk-upload/leads', { data });
    return response.data;
  },

  // Applications
  getApplications: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const response = await api.get('/admissions/applications', { params });
    return response.data;
  },

  getApplicationStats: async () => {
    const response = await api.get('/admissions/applications/stats');
    return response.data;
  },

  getApplication: async (id: string) => {
    const response = await api.get(`/admissions/applications/${id}`);
    return response.data;
  },

  updateApplicationStatus: async (id: string, status: string, remarks?: string) => {
    const response = await api.put(`/admissions/applications/${id}/status`, { status, remarks });
    return response.data;
  },

  enrollStudent: async (
    id: string,
    data?: { admissionNumber?: string; rollNumber?: string; sectionId?: string }
  ) => {
    const response = await api.post(`/admissions/applications/${id}/enroll`, data);
    return response.data;
  },

  deleteApplication: async (id: string) => {
    const response = await api.delete(`/admissions/applications/${id}`);
    return response.data;
  },

  createApplication: async (data: {
    academicBatchId: string;
    classId: string;
    sectionId?: string;
    student: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: 'male' | 'female' | 'other';
      bloodGroup?: string;
      nationality?: string;
      religion?: string;
      category?: string;
      motherTongue?: string;
      aadharNumber?: string;
    };
    contact: {
      phone: string;
      email?: string;
      address: {
        street?: string;
        city: string;
        state: string;
        pincode?: string;
        country?: string;
      };
    };
    parents?: {
      father?: {
        name: string;
        phone?: string;
        email?: string;
        occupation?: string;
        qualification?: string;
      };
      mother?: {
        name: string;
        phone?: string;
        email?: string;
        occupation?: string;
        qualification?: string;
      };
      guardian?: {
        name: string;
        relation: string;
        phone?: string;
        email?: string;
      };
    };
    previousEducation?: {
      schoolName?: string;
      board?: string;
      class?: string;
      percentage?: number;
      yearOfPassing?: number;
      tcNumber?: string;
    };
    source?: string;
    referredBy?: string;
  }) => {
    const response = await api.post('/admissions/applications', data);
    return response.data;
  },

  enrollApplication: async (
    id: string,
    data?: {
      sectionId?: string;
      admissionNumber?: string;
      rollNumber?: string;
      admissionCategory?: string;
      admissionDate?: string;
      feeStructureIds?: string[];
      electiveSubjectIds?: string[];
      transport?: {
        optIn: boolean;
        busId?: string;
        stopId?: string;
        pickupEnabled?: boolean;
        dropEnabled?: boolean;
        priceOverride?: number;
      };
      concession?: {
        type: string;
        name: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        appliedTo: string;
        specificComponents?: string[];
        reason?: string;
      };
    }
  ) => {
    const response = await api.post(`/admissions/applications/${id}/enroll`, data);
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/admissions/settings');
    return response.data;
  },

  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/admissions/settings', data);
    return response.data;
  },

  // Sources
  getSources: async () => {
    const response = await api.get('/admissions/sources');
    return response.data;
  },

  createSource: async (data: {
    code?: string; // Optional - will be auto-generated if not provided
    name: string;
    description?: string;
    category: 'organic' | 'referral' | 'marketing' | 'agent' | 'other';
  }) => {
    const response = await api.post('/admissions/sources', data);
    return response.data;
  },

  updateSource: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admissions/sources/${id}`, data);
    return response.data;
  },

  deleteSource: async (id: string) => {
    const response = await api.delete(`/admissions/sources/${id}`);
    return response.data;
  },

  // Agents
  getAgents: async (params?: { isActive?: boolean; search?: string }) => {
    const response = await api.get('/admissions/agents', { params });
    return response.data;
  },

  getAgent: async (id: string) => {
    const response = await api.get(`/admissions/agents/${id}`);
    return response.data;
  },

  getAgentStats: async (id: string) => {
    const response = await api.get(`/admissions/agents/${id}/stats`);
    return response.data;
  },

  createAgent: async (data: {
    code?: string; // Optional - will be auto-generated if not provided
    name: string;
    email?: string;
    phone: string;
    address?: { street?: string; city: string; state: string; pincode?: string };
    commissionType: 'percentage' | 'fixed';
    commissionValue: number;
    bankDetails?: {
      accountName: string;
      accountNumber: string;
      bankName: string;
      ifscCode: string;
    };
  }) => {
    const response = await api.post('/admissions/agents', data);
    return response.data;
  },

  updateAgent: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admissions/agents/${id}`, data);
    return response.data;
  },

  deleteAgent: async (id: string) => {
    const response = await api.delete(`/admissions/agents/${id}`);
    return response.data;
  },

  // Reports
  getLeadsReport: async (params?: {
    fromDate?: string;
    toDate?: string;
    groupBy?: 'source' | 'stage' | 'assignedTo' | 'day' | 'week' | 'month';
    source?: string;
    stage?: string;
    assignedTo?: string;
  }) => {
    const response = await api.get('/admissions/reports/leads', { params });
    return response.data;
  },

  getLeadsConversionReport: async (params?: { fromDate?: string; toDate?: string }) => {
    const response = await api.get('/admissions/reports/leads/conversion', { params });
    return response.data;
  },

  getApplicationsReport: async (params?: {
    fromDate?: string;
    toDate?: string;
    groupBy?: 'status' | 'class' | 'source' | 'day' | 'week' | 'month';
    status?: string;
    classId?: string;
    academicBatchId?: string;
  }) => {
    const response = await api.get('/admissions/reports/applications', { params });
    return response.data;
  },

  getApplicationProcessingTime: async (params?: { fromDate?: string; toDate?: string }) => {
    const response = await api.get('/admissions/reports/applications/processing-time', { params });
    return response.data;
  },

  getAdmissionAnalytics: async (params?: { fromDate?: string; toDate?: string }) => {
    const response = await api.get('/admissions/reports/analytics', { params });
    return response.data;
  },

  // Dynamic Forms
  getForms: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  }) => {
    const response = await api.get('/admissions/forms', { params });
    return response.data;
  },

  getForm: async (id: string) => {
    const response = await api.get(`/admissions/forms/${id}`);
    return response.data;
  },

  createForm: async (data: {
    name: string;
    slug?: string;
    description?: string;
    type: 'lead' | 'application' | 'enquiry' | 'feedback' | 'custom';
    fields?: Array<{
      id: string;
      type:
        | 'text'
        | 'textarea'
        | 'email'
        | 'phone'
        | 'number'
        | 'date'
        | 'select'
        | 'radio'
        | 'checkbox'
        | 'file'
        | 'section';
      name: string;
      label: string;
      placeholder?: string;
      helpText?: string;
      required: boolean;
      validation?: {
        minLength?: number;
        maxLength?: number;
        min?: number;
        max?: number;
        pattern?: string;
        acceptedFileTypes?: string[];
        maxFileSize?: number;
      };
      options?: Array<{ value: string; label: string }>;
      defaultValue?: string | boolean;
      width?: 'full' | 'half' | 'third';
      order: number;
    }>;
    settings?: {
      collectPayment?: boolean;
      paymentAmount?: number;
      redirectUrl?: string;
      confirmationMessage?: string;
      notifyOnSubmission?: boolean;
      notifyEmails?: string[];
      autoCreateLead?: boolean;
      assignToClassId?: string;
      assignToAcademicBatchId?: string;
    };
    styling?: {
      headerImage?: string;
      logo?: string;
      primaryColor?: string;
      backgroundColor?: string;
    };
  }) => {
    const response = await api.post('/admissions/forms', data);
    return response.data;
  },

  updateForm: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/admissions/forms/${id}`, data);
    return response.data;
  },

  deleteForm: async (id: string) => {
    const response = await api.delete(`/admissions/forms/${id}`);
    return response.data;
  },

  duplicateForm: async (id: string, name: string) => {
    const response = await api.post(`/admissions/forms/${id}/duplicate`, { name });
    return response.data;
  },

  getFormSubmissions: async (
    formId: string,
    params?: { page?: number; limit?: number; status?: string }
  ) => {
    const response = await api.get(`/admissions/forms/${formId}/submissions`, { params });
    return response.data;
  },

  getFormSubmission: async (submissionId: string) => {
    const response = await api.get(`/admissions/submissions/${submissionId}`);
    return response.data;
  },

  updateFormSubmissionStatus: async (
    submissionId: string,
    status: 'reviewed' | 'processed' | 'archived',
    notes?: string
  ) => {
    const response = await api.put(`/admissions/submissions/${submissionId}/status`, {
      status,
      notes,
    });
    return response.data;
  },
};

// Public Forms API (no authentication required)
export const publicFormsApi = {
  getForm: async (slug: string) => {
    const response = await api.get(`/admissions/public/forms/${slug}`);
    return response.data;
  },

  submitForm: async (
    slug: string,
    data: {
      data: Record<string, unknown>;
      files?: Array<{ fieldId: string; fileName: string; fileUrl: string; fileSize: number }>;
    }
  ) => {
    const response = await api.post(`/admissions/public/forms/${slug}/submit`, data);
    return response.data;
  },
};

// Academic API (Classes and Sections)
export const academicApi = {
  // Classes. An explicit branchId overrides the selected branch — the backend
  // prefers the X-Branch-Id header, so it must be sent there, not as a param.
  getClasses: async (params?: {
    status?: string;
    academicBatchId?: string;
    branchId?: string;
    limit?: number;
  }) => {
    const response = await api.get('/organization/classes', {
      params,
      headers: params?.branchId ? { 'X-Branch-Id': params.branchId } : undefined,
    });
    return response.data;
  },

  // Full tree (classes → sections → subjects) in one request — avoids the
  // 1 + N + N×M XHR fan-out that tripped the gateway rate limit (503/CORS).
  getClassTree: async (academicBatchId: string) => {
    const response = await api.get('/organization/classes/tree', {
      params: { academicBatchId },
    });
    return response.data;
  },

  getClass: async (id: string) => {
    const response = await api.get(`/organization/classes/${id}`);
    return response.data;
  },

  createClass: async (data: {
    academicBatchId: string;
    path: Array<{ levelKey: string; name: string; code: string; order?: number }>;
    /** FK → programs (university tier); omitted by schools. */
    programId?: string;
    capacity?: number;
    classTeacherId?: string;
  }) => {
    const response = await api.post('/organization/classes', data);
    return response.data;
  },

  updateClass: async (
    id: string,
    data: {
      path?: Array<{ levelKey: string; name: string; code: string; order?: number }>;
      programId?: string | null;
      capacity?: number;
      classTeacherId?: string | null;
    }
  ) => {
    const response = await api.put(`/organization/classes/${id}`, data);
    return response.data;
  },

  updateClassStatus: async (id: string, status: 'active' | 'inactive') => {
    const response = await api.put(`/organization/classes/${id}/status`, { status });
    return response.data;
  },

  deleteClass: async (id: string) => {
    const response = await api.delete(`/organization/classes/${id}`);
    return response.data;
  },

  // Sections
  getSections: async (params?: { classId?: string }) => {
    const response = await api.get('/organization/sections', { params });
    return response.data;
  },

  getSectionsByClass: async (classId: string) => {
    const response = await api.get(`/organization/classes/${classId}/sections`);
    return response.data;
  },

  getSection: async (id: string) => {
    const response = await api.get(`/organization/sections/${id}`);
    return response.data;
  },

  createSection: async (
    classId: string,
    data: { name: string; code: string; capacity?: number }
  ) => {
    const response = await api.post(`/organization/classes/${classId}/sections`, data);
    return response.data;
  },

  updateSection: async (id: string, data: { name?: string; code?: string; capacity?: number }) => {
    const response = await api.put(`/organization/sections/${id}`, data);
    return response.data;
  },

  deleteSection: async (id: string) => {
    const response = await api.delete(`/organization/sections/${id}`);
    return response.data;
  },

  assignTeacher: async (sectionId: string, staffId: string | null) => {
    const response = await api.put(`/organization/sections/${sectionId}/assign-teacher`, {
      staffId,
    });
    return response.data;
  },

  // Lab batches (subdivisions of a section for practical scheduling).
  // Replaces the whole list; batches whose _id is passed back keep their
  // students, removed batches have their memberships cleared server-side.
  updateSectionBatches: async (
    sectionId: string,
    batches: Array<{ _id?: string; name: string }>
  ) => {
    const response = await api.put(`/organization/sections/${sectionId}/batches`, { batches });
    return response.data;
  },

  assignLabBatches: async (
    sectionId: string,
    assignments: Array<{ studentId: string; batchId: string | null }>
  ) => {
    const response = await api.put(`/organization/sections/${sectionId}/batches/assign`, {
      assignments,
    });
    return response.data;
  },

  getAvailableTeachers: async () => {
    const response = await api.get('/organization/sections/teachers/available');
    return response.data;
  },

  // Subjects
  getSubjects: async (params?: {
    classId?: string;
    status?: string;
    /** Subjects a department may teach: its own, global and shared-with-it. */
    usableByDepartmentId?: string;
    limit?: number;
  }) => {
    const response = await api.get('/organization/subjects', { params });
    return response.data;
  },

  getSubject: async (id: string) => {
    const response = await api.get(`/organization/subjects/${id}`);
    return response.data;
  },

  createSubject: async (data: {
    name: string;
    code: string;
    type: string;
    classIds?: string[];
    description?: string;
    credits?: number;
    ownerDepartmentId?: string | null;
    /** 'core' = owner only, 'shared' = owner + offeredToDepartmentIds, 'global' = everyone. */
    sharing?: 'global' | 'core' | 'shared';
    offeredToDepartmentIds?: string[];
    applicableTo?: { departments?: string[] };
  }) => {
    const response = await api.post('/organization/subjects', data);
    return response.data;
  },

  updateSubject: async (
    id: string,
    data: {
      name?: string;
      code?: string;
      type?: string;
      classIds?: string[];
      description?: string;
      credits?: number;
      ownerDepartmentId?: string | null;
      sharing?: 'global' | 'core' | 'shared';
      offeredToDepartmentIds?: string[];
      applicableTo?: { departments?: string[] };
    }
  ) => {
    const response = await api.put(`/organization/subjects/${id}`, data);
    return response.data;
  },

  deleteSubject: async (id: string) => {
    const response = await api.delete(`/organization/subjects/${id}`);
    return response.data;
  },

  // Class-Subject Mapping (read-only — aggregates subjects across all sections of the class)
  getClassSubjects: async (classId: string) => {
    const response = await api.get(`/organization/classes/${classId}/subjects`);
    return response.data;
  },

  // Section-Subject Mapping (authoritative — subjects + per-section teacher assignments)
  getSectionSubjects: async (sectionId: string) => {
    const response = await api.get(`/organization/sections/${sectionId}/subjects`);
    return response.data;
  },

  assignSubjectToSection: async (
    sectionId: string,
    data: { subjectId: string; teacherId?: string; periodsPerWeek?: number }
  ) => {
    const response = await api.post(`/organization/sections/${sectionId}/subjects`, data);
    return response.data;
  },

  updateSectionSubject: async (
    sectionId: string,
    subjectId: string,
    data: { teacherId?: string | null; periodsPerWeek?: number }
  ) => {
    const response = await api.put(
      `/organization/sections/${sectionId}/subjects/${subjectId}`,
      data
    );
    return response.data;
  },

  removeSubjectFromSection: async (sectionId: string, subjectId: string) => {
    const response = await api.delete(`/organization/sections/${sectionId}/subjects/${subjectId}`);
    return response.data;
  },

  // Academic Batches. branchId overrides the selected branch (see getClasses).
  getAcademicBatches: async (params?: { branchId?: string }) => {
    const response = await api.get('/organization/academic-batches', {
      headers: params?.branchId ? { 'X-Branch-Id': params.branchId } : undefined,
    });
    return response.data;
  },

  getCurrentBatch: async () => {
    const response = await api.get('/organization/academic-batches/current');
    return response.data;
  },

  getAcademicBatch: async (id: string) => {
    const response = await api.get(`/organization/academic-batches/${id}`);
    return response.data;
  },

  createAcademicBatch: async (data: {
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  }) => {
    const response = await api.post('/organization/academic-batches', data);
    return response.data;
  },

  updateAcademicBatch: async (
    id: string,
    data: {
      name?: string;
      code?: string;
      startDate?: string;
      endDate?: string;
    }
  ) => {
    const response = await api.put(`/organization/academic-batches/${id}`, data);
    return response.data;
  },

  setCurrentBatch: async (id: string) => {
    const response = await api.put(`/organization/academic-batches/${id}/activate`);
    return response.data;
  },

  /** Copy an earlier year's classes and sections (subjects + teachers) into `toBatchId`. */
  copyAcademicStructure: async (toBatchId: string, fromBatchId: string) => {
    const response = await api.post(`/organization/academic-batches/${toBatchId}/copy-structure`, {
      fromBatchId,
    });
    return response.data as {
      data: { classesCreated: number; classesSkipped: number; sectionsCreated: number };
    };
  },

  deleteAcademicBatch: async (id: string) => {
    const response = await api.delete(`/organization/academic-batches/${id}`);
    return response.data;
  },
};

// Student API
export const studentApi = {
  getStudents: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    classId?: string;
    sectionId?: string;
    academicBatchId?: string;
    category?: string;
    admissionCategory?: string;
    gender?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    customFields?: Record<string, string>;
  }) => {
    const { customFields, ...rest } = params || {};
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== null && v !== '') {
        search.append(k, String(v));
      }
    }
    if (customFields) {
      for (const [k, v] of Object.entries(customFields)) {
        if (v !== undefined && v !== null && v !== '') {
          search.append(`cf[${k}]`, v);
        }
      }
    }
    const qs = search.toString();
    const response = await api.get(`/students${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  getStudent: async (id: string) => {
    const response = await api.get(`/students/${id}`);
    return response.data;
  },

  createStudent: async (data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    academicBatchId: string;
    classId: string;
    sectionId: string;
    bloodGroup?: string;
    nationality?: string;
    religion?: string;
    caste?: string;
    category?: string;
    admissionCategory?: string;
    rollNumber?: string;
    aadharNumber?: string;
    contact?: {
      email?: string;
      phone?: string;
    };
    parents?: {
      father?: { name: string; phone?: string; email?: string; occupation?: string };
      mother?: { name: string; phone?: string; email?: string; occupation?: string };
    };
    customFields?: Record<string, unknown>;
  }) => {
    const response = await api.post('/students', data);
    return response.data;
  },

  updateStudent: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/students/${id}`, data);
    return response.data;
  },

  deleteStudent: async (id: string) => {
    const response = await api.delete(`/students/${id}`);
    return response.data;
  },

  updateStudentStatus: async (id: string, status: string, reason?: string) => {
    const response = await api.put(`/students/${id}/status`, { status, reason });
    return response.data;
  },

  resetPortalPassword: async (id: string) => {
    const response = await api.post(`/students/${id}/reset-portal-password`);
    return response.data;
  },

  getStudentStats: async () => {
    const response = await api.get('/students/stats');
    return response.data;
  },

  exportStudents: async (params?: { classId?: string; sectionId?: string; format?: string }) => {
    const response = await api.get('/students/export', { params, responseType: 'blob' });
    return response.data;
  },

  // Bulk operations from list-page selection
  bulkUpdateStatus: async (data: {
    studentIds: string[];
    status: 'active' | 'inactive' | 'alumni' | 'transferred';
    reason?: string;
  }) => {
    const response = await api.post('/students/bulk-status', data);
    return response.data;
  },

  bulkShuffleStudents: async (data: {
    studentIds: string[];
    newSectionId: string;
    reason?: string;
  }) => {
    const response = await api.post('/students/bulk-shuffle', data);
    return response.data;
  },

  bulkDeleteStudents: async (studentIds: string[]) => {
    const response = await api.post('/students/bulk-delete', { studentIds });
    return response.data;
  },

  exportSelectedStudents: async (studentIds: string[], format: 'csv' | 'json' = 'csv') => {
    const response = await api.post(
      '/students/bulk-export',
      { studentIds },
      { params: { format }, responseType: format === 'csv' ? 'blob' : 'json' }
    );
    return response.data;
  },

  // Bulk Upload
  getBulkUploadTemplate: async (academicBatchId: string) => {
    const response = await api.get('/students/bulk-upload/template', {
      params: { academicBatchId },
      responseType: 'blob',
    });
    return response.data;
  },

  validateBulkUpload: async (academicBatchId: string, data: Array<Record<string, string>>) => {
    const response = await api.post('/students/bulk-upload/validate', {
      academicBatchId,
      data,
    });
    return response.data;
  },

  processBulkUpload: async (
    academicBatchId: string,
    data: Array<Record<string, string>>,
    meta?: { fileName?: string; source?: 'csv' | 'ai' | 'manual' }
  ) => {
    const response = await api.post('/students/bulk-upload', {
      academicBatchId,
      data,
      fileName: meta?.fileName,
      source: meta?.source,
    });
    return response.data;
  },

  aiParseBulkUpload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/students/bulk-upload/ai-parse', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Bulk Upload History
  getBulkUploads: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get('/students/bulk-uploads', { params });
    return response.data;
  },

  deleteBulkUpload: async (id: string) => {
    const response = await api.delete(`/students/bulk-uploads/${id}`);
    return response.data;
  },

  // Student sub-endpoints
  getEnrollmentHistory: async (studentId: string) => {
    const response = await api.get(`/students/${studentId}/enrollments`);
    return response.data;
  },

  getFeeSummary: async (studentId: string) => {
    const response = await api.get(`/students/${studentId}/fee-summary`);
    return response.data;
  },

  getAttendanceSummary: async (studentId: string) => {
    const response = await api.get(`/students/${studentId}/attendance-summary`);
    return response.data;
  },

  shuffleStudent: async (studentId: string, data: { newSectionId: string; reason?: string }) => {
    const response = await api.post(`/students/${studentId}/shuffle`, data);
    return response.data;
  },

  transferStudent: async (
    studentId: string,
    data: {
      toBranchId: string;
      toClassId: string;
      toSectionId: string;
      toAcademicBatchId: string;
      transferDate?: string;
      reason?: string;
    }
  ) => {
    const response = await api.post(`/students/${studentId}/transfer`, data);
    return response.data;
  },

  // Student Reports
  getClassWiseReport: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/students/reports/class-wise', { params });
    return response.data;
  },

  getSectionWiseReport: async (params?: { classId?: string; academicBatchId?: string }) => {
    const response = await api.get('/students/reports/section-wise', { params });
    return response.data;
  },

  getActiveStudentReport: async (params?: { classId?: string; academicBatchId?: string }) => {
    const response = await api.get('/students/reports/active', { params });
    return response.data;
  },

  getCategoryWiseReport: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/students/reports/category-wise', { params });
    return response.data;
  },

  getNewAdmissionsReport: async (params?: {
    fromDate?: string;
    toDate?: string;
    academicBatchId?: string;
  }) => {
    const response = await api.get('/students/reports/new-admissions', { params });
    return response.data;
  },

  getAlumniList: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/students/alumni', { params });
    return response.data;
  },

  getAlumniStats: async () => {
    const response = await api.get('/students/alumni/stats');
    return response.data;
  },

  // Promotion
  bulkPromote: async (data: {
    fromAcademicBatchId: string;
    toAcademicBatchId: string;
    promotions: Array<{
      fromClassId: string;
      fromSectionId?: string;
      toClassId: string;
      toSectionId: string;
      result?: 'promoted' | 'passed';
    }>;
    excludeStudentIds?: string[];
  }) => {
    const response = await api.post('/students/bulk-promote', data);
    return response.data;
  },

  promoteStudent: async (
    studentId: string,
    data: {
      newAcademicBatchId: string;
      newClassId: string;
      newSectionId: string;
      result?: 'promoted' | 'passed' | 'failed' | 'detained';
      remarks?: string;
    }
  ) => {
    const response = await api.post(`/students/${studentId}/promote`, data);
    return response.data;
  },
};

// Attendance API
export const attendanceApi = {
  // Student Attendance
  getAttendance: async (params: {
    classId: string;
    sectionId: string;
    date: string;
    /** Per-subject (lecture) register; omit for the whole-day register. */
    subjectId?: string;
    period?: number;
    /** Lab-batch register (id from Section.batches); only with subjectId. */
    batchId?: string;
  }) => {
    const response = await api.get('/attendance/students', { params });
    return response.data;
  },

  /** Subject-wise % + exam eligibility over a date range. */
  getSubjectWiseReport: async (params: {
    sectionId: string;
    fromDate: string;
    toDate: string;
    threshold?: number;
  }) => {
    const response = await api.get('/attendance/reports/subject-wise', { params });
    return response.data;
  },

  markAttendance: async (data: {
    classId: string;
    sectionId: string;
    date: string;
    subjectId?: string;
    period?: number;
    /** Lab-batch register (id from Section.batches); only with subjectId. */
    batchId?: string;
    records: Array<{
      studentId: string;
      status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
      inTime?: string;
      outTime?: string;
      remarks?: string;
    }>;
  }) => {
    const response = await api.post('/attendance/students', data);
    return response.data;
  },

  updateRecord: async (
    attendanceId: string,
    data: {
      studentId: string;
      status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
      inTime?: string;
      outTime?: string;
      remarks?: string;
    }
  ) => {
    const response = await api.put(`/attendance/students/${attendanceId}`, data);
    return response.data;
  },

  lockAttendance: async (attendanceId: string) => {
    const response = await api.put(`/attendance/students/${attendanceId}/lock`);
    return response.data;
  },

  getStudentHistory: async (studentId: string, params?: { fromDate?: string; toDate?: string }) => {
    const response = await api.get(`/attendance/students/${studentId}/history`, { params });
    return response.data;
  },

  // Reports
  getDailyReport: async (date: string) => {
    const response = await api.get('/attendance/reports/daily', { params: { date } });
    return response.data;
  },

  getClassWiseReport: async (params: { classId: string; fromDate: string; toDate: string }) => {
    const response = await api.get('/attendance/reports/class-wise', { params });
    return response.data;
  },

  getStudentWiseReport: async (params: {
    classId: string;
    sectionId: string;
    fromDate: string;
    toDate: string;
  }) => {
    const response = await api.get('/attendance/reports/student-wise', { params });
    return response.data;
  },

  getMonthlyReport: async (params: { year: number; month: number }) => {
    const response = await api.get('/attendance/reports/monthly', { params });
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/attendance/settings');
    return response.data;
  },

  updateSettings: async (data: {
    workingDays?: number[];
    startTime?: string;
    endTime?: string;
    lateThresholdMinutes?: number;
    halfDayThresholdMinutes?: number;
    autoLockAfterDays?: number;
    requireRemarks?: boolean;
    allowFutureAttendance?: boolean;
    lowAttendanceThreshold?: number;
  }) => {
    const response = await api.put('/attendance/settings', data);
    return response.data;
  },

  // Holidays
  getHolidays: async (params?: {
    year?: number;
    type?: string;
    applicableFor?: string;
    upcoming?: boolean;
  }) => {
    const response = await api.get('/attendance/holidays', { params });
    return response.data;
  },

  getHolidayStats: async () => {
    const response = await api.get('/attendance/holidays/stats');
    return response.data;
  },

  getHoliday: async (id: string) => {
    const response = await api.get(`/attendance/holidays/${id}`);
    return response.data;
  },

  createHoliday: async (data: {
    name: string;
    date: string;
    endDate?: string;
    type: 'national' | 'religious' | 'local' | 'vacation';
    description?: string;
    applicableFor?: 'all' | 'students' | 'staff';
  }) => {
    const response = await api.post('/attendance/holidays', data);
    return response.data;
  },

  updateHoliday: async (
    id: string,
    data: {
      name?: string;
      date?: string;
      endDate?: string;
      type?: 'national' | 'religious' | 'local' | 'vacation';
      description?: string;
      applicableFor?: 'all' | 'students' | 'staff';
    }
  ) => {
    const response = await api.put(`/attendance/holidays/${id}`, data);
    return response.data;
  },

  deleteHoliday: async (id: string) => {
    const response = await api.delete(`/attendance/holidays/${id}`);
    return response.data;
  },
};

// Staff Attendance API (HR Module)
export const staffAttendanceApi = {
  // Get attendance for a date
  getAttendance: async (date: string) => {
    const response = await api.get('/hr/attendance', { params: { date } });
    return response.data;
  },

  // Mark staff attendance
  markAttendance: async (data: {
    date: string;
    records: Array<{
      staffId: string;
      status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';
      checkIn?: string;
      checkOut?: string;
      remarks?: string;
    }>;
  }) => {
    const response = await api.post('/hr/attendance', data);
    return response.data;
  },

  // Get my attendance (for individual staff)
  getMyAttendance: async (params?: { month?: number; year?: number }) => {
    const response = await api.get('/hr/attendance/my', { params });
    return response.data;
  },

  // Self check-in/out (any staff member, for themselves)
  getSelfAttendanceToday: async () => {
    // Suppress global 403 toast — users without the HR module or a staff
    // profile legitimately fail here; the dashboard card hides itself.
    const response = await api.get('/hr/attendance/self/today', {
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },
  selfCheckIn: async (location?: { latitude: number; longitude: number; accuracy?: number }) => {
    const response = await api.post('/hr/attendance/self/check-in', { location });
    return response.data;
  },
  selfCheckOut: async (location?: { latitude: number; longitude: number; accuracy?: number }) => {
    const response = await api.post('/hr/attendance/self/check-out', { location });
    return response.data;
  },

  // Daily report
  getDailyReport: async (date: string) => {
    const response = await api.get('/hr/attendance/reports/daily', { params: { date } });
    return response.data;
  },

  // Monthly report
  getMonthlyReport: async (params: { month: number; year: number }) => {
    const response = await api.get('/hr/attendance/reports/monthly', { params });
    return response.data;
  },

  // Lock attendance
  lockAttendance: async (date: string) => {
    const response = await api.post('/hr/attendance/lock', { date });
    return response.data;
  },

  // Unlock attendance
  unlockAttendance: async (date: string) => {
    const response = await api.post('/hr/attendance/unlock', { date });
    return response.data;
  },
};

// HR API (Staff management)
export const hrApi = {
  // Staff
  getStaff: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    departmentId?: string;
    isTeaching?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const response = await api.get('/hr/staff', { params });
    return response.data;
  },

  getStaffById: async (id: string) => {
    const response = await api.get(`/hr/staff/${id}`);
    return response.data;
  },

  createStaff: async (data: {
    firstName: string;
    lastName: string;
    gender: 'male' | 'female' | 'other';
    dateOfBirth?: string;
    contact: {
      email: string;
      phone: string;
    };
    employment: {
      joiningDate: string;
      employmentType: 'permanent' | 'contract' | 'probation' | 'intern';
      departmentId?: string;
      designationId?: string;
    };
    teaching?: {
      isTeaching: boolean;
    };
    customFields?: Record<string, unknown>;
    roleCode?: string;
    accessScope?: {
      type: 'institution' | 'department' | 'program';
      institutionIds?: string[];
      departmentIds?: string[];
      programIds?: string[];
    };
    password?: string;
  }) => {
    const response = await api.post('/hr/staff', data);
    return response.data;
  },

  getStaffPendingApprovals: async () => {
    const response = await api.get('/hr/staff/pending-approvals');
    return response.data;
  },

  approveStaff: async (id: string) => {
    const response = await api.put(`/hr/staff/${id}/approve`);
    return response.data;
  },

  rejectStaff: async (id: string, reason?: string) => {
    const response = await api.put(`/hr/staff/${id}/reject`, { reason });
    return response.data;
  },

  updateStaff: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/staff/${id}`, data);
    return response.data;
  },

  deleteStaff: async (id: string) => {
    const response = await api.delete(`/hr/staff/${id}`);
    return response.data;
  },

  getStaffStats: async () => {
    const response = await api.get('/hr/staff/stats');
    return response.data;
  },

  // Departments
  // Also used as OPTIONAL enrichment outside HR (e.g. the subject catalogue's
  // owner-department picker). Tenants without the HR module get a 403 there,
  // which callers handle by hiding the field — so don't raise a global toast.
  getDepartments: async (params?: { institutionId?: string; includeInactive?: boolean }) => {
    const response = await api.get('/hr/departments', {
      params,
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },

  createDepartment: async (data: {
    name: string;
    code: string;
    type: 'academic' | 'administrative' | 'support';
    description?: string;
    headOfDepartment?: string | null;
    /** Constituent institution; omitted means the campus's default. */
    institutionId?: string;
    /** Campus-wide department serving every institution (no institutionId). */
    shared?: boolean;
  }) => {
    const response = await api.post('/hr/departments', data);
    return response.data;
  },

  updateDepartment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/departments/${id}`, data);
    return response.data;
  },

  deleteDepartment: async (id: string) => {
    const response = await api.delete(`/hr/departments/${id}`);
    return response.data;
  },

  // Designations
  /** Optional enrichment outside HR — see getDepartments. */
  getDesignations: async () => {
    const response = await api.get('/hr/designations', {
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },

  // Promotions (designation ladder + payroll revision)
  getPromotionPolicies: async () => {
    const response = await api.get('/hr/promotion-policies');
    return response.data;
  },

  createPromotionPolicy: async (data: {
    fromDesignationId: string;
    toDesignationId: string;
    increment:
      | { type: 'percentage'; value: number; base: 'basic' | 'gross' }
      | { type: 'fixed'; value: number }
      | { type: 'structure'; structureId: string };
    requiresApproval?: boolean;
  }) => {
    const response = await api.post('/hr/promotion-policies', data);
    return response.data;
  },

  updatePromotionPolicy: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/promotion-policies/${id}`, data);
    return response.data;
  },

  deletePromotionPolicy: async (id: string) => {
    const response = await api.delete(`/hr/promotion-policies/${id}`);
    return response.data;
  },

  getPromotions: async (params?: { staffId?: string; status?: string }) => {
    const response = await api.get('/hr/promotions', { params });
    return response.data;
  },

  promoteStaff: async (
    staffId: string,
    data: { toDesignationId: string; effectiveFrom?: string; lateral?: boolean; remarks?: string }
  ) => {
    const response = await api.post(`/hr/staff/${staffId}/promote`, data);
    return response.data;
  },

  approvePromotion: async (id: string) => {
    const response = await api.post(`/hr/promotions/${id}/approve`);
    return response.data;
  },

  rejectPromotion: async (id: string, reason: string) => {
    const response = await api.post(`/hr/promotions/${id}/reject`, { reason });
    return response.data;
  },

  createDesignation: async (data: {
    name: string;
    code: string;
    category: 'teaching' | 'non-teaching' | 'management';
    level: number;
    description?: string;
  }) => {
    const response = await api.post('/hr/designations', data);
    return response.data;
  },

  updateDesignation: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/designations/${id}`, data);
    return response.data;
  },

  deleteDesignation: async (id: string) => {
    const response = await api.delete(`/hr/designations/${id}`);
    return response.data;
  },

  // Leaves
  getLeaves: async (params?: {
    page?: number;
    limit?: number;
    staffId?: string;
    leaveType?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/hr/leaves', { params });
    return response.data;
  },

  getLeaveById: async (id: string) => {
    const response = await api.get(`/hr/leaves/${id}`);
    return response.data;
  },

  /** For yourself; HR may pass staffId to apply on someone's behalf. */
  applyLeave: async (data: {
    staffId?: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    isHalfDay?: boolean;
    halfDayType?: 'first-half' | 'second-half';
    reason: string;
  }) => {
    const response = await api.post('/hr/leaves', data);
    return response.data;
  },

  approveLeave: async (id: string, remarks?: string) => {
    const response = await api.put(`/hr/leaves/${id}/approve`, { remarks });
    return response.data;
  },

  rejectLeave: async (id: string, remarks: string) => {
    const response = await api.put(`/hr/leaves/${id}/reject`, { remarks });
    return response.data;
  },

  cancelLeave: async (id: string, reason: string) => {
    const response = await api.delete(`/hr/leaves/${id}`, { data: { reason } });
    return response.data;
  },

  getMyLeaves: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await api.get('/hr/leaves/my', { params });
    return response.data;
  },

  getLeaveBalance: async (staffId?: string) => {
    const response = await api.get('/hr/leaves/balance', { params: { staffId } });
    return response.data;
  },

  // Staff Status
  updateStaffStatus: async (id: string, status: string, reason?: string) => {
    const response = await api.put(`/hr/staff/${id}/status`, { status, reason });
    return response.data;
  },

  // Staff Photo
  uploadStaffPhoto: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/hr/staff/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Workload
  getWorkload: async (params?: { staffId?: string; departmentId?: string }) => {
    const response = await api.get('/hr/workload', { params });
    return response.data;
  },

  assignWorkload: async (data: {
    staffId: string;
    subjectId: string;
    classId: string;
    sectionIds?: string[];
    periodsPerWeek: number;
  }) => {
    const response = await api.post('/hr/workload', data);
    return response.data;
  },

  updateWorkload: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/workload/${id}`, data);
    return response.data;
  },

  // Bulk Upload
  getBulkUploadTemplate: async () => {
    const response = await api.get('/hr/staff/bulk-upload/template', { responseType: 'blob' });
    return response.data;
  },

  validateBulkUpload: async (data: Array<Record<string, string>>) => {
    const response = await api.post('/hr/staff/bulk-upload/validate', { data });
    return response.data;
  },

  processBulkUpload: async (data: Array<Record<string, string>>) => {
    const response = await api.post('/hr/staff/bulk-upload', { data });
    return response.data;
  },

  // HR Settings
  getSettings: async () => {
    const response = await api.get('/hr/settings');
    return response.data;
  },

  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/hr/settings', data);
    return response.data;
  },

  addLeaveType: async (data: {
    code: string;
    name: string;
    defaultBalance: number;
    carryForward: boolean;
    maxCarryForward?: number;
  }) => {
    const response = await api.post('/hr/settings/leave-types', data);
    return response.data;
  },

  updateLeaveType: async (code: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/settings/leave-types/${code}`, data);
    return response.data;
  },

  deleteLeaveType: async (code: string) => {
    const response = await api.delete(`/hr/settings/leave-types/${code}`);
    return response.data;
  },

  // Shifts
  addShift: async (data: {
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes?: number;
    isDefault?: boolean;
  }) => {
    const response = await api.post('/hr/settings/shifts', data);
    return response.data;
  },

  updateShift: async (code: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/settings/shifts/${code}`, data);
    return response.data;
  },

  deleteShift: async (code: string) => {
    const response = await api.delete(`/hr/settings/shifts/${code}`);
    return response.data;
  },

  // Weekly Offs
  updateWeeklyOffs: async (data: {
    days: number[];
    alternateWeekPattern?: {
      enabled: boolean;
      alternateDay?: number;
      startDate?: string;
    };
  }) => {
    const response = await api.put('/hr/settings/weekly-offs', data);
    return response.data;
  },

  // Leave Encashment
  updateLeaveEncashment: async (data: {
    enabled: boolean;
    eligibleLeaveTypes?: string[];
    maxEncashmentDays?: number;
    calculationBasis?: 'basic' | 'gross';
    minimumBalance?: number;
    payoutSchedule?: 'yearly' | 'on_separation';
  }) => {
    const response = await api.put('/hr/settings/leave-encashment', data);
    return response.data;
  },

  // Leave Approvals
  getPendingApprovals: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get('/hr/leaves/pending-approvals', { params });
    return response.data;
  },

  getApprovalStats: async () => {
    const response = await api.get('/hr/leaves/approval-stats');
    return response.data;
  },

  // ============ RazorpayX Salary Payouts ============
  // Per-branch integration. All endpoints scope to the active branch via
  // the X-Branch-Id header set globally on the axios instance.
  getRazorpayXSettings: async () => {
    const response = await api.get('/hr/settings/razorpay-x');
    return response.data;
  },

  connectRazorpayX: async (data: {
    keyId: string;
    keySecret: string;
    sourceAccountNumber: string;
    webhookSecret: string;
    pennyDropEnabled?: boolean;
  }) => {
    const response = await api.post('/hr/settings/razorpay-x/connect', data);
    return response.data;
  },

  verifyRazorpayX: async () => {
    const response = await api.post('/hr/settings/razorpay-x/verify');
    return response.data;
  },

  disconnectRazorpayX: async () => {
    const response = await api.delete('/hr/settings/razorpay-x');
    return response.data;
  },

  getRazorpayXBalance: async () => {
    const response = await api.get('/hr/settings/razorpay-x/balance');
    return response.data;
  },

  syncStaffRazorpayX: async (staffId: string) => {
    const response = await api.post(`/hr/staff/${staffId}/razorpay-x/sync`);
    return response.data;
  },

  getPayrollRunPaySummary: async (runId: string) => {
    const response = await api.get(`/hr/payroll-runs/${runId}/pay-summary`);
    return response.data;
  },

  payPayrollRun: async (
    runId: string,
    data?: {
      mode?: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
      staffIds?: string[];
      queueIfLowBalance?: boolean;
    }
  ) => {
    const response = await api.post(`/hr/payroll-runs/${runId}/pay`, data ?? {});
    return response.data;
  },

  payPayslip: async (
    payslipId: string,
    data?: { mode?: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI'; queueIfLowBalance?: boolean }
  ) => {
    const response = await api.post(`/hr/payslips/${payslipId}/pay`, data ?? {});
    return response.data;
  },

  refreshPayslipPayout: async (payslipId: string) => {
    const response = await api.post(`/hr/payslips/${payslipId}/payout/refresh`);
    return response.data;
  },
};

// Payroll API
export const payrollApi = {
  // Salary Structures
  getSalaryStructures: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const response = await api.get('/hr/salary-structures', { params });
    return response.data;
  },
  getSalaryStructure: async (id: string) => {
    const response = await api.get(`/hr/salary-structures/${id}`);
    return response.data;
  },
  createSalaryStructure: async (data: Record<string, unknown>) => {
    const response = await api.post('/hr/salary-structures', data);
    return response.data;
  },
  updateSalaryStructure: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/salary-structures/${id}`, data);
    return response.data;
  },
  deleteSalaryStructure: async (id: string) => {
    const response = await api.delete(`/hr/salary-structures/${id}`);
    return response.data;
  },
  suggestSalaryStructures: async (staffId: string) => {
    const response = await api.get(`/hr/salary-structures/suggest/${staffId}`);
    return response.data;
  },

  // Salary Assignments
  getSalaryAssignments: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    staffId?: string;
  }) => {
    const response = await api.get('/hr/salary-assignments', { params });
    return response.data;
  },
  getStaffSalaryAssignment: async (staffId: string) => {
    const response = await api.get(`/hr/salary-assignments/staff/${staffId}`);
    return response.data;
  },
  assignSalary: async (data: Record<string, unknown>) => {
    const response = await api.post('/hr/salary-assignments', data);
    return response.data;
  },
  reviseSalary: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/salary-assignments/${id}`, data);
    return response.data;
  },
  addCustomDeduction: async (id: string, data: Record<string, unknown>) => {
    const response = await api.post(`/hr/salary-assignments/${id}/custom-deductions`, data);
    return response.data;
  },
  updateCustomDeduction: async (id: string, code: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/salary-assignments/${id}/custom-deductions/${code}`, data);
    return response.data;
  },

  // Payroll Runs
  getPayrollRuns: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    year?: number;
  }) => {
    const response = await api.get('/hr/payroll-runs', { params });
    return response.data;
  },
  /** Record a finalized run as paid by bank transfer (no gateway; moves no money). */
  markPayrollRunPaid: async (id: string, paymentReference: string) => {
    const response = await api.put(`/hr/payroll-runs/${id}/mark-paid`, { paymentReference });
    return response.data as { data: { paid: number } };
  },
  /** One run's totals by pay component and by department, plus how many are paid. */
  getPayrollRunBreakdown: async (id: string) => {
    const response = await api.get(`/hr/payroll-runs/${id}/breakdown`);
    return response.data as {
      data: {
        runId: string;
        month: number;
        year: number;
        status: string;
        staffCount: number;
        paidCount: number;
        earnings: Array<{ code: string; name: string; amount: number }>;
        deductions: Array<{ code: string; name: string; amount: number }>;
        departments: Array<{ name: string; staff: number; gross: number; net: number }>;
      };
    };
  },
  getPayrollRun: async (id: string) => {
    const response = await api.get(`/hr/payroll-runs/${id}`);
    return response.data;
  },
  processPayroll: async (data: {
    month: number;
    year: number;
    staffIds?: string[];
    remarks?: string;
  }) => {
    const response = await api.post('/hr/payroll-runs', data);
    return response.data;
  },
  finalizePayroll: async (id: string) => {
    const response = await api.put(`/hr/payroll-runs/${id}/finalize`);
    return response.data;
  },
  cancelPayroll: async (id: string) => {
    const response = await api.put(`/hr/payroll-runs/${id}/cancel`);
    return response.data;
  },

  // Payslips
  getPayslips: async (params?: {
    page?: number;
    limit?: number;
    period?: string;
    month?: number;
    year?: number;
    payrollRunId?: string;
    disbursementStatus?: string;
    search?: string;
  }) => {
    const response = await api.get('/hr/payslips', { params });
    return response.data;
  },
  getMyPayslips: async (params?: { page?: number; limit?: number; year?: number }) => {
    // Suppress global 403 toast — users without the HR module or a staff
    // profile legitimately fail here; callers render an empty state instead.
    const response = await api.get('/hr/payslips/my', {
      params,
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },
  getPayslip: async (id: string) => {
    const response = await api.get(`/hr/payslips/${id}`);
    return response.data;
  },
  updateDisbursement: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hr/payslips/${id}/disbursement`, data);
    return response.data;
  },
  bulkUpdateDisbursement: async (data: {
    payslipIds: string[];
    status: string;
    paymentMode?: string;
    paymentReference?: string;
    remarks?: string;
  }) => {
    const response = await api.put('/hr/payslips/bulk-disbursement', data);
    return response.data;
  },

  // Payroll Settings
  getPayrollSettings: async () => {
    const response = await api.get('/hr/settings/payroll');
    return response.data;
  },
  updatePayrollSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/hr/settings/payroll', data);
    return response.data;
  },
};

// Campus Feed API
export const feedApi = {
  getPosts: async (params?: {
    page?: number;
    limit?: number;
    authorId?: string;
    postType?: string;
  }) => {
    const response = await api.get('/feed/posts', { params });
    return response.data;
  },
  getPost: async (id: string) => {
    const response = await api.get(`/feed/posts/${id}`);
    return response.data;
  },
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/image/feed/draft?category=photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  createPost: async (data: {
    postType?: string;
    content: string;
    media?: Array<{ url: string; type: string }>;
    audience?: string;
  }) => {
    const response = await api.post('/feed/posts', data);
    return response.data;
  },
  updatePost: async (id: string, data: { content: string }) => {
    const response = await api.put(`/feed/posts/${id}`, data);
    return response.data;
  },
  deletePost: async (id: string) => {
    const response = await api.delete(`/feed/posts/${id}`);
    return response.data;
  },
  toggleLike: async (id: string) => {
    const response = await api.post(`/feed/posts/${id}/like`);
    return response.data;
  },
  addComment: async (id: string, data: { content: string; parentCommentId?: string }) => {
    const response = await api.post(`/feed/posts/${id}/comments`, data);
    return response.data;
  },
  deleteComment: async (postId: string, commentId: string) => {
    const response = await api.delete(`/feed/posts/${postId}/comments/${commentId}`);
    return response.data;
  },
  togglePin: async (id: string) => {
    const response = await api.put(`/feed/posts/${id}/pin`);
    return response.data;
  },
  flagPost: async (id: string, data: { reason: string }) => {
    const response = await api.post(`/feed/posts/${id}/flag`, data);
    return response.data;
  },
  moderateDelete: async (id: string) => {
    const response = await api.delete(`/feed/posts/${id}/moderate`);
    return response.data;
  },
  getFlaggedPosts: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get('/feed/posts/flagged', { params });
    return response.data;
  },
};

// Finance API
export const financeApi = {
  // Fee Assignments
  getAssignments: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    classId?: string;
    sectionId?: string;
    academicBatchId?: string;
    feeStructureId?: string;
    hasBalance?: boolean;
  }) => {
    const response = await api.get('/finance/assignments', { params });
    return response.data;
  },

  getAssignment: async (id: string) => {
    const response = await api.get(`/finance/assignments/${id}`);
    return response.data;
  },

  createAssignment: async (data: {
    studentId: string;
    feeStructureId: string;
    academicBatchId: string;
  }) => {
    const response = await api.post('/finance/assignments', data);
    return response.data;
  },

  updateAssignment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/finance/assignments/${id}`, data);
    return response.data;
  },

  deleteAssignment: async (id: string) => {
    const response = await api.delete(`/finance/assignments/${id}`);
    return response.data;
  },

  bulkCreateAssignments: async (data: {
    studentIds: string[];
    feeStructureId: string;
    academicBatchId: string;
  }) => {
    const response = await api.post('/finance/assignments/bulk', data);
    return response.data;
  },

  getUnassignedStudents: async (params?: {
    academicBatchId?: string;
    classId?: string;
    sectionId?: string;
  }) => {
    const response = await api.get('/finance/assignments/unassigned', { params });
    return response.data;
  },

  // Branch fee totals from the dues summary report (defaults to the current batch)
  getAssignmentStats: async (params?: { academicBatchId?: string }) => {
    let academicBatchId = params?.academicBatchId;
    if (!academicBatchId) {
      const batch = await api.get('/organization/academic-batches/current');
      academicBatchId = batch.data?.data?._id;
    }
    if (!academicBatchId)
      return { success: true, data: { totalFee: 0, totalPaid: 0, totalBalance: 0 } };
    const response = await api.get('/finance/reports/dues/summary', {
      params: { academicBatchId, branchId: useBranchStore.getState().selectedBranchId },
    });
    const t = response.data?.data?.grandTotal || {};
    return {
      ...response.data,
      data: {
        totalFee: t.totalFee || 0,
        totalPaid: t.totalPaid || 0,
        totalBalance: t.totalDue || 0,
        branches: response.data?.data?.branches || [],
      },
    };
  },

  // Fee Bulk Upload
  getFeeUploadTemplate: async (academicBatchId: string) => {
    const response = await api.get('/finance/bulk-upload/assignments/template', {
      params: { academicBatchId },
      responseType: 'blob',
    });
    return response.data;
  },

  validateFeeUpload: async (academicBatchId: string, data: Array<Record<string, string>>) => {
    const response = await api.post('/finance/bulk-upload/assignments/validate', {
      academicBatchId,
      data,
    });
    return response.data;
  },

  processFeeUpload: async (academicBatchId: string, data: Array<Record<string, string>>) => {
    const response = await api.post('/finance/bulk-upload/assignments', {
      academicBatchId,
      data,
    });
    return response.data;
  },

  // Concessions
  getConcessions: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    studentId?: string;
  }) => {
    const response = await api.get('/finance/concessions', { params });
    return response.data;
  },

  getConcession: async (id: string) => {
    const response = await api.get(`/finance/concessions/${id}`);
    return response.data;
  },

  createConcession: async (data: {
    studentId: string;
    assignmentId: string;
    type: 'percentage' | 'fixed';
    value: number;
    reason: string;
    componentCodes?: string[];
  }) => {
    const response = await api.post('/finance/concessions', data);
    return response.data;
  },

  approveConcession: async (id: string, remarks?: string) => {
    const response = await api.put(`/finance/concessions/${id}/approve`, { remarks });
    return response.data;
  },

  rejectConcession: async (id: string, reason: string) => {
    const response = await api.put(`/finance/concessions/${id}/reject`, { reason });
    return response.data;
  },

  deleteConcession: async (id: string) => {
    const response = await api.delete(`/finance/concessions/${id}`);
    return response.data;
  },

  getConcessionStats: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/finance/concessions/stats', { params });
    return response.data;
  },

  // Scholarships (receivables — govt fee reimbursement etc.)
  getScholarships: async (params?: {
    page?: number;
    limit?: number;
    studentId?: string;
    status?: string;
    scheme?: string;
    sponsor?: string;
  }) => {
    const response = await api.get('/finance/scholarships', { params });
    return response.data;
  },

  getScholarshipStats: async () => {
    const response = await api.get('/finance/scholarships/stats');
    return response.data;
  },

  createScholarship: async (data: {
    studentId: string;
    feeAssignmentId?: string;
    scheme: string;
    sponsor?: 'government' | 'private' | 'institution';
    sanctionedAmount: number;
    applicationRef?: string;
    remarks?: string;
  }) => {
    const response = await api.post('/finance/scholarships', data);
    return response.data;
  },

  approveScholarship: async (id: string) => {
    const response = await api.post(`/finance/scholarships/${id}/approve`);
    return response.data;
  },

  rejectScholarship: async (id: string, reason: string) => {
    const response = await api.post(`/finance/scholarships/${id}/reject`, { reason });
    return response.data;
  },

  recordScholarshipDisbursement: async (
    id: string,
    data: { amount: number; receivedAt?: string; utrRef?: string }
  ) => {
    const response = await api.post(`/finance/scholarships/${id}/disbursements`, data);
    return response.data;
  },

  deleteScholarship: async (id: string) => {
    const response = await api.delete(`/finance/scholarships/${id}`);
    return response.data;
  },

  // Concession Bulk Upload
  getConcessionUploadTemplate: async (academicBatchId: string) => {
    const response = await api.get('/finance/bulk-upload/concessions/template', {
      params: { academicBatchId },
      responseType: 'blob',
    });
    return response.data;
  },

  validateConcessionUpload: async (
    academicBatchId: string,
    data: Array<Record<string, string>>
  ) => {
    const response = await api.post('/finance/bulk-upload/concessions/validate', {
      academicBatchId,
      data,
    });
    return response.data;
  },

  processConcessionUpload: async (academicBatchId: string, data: Array<Record<string, string>>) => {
    const response = await api.post('/finance/bulk-upload/concessions', {
      academicBatchId,
      data,
    });
    return response.data;
  },

  // Finance Settings
  getFinanceSettings: async () => {
    const response = await api.get('/finance/settings');
    return response.data;
  },

  updateFinanceSettings: async (data: {
    receiptSettings?: {
      prefix?: string;
      startNumber?: number;
      showLogo?: boolean;
      showSignature?: boolean;
      footerText?: string;
    };
    lateFeeSettings?: {
      enabled?: boolean;
      type?: 'percentage' | 'fixed';
      value?: number;
      gracePeriodDays?: number;
      maxAmount?: number;
    };
    cancellationSettings?: {
      allowCancellation?: boolean;
      cancellationCharge?: number;
      requireApproval?: boolean;
    };
    concessionSettings?: {
      requireApproval?: boolean;
      maxPercentage?: number;
      allowedTypes?: string[];
    };
  }) => {
    const response = await api.put('/finance/settings', data);
    return response.data;
  },

  // Bank Accounts — stored inside finance settings; API uses accountName/branchName
  getBankAccounts: async () => {
    const response = await api.get('/finance/settings');
    const accounts = (response.data?.data?.bankAccounts || []) as Array<Record<string, unknown>>;
    return {
      ...response.data,
      data: accounts.map((a) => ({ ...a, name: a.accountName, branch: a.branchName })),
    };
  },

  addBankAccount: async (data: {
    name: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    branch?: string;
    isDefault?: boolean;
  }) => {
    const { name, branch, ...rest } = data;
    const response = await api.post('/finance/settings/bank-accounts', {
      ...rest,
      accountName: name,
      branchName: branch,
    });
    return response.data;
  },

  updateBankAccount: async (id: string, data: Record<string, unknown>) => {
    const { name, branch, ...rest } = data;
    const response = await api.put(`/finance/settings/bank-accounts/${id}`, {
      ...rest,
      ...(name !== undefined && { accountName: name }),
      ...(branch !== undefined && { branchName: branch }),
    });
    return response.data;
  },

  deleteBankAccount: async (id: string) => {
    const response = await api.delete(`/finance/settings/bank-accounts/${id}`);
    return response.data;
  },

  // Payment Methods
  // Payment Methods — stored inside finance settings; API field is isEnabled
  getPaymentMethods: async () => {
    const response = await api.get('/finance/settings');
    const methods = (response.data?.data?.paymentMethods || []) as Array<Record<string, unknown>>;
    return { ...response.data, data: methods.map((m) => ({ ...m, enabled: !!m.isEnabled })) };
  },

  updatePaymentMethod: async (method: string, enabled: boolean) => {
    const response = await api.put(`/finance/settings/payment-methods/${method}`, {
      isEnabled: enabled,
    });
    return response.data;
  },

  // Application Fee Settings
  updateApplicationFeeSettings: async (data: {
    isEnabled?: boolean;
    amount?: number;
    feeType?: 'fixed' | 'variable';
    variableAmounts?: Array<{ classId?: string; className?: string; amount: number }>;
    isRefundable?: boolean;
    refundPercentage?: number;
    paymentModes?: string[];
    adjustInFee?: boolean;
    adjustmentComponent?: string;
  }) => {
    const response = await api.put('/finance/settings/application-fee', data);
    return response.data;
  },

  // Wallet Sequence Settings
  updateWalletSequenceSettings: async (data: {
    isEnabled?: boolean;
    deductionOrder?: Array<{ categoryCode: string; priority: number }>;
    autoDeductOnPayment?: boolean;
    minBalanceRequired?: number;
    maxDeductionPercentage?: number;
  }) => {
    const response = await api.put('/finance/settings/wallet-sequence', data);
    return response.data;
  },

  // Finance Reports
  getSiblingDues: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/finance/reports/sibling-dues', {
      params: { ...params, academicBatchId: params?.academicBatchId ?? (await currentBatchId()) },
    });
    return response.data;
  },

  getInstallmentWiseDues: async (params?: {
    academicBatchId?: string;
    classId?: string;
    installmentNumber?: number;
  }) => {
    const response = await api.get('/finance/reports/installment-wise', {
      params: { ...params, academicBatchId: params?.academicBatchId ?? (await currentBatchId()) },
    });
    return response.data;
  },

  getDaySheet: async (date: string) => {
    const response = await api.get('/finance/reports/day-sheet', { params: { date } });
    return response.data;
  },

  getStudentStatement: async (studentId: string, params?: { academicBatchId?: string }) => {
    const response = await api.get(`/finance/reports/student-statement/${studentId}`, { params });
    return response.data;
  },

  getClassWiseConcessionReport: async (params?: { academicBatchId?: string; classId?: string }) => {
    const response = await api.get('/finance/reports/concession/class-wise', { params });
    return response.data;
  },

  getStudentWiseConcessionReport: async (params?: {
    academicBatchId?: string;
    classId?: string;
    search?: string;
  }) => {
    const response = await api.get('/finance/reports/concession/student-wise', { params });
    return response.data;
  },

  // Total Paid and Due Report
  getTotalPaidAndDueReport: async (params: {
    academicBatchId: string;
    fromDate?: string;
    toDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) => {
    const response = await api.get('/finance/reports/total-paid-due', { params });
    return response.data;
  },

  // Fee Structures
  getFeeStructures: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    academicBatchId?: string;
  }) => {
    const response = await api.get('/finance/structures', { params });
    return response.data;
  },

  getFeeStructure: async (id: string) => {
    const response = await api.get(`/finance/structures/${id}`);
    return response.data;
  },

  getFeeStructuresForSection: async (sectionId: string, classId: string) => {
    const response = await api.get(`/finance/structures/for-section/${sectionId}`, {
      params: { classId },
    });
    return response.data;
  },

  createFeeStructure: async (data: {
    name: string;
    code: string;
    /** Optional. Legacy. New grade-scoped structures don't need a batch. */
    academicBatchId?: string;
    /** Set when cloning a skeleton into an assignment. */
    parentStructureId?: string | null;
    applicableTo?: {
      classIds?: string[];
      sectionIds?: string[];
      gradeCodes?: string[];
      streams?: string[];
      categories?: string[];
      admissionCategories?: string[];
    };
    components: Array<{
      name: string;
      code: string;
      amount: number;
      type: 'mandatory' | 'optional' | 'service-based';
      frequency?: 'yearly' | 'term-wise' | 'monthly';
      taxable?: boolean;
      taxRate?: number;
      refundable?: boolean;
    }>;
    installments?: Array<{
      name: string;
      dueDate: string;
      components: Array<{ componentCode: string; amount: number }>;
    }>;
    fineRules?: {
      type: 'fixed' | 'percentage' | 'daily';
      amount: number;
      gracePeriodDays: number;
      maxFine?: number;
    };
    concessionRules?: {
      requireApproval: boolean;
      maxPercentage: number;
      allowedTypes: string[];
    };
  }) => {
    const response = await api.post('/finance/structures', data);
    return response.data;
  },

  updateFeeStructure: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/finance/structures/${id}`, data);
    return response.data;
  },

  deleteFeeStructure: async (id: string, options?: { force?: boolean }) => {
    const response = await api.delete(`/finance/structures/${id}`, {
      params: options?.force ? { force: true } : undefined,
    });
    return response.data;
  },

  cloneFeeStructure: async (id: string, newName: string, newCode: string) => {
    const response = await api.post(`/finance/structures/${id}/clone`, {
      name: newName,
      code: newCode,
    });
    return response.data;
  },

  getFeeStructureStats: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/finance/structures/stats', { params });
    return response.data;
  },

  // Transactions
  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    paymentMode?: string;
    fromDate?: string;
    toDate?: string;
    classId?: string;
    sectionId?: string;
  }) => {
    const response = await api.get('/finance/transactions', { params });
    return response.data;
  },

  getTransaction: async (id: string) => {
    const response = await api.get(`/finance/transactions/${id}`);
    return response.data;
  },

  getReceipt: async (id: string): Promise<Blob> => {
    const response = await api.get(`/finance/transactions/${id}/receipt`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  createTransaction: async (data: {
    studentId: string;
    assignmentId: string;
    amount: number;
    paymentMode: 'cash' | 'card' | 'upi' | 'online' | 'cheque';
    referenceNumber?: string;
    remarks?: string;
  }) => {
    const response = await api.post('/finance/transactions', data);
    return response.data;
  },

  cancelTransaction: async (id: string, reason: string) => {
    const response = await api.post(`/finance/transactions/${id}/cancel`, { reason });
    return response.data;
  },

  refundTransaction: async (id: string, reason: string) => {
    const response = await api.post(`/finance/transactions/${id}/refund`, { reason });
    return response.data;
  },

  getTransactionStats: async (params?: { fromDate?: string; toDate?: string }) => {
    const response = await api.get('/finance/transactions/stats', { params });
    return response.data;
  },

  // Fee Counter
  searchStudentsForFeeCounter: async (params?: {
    search?: string;
    classId?: string;
    sectionId?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/finance/fee-counter/students', { params });
    return response.data;
  },

  getFeeCounterStats: async () => {
    const response = await api.get('/finance/fee-counter/stats');
    return response.data;
  },

  collectFee: async (data: {
    studentId: string;
    assignmentId: string;
    amount: number;
    paymentMode: 'cash' | 'card' | 'upi' | 'online' | 'cheque';
    referenceNumber?: string;
    remarks?: string;
    // Optional: list of fee components being collected (for receipt itemization
    // and for "collect transport fee only" use cases). When omitted the payment
    // is recorded against the assignment as a whole.
    components?: Array<{ componentCode: string; name: string; amount: number }>;
    installmentNumbers?: number[];
  }) => {
    const response = await api.post('/finance/fee-counter/collect', data);
    return response.data;
  },

  syncFeeAssignments: async (academicBatchId?: string) => {
    const response = await api.post('/finance/fee-counter/sync', { academicBatchId });
    return response.data;
  },

  getFeeStructureAssignmentCount: async (id: string) => {
    const response = await api.get(`/finance/structures/${id}/assignment-count`);
    return response.data;
  },

  // Dues
  getDues: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    classId?: string;
    status?: 'partial' | 'pending' | 'overdue';
  }) => {
    const response = await api.get('/finance/fee-counter/dues', { params });
    return response.data;
  },

  getDueStats: async () => {
    const response = await api.get('/finance/dues/stats');
    return response.data;
  },

  getClasswiseDues: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/finance/dues/classwise', { params });
    return response.data;
  },

  sendDueReminder: async (studentIds: string[], message?: string) => {
    const response = await api.post('/finance/dues/send-reminder', { studentIds, message });
    return response.data;
  },

  // Calculate Fines
  calculateFines: async () => {
    const response = await api.post('/finance/assignments/calculate-fines');
    return response.data;
  },

  // Wallets
  getWallets: async (params?: {
    page?: number;
    limit?: number;
    studentId?: string;
    hasBalance?: boolean;
  }) => {
    const response = await api.get('/finance/wallets', { params });
    return response.data;
  },

  getWallet: async (id: string) => {
    const response = await api.get(`/finance/wallets/${id}`);
    return response.data;
  },

  getWalletByStudent: async (studentId: string) => {
    const response = await api.get(`/finance/wallets/student/${studentId}`);
    return response.data;
  },

  getWalletStats: async () => {
    const response = await api.get('/finance/wallets/stats');
    return response.data;
  },

  createWallet: async (studentId: string) => {
    const response = await api.post('/finance/wallets', { studentId });
    return response.data;
  },

  getOrCreateWallet: async (studentId: string) => {
    const response = await api.post('/finance/wallets/get-or-create', { studentId });
    return response.data;
  },

  topUpWallet: async (
    walletId: string,
    data: {
      amount: number;
      paymentMode: string;
      paymentDetails?: Record<string, unknown>;
      description?: string;
    }
  ) => {
    const response = await api.post(`/finance/wallets/${walletId}/top-up`, data);
    return response.data;
  },

  debitWallet: async (
    walletId: string,
    data: {
      amount: number;
      category: string;
      referenceId?: string;
      referenceType?: string;
      description: string;
    }
  ) => {
    const response = await api.post(`/finance/wallets/${walletId}/debit`, data);
    return response.data;
  },

  getWalletTransactions: async (
    walletId: string,
    params?: {
      page?: number;
      limit?: number;
      type?: 'credit' | 'debit';
      category?: string;
      fromDate?: string;
      toDate?: string;
    }
  ) => {
    const response = await api.get(`/finance/wallets/${walletId}/transactions`, { params });
    return response.data;
  },

  toggleWalletStatus: async (walletId: string, isActive: boolean) => {
    const response = await api.patch(`/finance/wallets/${walletId}/status`, { isActive });
    return response.data;
  },

  // Online Payments (Razorpay)
  initiateOnlinePayment: async (data: {
    studentId: string;
    assignmentId: string;
    amount: number;
  }) => {
    const response = await api.post('/finance/transactions/online-payment/initiate', data);
    return response.data;
  },

  verifyOnlinePayment: async (data: { orderId: string; paymentId: string; signature: string }) => {
    const response = await api.post('/finance/transactions/online-payment/verify', data);
    return response.data;
  },

  // Approval Requests
  getApprovalRequests: async (params?: {
    page?: number;
    limit?: number;
    type?: 'cancellation' | 'refund';
    status?: 'pending' | 'approved' | 'rejected';
  }) => {
    const response = await api.get('/finance/approval-requests', { params });
    return response.data;
  },

  getApprovalRequest: async (id: string) => {
    const response = await api.get(`/finance/approval-requests/${id}`);
    return response.data;
  },

  getApprovalStats: async () => {
    const response = await api.get('/finance/approval-requests/stats');
    return response.data;
  },

  createApprovalRequest: async (data: {
    type: 'cancellation' | 'refund';
    transactionId: string;
    reason: string;
    refundAmount?: number;
  }) => {
    const response = await api.post('/finance/approval-requests', data);
    return response.data;
  },

  approveRequest: async (id: string, remarks?: string) => {
    const response = await api.post(`/finance/approval-requests/${id}/approve`, { remarks });
    return response.data;
  },

  rejectRequest: async (id: string, remarks: string) => {
    const response = await api.post(`/finance/approval-requests/${id}/reject`, { remarks });
    return response.data;
  },

  // Razorpay Route — per-branch linked-account onboarding for fee routing.
  // All endpoints are scoped to the active branch via the X-Branch-Id header
  // (set globally on the axios instance).
  getRazorpayRoute: async () => {
    const response = await api.get('/finance/settings/razorpay-route');
    return response.data;
  },

  onboardRazorpayRoute: async (data: {
    legal: {
      entityName: string;
      businessType:
        | 'individual'
        | 'partnership'
        | 'private_limited'
        | 'public_limited'
        | 'proprietorship'
        | 'trust'
        | 'ngo'
        | 'society'
        | 'educational_institutes';
      panNumber: string;
      gstNumber?: string;
    };
    contact: { email: string; phone: string };
    address: { line1: string; city: string; state: string; pincode: string; country?: 'IN' };
    bank: { accountNumber: string; ifsc: string; beneficiaryName: string };
  }) => {
    const response = await api.post('/finance/settings/razorpay-route/onboard', data);
    return response.data;
  },

  refreshRazorpayRoute: async () => {
    const response = await api.post('/finance/settings/razorpay-route/refresh');
    return response.data;
  },

  disconnectRazorpayRoute: async () => {
    const response = await api.delete('/finance/settings/razorpay-route');
    return response.data;
  },
};

// Health API
export const healthApi = {
  // Health Records
  getRecords: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    personType?: 'student' | 'staff';
    bloodGroup?: string;
    hasAlerts?: boolean;
  }) => {
    const response = await api.get('/health/records', { params });
    return response.data;
  },

  getRecord: async (id: string) => {
    const response = await api.get(`/health/records/${id}`);
    return response.data;
  },

  getRecordByPerson: async (personType: 'student' | 'staff', personId: string) => {
    const response = await api.get(`/health/records/person/${personType}/${personId}`);
    return response.data;
  },

  createRecord: async (data: {
    personType: 'student' | 'staff';
    personId: string;
    bloodGroup?: string;
    height?: number;
    weight?: number;
    allergies?: Array<{ allergen: string; severity: string; reaction?: string }>;
    medicalConditions?: Array<{ condition: string; diagnosedDate?: string; status: string }>;
    medications?: Array<{ name: string; dosage: string; frequency: string }>;
    emergencyContact?: { name: string; relationship: string; phone: string };
    insuranceInfo?: { provider?: string; policyNumber?: string; validUntil?: string };
  }) => {
    const response = await api.post('/health/records', data);
    return response.data;
  },

  updateRecord: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/health/records/${id}`, data);
    return response.data;
  },

  deleteRecord: async (id: string) => {
    const response = await api.delete(`/health/records/${id}`);
    return response.data;
  },

  syncRecord: async (personType: 'student' | 'staff', personId: string) => {
    const response = await api.post(`/health/records/sync/${personType}/${personId}`);
    return response.data;
  },

  getRecordStats: async () => {
    const response = await api.get('/health/records/stats');
    return response.data;
  },

  // Health Checkups
  getCheckups: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    personType?: 'student' | 'staff';
    personId?: string;
    healthRecordId?: string;
    campaignId?: string;
    checkupType?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/health/checkups', { params });
    return response.data;
  },

  getCheckup: async (id: string) => {
    const response = await api.get(`/health/checkups/${id}`);
    return response.data;
  },

  createCheckup: async (data: {
    personType: 'student' | 'staff';
    personId: string;
    healthRecordId: string;
    checkupType: 'routine' | 'annual' | 'sports' | 'pre-admission' | 'follow-up' | 'other';
    checkupDate: string;
    campaignId?: string;
    measurements?: {
      height?: number;
      weight?: number;
      bloodPressure?: { systolic: number; diastolic: number };
      pulse?: number;
      temperature?: number;
      spo2?: number;
    };
    examinations?: {
      vision?: { leftEye?: string; rightEye?: string; colorBlindness?: boolean; remarks?: string };
      hearing?: { leftEar?: string; rightEar?: string; remarks?: string };
      dental?: { cavities?: number; gumHealth?: string; remarks?: string };
      general?: { remarks?: string };
    };
  }) => {
    const response = await api.post('/health/checkups', data);
    return response.data;
  },

  updateCheckup: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/health/checkups/${id}`, data);
    return response.data;
  },

  completeCheckup: async (
    id: string,
    data: {
      measurements?: {
        height?: number;
        weight?: number;
        bmi?: number;
        bloodPressure?: { systolic: number; diastolic: number };
        pulse?: number;
        temperature?: number;
        spo2?: number;
      };
      examinations?: {
        vision?: {
          leftEye?: string;
          rightEye?: string;
          colorBlindness?: boolean;
          remarks?: string;
        };
        hearing?: { leftEar?: string; rightEar?: string; remarks?: string };
        dental?: { status?: string; remarks?: string };
        general?: { remarks?: string };
      };
      findings?: string;
      recommendations?: string;
      followUpRequired?: boolean;
      followUpDate?: string;
    }
  ) => {
    const response = await api.put(`/health/checkups/${id}/complete`, data);
    return response.data;
  },

  getCheckupStats: async () => {
    const response = await api.get('/health/checkups/stats');
    return response.data;
  },

  // Checkup Campaigns
  getCampaigns: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    personType?: 'student' | 'staff';
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/health/checkups/campaigns', { params });
    return response.data;
  },

  getCampaign: async (id: string) => {
    const response = await api.get(`/health/checkups/campaigns/${id}`);
    return response.data;
  },

  createCampaign: async (data: {
    name: string;
    description?: string;
    checkupType: string;
    targetGroup?: string;
    startDate: string;
    endDate: string;
    targetClasses?: string[];
    targetDepartments?: string[];
    examinations?: {
      includeVision?: boolean;
      includeHearing?: boolean;
      includeDental?: boolean;
      includeGeneral?: boolean;
    };
    notes?: string;
  }) => {
    const response = await api.post('/health/checkups/campaigns', data);
    return response.data;
  },

  updateCampaign: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/health/checkups/campaigns/${id}`, data);
    return response.data;
  },

  startCampaign: async (id: string) => {
    const response = await api.post(`/health/checkups/campaigns/${id}/start`);
    return response.data;
  },

  getCampaignCheckups: async (
    campaignId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
    }
  ) => {
    const response = await api.get('/health/checkups', {
      params: { ...params, campaignId },
    });
    return response.data;
  },

  // Vaccinations
  getVaccinations: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    personType?: 'student' | 'staff';
    personId?: string;
    healthRecordId?: string;
    vaccineName?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/health/vaccinations', { params });
    return response.data;
  },

  getVaccination: async (id: string) => {
    const response = await api.get(`/health/vaccinations/${id}`);
    return response.data;
  },

  createVaccination: async (data: {
    personType: 'student' | 'staff';
    personId: string;
    healthRecordId: string;
    vaccineName: string;
    doseNumber?: number;
    scheduledDate?: string;
    status?: 'scheduled' | 'completed' | 'missed' | 'overdue' | 'exempt';
  }) => {
    const response = await api.post('/health/vaccinations', data);
    return response.data;
  },

  updateVaccination: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/health/vaccinations/${id}`, data);
    return response.data;
  },

  administerVaccination: async (
    id: string,
    data: {
      administeredDate: string;
      administeredBy?: string;
      batchNumber?: string;
      manufacturer?: string;
      site?: string;
      notes?: string;
      nextDueDate?: string;
    }
  ) => {
    const response = await api.put(`/health/vaccinations/${id}/administer`, data);
    return response.data;
  },

  deleteVaccination: async (id: string) => {
    const response = await api.delete(`/health/vaccinations/${id}`);
    return response.data;
  },

  getDueVaccinations: async (daysAhead?: number) => {
    const response = await api.get('/health/vaccinations/due', { params: { daysAhead } });
    return response.data;
  },

  getVaccinationStats: async () => {
    const response = await api.get('/health/vaccinations/stats');
    return response.data;
  },

  markOverdueVaccinations: async () => {
    const response = await api.post('/health/vaccinations/mark-overdue');
    return response.data;
  },

  // Medical Visits
  getVisits: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    personType?: 'student' | 'staff';
    personId?: string;
    healthRecordId?: string;
    visitType?: string;
    status?: string;
    outcome?: string;
    isIncident?: boolean;
    fromDate?: string;
    toDate?: string;
    today?: boolean;
  }) => {
    const response = await api.get('/health/visits', { params });
    return response.data;
  },

  getVisit: async (id: string) => {
    const response = await api.get(`/health/visits/${id}`);
    return response.data;
  },

  createVisit: async (data: {
    personType: 'student' | 'staff';
    personId: string;
    healthRecordId: string;
    visitType: 'routine' | 'illness' | 'injury' | 'emergency' | 'follow-up' | 'other';
    chiefComplaint: string;
    symptoms?: string[];
    vitals?: {
      temperature?: number;
      bloodPressure?: { systolic: number; diastolic: number };
      pulse?: number;
      spo2?: number;
    };
    isIncident?: boolean;
    incidentDetails?: {
      location?: string;
      description?: string;
      witnesses?: string[];
    };
  }) => {
    const response = await api.post('/health/visits', data);
    return response.data;
  },

  updateVisit: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/health/visits/${id}`, data);
    return response.data;
  },

  closeVisit: async (
    id: string,
    data: {
      diagnosis?: string;
      treatment?: string;
      medicationsGiven?: Array<{ name: string; dosage: string; quantity?: number }>;
      outcome:
        | 'returned_to_class'
        | 'sent_home'
        | 'referred'
        | 'hospitalized'
        | 'under_observation';
      followUpRequired?: boolean;
      followUpDate?: string;
      parentNotified?: boolean;
      notes?: string;
    }
  ) => {
    const response = await api.put(`/health/visits/${id}/close`, data);
    return response.data;
  },

  getTodayVisits: async () => {
    const response = await api.get('/health/visits/today');
    return response.data;
  },

  getVisitStats: async () => {
    const response = await api.get('/health/visits/stats');
    return response.data;
  },

  notifyParent: async (visitId: string) => {
    const response = await api.post(`/health/visits/${visitId}/notify-parent`);
    return response.data;
  },

  // Health Reports
  getDashboard: async () => {
    const response = await api.get('/health/reports/dashboard');
    return response.data;
  },

  getGrowthChart: async (personId: string) => {
    const response = await api.get(`/health/reports/growth/${personId}`);
    return response.data;
  },

  getHealthSummary: async (personId: string) => {
    const response = await api.get(`/health/reports/summary/${personId}`);
    return response.data;
  },

  exportHealthCard: async (personId: string) => {
    const response = await api.get(`/health/reports/health-card/${personId}`);
    return response.data;
  },

  getComplianceReport: async () => {
    const response = await api.get('/health/reports/compliance');
    return response.data;
  },

  // Health Settings
  getSettings: async () => {
    const response = await api.get('/health/settings');
    return response.data;
  },

  updateSettings: async (data: {
    enableHealthModule?: boolean;
    enableStudentHealth?: boolean;
    enableStaffHealth?: boolean;
    infirmary?: {
      enabled?: boolean;
      name?: string;
      location?: string;
      operatingHours?: { start: string; end: string };
      contactNumber?: string;
      emergencyNumber?: string;
    };
    checkups?: {
      enableAnnualCheckups?: boolean;
      defaultCheckupMonth?: number;
      reminderDaysBefore?: number;
      includeVisionByDefault?: boolean;
      includeHearingByDefault?: boolean;
      includeDentalByDefault?: boolean;
      includeGrowthByDefault?: boolean;
    };
    vaccinations?: {
      enableVaccinationTracking?: boolean;
      sendReminders?: boolean;
      reminderDaysBefore?: number;
      requiredVaccines?: string[];
    };
    alerts?: {
      enableHealthAlerts?: boolean;
      alertOverdueVaccinations?: boolean;
      alertOverdueCheckups?: boolean;
      alertMedicationReminders?: boolean;
    };
    privacy?: {
      restrictHealthDataAccess?: boolean;
      allowedRoles?: string[];
      requireConsentForDataSharing?: boolean;
    };
    emergencyProtocol?: {
      steps?: string[];
      emergencyContacts?: Array<{ name: string; role: string; phone: string }>;
      nearestHospital?: { name: string; address: string; phone: string; distance?: string };
    };
  }) => {
    const response = await api.put('/health/settings', data);
    return response.data;
  },
};

// Upload API
export const uploadApi = {
  uploadImage: async (
    entityType: 'students' | 'staff' | 'admissions' | 'organization',
    entityId: string,
    file: File,
    category?: 'photo' | 'document' | 'certificate' | 'id-proof' | 'signature',
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);

    const params = category ? `?category=${category}` : '';
    const response = await api.post(`/upload/image/${entityType}/${entityId}${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  },

  uploadDocument: async (
    entityType: 'students' | 'staff' | 'admissions' | 'organization',
    entityId: string,
    file: File,
    category?: 'photo' | 'document' | 'certificate' | 'id-proof' | 'signature',
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);

    const params = category ? `?category=${category}` : '';
    const response = await api.post(
      `/upload/document/${entityType}/${entityId}${params}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );
    return response.data;
  },

  getPresignedUrl: async (data: {
    filename: string;
    mimeType: string;
    size: number;
    entityType: 'students' | 'staff' | 'admissions' | 'organization' | 'lessons' | 'courses';
    entityId: string;
    category: 'photo' | 'document' | 'certificate' | 'id-proof' | 'signature' | 'video';
  }) => {
    const response = await api.post('/upload/presigned-url', data);
    return response.data;
  },

  confirmUpload: async (data: {
    key: string;
    originalName: string;
    mimeType: string;
    size: number;
  }) => {
    const response = await api.post('/upload/confirm', data);
    return response.data;
  },

  /**
   * Upload a video file directly to S3 via a presigned PUT URL. Bypasses
   * the API server entirely so 500MB videos don't tie up Express workers.
   *
   *  1. POST /upload/presigned-url to get { uploadUrl, key }
   *  2. PUT the file directly to S3 (uses XHR for upload progress events)
   *  3. POST /upload/confirm so the upload is recorded in the uploads collection
   */
  uploadVideo: async (
    entityType: 'lessons' | 'courses',
    entityId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ key: string; sizeBytes: number; mimeType: string }> => {
    // Step 1: get presigned URL from API
    const presigned = await api.post('/upload/presigned-url', {
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      entityType,
      entityId,
      category: 'video',
    });

    const { uploadUrl, key } = presigned.data?.data || presigned.data;
    if (!uploadUrl || !key) {
      throw new Error('Failed to get presigned upload URL');
    }

    // Step 2: PUT the file directly to S3 with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during video upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));
      xhr.send(file);
    });

    // Step 3: confirm so the uploads collection records the file
    await api.post('/upload/confirm', {
      key,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    });

    return { key, sizeBytes: file.size, mimeType: file.type };
  },

  getSignedDownloadUrl: async (key: string) => {
    const response = await api.get(`/upload/${encodeURIComponent(key)}/signed-url`);
    return response.data;
  },

  deleteFile: async (key: string) => {
    const response = await api.delete(`/upload/${encodeURIComponent(key)}`);
    return response.data;
  },

  getUploadsByEntity: async (
    entityType: 'students' | 'staff' | 'admissions' | 'organization',
    entityId: string
  ) => {
    const response = await api.get(`/upload/entity/${entityType}/${entityId}`);
    return response.data;
  },
};

// Communications API
export const communicationsApi = {
  // Settings
  getSettings: async () => {
    const response = await api.get('/communications/settings');
    return response.data;
  },

  updateSettings: async (data: {
    smsSettings?: {
      provider?: 'msg91' | 'twilio' | 'gupshup' | 'custom' | 'none';
      apiKey?: string;
      senderId?: string;
      dltEntityId?: string;
      isEnabled?: boolean;
      testMode?: boolean;
      maxSmsPerDay?: number;
      defaultCountryCode?: string;
    };
    emailSettings?: {
      provider?: 'sendgrid' | 'ses' | 'smtp' | 'none';
      fromEmail?: string;
      fromName?: string;
      replyTo?: string;
      isEnabled?: boolean;
      apiKey?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpUsername?: string;
      smtpPassword?: string;
    };
    whatsappSettings?: {
      provider?: 'twilio' | 'meta' | 'gupshup' | 'none';
      phoneNumber?: string;
      isEnabled?: boolean;
    };
    announcementSettings?: {
      requireApproval?: boolean;
      defaultExpiryDays?: number;
      maxAttachmentSize?: number;
      allowedFileTypes?: string[];
      autoArchiveAfterDays?: number;
    };
    notificationDefaults?: {
      channels?: ('sms' | 'email' | 'push' | 'whatsapp')[];
      feeReminders?: boolean;
      attendanceAlerts?: boolean;
      announcementNotifications?: boolean;
      eventReminders?: boolean;
    };
  }) => {
    const response = await api.put('/communications/settings', data);
    return response.data;
  },

  // Event Types
  addEventType: async (data: {
    code: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
    requiresApproval: boolean;
    defaultDuration: number;
    isActive: boolean;
  }) => {
    const response = await api.post('/communications/settings/event-types', data);
    return response.data;
  },

  updateEventType: async (code: string, data: Record<string, unknown>) => {
    const response = await api.put(`/communications/settings/event-types/${code}`, data);
    return response.data;
  },

  deleteEventType: async (code: string) => {
    const response = await api.delete(`/communications/settings/event-types/${code}`);
    return response.data;
  },

  // SMS Templates
  addSMSTemplate: async (data: {
    code: string;
    name: string;
    content: string;
    category: 'fee' | 'attendance' | 'announcement' | 'admission' | 'hr' | 'general';
    variables: string[];
    dltTemplateId?: string;
    isActive: boolean;
  }) => {
    const response = await api.post('/communications/settings/sms-templates', data);
    return response.data;
  },

  updateSMSTemplate: async (code: string, data: Record<string, unknown>) => {
    const response = await api.put(`/communications/settings/sms-templates/${code}`, data);
    return response.data;
  },

  deleteSMSTemplate: async (code: string) => {
    const response = await api.delete(`/communications/settings/sms-templates/${code}`);
    return response.data;
  },

  // Email Templates
  addEmailTemplate: async (data: {
    code: string;
    name: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    category: 'fee' | 'attendance' | 'announcement' | 'admission' | 'hr' | 'general' | 'auth';
    variables: string[];
    isActive: boolean;
  }) => {
    const response = await api.post('/communications/settings/email-templates', data);
    return response.data;
  },

  updateEmailTemplate: async (code: string, data: Record<string, unknown>) => {
    const response = await api.put(`/communications/settings/email-templates/${code}`, data);
    return response.data;
  },

  deleteEmailTemplate: async (code: string) => {
    const response = await api.delete(`/communications/settings/email-templates/${code}`);
    return response.data;
  },

  // SMS
  sendSMS: async (data: {
    recipients: string[];
    message: string;
    templateCode?: string;
    variables?: Record<string, string>;
  }) => {
    const response = await api.post('/communications/sms/send', data);
    return response.data;
  },

  getSMSLogs: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get('/communications/sms/logs', { params });
    return response.data;
  },

  getSMSStats: async () => {
    const response = await api.get('/communications/sms/stats');
    return response.data;
  },

  getSMSTemplates: async () => {
    const response = await api.get('/communications/sms/templates');
    return response.data;
  },

  getSMSBalance: async () => {
    const response = await api.get('/communications/sms/balance');
    return response.data;
  },

  // Announcements
  getAnnouncements: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await api.get('/communications/announcements', { params });
    return response.data;
  },

  createAnnouncement: async (data: {
    title: string;
    content: string;
    type: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    targetAudience: {
      type: 'all' | 'students' | 'staff' | 'parents' | 'custom';
      classIds?: string[];
      sectionIds?: string[];
      departmentIds?: string[];
    };
    publishAt?: string;
    expiresAt?: string;
  }) => {
    const response = await api.post('/communications/announcements', data);
    return response.data;
  },

  getAnnouncementById: async (id: string) => {
    const response = await api.get(`/communications/announcements/${id}`);
    return response.data;
  },

  updateAnnouncement: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/communications/announcements/${id}`, data);
    return response.data;
  },

  deleteAnnouncement: async (id: string) => {
    const response = await api.delete(`/communications/announcements/${id}`);
    return response.data;
  },

  publishAnnouncement: async (id: string) => {
    const response = await api.put(`/communications/announcements/${id}/publish`);
    return response.data;
  },

  archiveAnnouncement: async (id: string) => {
    const response = await api.put(`/communications/announcements/${id}/archive`);
    return response.data;
  },

  // Events
  getEvents: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get('/communications/events', { params });
    return response.data;
  },

  getUpcomingEvents: async () => {
    const response = await api.get('/communications/events/upcoming');
    return response.data;
  },

  getCalendarEvents: async (params: { month: number; year: number }) => {
    const response = await api.get('/communications/events/calendar', { params });
    return response.data;
  },

  createEvent: async (data: {
    title: string;
    description?: string;
    type: string;
    startDate: string;
    endDate: string;
    isAllDay?: boolean;
    location?: string;
    targetAudience?: {
      type: 'all' | 'students' | 'staff' | 'custom';
      classIds?: string[];
      departmentIds?: string[];
    };
  }) => {
    const response = await api.post('/communications/events', data);
    return response.data;
  },

  getEventById: async (id: string) => {
    const response = await api.get(`/communications/events/${id}`);
    return response.data;
  },

  updateEvent: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/communications/events/${id}`, data);
    return response.data;
  },

  deleteEvent: async (id: string) => {
    const response = await api.delete(`/communications/events/${id}`);
    return response.data;
  },

  cancelEvent: async (id: string) => {
    const response = await api.put(`/communications/events/${id}/cancel`);
    return response.data;
  },

  // Reports
  getLoginReport: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get('/communications/reports/login', { params });
    return response.data;
  },

  getNeverLoggedReport: async () => {
    const response = await api.get('/communications/reports/never-logged');
    return response.data;
  },

  getNotificationReport: async (params?: { startDate?: string; endDate?: string }) => {
    const response = await api.get('/communications/reports/notifications', { params });
    return response.data;
  },
};

// Certificates API
export const certificatesApi = {
  // Certificate Types
  getTypes: async (category?: 'student' | 'staff') => {
    const response = await api.get('/certificates/types', {
      params: category ? { category } : undefined,
    });
    return response.data;
  },

  getType: async (id: string) => {
    const response = await api.get(`/certificates/types/${id}`);
    return response.data;
  },

  createType: async (data: {
    name: string;
    code: string;
    category: 'student' | 'staff';
    template: string;
    fields?: Array<{
      name: string;
      label: string;
      type: 'text' | 'date' | 'number' | 'select';
      required: boolean;
      options?: string[];
    }>;
    requiresApproval?: boolean;
    approvalLevels?: number;
    sequencePrefix: string;
  }) => {
    const response = await api.post('/certificates/types', data);
    return response.data;
  },

  updateType: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/certificates/types/${id}`, data);
    return response.data;
  },

  // Certificate Requests
  getRequests: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    requestorType?: string;
  }) => {
    const response = await api.get('/certificates/requests', { params });
    return response.data;
  },

  getRequest: async (id: string) => {
    const response = await api.get(`/certificates/requests/${id}`);
    return response.data;
  },

  createRequest: async (data: {
    certificateTypeId: string;
    requestorId: string;
    requestorType: 'student' | 'staff';
    purpose?: string;
    fieldValues?: Record<string, unknown>;
  }) => {
    const response = await api.post('/certificates/requests', data);
    return response.data;
  },

  approveRequest: async (id: string, remarks?: string) => {
    const response = await api.put(`/certificates/requests/${id}/approve`, { remarks });
    return response.data;
  },

  rejectRequest: async (id: string, reason: string) => {
    const response = await api.put(`/certificates/requests/${id}/reject`, { reason });
    return response.data;
  },

  issueRequest: async (id: string) => {
    const response = await api.put(`/certificates/requests/${id}/issue`);
    return response.data;
  },

  // ID Card Templates
  getIdCardTemplates: async (category?: 'student' | 'staff') => {
    const response = await api.get('/certificates/id-cards/templates', {
      params: category ? { category } : undefined,
    });
    return response.data;
  },

  createIdCardTemplate: async (data: {
    name: string;
    category: 'student' | 'staff';
    frontTemplate: string;
    backTemplate?: string;
    dimensions: { width: number; height: number; unit: 'mm' | 'cm' | 'in' };
  }) => {
    const response = await api.post('/certificates/id-cards/templates', data);
    return response.data;
  },

  generateIdCard: async (data: {
    templateId: string;
    entityId: string;
    entityType: 'student' | 'staff';
  }) => {
    const response = await api.post('/certificates/id-cards/generate', data);
    return response.data;
  },

  bulkGenerateIdCards: async (data: {
    templateId: string;
    category: 'student' | 'staff';
    classId?: string;
    sectionId?: string;
    departmentId?: string;
    ids?: string[];
  }) => {
    const response = await api.post('/certificates/id-cards/bulk-generate', data);
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/certificates/settings');
    return response.data;
  },

  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/certificates/settings', data);
    return response.data;
  },

  // Stats & Reports
  getStats: async () => {
    const response = await api.get('/certificates/stats');
    return response.data;
  },

  getReport: async (params?: {
    fromDate?: string;
    toDate?: string;
    category?: string;
    typeId?: string;
    status?: string;
  }) => {
    const response = await api.get('/certificates/reports', { params });
    return response.data;
  },
};

// Teaching API
export const teachingApi = {
  // My Classes
  getMyClasses: async (staffId?: string) => {
    // Suppress global 403 toast — admins without a teacher record may legitimately
    // get 403 from this endpoint; pages render an empty state instead.
    const response = await api.get('/teaching/my-classes', {
      params: staffId ? { staffId } : {},
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },
  getSectionStudents: async (
    sectionId: string,
    params?: { search?: string; page?: number; limit?: number; subjectId?: string }
  ) => {
    const response = await api.get(`/teaching/my-classes/${sectionId}/students`, { params });
    return response.data;
  },
  getSectionLessonPlans: async (sectionId: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get(`/teaching/my-classes/${sectionId}/lesson-plans`, { params });
    return response.data;
  },

  // Timetable Slots
  getSlots: async (classId?: string) => {
    const response = await api.get('/teaching/timetable/slots', {
      params: classId ? { classId } : {},
    });
    return response.data;
  },
  createSlot: async (data: {
    classId: string;
    sectionId?: string;
    name: string;
    startTime: string;
    endTime: string;
    order: number;
    type: string;
  }) => {
    const response = await api.post('/teaching/timetable/slots', data);
    return response.data;
  },
  copySlots: async (sourceClassId: string, targetClassId: string) => {
    const response = await api.post('/teaching/timetable/slots/copy', {
      sourceClassId,
      targetClassId,
    });
    return response.data;
  },
  updateSlot: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/teaching/timetable/slots/${id}`, data);
    return response.data;
  },
  deleteSlot: async (id: string) => {
    const response = await api.delete(`/teaching/timetable/slots/${id}`);
    return response.data;
  },

  // Timetable Entries
  getSectionTimetable: async (sectionId: string) => {
    const response = await api.get(`/teaching/timetable/section/${sectionId}`);
    return response.data;
  },
  getMyTimetable: async (staffId?: string) => {
    const response = await api.get('/teaching/timetable/my', {
      params: staffId ? { staffId } : {},
    });
    return response.data;
  },
  createEntry: async (data: {
    sectionId: string;
    slotId: string;
    dayOfWeek: number;
    subjects: Array<{
      subjectId: string;
      teacherId: string;
      /** Lab slot for a subset of the section (id from Section.batches). */
      batchId?: string;
      roomNumber?: string;
      notes?: string;
      isMandatory: boolean;
      studentIds?: string[];
      linkedSectionIds?: string[];
    }>;
  }) => {
    const response = await api.post('/teaching/timetable/entries', data);
    return response.data;
  },
  updateGroup: async (
    groupId: string,
    data: {
      subjects: Array<{
        entryId?: string;
        subjectId: string;
        teacherId: string;
        /** Lab slot for a subset of the section (id from Section.batches). */
        batchId?: string;
        roomNumber?: string;
        notes?: string;
        isMandatory: boolean;
        studentIds?: string[];
        linkedSectionIds?: string[];
      }>;
    }
  ) => {
    const response = await api.put(`/teaching/timetable/entries/group/${groupId}`, data);
    return response.data;
  },
  deleteGroup: async (groupId: string) => {
    const response = await api.delete(`/teaching/timetable/entries/group/${groupId}`);
    return response.data;
  },
  /** Empty one section's week; its periods & timings stay. */
  clearSectionTimetable: async (sectionId: string) => {
    const response = await api.delete(`/teaching/timetable/section/${sectionId}`);
    return response.data as { data: { deleted: number } };
  },
  /** Teachers already teaching at this period's time, and where. */
  getBusyTeachers: async (slotId: string, dayOfWeek: number, excludeGroupId?: string) => {
    const response = await api.get('/teaching/timetable/busy', {
      params: { slotId, dayOfWeek, ...(excludeGroupId && { excludeGroupId }) },
    });
    return response.data as {
      data: Array<{ teacherId: string; subjectId: string; where: string }>;
    };
  },
  bulkCreateEntries: async (data: {
    entries: Array<{
      sectionId: string;
      subjectId: string;
      teacherId: string;
      slotId: string;
      dayOfWeek: number;
    }>;
  }) => {
    const response = await api.post('/teaching/timetable/entries/bulk', data);
    return response.data;
  },
  updateEntry: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/teaching/timetable/entries/${id}`, data);
    return response.data;
  },
  deleteEntry: async (id: string) => {
    const response = await api.delete(`/teaching/timetable/entries/${id}`);
    return response.data;
  },

  // Lesson Plans
  getLessonPlans: async (params?: {
    page?: number;
    limit?: number;
    sectionId?: string;
    subjectId?: string;
    status?: string;
    teachingStatus?: string;
    fromDate?: string;
    toDate?: string;
    staffId?: string;
  }) => {
    const response = await api.get('/teaching/lesson-plans', { params });
    return response.data;
  },
  getLessonPlan: async (id: string) => {
    const response = await api.get(`/teaching/lesson-plans/${id}`);
    return response.data;
  },
  createLessonPlan: async (data: Record<string, unknown>) => {
    const response = await api.post('/teaching/lesson-plans', data);
    return response.data;
  },
  updateLessonPlan: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/teaching/lesson-plans/${id}`, data);
    return response.data;
  },
  deleteLessonPlan: async (id: string) => {
    const response = await api.delete(`/teaching/lesson-plans/${id}`);
    return response.data;
  },
  updateLessonPlanTeachingStatus: async (
    id: string,
    data: { teachingStatus: string; linkedAssignmentId?: string }
  ) => {
    const response = await api.put(`/teaching/lesson-plans/${id}/teaching-status`, data);
    return response.data;
  },

  // Assignments
  getAssignments: async (params?: {
    page?: number;
    limit?: number;
    sectionId?: string;
    subjectId?: string;
    status?: string;
  }) => {
    const response = await api.get('/teaching/assignments', { params });
    return response.data;
  },
  getAssignment: async (id: string) => {
    const response = await api.get(`/teaching/assignments/${id}`);
    return response.data;
  },
  createAssignment: async (data: Record<string, unknown>) => {
    const response = await api.post('/teaching/assignments', data);
    return response.data;
  },
  updateAssignment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/teaching/assignments/${id}`, data);
    return response.data;
  },
  deleteAssignment: async (id: string) => {
    const response = await api.delete(`/teaching/assignments/${id}`);
    return response.data;
  },
  publishAssignment: async (id: string) => {
    const response = await api.put(`/teaching/assignments/${id}/publish`);
    return response.data;
  },
  startGrading: async (id: string) => {
    const response = await api.put(`/teaching/assignments/${id}/start-grading`);
    return response.data;
  },
  completeAssignment: async (id: string) => {
    const response = await api.put(`/teaching/assignments/${id}/complete`);
    return response.data;
  },
  submitAssignment: async (
    id: string,
    data: { answers: Array<{ questionId: string; answer: string }>; studentId?: string }
  ) => {
    const response = await api.post(`/teaching/assignments/${id}/submit`, data);
    return response.data;
  },
  getAssignmentSubmissions: async (id: string) => {
    const response = await api.get(`/teaching/assignments/${id}/submissions`);
    return response.data;
  },
  reviewAssignmentSubmission: async (
    assignmentId: string,
    submissionId: string,
    data: { questionResults: { questionId: string; isCorrect: boolean }[] }
  ) => {
    const response = await api.put(
      `/teaching/assignments/${assignmentId}/submissions/${submissionId}/review`,
      data
    );
    return response.data;
  },
  reviewQuestionnaireSubmission: async (
    questionnaireId: string,
    submissionId: string,
    data: { questionResults: { questionId: string; isCorrect: boolean }[] }
  ) => {
    const response = await api.put(
      `/teaching/questionnaires/${questionnaireId}/submissions/${submissionId}/review`,
      data
    );
    return response.data;
  },

  getMyAssignmentSubmission: async (assignmentId: string) => {
    const response = await api.get(`/teaching/assignments/${assignmentId}/my-submission`);
    return response.data;
  },
  getMyQuestionnaireSubmission: async (questionnaireId: string) => {
    const response = await api.get(`/teaching/questionnaires/${questionnaireId}/my-submission`);
    return response.data;
  },

  // Grades
  getAssignmentGrades: async (assignmentId: string) => {
    const response = await api.get(`/teaching/grades/assignment/${assignmentId}`);
    return response.data;
  },
  getStudentGrades: async (studentId: string) => {
    const response = await api.get(`/teaching/grades/student/${studentId}`);
    return response.data;
  },
  getSectionReport: async (sectionId: string) => {
    const response = await api.get('/teaching/grades/section-report', { params: { sectionId } });
    return response.data;
  },
  getSectionStudentGrades: async (sectionId: string) => {
    const response = await api.get('/teaching/grades/section-students', {
      params: { sectionId },
    });
    return response.data;
  },
  gradeStudent: async (data: {
    assignmentId: string;
    studentId: string;
    marksObtained: number;
    remarks?: string;
  }) => {
    const response = await api.post('/teaching/grades', data);
    return response.data;
  },
  bulkGrade: async (data: {
    assignmentId: string;
    grades: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
  }) => {
    const response = await api.post('/teaching/grades/bulk', data);
    return response.data;
  },

  // Questionnaires
  getQuestionnaires: async (params?: {
    page?: number;
    limit?: number;
    sectionId?: string;
    subjectId?: string;
    status?: string;
    search?: string;
  }) => {
    const response = await api.get('/teaching/questionnaires', { params });
    return response.data;
  },
  createQuestionnaire: async (data: Record<string, unknown>) => {
    const response = await api.post('/teaching/questionnaires', data);
    return response.data;
  },
  getQuestionnaireByLesson: async (lessonPlanId: string) => {
    const response = await api.get(`/teaching/questionnaires/lesson/${lessonPlanId}`);
    return response.data;
  },
  getQuestionnaire: async (id: string) => {
    const response = await api.get(`/teaching/questionnaires/${id}`);
    return response.data;
  },
  updateQuestionnaire: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/teaching/questionnaires/${id}`, data);
    return response.data;
  },
  publishQuestionnaire: async (id: string) => {
    const response = await api.post(`/teaching/questionnaires/${id}/publish`);
    return response.data;
  },
  submitQuestionnaire: async (
    id: string,
    data: { answers: Array<{ questionId: string; answer: string }>; studentId?: string }
  ) => {
    const response = await api.post(`/teaching/questionnaires/${id}/submit`, data);
    return response.data;
  },
  getQuestionnaireSubmissions: async (id: string) => {
    const response = await api.get(`/teaching/questionnaires/${id}/submissions`);
    return response.data;
  },
  deleteQuestionnaire: async (id: string) => {
    const response = await api.delete(`/teaching/questionnaires/${id}`);
    return response.data;
  },
};

// Career Connect API
export const careerConnectApi = {
  // Companies
  getCompanies: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/companies', { params });
    return response.data;
  },
  getCompany: async (id: string) => {
    const response = await api.get(`/career-connect/companies/${id}`);
    return response.data;
  },
  createCompany: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/companies', data);
    return response.data;
  },
  updateCompany: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/companies/${id}`, data);
    return response.data;
  },
  deleteCompany: async (id: string) => {
    const response = await api.delete(`/career-connect/companies/${id}`);
    return response.data;
  },
  updateCompanyStatus: async (id: string, status: string) => {
    const response = await api.put(`/career-connect/companies/${id}/status`, { status });
    return response.data;
  },
  addCompanyContact: async (id: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/companies/${id}/contacts`, data);
    return response.data;
  },
  updateCompanyContact: async (id: string, contactId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/companies/${id}/contacts/${contactId}`, data);
    return response.data;
  },
  removeCompanyContact: async (id: string, contactId: string) => {
    const response = await api.delete(`/career-connect/companies/${id}/contacts/${contactId}`);
    return response.data;
  },
  addCompanyVisit: async (id: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/companies/${id}/visits`, data);
    return response.data;
  },
  getCompanyVisits: async (id: string) => {
    const response = await api.get(`/career-connect/companies/${id}/visits`);
    return response.data;
  },

  // Placement Drives
  getDrives: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/drives', { params });
    return response.data;
  },
  getDrive: async (id: string) => {
    const response = await api.get(`/career-connect/drives/${id}`);
    return response.data;
  },
  createDrive: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/drives', data);
    return response.data;
  },
  updateDrive: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/drives/${id}`, data);
    return response.data;
  },
  deleteDrive: async (id: string) => {
    const response = await api.delete(`/career-connect/drives/${id}`);
    return response.data;
  },
  updateDriveStatus: async (id: string, status: string) => {
    const response = await api.put(`/career-connect/drives/${id}/status`, { status });
    return response.data;
  },
  addDriveRound: async (driveId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/drives/${driveId}/rounds`, data);
    return response.data;
  },
  updateDriveRound: async (driveId: string, roundId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/drives/${driveId}/rounds/${roundId}`, data);
    return response.data;
  },
  removeDriveRound: async (driveId: string, roundId: string) => {
    const response = await api.delete(`/career-connect/drives/${driveId}/rounds/${roundId}`);
    return response.data;
  },
  registerForDrive: async (driveId: string) => {
    const response = await api.post(`/career-connect/drives/${driveId}/register`);
    return response.data;
  },
  unregisterFromDrive: async (driveId: string, studentId: string) => {
    const response = await api.delete(`/career-connect/drives/${driveId}/register/${studentId}`);
    return response.data;
  },
  getDriveRegistrations: async (driveId: string) => {
    const response = await api.get(`/career-connect/drives/${driveId}/registrations`);
    return response.data;
  },
  submitRoundResults: async (driveId: string, roundId: string, data: Record<string, unknown>) => {
    const response = await api.post(
      `/career-connect/drives/${driveId}/rounds/${roundId}/results`,
      data
    );
    return response.data;
  },
  createOffer: async (driveId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/drives/${driveId}/offers`, data);
    return response.data;
  },
  getDriveOffers: async (driveId: string) => {
    const response = await api.get(`/career-connect/drives/${driveId}/offers`);
    return response.data;
  },
  respondToOffer: async (offerId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/offers/${offerId}/respond`, data);
    return response.data;
  },
  getDriveStats: async () => {
    const response = await api.get('/career-connect/drives/stats');
    return response.data;
  },

  // Job Board
  getJobPostings: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/jobs', { params });
    return response.data;
  },
  getJobPosting: async (id: string) => {
    const response = await api.get(`/career-connect/jobs/${id}`);
    return response.data;
  },
  createJobPosting: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/jobs', data);
    return response.data;
  },
  updateJobPosting: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/jobs/${id}`, data);
    return response.data;
  },
  deleteJobPosting: async (id: string) => {
    const response = await api.delete(`/career-connect/jobs/${id}`);
    return response.data;
  },
  updateJobPostingStatus: async (id: string, status: string) => {
    const response = await api.put(`/career-connect/jobs/${id}/status`, { status });
    return response.data;
  },
  applyForJob: async (jobId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/jobs/${jobId}/apply`, data);
    return response.data;
  },
  getJobApplications: async (jobId: string, params?: Record<string, unknown>) => {
    const response = await api.get(`/career-connect/jobs/${jobId}/applications`, { params });
    return response.data;
  },
  getMyApplications: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/applications/my', { params });
    return response.data;
  },
  updateApplicationStatus: async (applicationId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/applications/${applicationId}/status`, data);
    return response.data;
  },

  // Student Profiles
  getStudentProfiles: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/student-profiles', { params });
    return response.data;
  },
  getMyProfile: async () => {
    const response = await api.get('/career-connect/student-profiles/my');
    return response.data;
  },
  getStudentProfile: async (studentId: string) => {
    const response = await api.get(`/career-connect/student-profiles/${studentId}`);
    return response.data;
  },
  updateStudentProfile: async (studentId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/student-profiles/${studentId}`, data);
    return response.data;
  },
  addSkill: async (studentId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/student-profiles/${studentId}/skills`, data);
    return response.data;
  },
  removeSkill: async (studentId: string, skillId: string) => {
    const response = await api.delete(
      `/career-connect/student-profiles/${studentId}/skills/${skillId}`
    );
    return response.data;
  },
  addCertification: async (studentId: string, data: Record<string, unknown>) => {
    const response = await api.post(
      `/career-connect/student-profiles/${studentId}/certifications`,
      data
    );
    return response.data;
  },
  removeCertification: async (studentId: string, certId: string) => {
    const response = await api.delete(
      `/career-connect/student-profiles/${studentId}/certifications/${certId}`
    );
    return response.data;
  },
  addProject: async (studentId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/student-profiles/${studentId}/projects`, data);
    return response.data;
  },
  removeProject: async (studentId: string, projectId: string) => {
    const response = await api.delete(
      `/career-connect/student-profiles/${studentId}/projects/${projectId}`
    );
    return response.data;
  },
  addExperience: async (studentId: string, data: Record<string, unknown>) => {
    const response = await api.post(
      `/career-connect/student-profiles/${studentId}/experience`,
      data
    );
    return response.data;
  },
  removeExperience: async (studentId: string, expId: string) => {
    const response = await api.delete(
      `/career-connect/student-profiles/${studentId}/experience/${expId}`
    );
    return response.data;
  },
  updatePreferences: async (studentId: string, data: Record<string, unknown>) => {
    const response = await api.put(
      `/career-connect/student-profiles/${studentId}/preferences`,
      data
    );
    return response.data;
  },

  // Alumni
  getAlumniProfiles: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/alumni', { params });
    return response.data;
  },
  getAlumniProfile: async (id: string) => {
    const response = await api.get(`/career-connect/alumni/${id}`);
    return response.data;
  },
  updateAlumniProfile: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/alumni/${id}`, data);
    return response.data;
  },
  getMyAlumniProfile: async () => {
    const response = await api.get('/career-connect/alumni/my-profile');
    return response.data;
  },
  verifyAlumniProfile: async (id: string) => {
    const response = await api.put(`/career-connect/alumni/${id}/verify`);
    return response.data;
  },

  // Mentorship
  getMentorshipPrograms: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/mentorship/programs', { params });
    return response.data;
  },
  getMentorshipProgram: async (id: string) => {
    const response = await api.get(`/career-connect/mentorship/programs/${id}`);
    return response.data;
  },
  createMentorshipProgram: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/mentorship/programs', data);
    return response.data;
  },
  updateMentorshipProgram: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/mentorship/programs/${id}`, data);
    return response.data;
  },
  deleteMentorshipProgram: async (id: string) => {
    const response = await api.delete(`/career-connect/mentorship/programs/${id}`);
    return response.data;
  },
  addMentorshipSession: async (programId: string, data: Record<string, unknown>) => {
    const response = await api.post(
      `/career-connect/mentorship/programs/${programId}/sessions`,
      data
    );
    return response.data;
  },

  // Referrals
  getReferrals: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/alumni/referrals', { params });
    return response.data;
  },
  getReferral: async (id: string) => {
    const response = await api.get(`/career-connect/alumni/referrals/${id}`);
    return response.data;
  },
  createReferral: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/alumni/referrals', data);
    return response.data;
  },
  updateReferral: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/alumni/referrals/${id}`, data);
    return response.data;
  },
  deleteReferral: async (id: string) => {
    const response = await api.delete(`/career-connect/alumni/referrals/${id}`);
    return response.data;
  },
  referStudent: async (referralId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/career-connect/alumni/referrals/${referralId}/refer`, data);
    return response.data;
  },

  // Counseling
  getCounselingSessions: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/counseling/sessions', { params });
    return response.data;
  },
  getCounselingSession: async (id: string) => {
    const response = await api.get(`/career-connect/counseling/sessions/${id}`);
    return response.data;
  },
  createCounselingSession: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/counseling/sessions', data);
    return response.data;
  },
  updateCounselingSession: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/counseling/sessions/${id}`, data);
    return response.data;
  },
  deleteCounselingSession: async (id: string) => {
    const response = await api.delete(`/career-connect/counseling/sessions/${id}`);
    return response.data;
  },

  // Assessments
  getAssessments: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/assessments', { params });
    return response.data;
  },
  getAssessment: async (id: string) => {
    const response = await api.get(`/career-connect/assessments/${id}`);
    return response.data;
  },
  createAssessment: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/assessments', data);
    return response.data;
  },
  updateAssessment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/assessments/${id}`, data);
    return response.data;
  },
  deleteAssessment: async (id: string) => {
    const response = await api.delete(`/career-connect/assessments/${id}`);
    return response.data;
  },

  // Resources
  getResources: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/resources', { params });
    return response.data;
  },
  getResource: async (id: string) => {
    const response = await api.get(`/career-connect/resources/${id}`);
    return response.data;
  },
  createResource: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/resources', data);
    return response.data;
  },
  updateResource: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/resources/${id}`, data);
    return response.data;
  },
  deleteResource: async (id: string) => {
    const response = await api.delete(`/career-connect/resources/${id}`);
    return response.data;
  },

  // Alumni Events
  getAlumniEvents: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/alumni/events', { params });
    return response.data;
  },
  getAlumniEvent: async (id: string) => {
    const response = await api.get(`/career-connect/alumni/events/${id}`);
    return response.data;
  },
  createAlumniEvent: async (data: Record<string, unknown>) => {
    const response = await api.post('/career-connect/alumni/events', data);
    return response.data;
  },
  updateAlumniEvent: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/alumni/events/${id}`, data);
    return response.data;
  },
  deleteAlumniEvent: async (id: string) => {
    const response = await api.delete(`/career-connect/alumni/events/${id}`);
    return response.data;
  },
  updateAlumniEventStatus: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/career-connect/alumni/events/${id}/status`, data);
    return response.data;
  },
  registerForAlumniEvent: async (id: string) => {
    const response = await api.post(`/career-connect/alumni/events/${id}/register`);
    return response.data;
  },

  // Reports
  getPlacementSummaryReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/placement-summary', { params });
    return response.data;
  },
  getCompanyWiseReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/company-wise', { params });
    return response.data;
  },
  getDepartmentWiseReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/department-wise', { params });
    return response.data;
  },
  getSalaryAnalysisReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/salary-analysis', { params });
    return response.data;
  },
  getPlacementTrendsReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/placement-trends', { params });
    return response.data;
  },
  getCounselingSummaryReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/counseling-summary', { params });
    return response.data;
  },
  getAssessmentAnalyticsReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/assessment-analytics', { params });
    return response.data;
  },
  getAlumniDemographicsReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/alumni-demographics', { params });
    return response.data;
  },
  getMentorshipImpactReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/career-connect/reports/mentorship-impact', { params });
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/career-connect/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/career-connect/settings', data);
    return response.data;
  },
};

// ── Courses & Online Teaching ─────────────────────────────────────
export const coursesApi = {
  // Courses CRUD
  getCourses: async (params?: Record<string, unknown>) => {
    const response = await api.get('/courses', { params });
    return response.data;
  },

  // Course Settings
  getCourseSettings: async () => {
    const response = await api.get('/courses/settings');
    return response.data;
  },
  updateCourseSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/courses/settings', data);
    return response.data;
  },
  getCourse: async (id: string) => {
    const response = await api.get(`/courses/${id}`);
    return response.data;
  },
  createCourse: async (data: Record<string, unknown>) => {
    const response = await api.post('/courses', data);
    return response.data;
  },
  updateCourse: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/courses/${id}`, data);
    return response.data;
  },
  deleteCourse: async (id: string) => {
    const response = await api.delete(`/courses/${id}`);
    return response.data;
  },
  updateCourseVisibility: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/courses/${id}/visibility`, data);
    return response.data;
  },

  // Lessons
  getLessons: async (courseId: string, params?: Record<string, unknown>) => {
    const response = await api.get(`/courses/${courseId}/lessons`, { params });
    return response.data;
  },
  getLesson: async (courseId: string, lessonId: string) => {
    const response = await api.get(`/courses/${courseId}/lessons/${lessonId}`);
    return response.data;
  },
  createLesson: async (courseId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/courses/${courseId}/lessons`, data);
    return response.data;
  },
  updateLesson: async (courseId: string, lessonId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/courses/${courseId}/lessons/${lessonId}`, data);
    return response.data;
  },
  deleteLesson: async (courseId: string, lessonId: string) => {
    const response = await api.delete(`/courses/${courseId}/lessons/${lessonId}`);
    return response.data;
  },

  // Quizzes
  getQuizzes: async (courseId: string, params?: Record<string, unknown>) => {
    const response = await api.get(`/courses/${courseId}/quizzes`, { params });
    return response.data;
  },
  getQuiz: async (courseId: string, quizId: string) => {
    const response = await api.get(`/courses/${courseId}/quizzes/${quizId}`);
    return response.data;
  },
  createQuiz: async (courseId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/courses/${courseId}/quizzes`, data);
    return response.data;
  },
  updateQuiz: async (courseId: string, quizId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/courses/${courseId}/quizzes/${quizId}`, data);
    return response.data;
  },
  deleteQuiz: async (courseId: string, quizId: string) => {
    const response = await api.delete(`/courses/${courseId}/quizzes/${quizId}`);
    return response.data;
  },
  submitQuizAttempt: async (courseId: string, quizId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/courses/${courseId}/quizzes/${quizId}/attempts`, data);
    return response.data;
  },
  getQuizAttempts: async (courseId: string, quizId: string, params?: Record<string, unknown>) => {
    const response = await api.get(`/courses/${courseId}/quizzes/${quizId}/attempts`, { params });
    return response.data;
  },

  // Enrollments
  getEnrollments: async (params?: Record<string, unknown>) => {
    const response = await api.get('/courses/enrollments', { params });
    return response.data;
  },
  getEnrollment: async (id: string) => {
    const response = await api.get(`/courses/enrollments/${id}`);
    return response.data;
  },
  enrollStudents: async (data: Record<string, unknown>) => {
    const response = await api.post('/courses/enrollments', data);
    return response.data;
  },
  updateEnrollment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/courses/enrollments/${id}`, data);
    return response.data;
  },

  // Progress
  getCourseProgress: async (enrollmentId: string) => {
    const response = await api.get(`/courses/enrollments/${enrollmentId}/progress`);
    return response.data;
  },
  updateLessonProgress: async (
    enrollmentId: string,
    lessonId: string,
    data: Record<string, unknown>
  ) => {
    const response = await api.put(
      `/courses/enrollments/${enrollmentId}/progress/${lessonId}`,
      data
    );
    return response.data;
  },
};

// ── Hostel Management ──────────────────────────────────────────────
export const hostelApi = {
  // Hostels
  getHostels: async (params?: Record<string, unknown>) => {
    const response = await api.get('/hostel/hostels', { params });
    return response.data;
  },
  getHostel: async (id: string) => {
    const response = await api.get(`/hostel/hostels/${id}`);
    return response.data;
  },
  createHostel: async (data: Record<string, unknown>) => {
    const response = await api.post('/hostel/hostels', data);
    return response.data;
  },
  updateHostel: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hostel/hostels/${id}`, data);
    return response.data;
  },
  deleteHostel: async (id: string) => {
    const response = await api.delete(`/hostel/hostels/${id}`);
    return response.data;
  },
  getHostelStats: async () => {
    const response = await api.get('/hostel/hostels/stats');
    return response.data;
  },

  // Rooms
  getRooms: async (params?: Record<string, unknown>) => {
    // Suppress global 403 toast — used by hostel detail page where the user
    // may have hostel.hostels:view but not hostel.rooms:view.
    const response = await api.get('/hostel/rooms', {
      params,
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },
  getRoom: async (id: string) => {
    const response = await api.get(`/hostel/rooms/${id}`);
    return response.data;
  },
  createRoom: async (data: Record<string, unknown>) => {
    const response = await api.post('/hostel/rooms', data);
    return response.data;
  },
  updateRoom: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hostel/rooms/${id}`, data);
    return response.data;
  },
  deleteRoom: async (id: string) => {
    const response = await api.delete(`/hostel/rooms/${id}`);
    return response.data;
  },
  updateRoomStatus: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hostel/rooms/${id}/status`, data);
    return response.data;
  },

  // Allocations
  getAllocations: async (params?: Record<string, unknown>) => {
    // Suppress global 403 toast — used by hostel detail page where the user
    // may have hostel.hostels:view but not hostel.allocations:view.
    const response = await api.get('/hostel/allocations', {
      params,
      // @ts-expect-error: custom flag consumed by response interceptor
      _skipErrorToast: true,
    });
    return response.data;
  },
  getAllocation: async (id: string) => {
    const response = await api.get(`/hostel/allocations/${id}`);
    return response.data;
  },
  allocateBed: async (data: Record<string, unknown>) => {
    const response = await api.post('/hostel/allocations', data);
    return response.data;
  },
  vacateBed: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hostel/allocations/${id}/vacate`, data);
    return response.data;
  },
  transferBed: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/hostel/allocations/${id}/transfer`, data);
    return response.data;
  },
  getStudentAllocation: async (studentId: string) => {
    const response = await api.get(`/hostel/allocations/student/${studentId}`);
    return response.data;
  },
  getAllocationStats: async () => {
    const response = await api.get('/hostel/allocations/stats');
    return response.data;
  },

  // Reports
  getOccupancyReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/hostel/reports/occupancy', { params });
    return response.data;
  },
  getVacancyReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/hostel/reports/vacancy', { params });
    return response.data;
  },
  getClassWiseReport: async (params?: Record<string, unknown>) => {
    const response = await api.get('/hostel/reports/class-wise', { params });
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/hostel/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/hostel/settings', data);
    return response.data;
  },
};

// ── Inventory API ──
export const inventoryApi = {
  // Assets
  getAssets: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/assets', { params });
    return response.data;
  },
  getAssetStats: async () => {
    const response = await api.get('/inventory/assets/stats');
    return response.data;
  },
  getAsset: async (id: string) => {
    const response = await api.get(`/inventory/assets/${id}`);
    return response.data;
  },
  createAsset: async (data: Record<string, unknown>) => {
    const response = await api.post('/inventory/assets', data);
    return response.data;
  },
  updateAsset: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/inventory/assets/${id}`, data);
    return response.data;
  },
  deleteAsset: async (id: string) => {
    const response = await api.delete(`/inventory/assets/${id}`);
    return response.data;
  },

  // Categories
  getCategories: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/categories', { params });
    return response.data;
  },
  createCategory: async (data: Record<string, unknown>) => {
    const response = await api.post('/inventory/categories', data);
    return response.data;
  },
  updateCategory: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/inventory/categories/${id}`, data);
    return response.data;
  },
  deleteCategory: async (id: string) => {
    const response = await api.delete(`/inventory/categories/${id}`);
    return response.data;
  },

  // Procurement
  getProcurements: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/procurements', { params });
    return response.data;
  },
  getProcurement: async (id: string) => {
    const response = await api.get(`/inventory/procurements/${id}`);
    return response.data;
  },
  createProcurement: async (data: Record<string, unknown>) => {
    const response = await api.post('/inventory/procurements', data);
    return response.data;
  },
  updateProcurement: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/inventory/procurements/${id}`, data);
    return response.data;
  },
  approveProcurement: async (id: string) => {
    const response = await api.put(`/inventory/procurements/${id}/approve`);
    return response.data;
  },
  receiveProcurement: async (id: string) => {
    const response = await api.put(`/inventory/procurements/${id}/receive`);
    return response.data;
  },

  // Issue / Return
  getIssues: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/issues', { params });
    return response.data;
  },
  getMyAssets: async () => {
    const response = await api.get('/inventory/issues/my');
    return response.data;
  },
  issueAsset: async (data: Record<string, unknown>) => {
    const response = await api.post('/inventory/issues', data);
    return response.data;
  },
  returnAsset: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/inventory/issues/${id}/return`, data);
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/inventory/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/inventory/settings', data);
    return response.data;
  },
};

// ── Expense API ──
export const expenseApi = {
  // Expenses
  getExpenses: async (params?: Record<string, unknown>) => {
    const response = await api.get('/expenses', { params });
    return response.data;
  },
  getMyExpenses: async (params?: Record<string, unknown>) => {
    const response = await api.get('/expenses/my', { params });
    return response.data;
  },
  getExpenseStats: async () => {
    const response = await api.get('/expenses/stats');
    return response.data;
  },
  getExpense: async (id: string) => {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },
  createExpense: async (data: Record<string, unknown>) => {
    const response = await api.post('/expenses', data);
    return response.data;
  },
  updateExpense: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/expenses/${id}`, data);
    return response.data;
  },
  deleteExpense: async (id: string) => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },
  submitExpense: async (id: string) => {
    const response = await api.put(`/expenses/${id}/submit`);
    return response.data;
  },
  approveExpense: async (id: string, remarks?: string) => {
    const response = await api.put(`/expenses/${id}/approve`, { remarks });
    return response.data;
  },
  rejectExpense: async (id: string, remarks: string) => {
    const response = await api.put(`/expenses/${id}/reject`, { remarks });
    return response.data;
  },
  markExpensePaid: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/expenses/${id}/mark-paid`, data);
    return response.data;
  },

  // Budgets
  getBudgets: async (params?: Record<string, unknown>) => {
    const response = await api.get('/expenses/budgets', { params });
    return response.data;
  },
  getBudget: async (id: string) => {
    const response = await api.get(`/expenses/budgets/${id}`);
    return response.data;
  },
  createBudget: async (data: Record<string, unknown>) => {
    const response = await api.post('/expenses/budgets', data);
    return response.data;
  },
  updateBudget: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/expenses/budgets/${id}`, data);
    return response.data;
  },
  deleteBudget: async (id: string) => {
    const response = await api.delete(`/expenses/budgets/${id}`);
    return response.data;
  },

  // Reimbursements
  getReimbursements: async (params?: Record<string, unknown>) => {
    const response = await api.get('/expenses/reimbursements', { params });
    return response.data;
  },
  createReimbursement: async (data: Record<string, unknown>) => {
    const response = await api.post('/expenses/reimbursements', data);
    return response.data;
  },
  approveReimbursement: async (id: string, remarks?: string) => {
    const response = await api.put(`/expenses/reimbursements/${id}/approve`, { remarks });
    return response.data;
  },
  processReimbursement: async (id: string, remarks?: string) => {
    const response = await api.put(`/expenses/reimbursements/${id}/process`, { remarks });
    return response.data;
  },

  // Settings
  getSettings: async () => {
    const response = await api.get('/expenses/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/expenses/settings', data);
    return response.data;
  },
};

// ── Feedback API ──
export const feedbackApi = {
  getTickets: async (params?: Record<string, unknown>) => {
    const response = await api.get('/feedback', { params });
    return response.data;
  },
  getTicket: async (id: string) => {
    const response = await api.get(`/feedback/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/feedback/stats');
    return response.data;
  },
  createTicket: async (data: Record<string, unknown>) => {
    const response = await api.post('/feedback', data);
    return response.data;
  },
  updateTicket: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/feedback/${id}`, data);
    return response.data;
  },
  deleteTicket: async (id: string) => {
    const response = await api.delete(`/feedback/${id}`);
    return response.data;
  },
  assignTicket: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/feedback/${id}/assign`, data);
    return response.data;
  },
  updateStatus: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/feedback/${id}/status`, data);
    return response.data;
  },
  escalateTicket: async (id: string) => {
    const response = await api.put(`/feedback/${id}/escalate`);
    return response.data;
  },
  addResponse: async (id: string, data: Record<string, unknown>) => {
    const response = await api.post(`/feedback/${id}/responses`, data);
    return response.data;
  },
  submitSatisfaction: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/feedback/${id}/satisfaction`, data);
    return response.data;
  },
};

// ── Visitor API ──
export const visitorApi = {
  getVisitors: async (params?: Record<string, unknown>) => {
    const response = await api.get('/visitors', { params });
    return response.data;
  },
  getVisitorStats: async () => {
    const response = await api.get('/visitors/stats');
    return response.data;
  },
  getVisitor: async (id: string) => {
    const response = await api.get(`/visitors/${id}`);
    return response.data;
  },
  createVisitor: async (data: Record<string, unknown>) => {
    const response = await api.post('/visitors', data);
    return response.data;
  },
  updateVisitor: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/visitors/${id}`, data);
    return response.data;
  },
  deleteVisitor: async (id: string) => {
    const response = await api.delete(`/visitors/${id}`);
    return response.data;
  },
  checkInVisitor: async (id: string) => {
    const response = await api.put(`/visitors/${id}/check-in`);
    return response.data;
  },
  checkOutVisitor: async (id: string) => {
    const response = await api.put(`/visitors/${id}/check-out`);
    return response.data;
  },
  generatePass: async (id: string, data?: Record<string, unknown>) => {
    const response = await api.post(`/visitors/${id}/pass`, data || {});
    return response.data;
  },
  revokePass: async (id: string) => {
    const response = await api.put(`/visitors/${id}/pass/revoke`);
    return response.data;
  },
  verifyPass: async (passCode: string) => {
    const response = await api.get(`/visitors/pass/${passCode}`);
    return response.data;
  },
  getLogs: async (params?: Record<string, unknown>) => {
    const response = await api.get('/visitors/logs', { params });
    return response.data;
  },
  exportLogs: async (params?: Record<string, unknown>) => {
    const response = await api.get('/visitors/logs/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
  getSettings: async () => {
    const response = await api.get('/visitors/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/visitors/settings', data);
    return response.data;
  },
};

export const transportApi = {
  getBuses: async (params?: Record<string, unknown>) => {
    const response = await api.get('/transport/buses', { params });
    return response.data;
  },
  getBusStats: async () => {
    const response = await api.get('/transport/buses/stats');
    return response.data;
  },
  getBus: async (id: string) => {
    const response = await api.get(`/transport/buses/${id}`);
    return response.data;
  },
  createBus: async (data: Record<string, unknown>) => {
    const response = await api.post('/transport/buses', data);
    return response.data;
  },
  updateBus: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/transport/buses/${id}`, data);
    return response.data;
  },
  deleteBus: async (id: string) => {
    const response = await api.delete(`/transport/buses/${id}`);
    return response.data;
  },
  getEnrollments: async (params?: Record<string, unknown>) => {
    const response = await api.get('/transport/enrollments', { params });
    return response.data;
  },
  getEnrollment: async (id: string) => {
    const response = await api.get(`/transport/enrollments/${id}`);
    return response.data;
  },
  getStudentEnrollment: async (studentId: string) => {
    const response = await api.get(`/transport/enrollments/student/${studentId}`);
    return response.data;
  },
  getMyEnrollment: async () => {
    const response = await api.get('/transport/enrollments/my');
    return response.data;
  },
  createEnrollment: async (data: Record<string, unknown>) => {
    const response = await api.post('/transport/enrollments', data);
    return response.data;
  },
  updateEnrollment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/transport/enrollments/${id}`, data);
    return response.data;
  },
  withdrawEnrollment: async (id: string, data: Record<string, unknown>) => {
    const response = await api.post(`/transport/enrollments/${id}/withdraw`, data);
    return response.data;
  },
  getSettings: async () => {
    const response = await api.get('/transport/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/transport/settings', data);
    return response.data;
  },
};

// ============ Live Classes ============
export const liveClassApi = {
  list: async (params?: {
    sectionId?: string;
    classId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    mine?: boolean;
    staffId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/teaching/live-classes', { params });
    return response.data;
  },
  create: async (data: {
    title: string;
    description?: string;
    classId?: string;
    sectionId: string;
    subjectId?: string;
    /** Only honoured when the caller is an admin scheduling for another teacher. */
    hostStaffId?: string;
    coHostStaffIds?: string[];
    scheduledStart: string;
    scheduledEnd: string;
    recordingEnabled?: boolean;
    autoMarkAttendance?: boolean;
    attendanceThresholdPct?: number;
    settings?: {
      chatEnabled?: boolean;
      studentCanUnmute?: boolean;
      studentCanDraw?: boolean;
      recordingEnabled?: boolean;
    };
  }) => {
    const response = await api.post('/teaching/live-classes', data);
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/teaching/live-classes/${id}`);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.patch(`/teaching/live-classes/${id}`, data);
    return response.data;
  },
  start: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/start`);
    return response.data;
  },
  end: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/end`);
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/cancel`);
    return response.data;
  },
  join: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/join`);
    return response.data;
  },
  listMessages: async (id: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get(`/teaching/live-classes/${id}/messages`, { params });
    return response.data;
  },
  listPolls: async (id: string) => {
    const response = await api.get(`/teaching/live-classes/${id}/polls`);
    return response.data;
  },
  listParticipants: async (id: string) => {
    const response = await api.get(`/teaching/live-classes/${id}/participants`);
    return response.data;
  },
  kick: async (id: string, userId: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/kick`, { userId });
    return response.data;
  },
  muteAll: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/mute-all`);
    return response.data;
  },
  updateLiveSettings: async (
    id: string,
    settings: {
      chatEnabled?: boolean;
      studentCanUnmute?: boolean;
      studentCanDraw?: boolean;
      recordingEnabled?: boolean;
    }
  ) => {
    const response = await api.patch(`/teaching/live-classes/${id}/settings`, settings);
    return response.data;
  },
  startRecording: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/recording/start`);
    return response.data;
  },
  stopRecording: async (id: string) => {
    const response = await api.post(`/teaching/live-classes/${id}/recording/stop`);
    return response.data;
  },
};

/* ───────────────────── Exams ───────────────────── */

export const examsApi = {
  // Settings
  getSettings: async () => {
    const response = await api.get('/exams/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/exams/settings', data);
    return response.data;
  },

  // Exam CRUD
  listExams: async (params?: {
    academicBatchId?: string;
    termName?: string;
    status?: string;
    type?: string;
    classId?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/exams', { params });
    return response.data;
  },
  getExam: async (id: string) => {
    const response = await api.get(`/exams/${id}`);
    return response.data;
  },
  createExam: async (data: Record<string, unknown>) => {
    const response = await api.post('/exams', data);
    return response.data;
  },
  updateExam: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/exams/${id}`, data);
    return response.data;
  },
  deleteExam: async (id: string) => {
    const response = await api.delete(`/exams/${id}`);
    return response.data;
  },
  setExamStatus: async (id: string, status: string) => {
    const response = await api.put(`/exams/${id}/status`, { status });
    return response.data;
  },

  // Schedules
  listSchedules: async (params: {
    examId?: string;
    paperId?: string;
    sectionId?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/exams/schedules/list', { params });
    return response.data;
  },
  createSchedule: async (data: Record<string, unknown>) => {
    const response = await api.post('/exams/schedules', data);
    return response.data;
  },
  bulkCreateSchedules: async (data: Record<string, unknown>) => {
    const response = await api.post('/exams/schedules/bulk', data);
    return response.data;
  },
  updateSchedule: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/exams/schedules/${id}`, data);
    return response.data;
  },
  deleteSchedule: async (id: string) => {
    const response = await api.delete(`/exams/schedules/${id}`);
    return response.data;
  },

  // Marks
  listMarksForPaperSection: async (params: {
    examId: string;
    paperId: string;
    sectionId: string;
  }) => {
    const response = await api.get('/exams/marks/paper-section', { params });
    return response.data;
  },
  upsertMark: async (data: Record<string, unknown>) => {
    const response = await api.post('/exams/marks', data);
    return response.data;
  },
  bulkUpsertMarks: async (data: Record<string, unknown>) => {
    const response = await api.post('/exams/marks/bulk', data);
    return response.data;
  },

  // Results
  sectionReport: async (params: { examId: string; sectionId: string }) => {
    const response = await api.get('/exams/results/section-report', { params });
    return response.data;
  },
  studentResults: async (studentId: string, onlyPublished?: boolean) => {
    const response = await api.get(`/exams/results/student/${studentId}`, {
      params: onlyPublished ? { onlyPublished: 'true' } : undefined,
    });
    return response.data;
  },
  publishResults: async (data: { examId: string; paperId?: string; studentIds?: string[] }) => {
    const response = await api.post('/exams/results/publish', data);
    return response.data;
  },

  // Report cards
  listReportCards: async (params: {
    examId?: string;
    sectionId?: string;
    studentId?: string;
    status?: string;
  }) => {
    const response = await api.get('/exams/report-cards', { params });
    return response.data;
  },
  getReportCard: async (id: string) => {
    const response = await api.get(`/exams/report-cards/${id}`);
    return response.data;
  },
  generateReportCards: async (data: {
    examId: string;
    sectionId?: string;
    studentIds?: string[];
  }) => {
    const response = await api.post('/exams/report-cards/generate', data);
    return response.data;
  },
  publishReportCard: async (id: string) => {
    const response = await api.post(`/exams/report-cards/${id}/publish`);
    return response.data;
  },
  unpublishReportCard: async (id: string) => {
    const response = await api.post(`/exams/report-cards/${id}/unpublish`);
    return response.data;
  },
  bulkPublishReportCards: async (data: { examId: string; sectionId?: string }) => {
    const response = await api.post('/exams/report-cards/bulk-publish', data);
    return response.data;
  },

  // Transcript — semesters, credits, SGPA, CGPA, backlogs
  getTranscript: async (studentId: string) => {
    const response = await api.get(`/exams/transcripts/student/${studentId}`);
    return response.data;
  },

  // Hall tickets
  listHallTickets: async (params: { examId?: string; sectionId?: string; studentId?: string }) => {
    const response = await api.get('/exams/hall-tickets', { params });
    return response.data;
  },
  getHallTicket: async (id: string) => {
    const response = await api.get(`/exams/hall-tickets/${id}`);
    return response.data;
  },
  generateHallTickets: async (data: {
    examId: string;
    sectionId?: string;
    studentIds?: string[];
  }) => {
    const response = await api.post('/exams/hall-tickets/generate', data);
    return response.data;
  },
  updateHallTicketSeat: async (id: string, seatNumber: string) => {
    const response = await api.patch(`/exams/hall-tickets/${id}/seat`, { seatNumber });
    return response.data;
  },

  // Promotion
  listPromotionRuns: async (params?: { status?: string }) => {
    const response = await api.get('/exams/promotions/runs', { params });
    return response.data;
  },
  getPromotionRun: async (id: string) => {
    const response = await api.get(`/exams/promotions/runs/${id}`);
    return response.data;
  },
  createPromotionRun: async (data: {
    fromBatchId: string;
    toBatchId: string;
    passMarkPercentOverride?: number;
    passSubjectsRequiredOverride?: 'all' | number;
  }) => {
    const response = await api.post('/exams/promotions/runs', data);
    return response.data;
  },
  overridePromotionDecision: async (
    runId: string,
    studentId: string,
    patch: {
      outcome?: 'promote' | 'graduate' | 'hold' | 'transfer_out';
      toClassId?: string;
      toSectionId?: string;
      reason?: string;
    }
  ) => {
    const response = await api.patch(
      `/exams/promotions/runs/${runId}/decisions/${studentId}`,
      patch
    );
    return response.data;
  },
  commitPromotionRun: async (runId: string) => {
    const response = await api.post(`/exams/promotions/runs/${runId}/commit`);
    return response.data;
  },
  deletePromotionRun: async (runId: string) => {
    const response = await api.delete(`/exams/promotions/runs/${runId}`);
    return response.data;
  },
};

// ─── Course Registration (universities/colleges) ────────────────────────────

export interface SchemeSlotPayload {
  kind: 'core' | 'basket';
  category?: string;
  // core
  subjectId?: string;
  credits?: number;
  // basket
  label?: string;
  chooseCount?: number;
  options?: Array<{ subjectId: string; credits: number; seatCap?: number }>;
}

export const registrationApi = {
  // Program schemes (registrar)
  getSchemes: async (params?: {
    departmentCode?: string;
    programId?: string;
    semesterNumber?: number;
    status?: string;
  }) => {
    const response = await api.get('/registration/schemes', { params });
    return response.data;
  },
  getScheme: async (id: string, expandSubjects = false) => {
    const response = await api.get(`/registration/schemes/${id}`, {
      params: expandSubjects ? { expand: 'subjects' } : undefined,
    });
    return response.data;
  },
  createScheme: async (data: {
    departmentCode: string;
    departmentName: string;
    /** FK → programs; omit for a department-wide curriculum. */
    programId?: string;
    semesterNumber: number;
    slots: SchemeSlotPayload[];
    minCredits?: number;
    maxCredits?: number;
  }) => {
    const response = await api.post('/registration/schemes', data);
    return response.data;
  },
  updateScheme: async (
    id: string,
    data: {
      departmentName?: string;
      /** `null` detaches the scheme from its program (back to department-wide). */
      programId?: string | null;
      slots?: SchemeSlotPayload[];
      minCredits?: number;
      maxCredits?: number;
    }
  ) => {
    const response = await api.put(`/registration/schemes/${id}`, data);
    return response.data;
  },
  publishScheme: async (id: string) => {
    const response = await api.post(`/registration/schemes/${id}/publish`);
    return response.data;
  },
  archiveScheme: async (id: string) => {
    const response = await api.post(`/registration/schemes/${id}/archive`);
    return response.data;
  },
  cloneScheme: async (
    id: string,
    data: {
      targetSemesterNumber?: number;
      targetProgramId?: string | null;
      targetDepartmentCode?: string;
      targetDepartmentName?: string;
    }
  ) => {
    const response = await api.post(`/registration/schemes/${id}/clone`, data);
    return response.data;
  },
  deleteScheme: async (id: string) => {
    const response = await api.delete(`/registration/schemes/${id}`);
    return response.data;
  },

  // Student self-service
  getMyContext: async (termId?: string) => {
    const response = await api.get('/registration/my/context', {
      params: termId ? { termId } : undefined,
    });
    return response.data;
  },
  submitMyRegistration: async (data: {
    academicBatchId: string;
    termId: string;
    selections: Array<{ slotId: string; subjectIds: string[] }>;
  }) => {
    const response = await api.post('/registration/my/registrations', data);
    return response.data;
  },
  updateMyRegistration: async (
    termId: string,
    data: { selections: Array<{ slotId: string; subjectIds: string[] }> }
  ) => {
    const response = await api.put(`/registration/my/registrations/${termId}`, data);
    return response.data;
  },
  withdrawMyRegistration: async (termId: string) => {
    const response = await api.delete(`/registration/my/registrations/${termId}`);
    return response.data;
  },

  // Registrar
  getTermRegistrations: async (
    termId: string,
    params?: { departmentCode?: string; page?: number; limit?: number }
  ) => {
    const response = await api.get(`/registration/terms/${termId}/registrations`, { params });
    return response.data;
  },
  getTermPending: async (
    termId: string,
    params: { academicBatchId: string; departmentCode?: string; limit?: number }
  ) => {
    const response = await api.get(`/registration/terms/${termId}/pending`, { params });
    return response.data;
  },
  getTermOverview: async (termId: string) => {
    const response = await api.get(`/registration/terms/${termId}/overview`);
    return response.data;
  },
  submitForStudent: async (
    studentId: string,
    data: {
      academicBatchId: string;
      termId: string;
      selections: Array<{ slotId: string; subjectIds: string[] }>;
    }
  ) => {
    const response = await api.post(`/registration/students/${studentId}/registrations`, data);
    return response.data;
  },
  withdrawForStudent: async (studentId: string, termId: string) => {
    const response = await api.delete(
      `/registration/students/${studentId}/registrations/${termId}`
    );
    return response.data;
  },
};

// Terms (semesters) on academic batches
export const termApi = {
  addTerm: async (batchId: string, data: Record<string, unknown>) => {
    const response = await api.post(`/organization/academic-batches/${batchId}/terms`, data);
    return response.data;
  },
  updateTerm: async (batchId: string, termId: string, data: Record<string, unknown>) => {
    const response = await api.put(
      `/organization/academic-batches/${batchId}/terms/${termId}`,
      data
    );
    return response.data;
  },
  deleteTerm: async (batchId: string, termId: string) => {
    const response = await api.delete(`/organization/academic-batches/${batchId}/terms/${termId}`);
    return response.data;
  },
};

/* ───────────────────── OBE Attainment ───────────────────── */

export interface ObePoPayload {
  /** Present for existing rows so their ids stay stable across edits. */
  _id?: string;
  code: string;
  title: string;
  statement: string;
  isCustom: boolean;
  order: number;
}

export interface ObePsoPayload {
  _id?: string;
  code: string;
  statement: string;
  order: number;
}

export interface ObeCoPayload {
  _id?: string;
  code: string;
  statement: string;
  bloomLevel: number;
  order: number;
}

/** Mapping cells reference COs by index into `cos` — new COs have no id yet. */
export interface ObePoMappingPayload {
  coIndex: number;
  poId: string;
  strength: number;
  justification?: string;
}

export interface ObePsoMappingPayload {
  coIndex: number;
  psoId: string;
  strength: number;
  justification?: string;
}

export interface ObeInstrumentItemPayload {
  /** Kept for existing items so marks stay attached to them. */
  _id?: string;
  label: string;
  coIds: string[];
  maxMarks: number;
}

export interface ObeInstrumentSetPayload {
  _id?: string;
  label: string;
  items: ObeInstrumentItemPayload[];
}

export interface ObeInstrumentPayload {
  name: string;
  kind: 'internal' | 'external';
  order: number;
  sets?: ObeInstrumentSetPayload[];
  bestOfCount?: number | null;
  thresholdPercentOverride?: number;
  examId?: string;
  paperId?: string;
}

export interface ObeMarkRowPayload {
  studentId: string;
  setId?: string;
  absent: boolean;
  /** Omit an item entirely for "not attempted"; send 0 for "attempted, scored 0". */
  marks: Array<{ itemId: string; marksObtained: number }>;
}

export const obeApi = {
  // Settings
  getSettings: async () => {
    const response = await api.get('/obe/settings');
    return response.data;
  },
  updateSettings: async (data: Record<string, unknown>) => {
    const response = await api.put('/obe/settings', data);
    return response.data;
  },

  // Programs (PO/PSO definitions)
  getPrograms: async () => {
    const response = await api.get('/obe/programs');
    return response.data;
  },
  createProgram: async (data: {
    departmentCode: string;
    /** FK → curriculum programs; omit for a department-wide PO/PSO set. */
    curriculumProgramId?: string;
    name: string;
    preset: string;
    pos?: ObePoPayload[];
    psos?: ObePsoPayload[];
  }) => {
    const response = await api.post('/obe/programs', data);
    return response.data;
  },
  getProgram: async (id: string) => {
    const response = await api.get(`/obe/programs/${id}`);
    return response.data;
  },
  updateProgram: async (
    id: string,
    data: {
      name?: string;
      curriculumProgramId?: string | null;
      pos?: ObePoPayload[];
      psos?: ObePsoPayload[];
    }
  ) => {
    const response = await api.put(`/obe/programs/${id}`, data);
    return response.data;
  },
  deleteProgram: async (id: string) => {
    const response = await api.delete(`/obe/programs/${id}`);
    return response.data;
  },

  // Course outcomes + mapping matrices
  getOutcomes: async (subjectId: string, programId: string) => {
    const response = await api.get('/obe/outcomes', { params: { subjectId, programId } });
    return response.data;
  },
  getOutcomesByProgram: async (programId: string) => {
    const response = await api.get('/obe/outcomes/by-program', { params: { programId } });
    return response.data;
  },
  upsertOutcomes: async (data: {
    subjectId: string;
    programId: string;
    cos: ObeCoPayload[];
    poMapping: ObePoMappingPayload[];
    psoMapping: ObePsoMappingPayload[];
  }) => {
    const response = await api.put('/obe/outcomes', data);
    return response.data;
  },

  // Offerings
  getOfferings: async (params?: {
    programId?: string;
    academicBatchId?: string;
    termId?: string;
    subjectId?: string;
    status?: string;
    mine?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/obe/offerings', { params });
    return response.data;
  },
  createOffering: async (data: {
    programId: string;
    subjectId: string;
    academicBatchId: string;
    termId: string;
    sectionIds: string[];
    coordinatorStaffId?: string;
    targetLevel?: number;
  }) => {
    const response = await api.post('/obe/offerings', data);
    return response.data;
  },
  getOffering: async (id: string) => {
    const response = await api.get(`/obe/offerings/${id}`);
    return response.data;
  },
  updateOffering: async (
    id: string,
    data: {
      sectionIds?: string[];
      coordinatorStaffId?: string | null;
      targetLevel?: number | null;
    }
  ) => {
    const response = await api.put(`/obe/offerings/${id}`, data);
    return response.data;
  },
  deleteOffering: async (id: string) => {
    const response = await api.delete(`/obe/offerings/${id}`);
    return response.data;
  },
  setOfferingStatus: async (id: string, status: 'draft' | 'data_entry') => {
    const response = await api.post(`/obe/offerings/${id}/status`, { status });
    return response.data;
  },
  getCohort: async (id: string) => {
    const response = await api.get(`/obe/offerings/${id}/cohort`);
    return response.data;
  },
  getExamLinks: async (params: { subjectId: string; academicBatchId: string; termId?: string }) => {
    const response = await api.get('/obe/exam-links', { params });
    return response.data;
  },

  // Instruments
  addInstrument: async (offeringId: string, data: ObeInstrumentPayload) => {
    const response = await api.post(`/obe/offerings/${offeringId}/instruments`, data);
    return response.data;
  },
  updateInstrument: async (
    offeringId: string,
    instrumentId: string,
    data: ObeInstrumentPayload
  ) => {
    const response = await api.put(
      `/obe/offerings/${offeringId}/instruments/${instrumentId}`,
      data
    );
    return response.data;
  },
  deleteInstrument: async (offeringId: string, instrumentId: string) => {
    const response = await api.delete(`/obe/offerings/${offeringId}/instruments/${instrumentId}`);
    return response.data;
  },

  // Marks
  getMarksGrid: async (offeringId: string, instrumentId: string) => {
    const response = await api.get(
      `/obe/offerings/${offeringId}/instruments/${instrumentId}/marks`
    );
    return response.data;
  },
  saveMarks: async (offeringId: string, instrumentId: string, rows: ObeMarkRowPayload[]) => {
    const response = await api.put(
      `/obe/offerings/${offeringId}/instruments/${instrumentId}/marks`,
      { rows }
    );
    return response.data;
  },
  /** Omit `commit` for a dry run; pass true to apply the rows. */
  importMarks: async (offeringId: string, instrumentId: string, csv: string, commit = false) => {
    const response = await api.post(
      `/obe/offerings/${offeringId}/instruments/${instrumentId}/marks/import`,
      { csv },
      { params: commit ? { commit: 'true' } : undefined }
    );
    return response.data;
  },

  // Attainment
  computeAttainment: async (offeringId: string, force = false) => {
    const response = await api.post(
      `/obe/offerings/${offeringId}/compute`,
      {},
      { params: force ? { force: 'true' } : undefined }
    );
    return response.data;
  },
  getAttainment: async (offeringId: string) => {
    const response = await api.get(`/obe/offerings/${offeringId}/attainment`);
    return response.data;
  },
  updateCoCorrectiveActions: async (
    offeringId: string,
    actions: Array<{ coId: string; text: string }>
  ) => {
    const response = await api.put(`/obe/offerings/${offeringId}/corrective-actions`, { actions });
    return response.data;
  },
  finalizeOffering: async (offeringId: string) => {
    const response = await api.post(`/obe/offerings/${offeringId}/finalize`);
    return response.data;
  },
  reopenOffering: async (offeringId: string) => {
    const response = await api.post(`/obe/offerings/${offeringId}/reopen`);
    return response.data;
  },

  // Surveys
  openSurvey: async (offeringId: string) => {
    const response = await api.post(`/obe/offerings/${offeringId}/survey/open`);
    return response.data;
  },
  closeSurvey: async (offeringId: string) => {
    const response = await api.post(`/obe/offerings/${offeringId}/survey/close`);
    return response.data;
  },
  getSurveyResults: async (offeringId: string) => {
    const response = await api.get(`/obe/offerings/${offeringId}/survey/results`);
    return response.data;
  },
  getMySurveys: async () => {
    const response = await api.get('/obe/surveys/my');
    return response.data;
  },
  respondToSurvey: async (offeringId: string, ratings: Array<{ coId: string; rating: number }>) => {
    const response = await api.post(`/obe/surveys/${offeringId}/respond`, { ratings });
    return response.data;
  },

  // Reports
  getProgramAttainment: async (
    programId: string,
    params: { academicBatchId?: string; termId?: string }
  ) => {
    const response = await api.get(`/obe/programs/${programId}/attainment`, { params });
    return response.data;
  },
  updateProgramCorrectiveActions: async (
    programId: string,
    data: { academicBatchId: string; actions: Array<{ poId: string; text: string }> }
  ) => {
    const response = await api.put(`/obe/programs/${programId}/corrective-actions`, data);
    return response.data;
  },
  exportOfferingReport: async (offeringId: string) => {
    const response = await api.get(`/obe/offerings/${offeringId}/report/export`, {
      params: { format: 'csv' },
      responseType: 'blob',
    });
    return response.data as Blob;
  },
  exportProgramAttainment: async (programId: string, academicBatchId: string) => {
    const response = await api.get(`/obe/programs/${programId}/attainment/export`, {
      params: { academicBatchId },
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  // ── Accreditation documents ──
  // Without `format: 'pdf'` these return the document as JSON, which is what
  // the on-screen preview renders; with it, the printable file.
  getNbaCriterion3: async (programId: string, params?: { academicBatchId?: string }) => {
    const response = await api.get(`/obe/programs/${programId}/accreditation/nba`, { params });
    return response.data;
  },
  downloadNbaCriterion3: async (programId: string, params?: { academicBatchId?: string }) => {
    const response = await api.get(`/obe/programs/${programId}/accreditation/nba`, {
      params: { ...params, format: 'pdf' },
      responseType: 'blob',
    });
    return response.data as Blob;
  },
  getNaacMetrics: async (programId: string, params?: { academicBatchId?: string }) => {
    const response = await api.get(`/obe/programs/${programId}/accreditation/naac`, { params });
    return response.data;
  },
  downloadNaacMetrics: async (programId: string, params?: { academicBatchId?: string }) => {
    const response = await api.get(`/obe/programs/${programId}/accreditation/naac`, {
      params: { ...params, format: 'pdf' },
      responseType: 'blob',
    });
    return response.data as Blob;
  },
  getNirfDataPoints: async (params?: { academicBatchId?: string }) => {
    const response = await api.get('/obe/accreditation/nirf', { params });
    return response.data;
  },
};

export { api };
