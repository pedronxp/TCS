import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID } from '../utils/uuid';
import { enterTrainingClass, leaveTrainingClass, TrainingEntryResult, TRAINING_ALLOWED_FORMS } from '../services/TrainingService';

const TRAINING_SESSION_KEY = '@training_session_v1';
const TRAINING_DEVICE_KEY = '@training_device_id_v1';

async function safeGetStorageItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSetStorageItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Treinamento continua em memoria se o AsyncStorage do iOS falhar.
  }
}

async function safeRemoveStorageItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // A saida local nao pode gerar LogBox por falha de cache.
  }
}

export interface TrainingSession {
  mode: 'training';
  classId: string;
  className: string;
  token: string;
  participantId: string;
  participantName: string;
  participantCount: number;
  participantLimit: number;
  startsAt: string;
  endsAt: string;
  allowedForms: string[];
  deviceId: string;
  createdAt: string;
}

interface TrainingContextData {
  session: TrainingSession | null;
  loading: boolean;
  deviceId: string | null;
  isTrainingActive: boolean;
  trainingProfile: {
    uid: string;
    name: string;
    email: string;
    role: 'agent';
    municipio: string;
    isApproved: boolean;
  } | null;
  enter: (input: { nome: string; token: string }) => Promise<TrainingEntryResult>;
  exit: () => Promise<void>;
  revalidate: () => Promise<boolean>;
  refreshFromStorage: () => Promise<void>;
  isExpired: () => boolean;
}

const TrainingContext = createContext<TrainingContextData>({
  session: null,
  loading: true,
  deviceId: null,
  isTrainingActive: false,
  trainingProfile: null,
  enter: async () => ({ ok: false, status: 'error' }),
  exit: async () => {},
  revalidate: async () => false,
  refreshFromStorage: async () => {},
  isExpired: () => true,
});

export function isTrainingSessionExpired(session: Pick<TrainingSession, 'endsAt'> | null | undefined): boolean {
  if (!session?.endsAt) return true;
  return Date.now() > new Date(session.endsAt).getTime();
}

async function getOrCreateTrainingDeviceId(): Promise<string> {
  const existing = await safeGetStorageItem(TRAINING_DEVICE_KEY);
  if (existing) return existing;
  const id = generateUUID();
  await safeSetStorageItem(TRAINING_DEVICE_KEY, id);
  return id;
}

function resultToSession(result: TrainingEntryResult, deviceId: string): TrainingSession {
  if (!result.ok || !result.classId || !result.className || !result.participantId || !result.participantName || !result.endsAt || !result.startsAt) {
    throw new Error('Resposta de treinamento incompleta.');
  }
  return {
    mode: 'training',
    classId: result.classId,
    className: result.className,
    token: result.token || '',
    participantId: result.participantId,
    participantName: result.participantName,
    participantCount: result.participantCount || 0,
    participantLimit: result.participantLimit || 0,
    startsAt: result.startsAt,
    endsAt: result.endsAt,
    allowedForms: result.allowedForms?.length ? result.allowedForms : [...TRAINING_ALLOWED_FORMS],
    deviceId,
    createdAt: new Date().toISOString(),
  };
}

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<TrainingSession | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  const isExpired = useCallback(() => {
    return isTrainingSessionExpired(sessionRef.current);
  }, []);

  const clearSession = useCallback(async () => {
    await safeRemoveStorageItem(TRAINING_SESSION_KEY);
    sessionRef.current = null;
    setSession(null);
  }, []);

  const refreshFromStorage = useCallback(async () => {
    const id = await getOrCreateTrainingDeviceId();
    deviceIdRef.current = id;
    setDeviceId(id);
    const raw = await safeGetStorageItem(TRAINING_SESSION_KEY);
    if (!raw) {
      sessionRef.current = null;
      setSession(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as TrainingSession;
      if (isTrainingSessionExpired(parsed)) {
        await clearSession();
      } else {
        sessionRef.current = parsed;
        setSession(parsed);
      }
    } catch {
      await clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    refreshFromStorage().catch(() => null).finally(() => setLoading(false));
  }, [refreshFromStorage]);

  const enter = useCallback(async (input: { nome: string; token: string }) => {
    const id = deviceIdRef.current || await getOrCreateTrainingDeviceId();
    deviceIdRef.current = id;
    setDeviceId(id);
    const result = await enterTrainingClass({ nome: input.nome, token: input.token, deviceId: id });
    if (result.ok) {
      const next = resultToSession({ ...result, token: result.token || input.token.trim().toUpperCase() }, id);
      await safeSetStorageItem(TRAINING_SESSION_KEY, JSON.stringify(next));
      sessionRef.current = next;
      setSession(next);
    }
    return result;
  }, []);

  const exit = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (activeSession?.classId && activeSession.deviceId) {
      try {
        await leaveTrainingClass({ classId: activeSession.classId, deviceId: activeSession.deviceId });
      } catch {
        // A saida local nao pode ficar presa se a rede falhar.
      }
    }
    await clearSession();
  }, [clearSession]);

  const revalidate = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) return false;
    if (isTrainingSessionExpired(activeSession)) {
      await clearSession();
      return false;
    }

    try {
      const currentDeviceId = activeSession.deviceId || deviceIdRef.current || await getOrCreateTrainingDeviceId();
      deviceIdRef.current = currentDeviceId;
      const result = await enterTrainingClass({
        nome: activeSession.participantName,
        token: activeSession.token,
        deviceId: currentDeviceId,
      });

      if (result.ok) {
        const next = {
          ...resultToSession({ ...result, token: result.token || activeSession.token }, currentDeviceId),
          createdAt: activeSession.createdAt,
        };
        const currentRaw = JSON.stringify(activeSession);
        const nextRaw = JSON.stringify(next);
        if (nextRaw !== currentRaw) {
          await safeSetStorageItem(TRAINING_SESSION_KEY, nextRaw);
          sessionRef.current = next;
          setSession(next);
        }
        return true;
      }

      if (['invalid_token', 'not_started', 'expired', 'ended'].includes(result.status || '')) {
        await clearSession();
        return false;
      }

      return true;
    } catch {
      return true;
    }
  }, [clearSession]);

  useEffect(() => {
    if (!session?.endsAt) return;
    const msUntilExpiration = new Date(session.endsAt).getTime() - Date.now();
    if (msUntilExpiration <= 0) {
      void clearSession();
      return;
    }
    const timer = setTimeout(() => {
      void clearSession();
    }, Math.min(msUntilExpiration, 2147483647));
    return () => clearTimeout(timer);
  }, [clearSession, session?.endsAt]);

  useEffect(() => {
    if (!session?.participantId || isTrainingSessionExpired(session)) return;
    const timer = setInterval(() => {
      revalidate().catch(() => null);
    }, 60_000);
    return () => clearInterval(timer);
  }, [revalidate, session?.participantId, session?.endsAt]);

  const trainingProfile = useMemo(() => {
    if (!session || isTrainingSessionExpired(session)) return null;
    return {
      uid: `training:${session.participantId}`,
      name: session.participantName,
      email: '',
      role: 'agent' as const,
      municipio: 'Treinamento',
      isApproved: true,
    };
  }, [session]);

  return (
    <TrainingContext.Provider value={{
      session,
      loading,
      deviceId,
      isTrainingActive: !!trainingProfile,
      trainingProfile,
      enter,
      exit,
      revalidate,
      refreshFromStorage,
      isExpired,
    }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  return useContext(TrainingContext);
}
