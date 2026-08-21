// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalAgendaPage } from './PortalAgendaPage';
import type { PortalRestrictionCause } from '@/types/portal';

const mocks = vi.hoisted(() => ({
  agenda: { data: { items: [] as Array<Record<string, unknown>> }, isLoading: false, isError: false, refetch: vi.fn() },
  inspections: { data: { items: [{ id: 'insp-1', protocol: 'TCS-001' }] }, isLoading: false, isError: false, refetch: vi.fn() },
  rpc: vi.fn(),
  access: {
    accountKind: 'individual' as const, userId: 'user-1', organizationId: null, role: null,
    creationAllowed: true, restrictionCause: null as PortalRestrictionCause | null,
  },
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: (config: { queryKey: unknown[] }) => config.queryKey.includes('agenda') && !config.queryKey.includes('vistorias') ? mocks.agenda : mocks.inspections }));
vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => ({ access: mocks.access }) }));
vi.mock('@/lib/portal', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/portal')>()), fetchPortalWorkspace: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(entry = '/portal/individual/agenda') {
  return render(<MemoryRouter initialEntries={[entry]}><PortalAgendaPage /><LocationProbe /></MemoryRouter>);
}

describe('agenda operacional do portal', () => {
  beforeEach(() => {
    mocks.agenda.data = { items: [] };
    mocks.agenda.isLoading = false;
    mocks.agenda.isError = false;
    mocks.agenda.refetch.mockReset();
    mocks.inspections.data = { items: [{ id: 'insp-1', protocol: 'TCS-001' }] };
    mocks.inspections.isLoading = false;
    mocks.inspections.isError = false;
    mocks.inspections.refetch.mockReset();
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.access.creationAllowed = true;
    mocks.access.restrictionCause = null;
  });
  afterEach(cleanup);

  it('abre e fecha o formulário pela URL sem animar a troca', () => {
    renderPage('/portal/individual/agenda?novo=1');
    expect(screen.getByRole('heading', { name: 'Novo agendamento' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fechar formulário' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/portal/individual/agenda');
  });

  it('devolve o foco ao gatilho quando o formulário é cancelado', async () => {
    renderPage('/portal/individual/agenda?novo=1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo agendamento' })).toHaveFocus());
  });

  it('preserva o contrato do RPC e atualiza a agenda após sucesso', async () => {
    renderPage('/portal/individual/agenda?novo=1');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Retorno técnico' } });
    fireEvent.change(screen.getByLabelText('Data e hora'), { target: { value: '2026-08-10T09:30' } });
    fireEvent.change(screen.getByLabelText('Vistoria'), { target: { value: 'insp-1' } });
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Levar documentação' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agendamento' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('portal_create_appointment', expect.objectContaining({
      p_inspection_id: 'insp-1', p_title: 'Retorno técnico', p_notes: 'Levar documentação',
    })));
    expect(await screen.findByText('Agendamento criado e incluído na agenda.')).toBeVisible();
    expect(mocks.agenda.refetch).toHaveBeenCalledOnce();
  });

  it('mantém o formulário e explica quando nenhuma alteração é salva', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'denied' } });
    renderPage('/portal/individual/agenda?novo=1');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Retorno técnico' } });
    fireEvent.change(screen.getByLabelText('Data e hora'), { target: { value: '2026-08-10T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agendamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhuma alteração foi salva');
    expect(screen.getByRole('heading', { name: 'Novo agendamento' })).toBeVisible();
  });

  it('recupera de rejeição de rede sem apagar nem travar o formulário', async () => {
    mocks.rpc.mockRejectedValue(new Error('network'));
    renderPage('/portal/individual/agenda?novo=1');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Retorno técnico' } });
    fireEvent.change(screen.getByLabelText('Data e hora'), { target: { value: '2026-08-10T09:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agendamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhuma alteração foi salva');
    expect(screen.getByLabelText('Título')).toHaveValue('Retorno técnico');
    expect(screen.getByRole('button', { name: 'Salvar agendamento' })).toBeEnabled();
  });

  it('explica o bloqueio de criação sem esconder a agenda', () => {
    mocks.access.creationAllowed = false;
    mocks.access.restrictionCause = 'subscription_past_due';
    mocks.agenda.data = { items: [{ id: 'a-1', title: 'Reunião', scheduled_at: '2026-08-10T12:00:00Z', status: 'agendado' }] };
    renderPage();
    expect(screen.getByRole('button', { name: 'Novo agendamento' })).toBeDisabled();
    expect(screen.getByText(/pendência de pagamento/i)).toBeVisible();
    expect(screen.getByText('Reunião')).toBeVisible();
  });

  it('normaliza ?novo=1 quando a permissão de criação está bloqueada', async () => {
    mocks.access.creationAllowed = false;
    renderPage('/portal/individual/agenda?novo=1');
    expect(screen.queryByRole('heading', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo agendamento' })).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/portal/individual/agenda'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('novo=1');
  });

  it('oferece recuperação quando a agenda falha', () => {
    mocks.agenda.isError = true;
    mocks.agenda.data = undefined as never;
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a agenda');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.agenda.refetch).toHaveBeenCalledOnce();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    mocks.agenda.data = { items: [{ id: 'a-1', title: 'Reunião', scheduled_at: '2026-08-10T12:00:00Z', status: 'agendado' }] };
    const { container } = renderPage();
    expect((await axe(container)).violations).toEqual([]);
  });
});
