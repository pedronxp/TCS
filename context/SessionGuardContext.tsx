import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  authenticateWithBiometrics,
  getBiometricAvailability,
  getBiometricPreference,
  setBiometricPreference,
} from '../services/BiometricAuthService';

const TIMEOUT_MS = 8 * 60 * 60 * 1000;
const BIOMETRIC_TIMEOUT_MS = 30 * 1000;

interface SessionGuardContextType {
  isLocked: boolean;
  ready: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  recordActivity: () => Promise<void>;
}

const SessionGuardContext = createContext<SessionGuardContextType>({
  isLocked: false,
  ready: false,
  biometricAvailable: false,
  biometricEnabled: false,
  biometricLabel: 'Biometria',
  unlock: async () => false,
  setBiometricEnabled: async () => false,
  recordActivity: async () => {},
});

export function SessionGuardProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometria');
  const appStateRef = useRef(AppState.currentState);
  const userId = profile?.uid ?? null;
  const activityKey = userId ? `tcs_last_active_${userId}` : null;

  const recordActivity = useCallback(async () => {
    if (!activityKey) return;
    try {
      await AsyncStorage.setItem(activityKey, Date.now().toString());
    } catch {
      // Falha local não deve interromper a sessão autenticada.
    }
  }, [activityKey]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    if (!userId) {
      setIsLocked(false);
      setBiometricEnabledState(false);
      setReady(true);
      return;
    }

    Promise.all([getBiometricAvailability(), getBiometricPreference(userId)])
      .then(([availability, enabled]) => {
        if (cancelled) return;
        const canAuthenticate = availability.available && availability.enrolled;
        setBiometricAvailable(canAuthenticate);
        setBiometricLabel(availability.label);
        setBiometricEnabledState(enabled && canAuthenticate);
        // Uma biometria removida ou indisponível nunca pode abrir uma sessão
        // anteriormente protegida: nesse caso, exigimos um novo login.
        setIsLocked(enabled);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const checkTimeout = useCallback(async () => {
    if (!activityKey) return;
    try {
      const raw = await AsyncStorage.getItem(activityKey);
      if (!raw) return;
      const lastActive = Number.parseInt(raw, 10);
      const timeout = biometricEnabled ? BIOMETRIC_TIMEOUT_MS : TIMEOUT_MS;
      if (Date.now() - lastActive > timeout) {
        setIsLocked(true);
      }
    } catch {
      // Sem leitura de cache, mantém a sessão atual.
    }
  }, [activityKey, biometricEnabled]);

  useEffect(() => {
    if (!ready) return;
    if (!isLocked) recordActivity().catch(() => null);

    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      if (prev.match(/inactive|background/) && next === 'active') {
        await checkTimeout();
      }
      if (next.match(/inactive|background/)) {
        await recordActivity();
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, [checkTimeout, isLocked, ready, recordActivity]);

  const unlock = useCallback(async () => {
    if (!biometricEnabled || !biometricAvailable) return false;
    const authenticated = await authenticateWithBiometrics('Confirme sua identidade para acessar o TCS');
    if (!authenticated) return false;
    setIsLocked(false);
    await recordActivity();
    return true;
  }, [biometricAvailable, biometricEnabled, recordActivity]);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (!userId) return false;
    if (enabled) {
      const availability = await getBiometricAvailability();
      if (!availability.available || !availability.enrolled) return false;
      const authenticated = await authenticateWithBiometrics('Confirme sua identidade para ativar o acesso protegido');
      if (!authenticated) return false;
      setBiometricAvailable(true);
      setBiometricLabel(availability.label);
    }
    await setBiometricPreference(userId, enabled);
    setBiometricEnabledState(enabled);
    if (!enabled) setIsLocked(false);
    await recordActivity();
    return true;
  }, [recordActivity, userId]);

  return (
    <SessionGuardContext.Provider value={{
      isLocked,
      ready,
      biometricAvailable,
      biometricEnabled,
      biometricLabel,
      unlock,
      setBiometricEnabled,
      recordActivity,
    }}>
      {children}
    </SessionGuardContext.Provider>
  );
}

export const useSessionGuard = () => useContext(SessionGuardContext);
