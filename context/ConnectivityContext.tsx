import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Deve espelhar o fallback do cliente Supabase. Sem isso, builds sem .env
// tratavam qualquer Wi‑Fi como internet real e consumiam tentativas de sync.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vobcapzssxchdckazfnr.supabase.co';
const CHECK_TIMEOUT_MS = 8000;
const DEBOUNCE_MS = 2000;
const MAX_RETRIES = 2;

interface ConnectivityContextData {
  isConnected: boolean;   // interface de rede (NetInfo)
  isOnlineReal: boolean;  // acesso real à internet (HTTP ao Supabase)
  connectionType: string;
}

const ConnectivityContext = createContext<ConnectivityContextData>({
  isConnected: true,
  isOnlineReal: true,
  connectionType: 'unknown',
});

/**
 * Verifica se há acesso real à internet fazendo uma requisição HEAD ao Supabase.
 * Exportada para uso fora de hooks React (ex: SyncService).
 */
export async function checkRealInternet(): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      const response = await fetch(SUPABASE_URL, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.status < 600) return true;
    } catch {
      if (attempt === MAX_RETRIES) return false;
      // Espera 1s antes do retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isOnlineReal, setIsOnlineReal] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNetChange = useCallback((state: NetInfoState) => {
    const connected = state.isConnected ?? true;
    setIsConnected(connected);
    setConnectionType(state.type);

    // Debounce a verificação real para evitar flicker em trocas WiFi/4G
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const online = connected ? await checkRealInternet() : false;
      setIsOnlineReal(online);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    // Verificação inicial
    NetInfo.fetch().then(async (state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      setConnectionType(state.type);
      const online = connected ? await checkRealInternet() : false;
      setIsOnlineReal(online);
    });

    const unsubscribe = NetInfo.addEventListener(handleNetChange);

    return () => {
      unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [handleNetChange]);

  return (
    <ConnectivityContext.Provider value={{ isConnected, isOnlineReal, connectionType }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
