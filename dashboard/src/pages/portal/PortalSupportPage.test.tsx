// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as supportModule from './PortalSupportPage';
import { PortalSupportPage } from './PortalSupportPage';

const state = vi.hoisted(() => ({
  access: {
    accountKind: 'organization' as const,
    userId: 'user-1',
    displayName: 'Coordenação TCS',
    organizationId: 'org-1',
    organizationName: 'Cataguases',
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
    permissions: ['support.read', 'support.create'],
    creationAllowed: true,
    restrictionCause: null,
  },
  tickets: {
    items: [
      {
        id: 'ticket-1',
        title: 'Falha na sincronização do aplicativo',
        subtitle: 'PROTO-001',
        status: 'open',
        category: 'tecnico',
        priority: 'high',
        created_at: '2026-08-01T10:00:00.000Z',
        description: 'O aplicativo não envia vistorias offline.',
      },
    ],
    summary: { total: 1, open: 1 },
  },
  eventsError: true,
  events: [] as Array<Record<string, unknown>>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[1] === 'support-events') {
      if (state.eventsError) {
        return { data: undefined, isLoading: false, isError: true, error: new Error('not_found'), refetch: vi.fn() };
      }
      return { data: state.events, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    }
    return { data: state.tickets, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  },
}));

vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({ access: state.access, can: (permission: string) => state.access.permissions.includes(permission) }),
}));

vi.mock('@/lib/portal', () => ({
  fetchPortalWorkspace: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'function not found' } })),
  },
}));

afterEach(cleanup);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/portal/municipal/suporte']}>
      <PortalSupportPage />
    </MemoryRouter>,
  );
}

describe('Suporte do portal municipal', () => {
  it('consome apenas eventos explicitamente compartilhados do contrato de timeline', () => {
    const parser = (supportModule as Record<string, unknown>).parsePublicSupportTimeline;
    expect(parser).toEqual(expect.any(Function));

    const events = (parser as (value: unknown) => Array<Record<string, unknown>>)({
      events: [
        { id: 'evt-shared', message: 'Resposta pública.', visibility: 'shared', event_type: 'client_message' },
        { id: 'evt-note', message: 'Nota interna.', visibility: 'internal', event_type: 'note' },
        { id: 'evt-unknown', message: 'Sem visibilidade.', event_type: 'message' },
      ],
    });

    expect(events).toEqual([{ id: 'evt-shared', message: 'Resposta pública.', visibility: 'shared', event_type: 'client_message' }]);
  });

  it('lista chamados e abre o detalhe do protocolo', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Falha na sincronização do aplicativo')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Ver detalhes de Falha na sincronização do aplicativo/i }));

    await waitFor(() => expect(screen.getByText('PROTO-001')).toBeVisible());
    expect(screen.getByText(/O aplicativo não envia vistorias offline/i)).toBeVisible();
  });

  it('exibe o estado "em integração" da linha do tempo de respostas sem inventar respostas', async () => {
    state.eventsError = true;
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Ver detalhes de/i }));

    await waitFor(() => expect(screen.getByText('Respostas em integração')).toBeVisible());
    expect(screen.getByText(/linha do tempo de respostas da equipe aparecerá aqui/i)).toBeVisible();
  });

  it('não expõe notas internas da equipe no espaço público do cliente', async () => {
    state.eventsError = false;
    state.events = [
      { id: 'evt-1', message: 'Resposta pública para o cliente.', created_at: '2026-08-02T10:00:00.000Z', event_type: 'message', visibility: 'shared' },
      { id: 'evt-2', message: 'Nota interna confidencial da equipe.', created_at: '2026-08-02T11:00:00.000Z', event_type: 'note', visibility: 'internal' },
    ];
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Ver detalhes de/i }));

    await waitFor(() => expect(screen.getByText('Resposta pública para o cliente.')).toBeVisible());
    // nota interna jamais aparece no portal do cliente
    expect(screen.queryByText('Nota interna confidencial da equipe.')).not.toBeInTheDocument();
  });
});
