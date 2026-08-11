// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalOnboardingChecklist } from './PortalOnboardingChecklist';
import type { PortalAccessContext, PortalCustomerEntryContext } from '@/types/portal';

const authState = vi.hoisted(() => ({
  access: null as PortalAccessContext | null,
  entryContext: null as PortalCustomerEntryContext | null,
  refreshAccess: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => authState }));
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

function access(overrides: Partial<PortalAccessContext> = {}): PortalAccessContext {
  return {
    accountKind: 'individual',
    userId: 'user-1',
    displayName: 'Ana Lima',
    organizationId: null,
    organizationName: null,
    role: null,
    membershipStatus: null,
    subscriptionStatus: 'trial',
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Profissional',
    features: {},
    limits: {},
    usage: {},
    permissions: ['dashboard.read', 'inspection.read', 'inspection.create', 'billing.read'],
    creationAllowed: true,
    restrictionCause: null,
    ...overrides,
  };
}

function entry(currentStep: 'configuration' | 'first_operation'): PortalCustomerEntryContext {
  return {
    accountKind: 'individual',
    entryState: 'ready',
    lifecycleState: 'trial',
    individualBootstrapEnabled: true,
    municipalBootstrapEnabled: true,
    organizationName: null,
    subscriptionStatus: 'trial',
    onboarding: {
      status: 'in_progress',
      currentStep,
      checklist: {
        identity: true,
        organization: true,
        plan: true,
        team: true,
        configuration: currentStep === 'first_operation',
        first_operation: false,
      },
      completedItems: currentStep === 'first_operation' ? 5 : 4,
      totalItems: 6,
      progressPercent: currentStep === 'first_operation' ? 83 : 67,
    },
  };
}

afterEach(() => {
  cleanup();
  authState.access = null;
  authState.entryContext = null;
  authState.refreshAccess.mockReset();
  supabaseMock.rpc.mockReset();
});

describe('checklist de ativação', () => {
  it('destaca uma única próxima ação e atualiza a configuração pelo contrato existente', async () => {
    const user = userEvent.setup();
    authState.access = access();
    authState.entryContext = entry('configuration');
    authState.refreshAccess.mockResolvedValue(undefined);
    supabaseMock.rpc.mockResolvedValue({ error: null });
    render(<MemoryRouter><PortalOnboardingChecklist /></MemoryRouter>);

    expect(screen.getByRole('progressbar', { name: 'Progresso da ativação' })).toHaveAttribute('aria-valuenow', '67');
    expect(screen.getByText('Ativação do portal')).toHaveClass('text-foreground');
    expect(screen.getByText('Próximo passo')).toHaveClass('text-foreground');
    expect(screen.getByRole('heading', { name: 'Configuração inicial revisada' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirmar configuração' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Iniciar primeira vistoria' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar configuração' }));
    await waitFor(() => expect(supabaseMock.rpc).toHaveBeenCalledWith('update_customer_onboarding_checklist', {
      p_item: 'configuration',
      p_completed: true,
      p_request_id: expect.any(String),
      p_source: 'web',
    }));
    expect(authState.refreshAccess).toHaveBeenCalledOnce();
  });

  it('mostra erro real e mantém a etapa disponível para nova tentativa', async () => {
    const user = userEvent.setup();
    authState.access = access();
    authState.entryContext = entry('configuration');
    supabaseMock.rpc.mockResolvedValue({ error: { message: 'failed' } });
    render(<MemoryRouter><PortalOnboardingChecklist /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Confirmar configuração' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir a configuração inicial.');
    expect(screen.getByRole('alert')).toHaveClass('bg-destructive-soft', 'text-foreground');
    expect(screen.getByRole('button', { name: 'Confirmar configuração' })).toBeEnabled();
  });

  it.each(['agent', 'supervisor'] as const)('mantém a configuração municipal em consulta para %s', (role) => {
    authState.access = access({
      accountKind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Município Piloto',
      role,
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'settings.read'],
    });
    authState.entryContext = { ...entry('configuration'), accountKind: 'organization', organizationName: 'Município Piloto' };
    render(<MemoryRouter><PortalOnboardingChecklist /></MemoryRouter>);

    expect(screen.getByText(/configuração municipal está disponível somente para a coordenação/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirmar configuração' })).not.toBeInTheDocument();
  });

  it('oferece a confirmação municipal à coordenação com autoridade efetiva', () => {
    authState.access = access({
      accountKind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Município Piloto',
      role: 'coordinator',
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'settings.read', 'settings.manage'],
    });
    authState.entryContext = { ...entry('configuration'), accountKind: 'organization', organizationName: 'Município Piloto' };
    render(<MemoryRouter><PortalOnboardingChecklist /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Confirmar configuração' })).toBeEnabled();
    expect(screen.queryByText(/modo de consulta/i)).not.toBeInTheDocument();
  });

  it('não oferece criação quando plano ou permissão bloqueiam a primeira vistoria', () => {
    authState.access = access({ permissions: ['dashboard.read', 'inspection.read'], creationAllowed: false, restrictionCause: 'plan_feature' });
    authState.entryContext = entry('first_operation');
    render(<MemoryRouter><PortalOnboardingChecklist /></MemoryRouter>);

    expect(screen.getByText('A criação de vistorias não está liberada para este acesso.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Iniciar primeira vistoria' })).not.toBeInTheDocument();
  });
});
