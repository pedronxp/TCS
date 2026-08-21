// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalMapPage } from './PortalMapPage';

const mocks = vi.hoisted(() => ({
  query: { data: undefined as { items: Array<Record<string, unknown>> } | undefined, isLoading: false, isError: false, refetch: vi.fn() },
  access: { accountKind: 'organization' as const, userId: 'user-1', organizationId: 'org-1', role: 'coordinator' as const },
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: () => mocks.query }));
vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => ({ access: mocks.access }) }));
vi.mock('@/lib/portal', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/portal')>()), fetchPortalWorkspace: vi.fn() }));
vi.mock('@/components/portal/PortalMap', () => ({ PortalMap: ({ points }: { points: Array<{ protocol: string }> }) => <div aria-label="Mapa de vistorias">{points.map((point) => point.protocol).join(', ')}</div> }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(entry = '/portal/municipal/mapa') {
  return render(<MemoryRouter initialEntries={[entry]}><PortalMapPage /><LocationProbe /></MemoryRouter>);
}

describe('mapa operacional do portal', () => {
  beforeEach(() => {
    mocks.query.data = {
      items: [
        { id: '1', protocol: 'TCS-001', status: 'concluida', address: 'Rua A', latitude: -8.1, longitude: -34.9, formulario_id: 'inspecao_bueiro_drenagem_v1' },
        { id: '2', protocol: 'TCS-002', status: 'pendente', address: 'Rua B', latitude: null, longitude: null, formulario_id: 'risco_inundacao_v1' },
      ],
    };
    mocks.query.isLoading = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
  });
  afterEach(cleanup);

  it('mantém mapa e alternativa textual no mesmo recorte autorizado', () => {
    renderPage();
    expect(screen.getByLabelText('Mapa de vistorias')).toHaveTextContent('TCS-001, TCS-002');
    expect(screen.getByText('1 de 2 vistorias possuem coordenadas disponíveis.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Lista das vistorias exibidas' })).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Ver vistoria' })[0]).toHaveAttribute('href', expect.stringContaining('/portal/municipal/vistorias/1'));
  });

  it('persiste busca e status na URL e aplica o mesmo filtro à lista e ao mapa', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Buscar vistoria ou endereço'), { target: { value: 'Rua B' } });
    fireEvent.change(screen.getByLabelText('Filtrar mapa por status'), { target: { value: 'pendente' } });
    expect(screen.getByLabelText('Mapa de vistorias')).toHaveTextContent('TCS-002');
    expect(screen.queryByText('TCS-001')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('busca=Rua+B&status=pendente');
  });

  it('filtra mapa e lista pelo formulário selecionado', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Filtrar mapa por formulário'), { target: { value: 'inspecao_bueiro_drenagem_v1' } });
    expect(screen.getByLabelText('Mapa de vistorias')).toHaveTextContent('TCS-001');
    expect(screen.queryByText('TCS-002')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('formulario=inspecao_bueiro_drenagem_v1');
  });

  it('diferencia vazio real de filtro sem resultado', () => {
    const { rerender } = renderPage('/portal/municipal/mapa?busca=inexistente');
    expect(screen.getByRole('heading', { name: 'Nenhum ponto corresponde aos filtros' })).toBeVisible();
    mocks.query.data = { items: [] };
    rerender(<MemoryRouter><PortalMapPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Nenhuma vistoria no mapa' })).toBeVisible();
  });

  it('trata coordenadas fora dos limites geográficos como indisponíveis', () => {
    mocks.query.data = { items: [{ id: '1', protocol: 'TCS-001', status: 'concluida', address: 'Rua A', latitude: 91, longitude: -34.9 }] };
    renderPage();
    expect(screen.getByText('0 de 1 vistoria possui coordenadas disponíveis.')).toBeVisible();
    expect(screen.getByText(/Sem coordenadas/)).toBeVisible();
  });

  it('oferece retry quando o escopo do mapa falha', () => {
    mocks.query.isError = true;
    mocks.query.data = undefined;
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as vistorias do mapa');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = renderPage();
    expect((await axe(container)).violations).toEqual([]);
  });
});
