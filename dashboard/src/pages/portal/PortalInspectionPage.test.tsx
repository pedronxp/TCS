// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalInspectionPage } from './PortalInspectionPage';

const mocks = vi.hoisted(() => ({
  query: { data: undefined as Record<string, unknown> | undefined, isLoading: false, isError: false, refetch: vi.fn() },
  queryFn: undefined as undefined | (() => Promise<unknown>),
  rpc: vi.fn(),
  invoke: vi.fn(),
  access: {
    accountKind: 'individual' as 'individual' | 'organization', userId: 'user-1', organizationId: null as string | null, role: null,
    permissions: ['inspection.read', 'document.read'] as string[],
  },
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: (config: { queryFn: () => Promise<unknown> }) => { mocks.queryFn = config.queryFn; return mocks.query; } }));
vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => ({ access: mocks.access }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));

function renderPage(entry = '/portal/individual/vistorias/insp-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/portal/individual/vistorias/:inspectionId" element={<PortalInspectionPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('detalhe de vistoria do portal', () => {
  beforeEach(() => {
    mocks.query.data = {
      id: 'insp-1', protocol: 'TCS-001', status: 'em_andamento', risk_level: 'alto', score: 82,
      occurred_at: '2026-08-09T12:00:00.000Z', address: 'Rua Um, 10', municipality: 'Recife', agent_name: 'Ana',
      latitude: -8.05, longitude: -34.9, document_available: true,
    };
    mocks.query.isLoading = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
    mocks.access.permissions = ['inspection.read', 'document.read'];
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('mostra os dados autorizados e preserva o retorno filtrado', () => {
    renderPage('/portal/individual/vistorias/insp-1?returnTo=%2Fportal%2Findividual%2Fvistorias%3Fstatus%3Dconcluida');
    expect(screen.getByRole('heading', { name: 'TCS-001' })).toBeVisible();
    expect(screen.getByText('Em andamento')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Vistorias' })).toHaveAttribute('href', '/portal/individual/vistorias?status=concluida');
  });

  it('retorna ao recorte do mapa sem aceitar destinos externos', () => {
    const { unmount } = renderPage('/portal/individual/vistorias/insp-1?returnTo=%2Fportal%2Findividual%2Fmapa%3Fstatus%3Dpendente');
    expect(screen.getByRole('link', { name: 'Voltar ao mapa' })).toHaveAttribute('href', '/portal/individual/mapa?status=pendente');
    unmount();
    renderPage('/portal/individual/vistorias/insp-1?returnTo=https%3A%2F%2Fexample.com');
    expect(screen.getByRole('link', { name: 'Vistorias' })).toHaveAttribute('href', '/portal/individual/vistorias');
  });

  it('não oferece o laudo sem permissão documental', () => {
    mocks.access.permissions = ['inspection.read'];
    renderPage();
    expect(screen.getByText(/não possui permissão para acessar o laudo/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Visualizar laudo' })).not.toBeInTheDocument();
  });

  it('rejeita resposta documental insegura ou incompatível', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, disposition: 'view', signed_url: 'http://storage.example/laudo.pdf' }, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar laudo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível autorizar o documento'));
    expect(screen.queryByRole('link', { name: /autorizado/i })).not.toBeInTheDocument();
  });

  it('oferece um link HTTPS autorizado sem abrir popup nem abandonar o portal', async () => {
    const open = vi.spyOn(window, 'open');
    mocks.invoke.mockResolvedValue({ data: { ok: true, disposition: 'download', signed_url: 'https://storage.example/laudo.pdf?token=abc' }, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Baixar arquivo' }));
    const link = await screen.findByRole('link', { name: 'Baixar arquivo autorizado' });
    expect(link).toHaveAttribute('href', 'https://storage.example/laudo.pdf?token=abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(open).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledWith('portal-inspection-document', { body: { inspection_id: 'insp-1', mode: 'download' } });
  });

  it('rejeita disposition diferente da ação solicitada', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, disposition: 'download', signed_url: 'https://storage.example/laudo.pdf' }, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar laudo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível autorizar o documento');
  });

  it('rejeita resposta HTTPS que não confirma autorização', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: false, disposition: 'view', signed_url: 'https://storage.example/laudo.pdf' }, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar laudo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível autorizar o documento');
  });

  it('rejeita detalhe com qualquer campo consumido malformado', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...mocks.query.data, latitude: 91 },
      error: null,
    });
    renderPage();
    await expect(mocks.queryFn?.()).rejects.toThrow('inspection_not_found');
  });

  it('oferece recuperação quando o detalhe está indisponível', () => {
    mocks.query.isError = true;
    mocks.query.data = undefined;
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Vistoria indisponível');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = renderPage();
    expect((await axe(container)).violations).toEqual([]);
  });
});
