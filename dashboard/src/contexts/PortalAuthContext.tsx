import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchCustomerEntryContext, fetchPortalAccessContext } from '@/lib/portal';
import type { PortalAccessContext, PortalCustomerEntryContext, PortalPermission } from '@/types/portal';

interface MunicipalBootstrapInput {
  displayName: string;
  municipalityName: string;
  stateCode: string;
  responsibleName: string;
}

interface PortalAuthValue {
  session: Session | null;
  user: User | null;
  access: PortalAccessContext | null;
  entryContext: PortalCustomerEntryContext | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string, selectedPlanCode?: string | null) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  linkGoogleIdentity: () => Promise<string | null>;
  bootstrapIndividual: () => Promise<string | null>;
  bootstrapMunicipal: (input: MunicipalBootstrapInput) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  can: (permission: PortalPermission) => boolean;
}

const PortalAuthContext = createContext<PortalAuthValue | undefined>(undefined);

function translateAuthError(message: string) {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de continuar.';
  if (message.includes('already registered')) return 'Este e-mail já possui uma conta.';
  if (message.includes('identity_already_exists') || message.includes('already linked')) return 'Esta conta Google já está vinculada a outro acesso.';
  if (message.includes('manual_linking_disabled')) return 'O vínculo Google ainda não foi habilitado neste ambiente.';
  return message;
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<PortalAccessContext | null>(null);
  const [entryContext, setEntryContext] = useState<PortalCustomerEntryContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) {
      setAccess(null);
      setEntryContext(null);
      setLoading(false);
      return;
    }
    try {
      if (nextSession.user.identities?.some((identity) => identity.provider === 'google')) {
        await supabase.rpc('reconcile_customer_identity');
        await supabase.rpc('record_google_identity_reconciled');
      }
      const [nextAccess, nextEntryContext] = await Promise.all([
        fetchPortalAccessContext(nextSession.user),
        fetchCustomerEntryContext(),
      ]);
      setAccess(nextAccess);
      setEntryContext(nextEntryContext);
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
      setEntryContext(null);
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
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        window.sessionStorage.setItem('tcs.portal.password-recovery', JSON.stringify({
          userId: nextSession.user.id,
          expiresAt: Date.now() + 20 * 60 * 1000,
        }));
      }
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
    void selectedPlanCode;
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    });
    return result.error ? translateAuthError(result.error.message) : null;
  }

  async function signInWithGoogle() {
    const capabilities = await supabase.rpc('get_public_auth_capabilities');
    const publicFlags = capabilities.data as { google_auth?: boolean } | null;
    if (capabilities.error || publicFlags?.google_auth !== true) {
      return 'O login Google ainda não está disponível para clientes.';
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/entrar` },
    });
    return oauthError ? translateAuthError(oauthError.message) : null;
  }

  async function linkGoogleIdentity() {
    if (!session) return 'Entre novamente antes de vincular o Google.';
    if (!session.user.email_confirmed_at) return 'Confirme seu e-mail antes de vincular o Google.';
    if (session.user.identities?.some((identity) => identity.provider === 'google')) return null;
    const capabilities = await supabase.rpc('get_public_auth_capabilities');
    const publicFlags = capabilities.data as { google_auth?: boolean } | null;
    if (capabilities.error || publicFlags?.google_auth !== true) return 'O vínculo Google está temporariamente indisponível.';
    const result = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/portal/${access?.accountKind === 'organization' ? 'municipal' : 'individual'}/perfil`,
      },
    });
    return result.error ? translateAuthError(result.error.message) : null;
  }

  async function bootstrapIndividual() {
    if (!session) return 'Sessão autenticada obrigatória.';
    const result = await supabase.rpc('bootstrap_individual_customer', {
      p_idempotency_key: `portal-individual-${session.user.id}`,
      p_terms_version: 'customer-terms-2026-08',
    });
    if (result.error) {
      if (result.error.message.includes('individual_bootstrap_disabled')) {
        return 'O cadastro individual autônomo ainda não está aberto.';
      }
      return 'Não foi possível concluir o acesso individual.';
    }
    await hydrate(session);
    return null;
  }

  async function bootstrapMunicipal(input: MunicipalBootstrapInput) {
    if (!session) return 'Sessão autenticada obrigatória.';
    const result = await supabase.rpc('bootstrap_municipal_customer', {
      p_idempotency_key: `portal-municipal-${session.user.id}`,
      p_payload: {
        display_name: input.displayName.trim(),
        municipality_name: input.municipalityName.trim(),
        state_code: input.stateCode.trim().toUpperCase(),
        responsible_name: input.responsibleName.trim(),
        terms_version: 'customer-terms-2026-08',
      },
    });
    if (result.error) {
      if (result.error.message.includes('municipality_onboarding_exists')) {
        return 'Este município já possui implantação. Entre por convite do administrador existente.';
      }
      if (result.error.message.includes('municipal_bootstrap_disabled')) {
        return 'O cadastro municipal autônomo ainda não está aberto.';
      }
      return 'Não foi possível iniciar a implantação municipal.';
    }
    await hydrate(session);
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setAccess(null);
    setEntryContext(null);
  }

  const permissionSet = useMemo(() => new Set(access?.permissions ?? []), [access?.permissions]);
  const can = useCallback((permission: PortalPermission) => permissionSet.has(permission), [permissionSet]);

  return (
    <PortalAuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      access,
      entryContext,
      loading,
      error,
      signIn,
      signUp,
      signInWithGoogle,
      linkGoogleIdentity,
      bootstrapIndividual,
      bootstrapMunicipal,
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
