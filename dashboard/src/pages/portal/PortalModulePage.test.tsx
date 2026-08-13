// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalModulePage } from './PortalModulePage';

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as { items: Array<Record<string, unknown>>; summary: Record<string, number | string | boolean | null> } | undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
  access: {
    accountKind: 'individual' as 'individual' | 'organization',
    userId: 'user',
    organizationId: null as string | null,
    role: null as null | 'coordinator',
    features: { reports: true } as Record<string, boolean>,
    permissions: ['inspection.read', 'appointment.read'] as string[],
    creationAllowed: true,
  },
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: () => mocks.query }));
vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => ({ access: mocks.access }) }));
vi.mock('@/lib/portal', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/portal')>();
  return { ...original, fetchPortalWorkspace: vi.fn() };
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderModule(section = 'vistorias', entry = '/portal/individual/vistorias') {
  return render(<MemoryRouter initialEntries={[entry]}><PortalModulePage section={section} /><LocationProbe /></MemoryRouter>);
}

describe('estados dos módulos do portal', () => {
  beforeEach(() => {
    mocks.query.data = undefined;
    mocks.query.isLoading = false;
    mocks.query.isFetching = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
    mocks.access.accountKind = 'individual';
    mocks.access.organizationId = null;
    mocks.access.role = null;
    mocks.access.features = { reports: true };
    mocks.access.permissions = ['inspection.read', 'appointment.read'];
    mocks.access.creationAllowed = true;
  });
  afterEach(cleanup);

  it('expõe carregamento acessível e respeita redução de movimento', () => {
    mocks.query.isLoading = true;
    const { container } = renderModule();
    expect(screen.getByRole('status', { name: 'Carregando itens' })).toBeVisible();
    expect(container.querySelectorAll('.motion-reduce\\:animate-none')).toHaveLength(4);
  });

  it('expõe erro recuperável sem estimar dados', () => {
    mocks.query.isError = true;
    renderModule();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar este módulo');
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  it('diferencia escopo vazio de filtro sem resultado e persiste filtros na URL', () => {
    mocks.query.data = { items: [], summary: {} };
    const { rerender } = renderModule();
    expect(screen.getByText('Nenhuma vistoria foi registrada neste escopo.')).toBeVisible();

    mocks.query.data = { items: [{ id: '1', title: 'TCS-001', status: 'pendente' }], summary: {} };
    rerender(<MemoryRouter initialEntries={['/portal/individual/vistorias']}><PortalModulePage section="vistorias" /><LocationProbe /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('Buscar em vistorias'), { target: { value: 'sem resultado' } });
    expect(screen.getByText('Ajuste a busca ou o filtro sem perder sua posição na lista.')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/portal/individual/vistorias?busca=sem+resultado');
  });

  it('preserva filtros ao abrir o detalhe da vistoria', () => {
    mocks.query.data = { items: [{ id: 'inspection 1', title: 'TCS-001', status: 'concluida' }], summary: {} };
    renderModule('vistorias', '/portal/individual/vistorias?status=concluida');
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute(
      'href',
      '/portal/individual/vistorias/inspection%201?returnTo=%2Fportal%2Findividual%2Fvistorias%3Fstatus%3Dconcluida',
    );
  });

  it('explica o bloqueio por plano e direciona quem pode ler cobrança para a assinatura', () => {
    mocks.access.accountKind = 'organization';
    mocks.access.organizationId = 'org-1';
    mocks.access.features = { reports: false };
    mocks.access.permissions = ['billing.read'];
    renderModule('relatorios', '/portal/municipal/relatorios');
    expect(screen.getByRole('heading', { name: 'Relatórios não incluídos neste plano' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Consultar assinatura' })).toHaveAttribute('href', '/portal/municipal/assinatura');
  });

  it.each([{ reports_basic: true }, { reports_advanced: true }])(
    'libera relatórios para funcionalidades profissionais alternativas: %o',
    (features) => {
      mocks.access.features = features;
      mocks.query.data = { items: [], summary: { inspections: 3 } };
      renderModule('relatorios', '/portal/individual/relatorios');
      expect(screen.getByText('Relatório pronto para exportação')).toBeVisible();
      expect(screen.queryByText('Relatórios não incluídos neste plano')).not.toBeInTheDocument();
    },
  );

  it('mantém o estado base sem violações automatizadas de acessibilidade', async () => {
    mocks.query.data = { items: [{ id: '1', title: 'TCS-001', status: 'concluida' }], summary: { inspections: 1 } };
    const { container } = renderModule();
    expect((await axe(container)).violations).toEqual([]);
  });
});
