import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'master_admin' | 'admin' | 'supervisor' | 'agent';
  municipio: string;
  isApproved: boolean;
}

interface AuthContextData {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const queryPromise = supabase
      .from('users')
      .select('uid, name, email, role, municipio, isApproved')
      .eq('uid', userId)
      .single();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('fetchProfile timeout')), 10000)
    );

    const { data, error } = await Promise.race([queryPromise, timeout]);
    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout de segurança: garante que o loading nunca trava indefinidamente
    const safetyTimer = setTimeout(() => setLoading(false), 12000);

    // Restaurar sessão existente ao iniciar o app
    const getSessionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')), 8000)
    );

    Promise.race([supabase.auth.getSession(), getSessionTimeout])
      .then(async (result: any) => {
        if (result.error) {
          console.warn('Auth session error:', result.error.message);
          if (result.error.message?.includes('Refresh Token')) {
            await supabase.auth.signOut().catch(() => {});
          }
          return;
        }
        const session = result?.data?.session;
        if (session) {
          const userProfile = await fetchProfile(session.user.id);
          if (userProfile?.isApproved) {
            setSession(session);
            setProfile(userProfile);
          } else {
            // Conta não aprovada ou perfil não encontrado — deslogar silenciosamente
            await supabase.auth.signOut().catch(() => {});
          }
        }
      })
      .catch((err) => {
        console.warn('Auth init catch:', err);
        supabase.auth.signOut().catch(() => {});
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    // Ouvir mudanças de auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const userProfile = await fetchProfile(session.user.id);
          if (userProfile?.isApproved) {
            setSession(session);
            setProfile(userProfile);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Re-buscar perfil para detectar mudanças de isApproved/role em tempo real
          setSession(session);
          const userProfile = await fetchProfile(session.user.id);
          if (userProfile?.isApproved) {
            setProfile(userProfile);
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

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
