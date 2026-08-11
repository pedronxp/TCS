// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalDashboardPage } from './PortalDashboardPage';
import type { PortalAccessContext, PortalDashboardData } from '@/types/portal';

type Hsl = readonly [number, number, number];

const contrastCases: ReadonlyArray<readonly [string, Hsl, Hsl]> = [
  ['texto light sobre o fundo da página', [0, 0, 9], [0, 0, 98]],
  ['texto light sobre fundo secundário', [0, 0, 9], [0, 0, 96]],
  ['texto light sobre fundo de sucesso', [0, 0, 9], [158, 50, 96]],
  ['texto light sobre fundo de alerta', [0, 0, 9], [38, 80, 95]],
  ['texto light sobre fundo destrutivo', [0, 0, 9], [0, 70, 96]],
  ['texto dark sobre o fundo da página', [0, 0, 98], [0, 0, 9]],
  ['texto dark sobre fundo secundário', [0, 0, 98], [0, 0, 15]],
  ['texto dark sobre fundo de sucesso', [0, 0, 98], [158, 40, 15]],
  ['texto dark sobre fundo de alerta', [0, 0, 98], [38, 60, 15]],
  ['texto dark sobre fundo destrutivo', [0, 0, 98], [0, 60, 15]],
];

const queryState = vi.hoisted(() => ({
  data: null as PortalDashboardData | null,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  options: null as { queryKey?: readonly unknown[]; enabled?: boolean } | null,
}));

const authState = vi.hoisted(() => ({ access: null as PortalAccessContext | null }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey?: readonly unknown[]; enabled?: boolean }) => {
    queryState.options = options;
    return queryState;
  },
}));
vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => authState }));
vi.mock('@/components/portal/PortalOnboardingChecklist', () => ({ PortalOnboardingChecklist: () => null }));

function individualAccess(overrides: Partial<PortalAccessContext> = {}): PortalAccessContext {
  return {
    accountKind: 'individual',
    userId: 'user-1',
    displayName: 'Ana Lima',
    organizationId: null,
    organizationName: null,
    role: null,
    membershipStatus: null,
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Profissional',
    features: {},
    limits: {},
    usage: {},
    permissions: ['dashboard.read', 'inspection.read', 'inspection.create', 'appointment.read'],
    creationAllowed: true,
    restrictionCause: null,
    ...overrides,
  };
}

const dashboardData: PortalDashboardData = {
  metrics: [
    { key: 'inspections', label: 'Vistorias no escopo', value: 12 },
    { key: 'appointments', label: 'Próximos agendamentos', value: 2 },
  ],
  recentInspections: [{ id: 'inspection-1', protocol: 'VIS-1042', status: 'concluída', riskLevel: null, occurredAt: '2026-08-08T12:00:00Z' }],
  upcoming: [{ id: 'appointment-1', title: 'Visita ao lote 12', scheduledAt: '2026-08-09T12:00:00Z', status: 'agendada' }],
};

afterEach(() => {
  cleanup();
  authState.access = null;
  queryState.data = null;
  queryState.isLoading = false;
  queryState.isError = false;
  queryState.isFetching = false;
  queryState.refetch.mockReset();
  queryState.options = null;
  delete document.documentElement.dataset.theme;
});

describe('dashboard do portal', () => {
  it.each(['light', 'dark'] as const)('prioriza dados reais e mantém contraste no tema %s', async (theme) => {
    authState.access = individualAccess();
    queryState.data = dashboardData;
    const { container } = render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    document.documentElement.dataset.theme = theme;

    expect(screen.getByRole('heading', { level: 1, name: 'Olá, Ana' })).toBeVisible();
    expect(screen.getByText('Seu trabalho')).toHaveClass('text-foreground');
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByText('VIS-1042')).toBeVisible();
    expect(screen.getByText('Visita ao lote 12')).toBeVisible();
    expect(screen.getByRole('link', { name: /Iniciar nova vistoria/ })).toHaveAttribute('href', '/portal/individual/vistorias?nova=1');
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });

  it.each(contrastCases)('mantém razão AA determinística para %s', (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('não expõe módulos nem CTA quando faltam permissões efetivas', () => {
    authState.access = individualAccess({
      planName: null,
      permissions: ['dashboard.read'],
      creationAllowed: false,
      restrictionCause: 'plan_feature',
    });
    queryState.data = dashboardData;
    render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);

    expect(screen.getByText('Plano não definido')).toBeVisible();
    expect(screen.getByText('Vistorias fora do seu acesso')).toBeVisible();
    expect(screen.getByText('Agenda fora do seu acesso')).toBeVisible();
    expect(screen.queryByText('VIS-1042')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Iniciar nova vistoria/ })).not.toBeInTheDocument();
  });

  it('mantém um skeleton estável e respeita reduced-motion', () => {
    authState.access = individualAccess();
    queryState.isLoading = true;
    const { container } = render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);

    expect(screen.getByRole('status', { name: 'Carregando panorama' })).toBeVisible();
    expect(container.querySelectorAll('.h-\\[172px\\]')).toHaveLength(4);
    container.querySelectorAll('.animate-pulse').forEach((skeleton) => expect(skeleton).toHaveClass('motion-reduce:animate-none'));
  });

  it('oferece retry honesto quando a consulta falha', async () => {
    const user = userEvent.setup();
    authState.access = individualAccess();
    queryState.isError = true;
    render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);

    expect(screen.getByRole('alert')).toHaveTextContent('Os dados não foram substituídos por estimativas.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it('mantém cache utilizável sem afirmar que está atualizado quando o refetch falha', async () => {
    const user = userEvent.setup();
    authState.access = individualAccess();
    queryState.data = dashboardData;
    queryState.isError = true;
    render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);

    expect(screen.getByRole('status')).toHaveTextContent('Os dados abaixo são da última atualização disponível e podem estar desatualizados.');
    expect(screen.getByText('Últimos dados disponíveis')).toBeVisible();
    expect(screen.queryByText('Dados atualizados pelo portal')).not.toBeInTheDocument();
    expect(screen.getByText('VIS-1042')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it('separa o cache ao atualizar o acesso individual para municipal', () => {
    authState.access = individualAccess();
    const view = render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    const individualKey = queryState.options?.queryKey;

    authState.access = individualAccess({
      accountKind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Município Piloto',
      role: 'agent',
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'inspection.read'],
    });
    view.rerender(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    const municipalKey = queryState.options?.queryKey;

    expect(individualKey).toEqual([
      'portal', 'dashboard', 'user-1', 'individual', null, 'individual',
      'no-membership::active::version-1::creation-allowed::no-restriction::appointment.read|dashboard.read|inspection.create|inspection.read',
    ]);
    expect(municipalKey).toEqual([
      'portal', 'dashboard', 'user-1', 'organization', 'org-1', 'agent',
      'active::active::version-1::creation-allowed::no-restriction::dashboard.read|inspection.read',
    ]);
    expect(municipalKey).not.toEqual(individualKey);
  });

  it('separa o cache quando o perfil de autorização municipal muda', () => {
    authState.access = individualAccess({
      accountKind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Município Piloto',
      role: 'supervisor',
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'inspection.read', 'team.read'],
    });
    const view = render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    const supervisorKey = queryState.options?.queryKey;

    authState.access = { ...authState.access, role: 'agent', permissions: ['dashboard.read', 'inspection.read'] };
    view.rerender(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    const agentKey = queryState.options?.queryKey;

    expect(supervisorKey).not.toEqual(agentKey);
    expect(supervisorKey).toContain('supervisor');
    expect(agentKey).toContain('agent');
  });

  it('separa o cache quando a autorização muda sem alterar a função', () => {
    authState.access = individualAccess({
      accountKind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Município Piloto',
      role: 'agent',
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'inspection.read'],
    });
    const view = render(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    const activeKey = queryState.options?.queryKey;

    authState.access = {
      ...authState.access,
      subscriptionStatus: 'past_due',
      creationAllowed: false,
      restrictionCause: 'subscription_past_due',
      permissions: ['dashboard.read'],
    };
    view.rerender(<MemoryRouter><PortalDashboardPage /></MemoryRouter>);
    const restrictedKey = queryState.options?.queryKey;

    expect(restrictedKey).not.toEqual(activeKey);
    expect(restrictedKey?.at(-1)).toContain('creation-blocked');
    expect(restrictedKey?.at(-1)).toContain('subscription_past_due');
  });
});

function contrastRatio(foreground: Hsl, background: Hsl) {
  const foregroundLuminance = relativeLuminance(hslToRgb(foreground));
  const backgroundLuminance = relativeLuminance(hslToRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function hslToRgb([hue, saturationPercent, lightnessPercent]: Hsl): [number, number, number] {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let rgb: [number, number, number];

  if (segment < 1) rgb = [chroma, secondary, 0];
  else if (segment < 2) rgb = [secondary, chroma, 0];
  else if (segment < 3) rgb = [0, chroma, secondary];
  else if (segment < 4) rgb = [0, secondary, chroma];
  else if (segment < 5) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  const match = lightness - chroma / 2;
  return rgb.map((channel) => channel + match) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]) {
  const [red, green, blue] = rgb.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
