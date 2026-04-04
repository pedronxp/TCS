import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
const LAST_ACTIVE_KEY = 'tcs_last_active_ts';

interface SessionGuardContextType {
  isLocked: boolean;
  unlock: () => void;
  recordActivity: () => void;
}

const SessionGuardContext = createContext<SessionGuardContextType>({
  isLocked: false,
  unlock: () => {},
  recordActivity: () => {},
});

export function SessionGuardProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const recordActivity = async () => {
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  };

  const checkTimeout = async () => {
    const raw = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return;
    const lastActive = parseInt(raw, 10);
    if (Date.now() - lastActive > TIMEOUT_MS) {
      setIsLocked(true);
    }
  };

  useEffect(() => {
    // Registrar atividade inicial
    recordActivity();

    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      // Voltou ao foreground após ficar em background/inactive
      if (prev.match(/inactive|background/) && next === 'active') {
        await checkTimeout();
      }
      // Saindo do app — registrar timestamp
      if (next.match(/inactive|background/)) {
        await recordActivity();
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, []);

  const unlock = () => {
    setIsLocked(false);
    recordActivity();
  };

  return (
    <SessionGuardContext.Provider value={{ isLocked, unlock, recordActivity }}>
      {children}
    </SessionGuardContext.Provider>
  );
}

export const useSessionGuard = () => useContext(SessionGuardContext);
