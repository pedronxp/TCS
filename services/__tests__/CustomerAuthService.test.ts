jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `tcs://${path}`),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../../utils/supabase', () => {
  const googleSession = {
    user: {
      id: '81000000-0000-4000-8000-000000000001',
      email_confirmed_at: '2026-08-01T00:00:00Z',
      identities: [{ id: 'google-id', provider: 'google' }],
    },
  };
  const auth = {
    exchangeCodeForSession: jest.fn().mockResolvedValue({ data: { session: googleSession }, error: null }),
    setSession: jest.fn(),
    getSession: jest.fn().mockResolvedValue({ data: { session: googleSession }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: googleSession.user }, error: null }),
    signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: 'https://accounts.google.test' }, error: null }),
    linkIdentity: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    signOut: jest.fn(),
  };
  const rpc = jest.fn((name: string) => Promise.resolve({
    data: name === 'get_public_auth_capabilities'
      ? { google_auth: true, password_recovery: true }
      : true,
    error: null,
  }));
  return { supabase: { auth, rpc }, __auth: auth, __rpc: rpc };
});

import * as WebBrowser from 'expo-web-browser';
import {
  buildCustomerAuthCallback,
  completeCustomerAuthCallback,
  completeCustomerPasswordRecovery,
  signInCustomerWithGoogle,
  translateCustomerIdentityError,
} from '../CustomerAuthService';

const supabaseModule = require('../../utils/supabase');

describe('CustomerAuthService Google', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('traduz conflito sem sugerir que papéis ou contas foram mesclados', () => {
    expect(translateCustomerIdentityError(new Error('identity_already_exists')))
      .toContain('já está vinculada a outro acesso');
  });

  it('usa a origem atual no retorno da versão web', () => {
    expect(buildCustomerAuthCallback(
      'auth/callback',
      'web',
      'https://codex-auth.tcsvistoria.pages.dev/',
    )).toBe('https://codex-auth.tcsvistoria.pages.dev/auth/callback');
  });

  it('mantém o esquema do aplicativo no retorno nativo', () => {
    expect(buildCustomerAuthCallback('auth/reset-password', 'ios'))
      .toBe('tcs://auth/reset-password');
  });

  it('torna callback PKCE repetido idempotente', async () => {
    const callback = 'tcs://auth/callback?code=one-time-code';
    const [first, second] = await Promise.all([
      completeCustomerAuthCallback(callback),
      completeCustomerAuthCallback(callback),
    ]);

    expect(first.session?.user.id).toBe(second.session?.user.id);
    expect(supabaseModule.__auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(supabaseModule.__rpc).toHaveBeenCalledWith('reconcile_customer_identity');
    expect(supabaseModule.__rpc).toHaveBeenCalledWith('record_google_identity_reconciled');
  });

  it('trata cancelamento do navegador sem criar callback parcial', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({ type: 'cancel' });
    await expect(signInCustomerWithGoogle()).resolves.toBe('cancelled');
    expect(supabaseModule.__auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejeita callback expirado ou negado sem trocar sessão', async () => {
    await expect(completeCustomerAuthCallback('tcs://auth/callback?error=access_denied'))
      .rejects.toThrow('access_denied');
    expect(supabaseModule.__auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('não altera senha sem marcador de recuperação válido', async () => {
    await expect(completeCustomerPasswordRecovery('NovaSenha123', true))
      .rejects.toThrow('invalid_password_recovery_session');
    expect(supabaseModule.__auth.updateUser).not.toHaveBeenCalled();
  });
});
