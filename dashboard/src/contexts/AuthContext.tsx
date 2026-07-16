import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'master_admin' | 'admin' | 'supervisor' | 'agent';

export interface AdminProfile {
  uid: string;
  name: string;
  role: UserRole;
  municipio: string | null;
  isApproved: boolean;
  isOwner: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAuthorized: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string): Promise<AdminProfile | null> {
    const [{ data, error }, { data: owner }] = await Promise.all([
      supabase.from('users').select('uid, name, role, municipio, isApproved').eq('uid', userId).maybeSingle(),
      supabase.from('owner_admins').select('user_id, active').eq('user_id', userId).eq('active', true).maybeSingle(),
    ]);

    if (error || !data) return null;
    return { ...data, isOwner: !!owner } as AdminProfile;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        const p = await loadProfile(data.session.user.id);
        if (mounted) setProfile(p);
      }
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        const p = await loadProfile(newSession.user.id);
        if (mounted) setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: traduzirErroSupabase(error.message) };

    const p = data.user ? await loadProfile(data.user.id) : null;
    if (!p) {
      await supabase.auth.signOut();
      return { error: 'Perfil não encontrado para este usuário.' };
    }
    if (p.role !== 'master_admin' || !p.isOwner) {
      try { await supabase.rpc('record_denied_owner_access'); } catch { /* registro best-effort */ }
      await supabase.auth.signOut();
      return { error: 'Acesso restrito aos proprietários autorizados. Use o app móvel.' };
    }
    if (!p.isApproved) {
      await supabase.auth.signOut();
      return { error: 'Conta pendente de aprovação.' };
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  const isAuthorized =
    !!session && !!profile && profile.role === 'master_admin' && profile.isOwner && profile.isApproved;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signOut,
        isAuthorized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

function traduzirErroSupabase(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'E-mail ainda não confirmado.';
  return msg;
}
