// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalAuthPage } from './PortalAuthPage';
import type { PortalAccessContext } from '@/types/portal';

const portalAuthState = vi.hoisted(() => ({
  access: null as PortalAccessContext | null,
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
  session: { user: { id: 'owner-user' } } as { user: { id: string } } | null,
  loading: false,
  signIn: vi.fn().mockResolvedValue(null),
  signUp: vi.fn().mockResolvedValue(null),
  signInWithGoogle: vi.fn().mockResolvedValue(null),
  bootstrapIndividual: vi.fn().mockResolvedValue(null),
  bootstrapMunicipal: vi.fn().mockResolvedValue(null),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => portalAuthState,
}));

afterEach(() => {
  cleanup();
  portalAuthState.entryContext.accountKind = null;
  portalAuthState.access = null;
  portalAuthState.session = { user: { id: 'owner-user' } };
  portalAuthState.signIn.mockReset().mockResolvedValue(null);
  portalAuthState.signUp.mockReset().mockResolvedValue(null);
  portalAuthState.signInWithGoogle.mockReset().mockResolvedValue(null);
  portalAuthState.bootstrapIndividual.mockReset().mockResolvedValue(null);
  portalAuthState.bootstrapMunicipal.mockReset().mockResolvedValue(null);
  portalAuthState.signOut.mockReset().mockResolvedValue(undefined);
  delete document.documentElement.dataset.theme;
});

function suspendedMunicipalAccess(): PortalAccessContext {
  return {
    accountKind: 'organization',
    userId: 'owner-user',
    displayName: 'Coordenação TCS',
    organizationId: 'org-1',
    organizationName: 'Município Piloto',
    role: 'coordinator',
    membershipStatus: 'suspended',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Municipal',
    features: {},
    limits: {},
    usage: {},
    permissions: [],
    creationAllowed: false,
    restrictionCause: 'membership_inactive',
  };
}

describe('entrada autenticada do portal', () => {
  it.each(['light', 'dark'] as const)('mantém o aviso de vínculo suspenso contrastante no tema %s', async (theme) => {
    portalAuthState.access = suspendedMunicipalAccess();
    document.documentElement.dataset.theme = theme;

    const { container } = render(
      <MemoryRouter initialEntries={['/entrar?status=vinculo-inativo']}>
        <PortalAuthPage mode="sign-in" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Acesso suspenso')).toHaveClass('text-foreground');
    expect(screen.getByRole('alert', { name: '' })).toHaveClass('bg-warning-soft', 'text-foreground');
    expect(screen.getByRole('alert', { name: '' })).not.toHaveClass('text-warning');
    if (theme === 'light') expect((await axe(container)).violations).toEqual([]);
  });

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
    expect(screen.queryByRole('heading', { name: 'Defina como você usará a TCS' })).not.toBeInTheDocument();
  });

  it('apresenta o aceite jurídico em linguagem humana sem expor a versão técnica', () => {
    render(<MemoryRouter initialEntries={['/entrar']}><PortalAuthPage mode="sign-in" /></MemoryRouter>);

    expect(screen.getByRole('checkbox', {
      name: 'Aceito os Termos de Uso e a Política de Privacidade vigentes.',
    })).toBeVisible();
    expect(screen.queryByText(/customer-terms-2026-08/i)).not.toBeInTheDocument();
  });

  it('mantém os onboardings individual e municipal distintos e acessíveis', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/entrar']}><PortalAuthPage mode="sign-in" /></MemoryRouter>);

    const individual = screen.getByRole('radio', { name: /Profissional individual/ });
    const municipal = screen.getByRole('radio', { name: /Prefeitura ou município/ });
    expect(individual).toBeChecked();

    individual.focus();
    await user.keyboard('{ArrowRight}');

    expect(municipal).toBeChecked();
    expect(municipal).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Dados iniciais da implantação' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuar com implantação municipal' })).toBeDisabled();
  });

  it('permite encerrar a sessão e usar outra conta durante a configuração', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/entrar']}><PortalAuthPage mode="sign-in" /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Sair e usar outra conta' }));
    await waitFor(() => expect(portalAuthState.signOut).toHaveBeenCalledOnce());
  });

  it('mantém a configuração e oferece nova tentativa quando o logout falha', async () => {
    const user = userEvent.setup();
    portalAuthState.signOut.mockRejectedValueOnce(new Error('network'));
    render(<MemoryRouter initialEntries={['/entrar']}><PortalAuthPage mode="sign-in" /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Sair e usar outra conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta sessão continua aberta');
    expect(screen.getByRole('heading', { name: 'Defina como você usará a TCS' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sair e usar outra conta' })).toBeEnabled();
  });
});

describe('autenticação pública do portal', () => {
  it('preserva query params nos caminhos secundários de entrada', () => {
    portalAuthState.session = null;
    render(<MemoryRouter initialEntries={['/entrar?returnTo=%2Fportal%2Fagenda']}><PortalAuthPage mode="sign-in" /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/recuperar-senha?returnTo=%2Fportal%2Fagenda');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/criar-conta?returnTo=%2Fportal%2Fagenda');
  });

  it('transforma a criação de conta em uma confirmação de e-mail clara', async () => {
    const user = userEvent.setup();
    portalAuthState.session = null;
    render(<MemoryRouter initialEntries={['/criar-conta?plan=individual']}><PortalAuthPage mode="sign-up" /></MemoryRouter>);

    await user.type(screen.getByLabelText('Nome completo'), 'Pessoa Teste');
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-segura');
    // Aceite dos Termos de Uso e Política de Privacidade é obrigatório para criar conta.
    await user.click(screen.getByRole('checkbox', { name: /Li e aceito os Termos de Uso e a Política de Privacidade/ }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Confirme seu e-mail')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Conta criada. Confirme o link enviado ao seu e-mail para continuar.');
    expect(portalAuthState.signUp).toHaveBeenCalledWith('Pessoa Teste', 'pessoa@exemplo.com', 'senha-segura', 'individual');
  });

  it('bloqueia a criação de conta sem aceitar os Termos de Uso e a Política de Privacidade', async () => {
    const user = userEvent.setup();
    portalAuthState.session = null;
    render(<MemoryRouter initialEntries={['/criar-conta?plan=individual']}><PortalAuthPage mode="sign-up" /></MemoryRouter>);

    await user.type(screen.getByLabelText('Nome completo'), 'Pessoa Teste');
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-segura');

    // Botão de criar conta permanece desabilitado até aceitar os termos.
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(portalAuthState.signUp).not.toHaveBeenCalled();
  });
});
