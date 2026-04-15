import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import {
  OFFLINE_ACCESS_STORAGE_KEY,
  createOfflineAccessSnapshot,
  isOfflineAccessExpired,
  isOfflineAccessValid,
  parseOfflineAccessSnapshot,
} from '../utils/authOffline';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'master_admin' | 'admin' | 'supervisor' | 'agent';
  municipio: string;
  isApproved: boolean;
  createdAt?: string;
  nameChanged?: boolean;
  phone?: string | null;
}

interface AuthContextData {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isUsingOfflineAccess: boolean;
  offlineAccessExpired: boolean;
  offlineAccessExpiresAt: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({
  session: null,
  profile: null,
  loading: true,
  isUsingOfflineAccess: false,
  offlineAccessExpired: false,
  offlineAccessExpiresAt: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  retryAuthState: async () => {},
});

const PROFILE_CACHE_KEY = (uid: string) => `@profile_cache_${uid}`;

const NETWORK_ERROR_MARKERS = [
  'network request failed',
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'timeout',
  'timed out',
  'aborterror',
  'socket',
  'offline',
] as const;

type FetchProfileResult =
  | { kind: 'success'; profile: UserProfile }
  | { kind: 'offline' }
  | { kind: 'missing' };

async function saveProfileToCache(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY(profile.uid), JSON.stringify(profile));
    await AsyncStorage.setItem('@sync_user_name', profile.name);
  } catch {}
}

async function loadProfileFromCache(uid: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY(uid));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

async function saveOfflineAccessSnapshot(uid: string): Promise<string> {
  const snapshot = createOfflineAccessSnapshot(uid);
  await AsyncStorage.setItem(OFFLINE_ACCESS_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot.offlineUntil;
}

async function loadOfflineAccessSnapshot() {
  const raw = await AsyncStorage.getItem(OFFLINE_ACCESS_STORAGE_KEY);
  return parseOfflineAccessSnapshot(raw);
}

async function clearOfflineAccessSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_ACCESS_STORAGE_KEY);
}

function isNetworkLikeError(error: unknown): boolean {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  const message = rawMessage.toLowerCase();
  return NETWORK_ERROR_MARKERS.some(marker => message.includes(marker));
}

async function fetchProfile(userId: string): Promise<FetchProfileResult> {
  try {
    const queryPromise = supabase
      .from('users')
      .select('uid, name, email, role, municipio, isApproved, "createdAt", "nameChanged", phone')
      .eq('uid', userId)
      .single();

    const timeoutPromise = new Promise<'timeout'>(resolve =>
      setTimeout(() => resolve('timeout'), 10000)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (result === 'timeout') return { kind: 'offline' };

    const { data, error } = result;
    if (error) {
      return isNetworkLikeError(error) ? { kind: 'offline' } : { kind: 'missing' };
    }
    if (!data) return { kind: 'missing' };

    return { kind: 'success', profile: data as UserProfile };
  } catch (error) {
    return isNetworkLikeError(error) ? { kind: 'offline' } : { kind: 'missing' };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUsingOfflineAccess, setIsUsingOfflineAccess] = useState(false);
  const [offlineAccessExpired, setOfflineAccessExpired] = useState(false);
  const [offlineAccessExpiresAt, setOfflineAccessExpiresAt] = useState<string | null>(null);

  const clearRuntimeState = () => {
    setSession(null);
    setProfile(null);
    setIsUsingOfflineAccess(false);
  };

  const clearSessionHints = () => {
    AsyncStorage.removeItem('@sync_user_name').catch(() => {});
  };

  const markOfflineAccessExpired = (expiresAt: string | null) => {
    clearRuntimeState();
    setOfflineAccessExpired(true);
    setOfflineAccessExpiresAt(expiresAt);
  };

  const clearOfflineFlags = () => {
    setIsUsingOfflineAccess(false);
    setOfflineAccessExpired(false);
    setOfflineAccessExpiresAt(null);
  };

  const applyApprovedSession = async (sess: Session, nextProfile: UserProfile) => {
    const expiresAt = await saveOfflineAccessSnapshot(sess.user.id);

    setSession(sess);
    setProfile(nextProfile);
    setIsUsingOfflineAccess(false);
    setOfflineAccessExpired(false);
    setOfflineAccessExpiresAt(expiresAt);

    await saveProfileToCache(nextProfile);
  };

  const tryRestoreOfflineSession = async (sess: Session): Promise<'restored' | 'expired' | 'missing'> => {
    const [cachedProfile, snapshot] = await Promise.all([
      loadProfileFromCache(sess.user.id),
      loadOfflineAccessSnapshot(),
    ]);

    if (cachedProfile?.isApproved && isOfflineAccessValid(snapshot, sess.user.id)) {
      setSession(sess);
      setProfile(cachedProfile);
      setIsUsingOfflineAccess(true);
      setOfflineAccessExpired(false);
      setOfflineAccessExpiresAt(snapshot!.offlineUntil);
      return 'restored';
    }

    if (isOfflineAccessExpired(snapshot, sess.user.id)) {
      markOfflineAccessExpired(snapshot!.offlineUntil);
      return 'expired';
    }

    clearRuntimeState();
    setOfflineAccessExpired(false);
    setOfflineAccessExpiresAt(snapshot?.uid === sess.user.id ? snapshot.offlineUntil : null);
    return 'missing';
  };

  const forceSignOut = async () => {
    clearRuntimeState();
    clearOfflineFlags();
    await clearOfflineAccessSnapshot().catch(() => {});
    clearSessionHints();
    await supabase.auth.signOut().catch(() => {});
  };

  const resolveSession = async (sess: Session): Promise<void> => {
    const profileResult = await fetchProfile(sess.user.id);

    if (profileResult.kind === 'success') {
      if (!profileResult.profile.isApproved) {
        await forceSignOut();
        return;
      }

      await applyApprovedSession(sess, profileResult.profile);
      return;
    }

    if (profileResult.kind === 'offline') {
      await tryRestoreOfflineSession(sess);
      return;
    }

    await forceSignOut();
  };

  const initializeAuthState = async () => {
    const getSessionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')), 8000)
    );

    try {
      const result: any = await Promise.race([supabase.auth.getSession(), getSessionTimeout]);

      if (result.error) {
        const msg: string = result.error.message ?? '';
        if (msg.includes('Refresh Token') || msg.includes('refresh_token')) {
          await forceSignOut();
        } else {
          clearRuntimeState();
          setOfflineAccessExpired(false);
          setOfflineAccessExpiresAt(null);
        }
        return;
      }

      const sess = result?.data?.session;
      if (!sess) {
        clearRuntimeState();
        setOfflineAccessExpired(false);
        setOfflineAccessExpiresAt(null);
        return;
      }

      await resolveSession(sess);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Refresh Token') || msg.includes('refresh_token')) {
        await forceSignOut();
        return;
      }

      clearRuntimeState();
      setOfflineAccessExpired(false);
      setOfflineAccessExpiresAt(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 14000);

    initializeAuthState()
      .finally(() => {
        clearTimeout(safetyTimer);
        if (isMounted) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (event === 'SIGNED_IN' && sess) {
          await resolveSession(sess);
        } else if (event === 'SIGNED_OUT') {
          clearRuntimeState();
          clearOfflineFlags();
          clearSessionHints();
          clearOfflineAccessSnapshot().catch(() => {});
        } else if (event === 'TOKEN_REFRESHED' && sess) {
          const profileResult = await fetchProfile(sess.user.id);

          if (profileResult.kind === 'success') {
            if (!profileResult.profile.isApproved) {
              await forceSignOut();
              return;
            }

            await applyApprovedSession(sess, profileResult.profile);
          } else if (profileResult.kind === 'offline') {
            await tryRestoreOfflineSession(sess);
          } else {
            await forceSignOut();
          }
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await forceSignOut();
  };

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;

    const profileResult = await fetchProfile(currentSession.user.id);
    if (profileResult.kind === 'success' && profileResult.profile.isApproved) {
      await applyApprovedSession(currentSession, profileResult.profile);
    }
  };

  const retryAuthState = async () => {
    setLoading(true);
    try {
      await initializeAuthState();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isUsingOfflineAccess,
        offlineAccessExpired,
        offlineAccessExpiresAt,
        signOut,
        refreshProfile,
        retryAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
