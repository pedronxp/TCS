// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportPage } from './SupportPage';

const supportFixtures = vi.hoisted(() => ({
  queue: {
    total: 3,
    assignees: [{ id: 'staff-1', name: 'Ana Lima' }],
    items: [
      {
        id: 'ticket-1',
        code: 'SUP-1042',
        subject: 'Sincronização interrompida',
        description: 'Agentes não conseguem sincronizar.',
        category: 'technical',
        priority: 'critical',
        status: 'in_progress',
        assignedTo: 'staff-1',
        assignedName: 'Ana Lima',
        responseDue: '2026-07-26T18:00:00.000Z',
        resolutionDue: '2026-07-27T18:00:00.000Z',
        escalateAt: '2026-07-26T19:00:00.000Z',
        createdAt: '2026-07-26T12:00:00.000Z',
        customerId: 'organization-1',
        customerName: 'Prefeitura de Aurora',
        planId: 'plan-1',
        planName: 'Municipal Pro',
        breached: true,
        escalated: true,
      },
      {
        id: 'ticket-2',
        code: 'SUP-1041',
        subject: 'Dúvida sobre relatório',
        description: 'Cliente aguarda retorno.',
        category: 'product',
        priority: 'normal',
        status: 'waiting_customer',
        assignedTo: null,
        assignedName: null,
        responseDue: null,
        resolutionDue: null,
        escalateAt: null,
        createdAt: '2026-07-25T12:00:00.000Z',
        customerId: 'organization-1',
        customerName: 'Prefeitura de Aurora',
        planId: 'plan-1',
        planName: 'Municipal Pro',
        breached: false,
        escalated: false,
      },
    ],
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === 'support-plans'
      ? [{ id: 'plan-1', name: 'Municipal Pro' }]
      : queryKey[0] === 'support-events'
        ? [{ id: 'event-1', event_type: 'note', message: 'Contexto validado', metadata: {}, actor_id: 'staff-123456789', created_at: '2026-07-26T13:00:00.000Z' }]
        : supportFixtures.queue,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true, user: { id: 'staff-1' }, profile: { role: 'owner' } }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    data: { items: [{ customer_id: 'organization-1', subject_id: 'organization-1', display_name: 'Prefeitura de Aurora' }] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

afterEach(cleanup);

describe('Central de suporte', () => {
  it('reproduz indicadores, quadro e torre de SLA', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Suporte' })).toBeVisible();
    expect(screen.getByText('Fila por prioridade')).toBeVisible();
    expect(screen.getByText('Risco de SLA')).toBeVisible();
    expect(screen.getByText('Aguardando cliente')).toBeVisible();
    expect(screen.getByText('Panorama de SLA')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<SupportPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('traça linha do tempo e indica a próxima ação honesta por coluna', () => {
    render(<SupportPage />);
    expect(screen.getByText(/linha do tempo com horário e responsável/)).toBeVisible();
    // chamado em risco de SLA -> ação "Abrir" (prioridade), sem prometer resolução imediata
    expect(screen.getByText('Abrir')).toBeVisible();
    // chamado aguardando cliente -> ação "Responder"
    expect(screen.getByText('Responder')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /SUP-1042/ }));
    expect(screen.getByText('Responsável interno · staff-12…')).toBeVisible();
    expect(screen.getByText('Contexto validado')).toBeVisible();
  });
});
