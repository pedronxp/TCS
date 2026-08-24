import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface BiometricAvailability {
  available: boolean;
  enrolled: boolean;
  label: string;
}

function preferenceKey(userId: string): string {
  return `tcs_biometric_${userId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Platform.OS === 'web') {
    return { available: false, enrolled: false, label: 'Biometria' };
  }

  try {
    const [hasHardware, enrolled, authenticationTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const facial = authenticationTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const fingerprint = authenticationTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

    return {
      available: hasHardware,
      enrolled,
      label: facial && Platform.OS === 'ios'
        ? 'Face ID'
        : facial && !fingerprint
          ? 'Reconhecimento facial'
          : fingerprint
            ? 'Digital'
            : 'Biometria',
    };
  } catch {
    return { available: false, enrolled: false, label: 'Biometria' };
  }
}

export async function getBiometricPreference(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await SecureStore.getItemAsync(preferenceKey(userId))) === 'enabled';
  } catch {
    return false;
  }
}

export async function setBiometricPreference(userId: string, enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (enabled) {
    await SecureStore.setItemAsync(preferenceKey(userId), 'enabled');
  } else {
    await SecureStore.deleteItemAsync(preferenceKey(userId));
  }
}

export async function authenticateWithBiometrics(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar código do aparelho',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'strong',
    });
    return result.success;
  } catch {
    return false;
  }
}
