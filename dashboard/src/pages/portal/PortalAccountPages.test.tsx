// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://portal.tcs.test/"}
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalBillingPage } from './PortalBillingPage';
import { PortalInvitesPage } from './PortalInvitesPage';
import { PortalProfilePage } from './PortalProfilePage';
import { PortalSettingsPage } from './PortalSettingsPage';
import { PortalSupportPage } from './PortalSupportPage';
import { PortalTeamPage } from './PortalTeamPage';

const state = vi.hoisted(() => ({
  access: {
    accountKind: 'organization',
    userId: 'user-1',
    displayName: 'Coordenação TCS',
    organizationId: 'org-1',
    organizationName: 'Município Piloto',
    role: 'master',
    membershipStatus: 'active',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Municipal Básico',
    features: {},
    limits: {},
    usage: { inspections: 12 },
    permissions: [
      'billing.read', 'billing.manage', 'support.read', 'support.create', 'profile.read',
      'team.read', 'team.manage', 'invite.agent', 'invite.manage', 'settings.read', 'settings.manage',
    ],
    creationAllowed: true,
    restrictionCause: null,
  },
  queryOptions: [] as Array<{ queryKey: readonly unknown[]; enabled?: boolean }>,
  workspaceItems: [] as Array<Record<string, unknown>>,
  sessions: [] as Array<Record<string, unknown>>,
  queryError: false,
  refetch: vi.fn().mockResolvedValue(undefined),
  setQueryData: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  linkGoogleIdentity: vi.fn().mockResolvedValue(null),
  user: { email: 'coordenacao@exemplo.com', identities: [] as Array<{ provider: string }> },
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[]; enabled?: boolean }) => {
    state.queryOptions.push(options);
    const sessions = options.queryKey[1] === 'sessions';
    return {
      data: sessions ? state.sessions : { items: state.workspaceItems, summary: {} },
      isLoading: false,
      isError: state.queryError,
      refetch: state.refetch,
    };
  },
  useQueryClient: () => ({ setQueryData: state.setQueryData }),
}));

vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({
    access: state.access,
    user: state.user,
    can: (permission: string) => state.access.permissions.includes(permission),
    signOut: state.signOut,
    linkGoogleIdentity: state.linkGoogleIdentity,
  }),
}));

vi.mock('@/lib/portal', () => ({
  fetchPortalWorkspace: vi.fn(),
  portalHome: (kind: string) => (kind === 'organization' ? '/portal/municipal' : '/portal/individual'),
  portalRestrictionMessage: (cause: string | null) => cause ?? '',
  portalSubscriptionPresentation: (status: string, cancelAtPeriodEnd = false) => ({
    label: status === 'active' ? 'Assinatura ativa'
      : status === 'past_due' ? 'Pagamento pendente'
      : status === 'canceled' ? 'Cancelada'
      : status === 'expired' ? 'Expirada'
      : status === 'trial' ? 'Período de teste'
      : status === 'grace' ? 'Em carência'
      : 'Sem assinatura',
    tone: status === 'active' ? 'success' : status === 'canceled' || status === 'expired' || status === 'none' ? 'destructive' : 'warning',
    preservesRead: status !== 'none',
    allowsCreate: ['trial', 'active', 'grace'].includes(status) && !(cancelAtPeriodEnd && status === 'past_due'),
  }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: state.rpc,
    functions: { invoke: state.invoke },
    auth: { resetPasswordForEmail: state.resetPasswordForEmail },
  },
}));

beforeEach(() => {
  state.access.accountKind = 'organization';
  state.access.userId = 'user-1';
  state.access.organizationId = 'org-1';
  state.access.role = 'master';
  state.access.subscriptionStatus = 'active';
  state.access.permissions = [
    'billing.read', 'billing.manage', 'support.read', 'support.create', 'profile.read',
    'team.read', 'team.manage', 'invite.agent', 'invite.manage', 'settings.read', 'settings.manage',
  ];
  state.queryOptions = [];
  state.workspaceItems = [];
  state.sessions = [];
  state.queryError = false;
  state.refetch.mockReset().mockResolvedValue(undefined);
  state.setQueryData.mockReset();
  state.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  state.invoke.mockReset().mockResolvedValue({ data: null, error: { message: 'unavailable' } });
  state.signOut.mockReset().mockResolvedValue(undefined);
  state.linkGoogleIdentity.mockReset().mockResolvedValue(null);
  state.user = { email: 'coordenacao@exemplo.com', identities: [] };
  state.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000000' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('conta e administração do portal', () => {
  it.each(['light', 'dark'] as const)('mantém o status de assinatura inativa contrastante no tema %s', async (theme) => {
    state.access.subscriptionStatus = 'past_due';
    document.documentElement.dataset.theme = theme;

    const { container } = render(<PortalBillingPage />);
    const badge = screen.getByText('Pagamento pendente');

    expect(badge).toHaveClass('bg-warning-soft', 'text-foreground');
    expect(badge).not.toHaveClass('text-warning');
    if (theme === 'light') expect((await axe(container)).violations).toEqual([]);
  });

  it('isola chamados e convites por usuário, público e organização', () => {
    const support = render(<PortalSupportPage />);
    expect(state.queryOptions.at(-1)?.queryKey).toEqual([
      'portal', 'workspace', 'suporte', 'user-1', 'organization', 'org-1', 'master',
    ]);
    support.unmount();

    state.access.userId = 'user-2';
    state.access.organizationId = 'org-2';
    const invites = render(<PortalInvitesPage />);
    expect(state.queryOptions.at(-1)?.queryKey).toEqual([
      'portal', 'workspace', 'convites', 'user-2', 'organization', 'org-2', 'master',
    ]);
    invites.unmount();

    const team = render(<PortalTeamPage />);
    expect(state.queryOptions.at(-1)?.queryKey).toEqual([
      'portal', 'workspace', 'equipe', 'user-2', 'organization', 'org-2',
    ]);
    team.unmount();

    const settings = render(<PortalSettingsPage />);
    expect(state.queryOptions.at(-1)?.queryKey).toEqual([
      'portal', 'workspace', 'configuracoes', 'user-2', 'organization', 'org-2',
    ]);
    settings.unmount();

    render(<PortalProfilePage />);
    expect(state.queryOptions.at(-1)?.queryKey).toEqual([
      'portal', 'sessions', 'user-2', 'organization', 'org-2',
    ]);
  });

  it('separa caches de suporte e convites quando o papel é rebaixado', () => {
    const supportCoordinator = render(<PortalSupportPage />);
    const supportCoordinatorKey = state.queryOptions.at(-1)?.queryKey;
    supportCoordinator.unmount();

    state.access.role = 'supervisor';
    const supportSupervisor = render(<PortalSupportPage />);
    const supportSupervisorKey = state.queryOptions.at(-1)?.queryKey;
    supportSupervisor.unmount();

    state.access.role = 'master';
    const invitesCoordinator = render(<PortalInvitesPage />);
    const invitesCoordinatorKey = state.queryOptions.at(-1)?.queryKey;
    invitesCoordinator.unmount();

    state.access.role = 'supervisor';
    const invitesSupervisor = render(<PortalInvitesPage />);
    const invitesSupervisorKey = state.queryOptions.at(-1)?.queryKey;
    invitesSupervisor.unmount();

    expect(supportCoordinatorKey?.at(-1)).toBe('master');
    expect(supportSupervisorKey?.at(-1)).toBe('supervisor');
    expect(supportSupervisorKey).not.toEqual(supportCoordinatorKey);
    expect(invitesCoordinatorKey?.at(-1)).toBe('master');
    expect(invitesSupervisorKey?.at(-1)).toBe('supervisor');
    expect(invitesSupervisorKey).not.toEqual(invitesCoordinatorKey);
  });

  it('move o foco para o formulário de suporte e o restaura ao cancelar', async () => {
    const user = userEvent.setup();
    const { container } = render(<PortalSupportPage />);
    const trigger = screen.getByRole('button', { name: 'Abrir chamado' });

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Novo chamado' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect((await axe(container)).violations).toEqual([]);
  });

  it('fecha o formulário de suporte e restaura foco seguro quando a permissão é removida', async () => {
    const user = userEvent.setup();
    const view = render(<PortalSupportPage />);
    await user.click(screen.getByRole('button', { name: 'Abrir chamado' }));
    expect(screen.getByRole('heading', { name: 'Novo chamado' })).toBeVisible();

    state.access.permissions = state.access.permissions.filter((permission) => permission !== 'support.create');
    view.rerender(<PortalSupportPage />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Novo chamado' })).not.toBeInTheDocument());
    expect(screen.getByText(/consultar chamados, mas não abrir novas solicitações/i)).toBeVisible();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Suporte' })).toHaveFocus());
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('move e restaura foco ao gerenciar uma pessoa', async () => {
    const user = userEvent.setup();
    state.workspaceItems = [{ id: 'member-1', user_id: 'user-2', title: 'Agente Um', subtitle: 'agent', status: 'active' }];
    render(<PortalTeamPage />);
    const trigger = screen.getByRole('button', { name: 'Gerenciar' });

    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Confirmar alteração de alto impacto' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('fecha a gestão de equipe e restaura foco seguro após downgrade', async () => {
    const user = userEvent.setup();
    state.workspaceItems = [{ id: 'member-1', user_id: 'user-2', title: 'Agente Um', subtitle: 'agent', status: 'active' }];
    const view = render(<PortalTeamPage />);
    await user.click(screen.getByRole('button', { name: 'Gerenciar' }));
    expect(screen.getByRole('heading', { name: 'Confirmar alteração de alto impacto' })).toBeVisible();

    state.access.role = 'supervisor';
    state.access.permissions = state.access.permissions.filter((permission) => permission !== 'team.manage');
    view.rerender(<PortalTeamPage />);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Confirmar alteração de alto impacto' })).not.toBeInTheDocument());
    expect(screen.getByText(/modo de consulta/i)).toBeVisible();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Equipe' })).toHaveFocus());
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('anuncia falha de suporte e preserva os campos para retry', async () => {
    const user = userEvent.setup();
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });
    render(<PortalSupportPage />);
    await user.click(screen.getByRole('button', { name: 'Abrir chamado' }));
    await user.type(screen.getByLabelText('Assunto'), 'Falha no mapa');
    await user.type(screen.getByLabelText('Descrição'), 'Detalhes suficientes para reproduzir');
    await user.click(screen.getByRole('button', { name: 'Enviar chamado' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('tente novamente');
    expect(screen.getByLabelText('Assunto')).toHaveValue('Falha no mapa');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Detalhes suficientes para reproduzir');
  });

  it('anuncia falha de equipe e mantém a confirmação para retry', async () => {
    const user = userEvent.setup();
    state.workspaceItems = [{ id: 'member-1', user_id: 'user-2', title: 'Agente Um', subtitle: 'agent', status: 'active' }];
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });
    render(<PortalTeamPage />);
    await user.click(screen.getByRole('button', { name: 'Gerenciar' }));
    await user.type(screen.getByLabelText('Justificativa'), 'Ajuste operacional necessário');
    await user.type(screen.getByLabelText('Digite CONFIRMAR'), 'CONFIRMAR');
    await user.click(screen.getByRole('button', { name: 'Aplicar alteração' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('não foi concluída');
    expect(screen.getByLabelText('Justificativa')).toHaveValue('Ajuste operacional necessário');
    expect(screen.getByLabelText('Digite CONFIRMAR')).toHaveValue('CONFIRMAR');
  });

  it('anuncia falha de convite e preserva o e-mail para retry', async () => {
    const user = userEvent.setup();
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });
    render(<PortalInvitesPage />);
    await user.type(screen.getByLabelText('E-mail'), 'agente@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Criar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('tente novamente');
    expect(screen.getByLabelText('E-mail')).toHaveValue('agente@exemplo.com');
  });

  it('anuncia falha de configuração e preserva a edição para retry', async () => {
    const user = userEvent.setup();
    state.workspaceItems = [{
      id: 'org-1', title: 'Município Antigo', display_name: 'Município Antigo',
      contact_name: 'Contato Antigo', contact_email: 'antigo@exemplo.com', session_timeout_minutes: 480,
    }];
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });
    render(<PortalSettingsPage />);
    const displayName = screen.getByLabelText('Nome de exibição');
    await user.clear(displayName);
    await user.type(displayName, 'Município em edição');
    await user.type(screen.getByLabelText('Justificativa'), 'Atualização cadastral necessária');
    await user.type(screen.getByLabelText('Digite CONFIRMAR'), 'CONFIRMAR');
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(displayName).toHaveValue('Município em edição');
    expect(screen.getByLabelText('Justificativa')).toHaveValue('Atualização cadastral necessária');
  });

  it('não expõe ação para encerrar registros de dispositivos', async () => {
    state.sessions = [{
      id: 'session-1', device_name: 'Notebook', platform: 'web', status: 'active',
      started_at: '2026-08-09T10:00:00Z', last_heartbeat_at: '2026-08-09T11:00:00Z',
    }];
    render(<PortalProfilePage />);

    expect(screen.queryByRole('button', { name: 'Encerrar registro' })).not.toBeInTheDocument();
    expect(screen.getByText(/Último IP:/)).toBeVisible();
    expect(state.refetch).not.toHaveBeenCalled();
  });

  it('abre detalhes completos do chamado sem expor chamados de outro escopo', async () => {
    const user = userEvent.setup();
    state.workspaceItems = [{
      id: 'ticket-1', title: 'Teste web Técnico', subtitle: 'TCS-3844777428', status: 'open',
      priority: 'high', category: 'tecnico', created_at: '2026-08-13T10:00:00Z',
      description: 'O mapa não conclui o carregamento na área de vistorias.',
    }];
    render(<PortalSupportPage />);

    await user.click(screen.getByRole('button', { name: 'Ver detalhes de Teste web Técnico' }));

    expect(screen.getByRole('dialog', { name: 'Teste web Técnico' })).toHaveTextContent('O mapa não conclui o carregamento');
    expect(screen.getByRole('dialog', { name: 'Teste web Técnico' })).toHaveTextContent('Prioridade');
    expect(screen.getByRole('dialog', { name: 'Teste web Técnico' })).toHaveTextContent('Alta');
  });

  it('explica o limite temporário de envio da senha TCS sem usar aviso destrutivo', async () => {
    const user = userEvent.setup();
    state.user = { email: 'coordenacao@exemplo.com', identities: [{ provider: 'google' }] };
    state.resetPasswordForEmail.mockResolvedValue({ error: { message: 'over_email_send_rate_limit' } });
    render(<PortalProfilePage />);

    await user.click(screen.getByRole('button', { name: 'Criar senha TCS' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('O envio de e-mail atingiu o limite temporário');
    expect(notice).not.toHaveClass('bg-destructive-soft', 'text-destructive');
  });

  it('mantém a sessão local e anuncia a falha quando o logout global é rejeitado', async () => {
    const user = userEvent.setup();
    state.signOut.mockRejectedValueOnce(new Error('falha de rede'));
    render(<PortalProfilePage />);

    const logout = screen.getByRole('button', { name: 'Sair de todos os dispositivos' });
    expect(screen.getByText(/Tokens de acesso já emitidos.*podem permanecer válidos até expirar/)).toBeVisible();
    await user.click(logout);

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta sessão continua aberta');
    expect(logout).toBeEnabled();
    expect(state.signOut).toHaveBeenCalledOnce();
  });

  it('expõe periodicidade nativa, unidade do preço e falha fechada para host externo', async () => {
    const user = userEvent.setup();
    state.invoke.mockResolvedValueOnce({
      data: { ok: true, checkout: { checkout_url: 'https://pagamento-malicioso.example/checkout' } },
      error: null,
    });
    render(<PortalBillingPage />);

    const annual = screen.getByRole('radio', { name: 'Anual' });
    await user.click(annual);
    expect(annual).toBeChecked();
    expect(screen.getAllByText('por ano').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Fazer upgrade para Municipal Profissional/ }));
    expect(await screen.findByText(/Não foi possível iniciar o checkout/)).toHaveAttribute('role', 'alert');
  });

  it.each([
    ['sem checkout_id', { checkout_id: undefined }],
    ['com status não pendente', { status: 'completed' }],
    ['com valor divergente', { amount_cents: 1490001 }],
    ['com moeda divergente', { currency: 'USD' }],
    ['sem versão de plano válida', { plan_version_id: 'versao-invalida' }],
    ['sem provedor configurado', { provider_configuration_required: true }],
  ])('bloqueia checkout %s mesmo quando a URL é HTTPS e da própria origem', async (_label, override) => {
    const user = userEvent.setup();
    state.invoke.mockResolvedValueOnce({
      data: {
        ok: true,
        checkout: {
          checkout_id: '11111111-1111-4111-8111-111111111111',
          status: 'pending',
          amount_cents: 3990000,
          currency: 'BRL',
          plan_version_id: '22222222-2222-4222-8222-222222222222',
          provider_configuration_required: false,
          checkout_url: 'https://portal.tcs.test/checkout/retorno',
          ...override,
        },
      },
      error: null,
    });
    render(<PortalBillingPage />);

    await user.click(screen.getByRole('radio', { name: 'Anual' }));
    await user.click(screen.getByRole('button', { name: /Fazer upgrade para Municipal Profissional/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar o checkout');
  });

  it('bloqueia uma resposta completa quando a URL não é HTTPS e da própria origem', async () => {
    const user = userEvent.setup();
    state.invoke.mockResolvedValueOnce({
      data: {
        ok: true,
        checkout: {
          checkout_id: '11111111-1111-4111-8111-111111111111',
          status: 'pending',
          amount_cents: 3990000,
          currency: 'BRL',
          plan_version_id: '22222222-2222-4222-8222-222222222222',
          provider_configuration_required: false,
          checkout_url: 'http://portal.tcs.test/checkout/retorno',
        },
      },
      error: null,
    });
    render(<PortalBillingPage />);

    await user.click(screen.getByRole('radio', { name: 'Anual' }));
    await user.click(screen.getByRole('button', { name: /Fazer upgrade para Municipal Profissional/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar o checkout');
  });

  it('atualiza o baseline confirmado sem manter o alerta de alterações não salvas', async () => {
    const user = userEvent.setup();
    state.workspaceItems = [{
      id: 'org-1', title: 'Município Antigo', display_name: 'Município Antigo',
      contact_name: 'Contato Antigo', contact_email: 'antigo@exemplo.com', session_timeout_minutes: 480,
    }];
    render(<PortalSettingsPage />);

    const displayName = screen.getByLabelText('Nome de exibição');
    await user.clear(displayName);
    await user.type(displayName, 'Município Atualizado');
    await user.type(screen.getByLabelText('Justificativa'), 'Atualização cadastral necessária');
    await user.type(screen.getByLabelText('Digite CONFIRMAR'), 'CONFIRMAR');
    expect(screen.getByText('Alterações não salvas.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }));

    expect(await screen.findByText('Salvo agora e registrado na auditoria.')).toBeVisible();
    expect(screen.queryByText('Alterações não salvas.')).not.toBeInTheDocument();
    expect(state.setQueryData).toHaveBeenCalledOnce();
  });

  it('anuncia erro de carregamento, permite tentar novamente e preserva o formulário', async () => {
    const user = userEvent.setup();
    state.queryError = true;
    state.workspaceItems = [{
      id: 'org-1', title: 'Município Antigo', display_name: 'Município Antigo',
      contact_name: 'Contato Antigo', contact_email: 'antigo@exemplo.com', session_timeout_minutes: 480,
    }];
    render(<PortalSettingsPage />);

    const displayName = screen.getByLabelText('Nome de exibição');
    await user.clear(displayName);
    await user.type(displayName, 'Município em edição');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar as configurações');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(state.refetch).toHaveBeenCalledOnce();
    expect(displayName).toHaveValue('Município em edição');
  });

  it('anuncia a criação do convite em uma região de status', async () => {
    const user = userEvent.setup();
    state.rpc.mockResolvedValueOnce({ data: { allowed: true, token: 'token-seguro' }, error: null });
    render(<PortalInvitesPage />);

    await user.type(screen.getByLabelText('E-mail'), 'agente@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Criar convite' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Convite criado');
  });

  it('desabilita o convite e explica quando a assinatura bloqueia a criação', () => {
    state.access.subscriptionStatus = 'canceled';
    state.access.creationAllowed = false;
    state.access.restrictionCause = 'subscription_inactive';
    render(<PortalInvitesPage />, { wrapper: MemoryRouter });

    const button = screen.getByRole('button', { name: 'Criar convite' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/desabilitado porque a assinatura/i)).toBeVisible();
  });

  it('preserva consulta ao histórico mesmo com assinatura bloqueada', () => {
    state.access.subscriptionStatus = 'canceled';
    state.access.creationAllowed = false;
    state.access.restrictionCause = 'subscription_inactive';
    render(<PortalInvitesPage />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { name: 'Convites' })).toBeVisible();
    expect(screen.getByText('Histórico')).toBeVisible();
  });
});
