// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalAuthPage } from './PortalAuthPage';

const portalAuthState = vi.hoisted(() => ({
  access: null,
  entryContext: {
    accountKind: null as 'individual' | 'organization' | 'internal' | null,
    entryState: 'account_choice_required',
    lifecycleState: 'creating' as const,
    individualBootstrapEnabled: true,
    municipalBootstrapEnabled: true,
    organizationName: null,
    subscriptionStatus: null,
    onboarding: null,
  },
  session: { user: { id: 'owner-user' } },
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  bootstrapIndividual: vi.fn(),
  bootstrapMunicipal: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => portalAuthState,
}));

afterEach(() => {
  cleanup();
  portalAuthState.entryContext.accountKind = null;
});

describe('entrada autenticada do portal', () => {
  it('encaminha owner interno para o console em vez de oferecer onboarding de cliente', () => {
    portalAuthState.entryContext.accountKind = 'internal';

    render(
      <MemoryRouter initialEntries={['/entrar']}>
        <Routes>
          <Route path="/entrar" element={<PortalAuthPage mode="sign-in" />} />
          <Route path="/login" element={<p>Console interno TCS</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Console interno TCS')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Configure seu acesso' })).not.toBeInTheDocument();
  });

  it('apresenta o aceite jurídico em linguagem humana sem expor a versão técnica', () => {
    render(
      <MemoryRouter initialEntries={['/entrar']}>
        <PortalAuthPage mode="sign-in" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('checkbox', {
      name: 'Aceito os Termos de Uso e a Política de Privacidade vigentes.',
    })).toBeVisible();
    expect(screen.queryByText(/customer-terms-2026-08/i)).not.toBeInTheDocument();
  });
});
