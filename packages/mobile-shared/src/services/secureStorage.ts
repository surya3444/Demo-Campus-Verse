import { MMKV } from 'react-native-mmkv';

// Use MMKV for token storage (device-level encryption)
// SecureStore has a 2048 byte limit which is too small for JWT tokens with permissions
const storage = new MMKV({
  id: 'secure-storage',
  encryptionKey: 'campusverse-secure-key',
});

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  BRANCH_ID: 'branch_id',
  BIOMETRIC_ENABLED: 'biometric_enabled',
} as const;

export const secureStorage = {
  // Tokens
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    if (accessToken) storage.set(KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) storage.set(KEYS.REFRESH_TOKEN, refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return storage.getString(KEYS.ACCESS_TOKEN) ?? null;
  },

  async getRefreshToken(): Promise<string | null> {
    return storage.getString(KEYS.REFRESH_TOKEN) ?? null;
  },

  async clearTokens(): Promise<void> {
    storage.delete(KEYS.ACCESS_TOKEN);
    storage.delete(KEYS.REFRESH_TOKEN);
  },

  // User data
  async setUserData(userData: object): Promise<void> {
    storage.set(KEYS.USER_DATA, JSON.stringify(userData));
  },

  async getUserData<T>(): Promise<T | null> {
    const data = storage.getString(KEYS.USER_DATA);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  async clearUserData(): Promise<void> {
    storage.delete(KEYS.USER_DATA);
  },

  // Branch
  async setBranchId(branchId: string): Promise<void> {
    storage.set(KEYS.BRANCH_ID, branchId);
  },

  async getBranchId(): Promise<string | null> {
    return storage.getString(KEYS.BRANCH_ID) ?? null;
  },

  async clearBranchId(): Promise<void> {
    storage.delete(KEYS.BRANCH_ID);
  },

  // Biometric preference
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    storage.set(KEYS.BIOMETRIC_ENABLED, enabled);
  },

  async isBiometricEnabled(): Promise<boolean> {
    return storage.getBoolean(KEYS.BIOMETRIC_ENABLED) ?? false;
  },

  // Clear all
  async clearAll(): Promise<void> {
    storage.delete(KEYS.ACCESS_TOKEN);
    storage.delete(KEYS.REFRESH_TOKEN);
    storage.delete(KEYS.USER_DATA);
    storage.delete(KEYS.BRANCH_ID);
    storage.delete(KEYS.BIOMETRIC_ENABLED);
  },
};
