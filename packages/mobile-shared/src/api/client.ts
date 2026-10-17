import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';

// API URL - will be configured via environment
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
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

// Decode JWT payload without verification (just base64 decode)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// Request interceptor - add auth headers
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const accessToken = await secureStorage.getAccessToken();
    let branchId = await secureStorage.getBranchId();

    // Fallback 1: read from auth store state
    if (!branchId) {
      const storeBranchId = useAuthStore.getState().selectedBranchId;
      if (storeBranchId) {
        branchId = storeBranchId;
      }
    }

    // Fallback 2: extract from JWT accessScope.branchIds
    if (!branchId && accessToken) {
      const payload = decodeJwtPayload(accessToken);
      const branchIds = (payload?.accessScope as { branchIds?: string[] })?.branchIds;
      if (branchIds && branchIds.length > 0) {
        branchId = branchIds[0];
      }
    }

    // Persist for future requests if we found it from a fallback
    if (branchId) {
      const stored = await secureStorage.getBranchId();
      if (!stored) {
        await secureStorage.setBranchId(branchId);
      }
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (branchId) {
      config.headers['X-Branch-Id'] = branchId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't retry if it's the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // A 401 from these endpoints is a credential/validation error (bad
    // password, inactive account, expired reset link) — NOT an expired access
    // token. Don't run the token-refresh path; let the real error surface.
    const isPreAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/forgot-password') ||
      originalRequest.url?.includes('/auth/reset-password');

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry && !isPreAuthEndpoint) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await secureStorage.getRefreshToken();

        if (!refreshToken) {
          // Nothing to refresh with (e.g. session already cleared). Surface the
          // original 401 rather than a misleading "No refresh token" message.
          throw error;
        }

        // Call refresh endpoint with refresh token in body (mobile can't use httpOnly cookies)
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

        const { accessToken, refreshToken: rotatedRefreshToken } = response.data.data;

        // The backend rotates the refresh token on every refresh — persist the
        // rotated one or the session dies when the original token's 7-day exp
        // hits. Fall back to the old token if the server didn't send one.
        await secureStorage.setTokens(accessToken, rotatedRefreshToken || refreshToken);

        // Process queued requests
        processQueue(null, accessToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        processQueue(refreshError as Error, null);
        await secureStorage.clearAll();

        // The app will detect this and redirect to login
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// Helper to extract data from response
export async function fetchApi<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await request;
  return response.data.data;
}

// Pull a human-readable message out of an API/Axios error. Prefers the
// backend's `error.message` ({ success:false, error:{ code, message } }) and
// falls back to the Axios/network message, then a caller-supplied default.
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    return data?.error?.message || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export { apiClient, API_URL };
