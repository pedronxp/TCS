import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ensureIndividualPortalProfile, fetchPortalAccessContext } from '@/lib/portal';
import type { PortalAccessContext, PortalPermission } from '@/types/portal';

interface PortalAuthValue {
  session: Session | null;
  user: User | null;
  access: PortalAccessContext | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string, selectedPlanCode?: string | null) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  can: (permission: PortalPermission) => boolean;
}

const PortalAuthContext = createContext<PortalAuthValue | undefined>(undefined);

function translateAuthError(message: string) {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de continuar.';
  if (message.includes('already registered')) return 'Este e-mail já possui uma conta.';
  return message;
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<PortalAccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) {
      setAccess(null);
      setLoading(false);
      return;
    }
    try {
      let nextAccess = await fetchPortalAccessContext(nextSession.user);
      if (!nextAccess) {
        await ensureIndividualPortalProfile();
        nextAccess = await fetchPortalAccessContext(nextSession.user);
      }
      setAccess(nextAccess);
      if (nextAccess) {
        const deviceId = portalDeviceId();
        await supabase.rpc('register_active_session', {
          p_device_id: deviceId,
          p_device_name: navigator.platform || 'Navegador web',
          p_platform: 'web',
          p_replace: false,
        });
      }
      setError(null);
    } catch (cause) {
      setAccess(null);
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar seu acesso.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) void hydrate(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (mounted) void hydrate(nextSession);
      }, 0);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [hydrate]);

  const refreshAccess = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    await hydrate(session);
  }, [hydrate, session]);

  async function signIn(email: string, password: string) {
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return translateAuthError(result.error.message);
    await hydrate(result.data.session);
    return null;
  }

  async function signUp(name: string, email: string, password: string, selectedPlanCode?: string | null) {
    setError(null);
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
          role: 'agent',
          account_kind: 'individual',
          selected_plan_code: selectedPlanCode?.match(/^individual_[a-z0-9_]+$/) ? selectedPlanCode : null,
        },
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    });
    return result.error ? translateAuthError(result.error.message) : null;
  }

  async function signInWithGoogle() {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/entrar` },
    });
    return oauthError ? translateAuthError(oauthError.message) : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setAccess(null);
  }

  const permissionSet = useMemo(() => new Set(access?.permissions ?? []), [access?.permissions]);
  const can = useCallback((permission: PortalPermission) => permissionSet.has(permission), [permissionSet]);

  return (
    <PortalAuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      access,
      loading,
      error,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshAccess,
      can,
    }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

function portalDeviceId() {
  const key = 'tcs-portal-device-id';
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortalAuth() {
  const value = useContext(PortalAuthContext);
  if (!value) throw new Error('usePortalAuth deve ser usado dentro de PortalAuthProvider');
  return value;
}
