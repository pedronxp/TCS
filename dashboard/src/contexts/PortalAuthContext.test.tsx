// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalAuthProvider, usePortalAuth } from './PortalAuthContext';
import type { PortalAccessContext } from '@/types/portal';

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  rpc: vi.fn(),
}));

const accountEntryMock = vi.hoisted(() => ({
  buildAuthCallbackUrl: vi.fn(() => ''),
  fetchAuthenticatedInternalProfile: vi.fn(),
}));

const portalMock = vi.hoisted(() => ({
  fetchPortalAccessContext: vi.fn(),
  fetchCustomerEntryContext: vi.fn(),
  parseInternalCustomerEntryContext: vi.fn(() => null),
}));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));
vi.mock('@/lib/account-entry', () => accountEntryMock);
vi.mock('@/lib/portal', () => portalMock);

type AuthStateListener = (event: string, session: Session | null) => void;

let authStateListener: AuthStateListener | undefined;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeSession(userId: string): Session {
  return {
    access_token: `token-${userId}`,
    refresh_token: `refresh-${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, identities: [] },
  } as unknown as Session;
}

function makeAccess(userId: string, displayName: string): PortalAccessContext {
  return {
    accountKind: 'individual',
    userId,
    displayName,
    organizationId: null,
    organizationName: null,
    role: null,
    membershipStatus: null,
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: null,
    planVersionId: null,
    planName: null,
    features: {},
    limits: {},
    usage: {},
    permissions: [],
    creationAllowed: true,
    restrictionCause: null,
  };
}

function Probe() {
  const { access, session, loading, error } = usePortalAuth();
  return (
    <div data-testid="probe">
      {JSON.stringify({
        access: access?.displayName ?? null,
        session: session?.user.id ?? null,
        loading,
        error,
      })}
    </div>
  );
}

function renderProvider() {
  return render(
    <PortalAuthProvider>
      <Probe />
    </PortalAuthProvider>,
  );
}

// O handler de auth agenda a hidratação em window.setTimeout(..., 0).
async function flushAuthEvent(event: string, session: Session | null) {
  act(() => {
    authStateListener?.(event, session);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  supabaseMock.auth.onAuthStateChange.mockImplementation((listener: AuthStateListener) => {
    authStateListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  portalMock.parseInternalCustomerEntryContext.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  authStateListener = undefined;
});

describe('PortalAuthContext', () => {
  it('hidratação antiga que falha não sobrescreve o resultado da hidratação mais recente', async () => {
    // A hidratação disparada por getSession() inicia primeiro e fica presa na
    // busca do perfil interno; a disparada por onAuthStateChange() inicia
    // depois e conclui antes. Quando a antiga termina (com erro), ela não pode
    // reaplicar setAccess(null)/setError (flash de "sem acesso").
    const staleInternalProfile = deferred<unknown>();
    accountEntryMock.fetchAuthenticatedInternalProfile
      .mockImplementationOnce(() => staleInternalProfile.promise)
      .mockResolvedValueOnce(null);
    portalMock.fetchPortalAccessContext
      .mockResolvedValueOnce(makeAccess('user-novo', 'Acesso Novo'))
      .mockResolvedValueOnce(makeAccess('user-antigo', 'Acesso Antigo'));
    portalMock.fetchCustomerEntryContext.mockResolvedValue(null);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: makeSession('user-antigo') } });

    renderProvider();

    // Hidratação #1 (getSession) inicia e suspende no perfil interno.
    await act(async () => {});
    expect(screen.getByTestId('probe')).toHaveTextContent('"session":"user-antigo"');
    expect(screen.getByTestId('probe')).toHaveTextContent('"loading":true');

    // Hidratação #2 (onAuthStateChange, mais recente) conclui primeiro.
    await flushAuthEvent('SIGNED_IN', makeSession('user-novo'));
    expect(screen.getByTestId('probe')).toHaveTextContent('"access":"Acesso Novo"');
    expect(screen.getByTestId('probe')).toHaveTextContent('"loading":false');

    // A hidratação antiga termina por último e deve ser descartada.
    await act(async () => {
      staleInternalProfile.reject(new Error('falha antiga'));
    });

    expect(screen.getByTestId('probe')).toHaveTextContent('"access":"Acesso Novo"');
    expect(screen.getByTestId('probe')).toHaveTextContent('"error":null');
    expect(screen.getByTestId('probe')).toHaveTextContent('"loading":false');
  });

  it('hidratação antiga que resolve depois não reaplica o próprio acesso', async () => {
    const staleInternalProfile = deferred<unknown>();
    accountEntryMock.fetchAuthenticatedInternalProfile
      .mockImplementationOnce(() => staleInternalProfile.promise)
      .mockResolvedValueOnce(null);
    portalMock.fetchPortalAccessContext
      .mockResolvedValueOnce(makeAccess('user-novo', 'Acesso Novo'))
      .mockResolvedValueOnce(makeAccess('user-antigo', 'Acesso Antigo'));
    portalMock.fetchCustomerEntryContext.mockResolvedValue(null);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: makeSession('user-antigo') } });

    renderProvider();

    await act(async () => {});
    await flushAuthEvent('SIGNED_IN', makeSession('user-novo'));
    expect(screen.getByTestId('probe')).toHaveTextContent('"access":"Acesso Novo"');

    await act(async () => {
      staleInternalProfile.resolve(null);
    });

    expect(screen.getByTestId('probe')).toHaveTextContent('"access":"Acesso Novo"');
    expect(screen.getByTestId('probe')).toHaveTextContent('"session":"user-novo"');
    expect(screen.getByTestId('probe')).toHaveTextContent('"error":null');
  });
});
