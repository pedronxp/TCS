import React, { useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../utils/supabase';
import { generateUUID } from '../utils/uuid';
import { useAuth } from '../context/AuthContext';
import { sessionRegistrationState, shouldTerminateAfterHeartbeat } from '../utils/sessionControl';

const DEVICE_ID_KEY = 'tcs_device_id_v1';
const HEARTBEAT_INTERVAL_MS = 60_000;

async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = generateUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

async function registerSession(replace = false) {
  const deviceId = await getDeviceId();
  return supabase.rpc('register_active_session', {
    p_device_id: deviceId,
    p_device_name: Device.deviceName || `${Device.brand || 'Dispositivo'} ${Device.modelName || ''}`.trim(),
    p_platform: Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'unknown',
    p_replace: replace,
  });
}

export function SessionLifecycle() {
  const { session, signOut, localTestMode } = useAuth();
  const conflictShown = useRef(false);

  useEffect(() => {
    if (!session || localTestMode) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const heartbeat = async () => {
      try {
        const { data, error } = await supabase.rpc('heartbeat_active_session');
        if (shouldTerminateAfterHeartbeat(data, !!error) && active) {
          Alert.alert('Sessão encerrada', 'Esta sessão foi encerrada remotamente. Entre novamente para continuar.', [
            { text: 'OK', onPress: () => signOut() },
          ], { cancelable: false });
        }
      } catch { /* offline: próxima janela tentará novamente */ }
    };
    registerSession(false).then(({ data, error }) => {
      if (!active || error) return; // Migration ainda não publicada: mantém compatibilidade.
      if (sessionRegistrationState(data) === 'conflict' && !conflictShown.current) {
        conflictShown.current = true;
        Alert.alert(
          'Sessão ativa em outro aparelho',
          data.device_name ? `Sua conta está ativa em ${data.device_name}.` : 'Sua conta já está ativa em outro aparelho.',
          [
            { text: 'Sair', style: 'cancel', onPress: () => signOut() },
            {
              text: 'Usar este aparelho',
              onPress: () => registerSession(true).then(({ data: replaced }) => {
                if (replaced?.allowed) conflictShown.current = false;
              }),
            },
          ],
          { cancelable: false },
        );
      }
    });

    timer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') heartbeat();
    });

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      appState.remove();
    };
  }, [session?.access_token, signOut, localTestMode]);

  return null;
}
