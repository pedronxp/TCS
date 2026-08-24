import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  fetchCustomerEntryContext,
  fetchPortalAccessContext,
  safePortalDestination,
} from '@/lib/portal';
import { safeConsoleDestination } from '@/lib/routes';

const INTERNAL_ROLES = new Set(['owner', 'developer', 'support', 'auditor']);
const callbackSessions = new Map<string, Promise<Session>>();

export type AccountEntryKind =
  | 'internal'
  | 'individual'
  | 'organization'
  | 'onboarding'
  | 'restricted';

export interface AccountEntryResolution {
  kind: AccountEntryKind;
  destination: string;
  label: string;
}

interface AccountEntryInput {
  userId: string;
  internalProfile: unknown | null;
  accountKind?: 'individual' | 'organization' | 'internal' | null;
  membershipStatus?: string | null;
  lifecycleState?: string | null;
  returnTo?: string | null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function buildAuthCallbackUrl(
  source: 'portal' | 'console',
  returnTo?: string | null,
): string {
  const url = new URL('/auth/callback', window.location.origin);
  url.searchParams.set('source', source);
  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
    url.searchParams.set('returnTo', returnTo);
  }
  return url.toString();
}

export function resolveAccountEntry(input: AccountEntryInput): AccountEntryResolution {
  const staff = object(input.internalProfile);
  const staffRole = typeof staff?.role === 'string' ? staff.role : null;
  const sameUser = staff?.user_id === input.userId;
  const validStaff = Boolean(staffRole && INTERNAL_ROLES.has(staffRole) && sameUser);

  if (validStaff && staff?.status === 'active') {
    const permissions = Array.isArray(staff.permissions) ? staff.permissions : [];
    if (permissions.includes('console.read')) {
      return {
        kind: 'internal',
        destination: safeConsoleDestination(input.returnTo),
        label: 'Console interno TCS',
      };
    }
    return {
      kind: 'restricted',
      destination: '/login?status=acesso-restrito',
      label: 'Acesso interno sem permissão',
    };
  }

  if (validStaff && staff?.status !== 'active') {
    return {
      kind: 'restricted',
      destination: '/login?status=acesso-restrito',
      label: 'Acesso interno indisponível',
    };
  }

  if (input.lifecycleState === 'blocked') {
    return {
      kind: 'restricted',
      destination: '/entrar?status=sem-acesso',
      label: 'Conta temporariamente indisponível',
    };
  }

  if (input.accountKind === 'organization') {
    if (input.membershipStatus !== 'active') {
      return {
        kind: 'restricted',
        destination: '/entrar?status=vinculo-inativo',
        label: 'Vínculo organizacional inativo',
      };
    }
    return {
      kind: 'organization',
      destination: safePortalDestination(input.returnTo, 'organization'),
      label: 'Portal da organização',
    };
  }

  if (input.accountKind === 'individual') {
    return {
      kind: 'individual',
      destination: safePortalDestination(input.returnTo, 'individual'),
      label: 'Portal profissional individual',
    };
  }

  return {
    kind: 'onboarding',
    destination: '/entrar',
    label: 'Escolha do tipo de conta',
  };
}

export async function fetchAuthenticatedInternalProfile(): Promise<unknown | null> {
  const result = await supabase.rpc('get_internal_staff_profile');
  return result.error ? null : result.data;
}

export async function resolveAuthenticatedAccountEntry(
  user: User,
  returnTo?: string | null,
): Promise<AccountEntryResolution> {
  const internalProfile = await fetchAuthenticatedInternalProfile();
  const internalResolution = resolveAccountEntry({ userId: user.id, internalProfile, returnTo });
  if (internalResolution.kind === 'internal' || internalResolution.kind === 'restricted') {
    return internalResolution;
  }

  if (user.identities?.some((identity) => identity.provider === 'google')) {
    const reconciliation = await supabase.rpc('reconcile_customer_identity');
    if (reconciliation.error) throw new Error('Não foi possível validar sua identidade Google.');
    void supabase.rpc('record_google_identity_reconciled');
  }

  const [access, entryContext] = await Promise.all([
    fetchPortalAccessContext(user),
    fetchCustomerEntryContext(),
  ]);

  return resolveAccountEntry({
    userId: user.id,
    internalProfile: null,
    accountKind: access?.accountKind ?? entryContext.accountKind,
    membershipStatus: access?.membershipStatus,
    lifecycleState: entryContext.lifecycleState,
    returnTo,
  });
}

export function resolveAuthCallbackSession(url: string): Promise<Session> {
  const callback = new URL(url);
  const callbackError = callback.searchParams.get('error_description')
    ?? callback.searchParams.get('error');
  if (callbackError) return Promise.reject(new Error(callbackError));

  const code = callback.searchParams.get('code');
  const key = code ? `code:${code}` : `session:${callback.origin}${callback.pathname}`;
  const current = callbackSessions.get(key);
  if (current) return current;

  const operation = (async () => {
    const existing = await supabase.auth.getSession();
    if (existing.data.session) return existing.data.session;
    if (existing.error) throw existing.error;
    if (!code) throw new Error('Sua sessão expirou. Entre novamente para continuar.');

    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error || !exchanged.data.session) {
      throw exchanged.error ?? new Error('Não foi possível concluir a autenticação.');
    }
    return exchanged.data.session;
  })();

  callbackSessions.set(key, operation);
  void operation.catch(() => callbackSessions.delete(key));
  return operation;
}
