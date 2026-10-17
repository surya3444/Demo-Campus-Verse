import { useState, useEffect, useCallback } from 'react';
import { biometricService, BiometricType } from '../services/biometricService';
import { secureStorage } from '../services/secureStorage';

interface UseBiometricsReturn {
  isAvailable: boolean;
  isEnabled: boolean;
  biometricType: BiometricType;
  isLoading: boolean;
  authenticate: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
}

export function useBiometrics(): UseBiometricsReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const available = await biometricService.isAvailable();
        setIsAvailable(available);

        if (available) {
          const type = await biometricService.getBiometricType();
          setBiometricType(type);

          const enabled = await secureStorage.isBiometricEnabled();
          setIsEnabled(enabled);
        }
      } catch (error) {
        console.error('Error checking biometrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkBiometrics();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;

    const promptMessage =
      biometricType === 'facial'
        ? 'Login with Face ID'
        : biometricType === 'fingerprint'
          ? 'Login with Fingerprint'
          : 'Authenticate to login';

    const result = await biometricService.authenticate(promptMessage);
    return result.success;
  }, [isAvailable, biometricType]);

  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;

    // First, verify biometric authentication
    const authenticated = await authenticate();
    if (!authenticated) return false;

    // Enable biometrics
    await secureStorage.setBiometricEnabled(true);
    setIsEnabled(true);
    return true;
  }, [isAvailable, authenticate]);

  const disableBiometrics = useCallback(async (): Promise<void> => {
    await secureStorage.setBiometricEnabled(false);
    setIsEnabled(false);
  }, []);

  return {
    isAvailable,
    isEnabled,
    biometricType,
    isLoading,
    authenticate,
    enableBiometrics,
    disableBiometrics,
  };
}

/**
 * Get a human-readable label for the biometric type
 */
export function getBiometricLabel(type: BiometricType): string {
  switch (type) {
    case 'facial':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris Scanner';
    default:
      return 'Biometrics';
  }
}
