import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export const biometricService = {
  async isAvailable(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  },

  async getBiometricType(): Promise<BiometricType> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'facial';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'iris';
    }
    return 'none';
  },

  async authenticate(promptMessage?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to continue',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || 'Authentication failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error',
      };
    }
  },

  async getSecurityLevel(): Promise<'none' | 'secret' | 'biometric'> {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    switch (level) {
      case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
      case LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK:
        return 'biometric';
      case LocalAuthentication.SecurityLevel.SECRET:
        return 'secret';
      default:
        return 'none';
    }
  },
};
