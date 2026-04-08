import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

const PROFILE_CACHE_KEY = (uid: string) => `@profile_cache_${uid}`;

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

type FetchProfileResult = UserProfile | null | 'timeout';

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

    if (result === 'timeout') return 'timeout';

    const { data, error } = result;
    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return 'timeout';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safetyTimer = setTimeout(() => setLoading(false), 14000);

    const getSessionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')), 8000)
    );

    Promise.race([supabase.auth.getSession(), getSessionTimeout])
      .then(async (result: any) => {
        if (result.error) {
          const msg: string = result.error.message ?? '';
          if (msg.includes('Refresh Token') || msg.includes('refresh_token')) {
            // Token inválido — limpar sessão do SecureStore e redirecionar para login
            await supabase.auth.signOut().catch(() => {});
          }
          return;
        }
        const sess = result?.data?.session;
        if (!sess) return;

        const profileResult = await fetchProfile(sess.user.id);

        if (profileResult === 'timeout') {
          // Offline ou rede indisponível — tentar cache
          const cached = await loadProfileFromCache(sess.user.id);
          if (cached?.isApproved) {
            setSession(sess);
            setProfile(cached);
          }
          // Se sem cache, aguarda reconexão — não deslogar imediatamente
        } else if (profileResult?.isApproved) {
          setSession(sess);
          setProfile(profileResult);
          await saveProfileToCache(profileResult);
        } else {
          // Conta não aprovada ou não encontrada no banco
          await supabase.auth.signOut().catch(() => {});
        }
      })
      .catch(async (err) => {
        const msg: string = err?.message ?? String(err);
        if (msg.includes('Refresh Token') || msg.includes('refresh_token')) {
          // Token inválido/expirado — limpar sessão do SecureStore e redirecionar para login
          await supabase.auth.signOut().catch(() => {});
        }
        // Timeout de getSession sem token inválido — não deslogar (pode ser offline)
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (event === 'SIGNED_IN' && sess) {
          const profileResult = await fetchProfile(sess.user.id);
          if (profileResult === 'timeout') {
            const cached = await loadProfileFromCache(sess.user.id);
            if (cached?.isApproved) {
              setSession(sess);
              setProfile(cached);
            }
          } else if (profileResult?.isApproved) {
            setSession(sess);
            setProfile(profileResult);
            await saveProfileToCache(profileResult);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          AsyncStorage.removeItem('@sync_user_name').catch(() => {});
        } else if (event === 'TOKEN_REFRESHED' && sess) {
          setSession(sess);
          const profileResult = await fetchProfile(sess.user.id);
          if (profileResult === 'timeout') {
            // Offline: manter perfil atual
          } else if (profileResult?.isApproved) {
            setProfile(profileResult);
            await saveProfileToCache(profileResult);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
          }
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const profileResult = await fetchProfile(currentSession.user.id);
    if (profileResult && profileResult !== 'timeout' && profileResult.isApproved) {
      setProfile(profileResult);
      await saveProfileToCache(profileResult);
    }
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
