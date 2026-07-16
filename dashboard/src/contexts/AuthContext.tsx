import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { jsonArray, jsonObject, jsonString } from '@/lib/json';
import type {
  AssuranceLevel,
  InternalPermission,
  InternalRole,
  InternalStaffProfile,
  StaffStatus,
} from '@/types/internal';
import type { Json } from '@/types/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: InternalStaffProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAssurance: () => Promise<AssuranceLevel>;
  can: (permission: InternalPermission) => boolean;
  isAuthorized: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const internalPermissions = new Set<string>([
  'console.read', 'dashboard.executive.read', 'dashboard.technical.read',
  'customer.read', 'customer.sensitive.read', 'customer.sensitive.request', 'customer.write',
  'commercial.read', 'commercial.write', 'support.read', 'support.write',
  'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
  'technical.read', 'technical.write', 'build.request', 'build.approve',
  'configuration.prepare', 'configuration.publish',
]);

function isInternalRole(value: string | null): value is InternalRole {
  return value === 'owner' || value === 'developer';
}

function isStaffStatus(value: string | null): value is StaffStatus {
  return value === 'active' || value === 'suspended' || value === 'removed';
}

function isAssuranceLevel(value: string | null): value is AssuranceLevel {
  return value === 'aal1' || value === 'aal2';
}

function isInternalPermission(value: Json): value is InternalPermission {
  return typeof value === 'string' && internalPermissions.has(value);
}

function parseProfile(data: Json | null): InternalStaffProfile | null {
  const record = jsonObject(data);
  if (!record) return null;
  const id = jsonString(record.id);
  const userId = jsonString(record.user_id);
  const role = jsonString(record.role);
  const status = jsonString(record.status);
  const assuranceLevel = jsonString(record.assurance_level);
  if (!id || !userId || !isInternalRole(role) || !isStaffStatus(status) || !isAssuranceLevel(assuranceLevel)) {
    return null;
  }
  return {
    id,
    userId,
    displayName: jsonString(record.display_name)?.trim() || 'Equipe interna',
    role,
    status,
    permissions: jsonArray(record.permissions).filter(isInternalPermission),
    assuranceLevel,
    uid: userId,
    municipio: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<InternalStaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (): Promise<InternalStaffProfile | null> => {
    const { data, error } = await supabase.rpc('get_internal_staff_profile');
    if (error || !data) return null;
    return parseProfile(data);
  }, []);

  const refreshAssurance = useCallback(async (): Promise<AssuranceLevel> => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    const level = (data.currentLevel ?? 'aal1') as AssuranceLevel;
    setProfile((current) => current ? { ...current, assuranceLevel: level } : current);
    return level;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrate(nextSession: Session | null) {
      if (!mounted) return;
      setSession(nextSession);
      const nextProfile = nextSession ? await loadProfile() : null;
      if (!mounted) return;
      setProfile(nextProfile);
      setLoading(false);
    }

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void hydrate(nextSession), 0);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: traduzirErroSupabase(error.message) };

    const nextProfile = data.user ? await loadProfile() : null;
    if (!nextProfile) {
      await supabase.rpc('record_internal_access_denied', {
        p_action: 'console.login',
        p_target_type: 'internal_console',
        p_target_id: data.user?.id ?? null,
        p_reason: 'active_internal_staff_required',
      });
      await supabase.auth.signOut();
      return { error: 'Acesso restrito à equipe interna ativa.' };
    }
    setSession(data.session);
    setProfile(nextProfile);
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  const permissions = useMemo(() => new Set(profile?.permissions ?? []), [profile?.permissions]);
  const can = useCallback(
    (permission: InternalPermission) => permissions.has(permission),
    [permissions],
  );
  const isAuthorized = Boolean(session && profile?.status === 'active' && can('console.read'));

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signOut,
      refreshAssurance,
      can,
      isAuthorized,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook and provider intentionally share the context definition in this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

function traduzirErroSupabase(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado.';
  return message;
}
