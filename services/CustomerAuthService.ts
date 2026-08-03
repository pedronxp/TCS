import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

WebBrowser.maybeCompleteAuthSession();

const RECOVERY_MARKER_KEY = 'tcs.password_recovery_session';
const RECOVERY_WINDOW_MS = 20 * 60 * 1000;
const callbackOperations = new Map<string, Promise<{ session: Session | null; recovery: boolean }>>();
const completedCallbacks = new Map<string, { session: Session | null; recovery: boolean }>();

export const CUSTOMER_AUTH_CALLBACK = Linking.createURL('auth/callback', {
  scheme: 'tcs',
});
export const PASSWORD_RECOVERY_CALLBACK = Linking.createURL('auth/reset-password', {
  scheme: 'tcs',
});

export interface PublicAuthCapabilities {
  googleAuth: boolean;
  passwordRecovery: boolean;
}

export type CustomerIdentityLinkResult = 'completed' | 'redirected' | 'cancelled' | 'already-linked';

export function translateCustomerIdentityError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  if (normalized.includes('identity_already_exists') || normalized.includes('already linked')) {
    return 'Esta conta Google já está vinculada a outro acesso. Entre com essa conta ou use outro Google.';
  }
  if (normalized.includes('manual_linking_disabled')) {
    return 'O vínculo com Google ainda não foi habilitado neste ambiente.';
  }
  if (normalized.includes('email_not_confirmed') || normalized.includes('verified_email_required')) {
    return 'Confirme seu e-mail antes de vincular uma conta Google.';
  }
  if (normalized.includes('google_auth_disabled')) {
    return 'O acesso Google está temporariamente indisponível.';
  }
  return 'Não foi possível concluir o vínculo com Google. Nenhum acesso foi alterado.';
}

interface RecoveryMarker {
  userId: string;
  expiresAt: number;
}

const recoveryMarkerStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(RECOVERY_MARKER_KEY) ?? null;
    return SecureStore.getItemAsync(RECOVERY_MARKER_KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(RECOVERY_MARKER_KEY, value);
      return;
    }
    await SecureStore.setItemAsync(RECOVERY_MARKER_KEY, value);
  },
  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(RECOVERY_MARKER_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(RECOVERY_MARKER_KEY);
  },
};

const parseCallbackParams = (url: string) => {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  fragment.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
};

export async function getPublicAuthCapabilities(): Promise<PublicAuthCapabilities> {
  const { data, error } = await supabase.rpc('get_public_auth_capabilities');
  if (error) throw error;
  const source = (data ?? {}) as Record<string, unknown>;
  return {
    googleAuth: source.google_auth === true,
    passwordRecovery: source.password_recovery === true,
  };
}

export async function markPasswordRecoverySession(session: Session): Promise<void> {
  const marker: RecoveryMarker = {
    userId: session.user.id,
    expiresAt: Date.now() + RECOVERY_WINDOW_MS,
  };
  await recoveryMarkerStorage.set(JSON.stringify(marker));
}

export async function hasValidPasswordRecoverySession(): Promise<boolean> {
  const [stored, sessionResult] = await Promise.all([
    recoveryMarkerStorage.get(),
    supabase.auth.getSession(),
  ]);
  if (!stored || !sessionResult.data.session) return false;
  try {
    const marker = JSON.parse(stored) as RecoveryMarker;
    return marker.userId === sessionResult.data.session.user.id
      && marker.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export async function clearPasswordRecoverySession(): Promise<void> {
  await recoveryMarkerStorage.remove();
}

async function exchangeCustomerAuthCallback(url: string): Promise<{
  session: Session | null;
  recovery: boolean;
}> {
  const params = parseCallbackParams(url);
  const callbackError = params.get('error_description') ?? params.get('error');
  if (callbackError) throw new Error(callbackError);

  const code = params.get('code');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const recovery = params.get('type') === 'recovery';
  let session: Session | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    session = data.session;
  } else if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    session = data.session;
  }

  if (session && recovery) {
    await markPasswordRecoverySession(session);
  }

  if (session && session.user.identities?.some(identity => identity.provider === 'google')) {
    await supabase.rpc('reconcile_customer_identity');
    await supabase.rpc('record_google_identity_reconciled');
  }

  return { session, recovery };
}

export async function linkCustomerGoogleIdentity(): Promise<CustomerIdentityLinkResult> {
  const [capabilities, userResult] = await Promise.all([
    getPublicAuthCapabilities(),
    supabase.auth.getUser(),
  ]);
  if (!capabilities.googleAuth) throw new Error('google_auth_disabled');
  if (userResult.error || !userResult.data.user) throw new Error('authentication_required');

  const user = userResult.data.user;
  if (!user.email_confirmed_at) throw new Error('verified_email_required');
  if (user.identities?.some(identity => identity.provider === 'google')) return 'already-linked';

  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: CUSTOMER_AUTH_CALLBACK,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });
  if (error) throw error;
  if (Platform.OS === 'web') return 'redirected';
  if (!data.url) throw new Error('google_auth_url_missing');

  const response = await WebBrowser.openAuthSessionAsync(data.url, CUSTOMER_AUTH_CALLBACK);
  if (response.type !== 'success') return 'cancelled';
  await completeCustomerAuthCallback(response.url);
  return 'completed';
}

export function completeCustomerAuthCallback(url: string): Promise<{
  session: Session | null;
  recovery: boolean;
}> {
  const params = parseCallbackParams(url);
  const callbackKey = params.get('code')
    ? `code:${params.get('code')}`
    : `token:${params.get('access_token') ?? url}`;
  const completed = completedCallbacks.get(callbackKey);
  if (completed) return Promise.resolve(completed);
  const active = callbackOperations.get(callbackKey);
  if (active) return active;
  const operation = exchangeCustomerAuthCallback(url)
    .then((result) => {
      completedCallbacks.set(callbackKey, result);
      return result;
    })
    .finally(() => callbackOperations.delete(callbackKey));
  callbackOperations.set(callbackKey, operation);
  return operation;
}

export async function signInCustomerWithGoogle(): Promise<'completed' | 'redirected' | 'cancelled'> {
  const capabilities = await getPublicAuthCapabilities();
  if (!capabilities.googleAuth) throw new Error('google_auth_disabled');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: CUSTOMER_AUTH_CALLBACK,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });
  if (error) throw error;
  if (Platform.OS === 'web') return 'redirected';
  if (!data.url) throw new Error('google_auth_url_missing');

  const response = await WebBrowser.openAuthSessionAsync(
    data.url,
    CUSTOMER_AUTH_CALLBACK,
  );
  if (response.type !== 'success') return 'cancelled';
  await completeCustomerAuthCallback(response.url);
  return 'completed';
}

export async function requestCustomerPasswordRecovery(email: string): Promise<void> {
  const capabilities = await getPublicAuthCapabilities();
  if (!capabilities.passwordRecovery) throw new Error('password_recovery_disabled');
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: PASSWORD_RECOVERY_CALLBACK },
  );
  if (error) throw error;
}

export async function completeCustomerPasswordRecovery(
  password: string,
  revokeOtherSessions: boolean,
): Promise<void> {
  if (!(await hasValidPasswordRecoverySession())) {
    throw new Error('invalid_password_recovery_session');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw updateError;

  const { error: auditError } = await supabase.rpc(
    'record_password_recovery_completed',
    { p_other_sessions_revoked: revokeOtherSessions },
  );
  if (auditError) throw auditError;

  if (revokeOtherSessions) {
    const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' });
    if (revokeError) throw revokeError;
  }
  await clearPasswordRecoverySession();
  await supabase.auth.signOut({ scope: 'local' });
}
