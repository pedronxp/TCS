import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import {
  buildInternalStaffAppProfile,
  type InternalMobileRole,
  type InternalStaffProfilePayload,
} from '../services/AppProfileService';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'master_admin' | 'admin' | 'supervisor' | 'agent' | InternalMobileRole;
  municipio: string;
  isApproved: boolean;
  createdAt?: string;
  nameChanged?: boolean;
  phone?: string | null;
  organizationId?: string | null;
  accountKind?: 'individual' | 'organization' | 'internal';
  permissions?: string[];
  tokenLimit?: number | null;
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

async function fetchProfile(_userId: string): Promise<FetchProfileResult> {
  try {
    const queryPromise = supabase.rpc('get_my_user_profile');

    const timeoutPromise = new Promise<'timeout'>(resolve =>
      setTimeout(() => resolve('timeout'), 10000)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (result === 'timeout') return 'timeout';

    const { data, error } = result;
    if (error || !data) return null;
    const profile = data as UserProfile;
    return {
      ...profile,
      accountKind: profile.organizationId ? 'organization' : 'individual',
    };
  } catch {
    return 'timeout';
  }
}

async function fetchAuthorizedProfile(session: Session): Promise<FetchProfileResult> {
  const fetchInternalProfile = async (): Promise<FetchProfileResult> => {
    try {
      const queryPromise = supabase.rpc('get_internal_staff_profile');
      const timeoutPromise = new Promise<'timeout'>(resolve =>
        setTimeout(() => resolve('timeout'), 10000)
      );
      const result = await Promise.race([queryPromise, timeoutPromise]);
      if (result === 'timeout') return 'timeout';

      const { data, error } = result;
      if (error) return null;
      return buildInternalStaffAppProfile(
        session,
        data as InternalStaffProfilePayload | null,
      );
    } catch {
      return null;
    }
  };

  const [legacyProfile, internalProfile] = await Promise.all([
    fetchProfile(session.user.id),
    fetchInternalProfile(),
  ]);

  // Staff ativo pode coexistir com um cadastro legado em public.users.
  // A identidade interna sempre prevalece para impedir perfil incorreto
  // e desbloquear developer/support com cadastro municipal neutro.
  if (internalProfile && internalProfile !== 'timeout') return internalProfile;
  if (legacyProfile && legacyProfile !== 'timeout') return legacyProfile;
  if (internalProfile === 'timeout' || legacyProfile === 'timeout') return 'timeout';
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const updateAutoRefresh = (state: string) => {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    };

    updateAutoRefresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateAutoRefresh);
    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let authRevision = 0;
    const isCurrent = (revision: number) => active && revision === authRevision;
    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, 14000);

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
        let sess = result?.data?.session as Session | null;
        if (!sess) return;

        const revision = authRevision;
        const profileResult = await fetchAuthorizedProfile(sess);
        if (!isCurrent(revision)) return;

        if (profileResult === 'timeout') {
          // Offline ou rede indisponível — tentar cache
          const cached = await loadProfileFromCache(sess.user.id);
          if (isCurrent(revision) && cached?.isApproved) {
            setSession(sess);
            setProfile(cached);
          }
          // Se sem cache, aguarda reconexão — não deslogar imediatamente
        } else if (profileResult) {
          setSession(sess);
          setProfile(profileResult);
          if (profileResult.isApproved) await saveProfileToCache(profileResult);
        } else {
          // Identidades OAuth novas permanecem autenticadas, porém neutras,
          // para concluir o bootstrap server-side. A reconciliação nunca aprova.
          try { await supabase.rpc('reconcile_customer_identity'); } catch { /* mantém sessão neutra */ }
          if (!isCurrent(revision)) return;
          const reconciled = await fetchProfile(sess.user.id);
          if (!isCurrent(revision)) return;
          setSession(sess);
          if (reconciled && reconciled !== 'timeout') setProfile(reconciled);
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
        if (active) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, sess) => {
        if (!active) return;
        if (event === 'SIGNED_OUT') {
          authRevision += 1;
          setSession(null);
          setProfile(null);
          AsyncStorage.removeItem('@sync_user_name').catch(() => {});
          return;
        }

        if ((event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED') || !sess) return;
        const revision = ++authRevision;

        // A documentação do Supabase alerta que aguardar chamadas da própria
        // API dentro do callback de auth pode travar as requisições seguintes.
        setTimeout(() => {
          if (!isCurrent(revision)) return;
          void (async () => {
            if (event === 'SIGNED_IN') {
              const profileResult = await fetchAuthorizedProfile(sess);
              if (!isCurrent(revision)) return;
              if (profileResult === 'timeout') {
                const cached = await loadProfileFromCache(sess.user.id);
                if (isCurrent(revision) && cached?.isApproved) {
                  setSession(sess);
                  setProfile(cached);
                }
              } else if (profileResult) {
                setSession(sess);
                setProfile(profileResult);
                if (profileResult.isApproved) await saveProfileToCache(profileResult);
              } else {
                try { await supabase.rpc('reconcile_customer_identity'); } catch { /* mantém sessão neutra */ }
                if (!isCurrent(revision)) return;
                const reconciled = await fetchProfile(sess.user.id);
                if (!isCurrent(revision)) return;
                setSession(sess);
                if (reconciled && reconciled !== 'timeout') setProfile(reconciled);
              }
              return;
            }

            setSession(sess);
            const profileResult = await fetchAuthorizedProfile(sess);
            if (!isCurrent(revision)) return;
            if (profileResult === 'timeout') {
              // Offline: manter perfil atual.
            } else if (profileResult) {
              setProfile(profileResult);
              if (profileResult.isApproved) await saveProfileToCache(profileResult);
            } else {
              setProfile(null);
            }
          })().catch(() => {
            // Uma indisponibilidade temporária não pode derrubar a sessão local.
          });
        }, 0);
      }
    );

    return () => {
      active = false;
      authRevision += 1;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const profileResult = await fetchAuthorizedProfile(currentSession);
    if (profileResult && profileResult !== 'timeout') {
      setProfile(profileResult);
      if (profileResult.isApproved) await saveProfileToCache(profileResult);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
