// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as reportsModule from './PortalReportsPage';
import { PortalReportsPage } from './PortalReportsPage';
import type { PortalAccessContext, PortalPermission } from '@/types/portal';

const state = vi.hoisted(() => ({
  access: {
    accountKind: 'organization' as const,
    userId: 'user-1',
    displayName: 'Coordenação TCS',
    organizationId: 'org-1',
    organizationName: 'Município Piloto',
    role: 'master' as const,
    membershipStatus: 'active' as const,
    subscriptionStatus: 'active' as const,
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Municipal Básico',
    features: {},
    limits: {},
    usage: { inspections: 0 },
    permissions: ['dashboard.read', 'report.read'],
    creationAllowed: true,
    restrictionCause: null,
  } as PortalAccessContext,
  queryData: undefined as
    | { indicators: Array<Record<string, unknown>>; rows: Array<Record<string, unknown>>; charts: Array<Record<string, unknown>> }
    | undefined,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: state.queryData,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    isError: state.isError,
    refetch: state.refetch,
  }),
}));

vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({ access: state.access, can: (permission: string) => state.access.permissions.includes(permission as PortalPermission) }),
}));

vi.mock('@/lib/portal', () => ({
  portalHome: () => '/portal/municipal',
  portalRestrictionMessage: (cause: string | null) => cause ?? '',
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: state.rpc } }));

beforeEach(() => {
  state.queryData = undefined;
  state.isLoading = false;
  state.isError = false;
  state.access.creationAllowed = true;
  state.access.restrictionCause = null;
  state.access.subscriptionStatus = 'active';
  state.refetch.mockReset();
  state.rpc.mockReset();
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:fake'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/portal/municipal/relatorios']}>
      <PortalReportsPage />
    </MemoryRouter>,
  );
}

describe('relatórios e estatísticas municipais', () => {
  it('adapta o contrato autoritativo do relatório sem inventar indicadores ou linhas', () => {
    const parser = (reportsModule as Record<string, unknown>).parseReportingResult;
    expect(parser).toEqual(expect.any(Function));

    const result = (parser as (value: unknown) => {
      indicators: Array<{ key: string; value: number }>;
      rows: Array<Record<string, unknown>>;
      charts: Array<{ key: string; series: Array<{ label: string; value: number }> }>;
    })({
      volume: 3,
      risk: { breakdown: [{ risk: 'alto', count: 2 }], trend: [] },
      schedule: { distribution: [{ status: 'scheduled', count: 4 }] },
      documents: {
        documents: [{ status: 'generated', count: 5 }],
        acknowledgements: [{ outcome: 'acknowledged', count: 2 }],
      },
      productivity: [{ memberId: 'agent-1', memberName: 'Ana', inspections: 3 }],
      consumption: { resources: [{ resourceCode: 'inspections', consumed: 8 }] },
      export: { rows: [{ protocol: 'TCS-001', location: 'Centro' }] },
    });

    expect(result.indicators).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'inspections', value: 3 }),
      expect.objectContaining({ key: 'appointments', value: 4 }),
      expect.objectContaining({ key: 'documents', value: 5 }),
      expect.objectContaining({ key: 'acknowledgements', value: 2 }),
    ]));
    expect(result.rows).toEqual([{ protocol: 'TCS-001', location: 'Centro' }]);
    expect(result.charts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk', series: [{ label: 'alto', value: 2 }] }),
      expect.objectContaining({ key: 'team', series: [{ label: 'Ana', value: 3 }] }),
    ]));
  });

  it('converte os filtros da interface no único payload aceito pela RPC', () => {
    const toRpcFilters = (reportsModule as Record<string, unknown>).toReportingRpcFilters;
    expect(toRpcFilters).toEqual(expect.any(Function));

    const payload = (toRpcFilters as (filters: Record<string, string>, now: Date) => Record<string, string>)(
      { period: 'last_7_days', form: 'form-1', risk: 'alto', neighborhood: 'Centro', team: 'agent-1' },
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(payload).toMatchObject({
      formId: 'form-1',
      risk: 'alto',
      location: 'Centro',
      teamMemberId: 'agent-1',
      to: '2026-08-20T12:00:00.000Z',
    });
    expect(payload.from).toBe('2026-08-14T00:00:00.000Z');
    expect(payload).not.toHaveProperty('status');
  });

  it('mostra estado de carregamento enquanto busca o contrato de relatório', () => {
    state.isLoading = true;
    renderPage();
    expect(screen.getByRole('status', { name: 'Carregando relatório' })).toBeInTheDocument();
  });

  it('apresenta estado em integração quando o contrato portal_get_reporting não está disponível', () => {
    state.isError = true;
    renderPage();
    expect(screen.getByRole('heading', { name: 'Relatórios em integração' })).toBeVisible();
    expect(screen.getByText('portal_get_reporting')).toBeInTheDocument();
    screen.getByRole('button', { name: /Tentar novamente/i });
  });

  it('mostra estado vazio quando o contrato retorna sem indicadores nem linhas', () => {
    state.queryData = { indicators: [], rows: [], charts: [] };
    renderPage();
    expect(screen.getByRole('heading', { name: 'Nenhum dado para este recorte' })).toBeVisible();
  });

  it('apresenta indicadores, tabela e botões de exportação quando há dados', () => {
    state.queryData = {
      indicators: [
        { key: 'total', label: 'Vistorias', value: 42 },
        { key: 'risk', label: 'Risco alto', value: 7 },
      ],
      rows: [
        { id: '1', protocol: 'TCS-001', status: 'completed', neighborhood: 'Centro', team: 'Equipe A' },
        { id: '2', protocol: 'TCS-002', status: 'pending', neighborhood: 'Beira-rio', team: 'Equipe B' },
      ],
      charts: [{ key: 'by_status', label: 'Por situação', series: [{ label: 'Concluídas', value: 1 }, { label: 'Pendentes', value: 1 }] }],
    };
    renderPage();
    expect(screen.getByText('Vistorias')).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Tabela do recorte' })).toBeVisible();
    expect(screen.getByText('TCS-001')).toBeVisible();
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Exportar PDF/i })).toBeEnabled();
    expect(screen.getByText('Por situação')).toBeVisible();
  });

  it('exporta CSV preservando os filtros e cria download', () => {
    state.queryData = {
      indicators: [],
      rows: [{ id: '1', protocol: 'TCS-001', status: 'completed' }],
      charts: [],
    };
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('avisa que a exportação em PDF ainda não está disponível', () => {
    state.queryData = {
      indicators: [],
      rows: [{ id: '1', protocol: 'TCS-001', status: 'completed' }],
      charts: [],
    };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('A exportação em PDF ainda não está disponível');
  });

  it('desabilita exportação quando a assinatura bloqueia a criação', () => {
    state.access.subscriptionStatus = 'canceled';
    state.access.creationAllowed = false;
    state.access.restrictionCause = 'subscription_inactive';
    state.queryData = {
      indicators: [{ key: 'total', label: 'Total', value: 1 }],
      rows: [{ id: '1', protocol: 'TCS-001', status: 'completed' }],
      charts: [],
    };
    renderPage();
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeDisabled();
  });

  it('exibe somente os filtros suportados pelo contrato de relatórios', () => {
    state.queryData = { indicators: [], rows: [], charts: [] };
    renderPage();
    expect(screen.getByLabelText('Período')).toBeInTheDocument();
    expect(screen.queryByLabelText('Situação')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Formulário')).toBeInTheDocument();
    expect(screen.getByLabelText('Risco')).toBeInTheDocument();
    expect(screen.getByLabelText('Bairro')).toBeInTheDocument();
    expect(screen.getByLabelText('Equipe')).toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade no estado vazio', async () => {
    state.queryData = { indicators: [], rows: [], charts: [] };
    const { container } = renderPage();
    expect((await axe(container)).violations).toEqual([]);
  });
});
