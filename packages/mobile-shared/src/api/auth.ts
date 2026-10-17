import { apiClient, fetchApi, getApiErrorMessage } from './client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  roleCode: string;
  roleName: string;
  tenantId: string;
  branches: Array<{
    branchId: string;
    branchName: string;
    isDefault: boolean;
  }>;
  accessScope: {
    type: 'all' | 'branch' | 'department';
    branches?: string[];
    departments?: string[];
  };
  profileImage?: string;
  phone?: string;
  studentId?: string;
  parentInfo?: {
    children: Array<{
      studentId: string;
      studentName: string;
      classId: string;
      className: string;
      sectionId: string;
      sectionName: string;
      rollNumber?: string;
      profileImage?: string;
    }>;
  };
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      return await fetchApi(apiClient.post('/auth/login', credentials));
    } catch (error) {
      // Surface the backend's reason (e.g. "Invalid credentials", "Account is
      // inactive") instead of a generic/misleading Axios message.
      throw new Error(getApiErrorMessage(error, 'Invalid email or password. Please try again.'));
    }
  },

  getMe: async (): Promise<UserProfile> => {
    return fetchApi(apiClient.get('/auth/me'));
  },

  refresh: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post(
      '/auth/refresh',
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }
    );
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> => {
    await apiClient.post('/auth/change-password', data);
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },

  resetPassword: async (data: { token: string; newPassword: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password', data);
  },

  // Register push notification token
  registerPushToken: async (token: string, platform: 'ios' | 'android'): Promise<void> => {
    await apiClient.post('/auth/push-token', { token, platform });
  },
};
