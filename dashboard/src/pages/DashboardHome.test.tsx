// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardHome } from './DashboardHome';

const { dashboardState, executiveData } = vi.hoisted(() => {
  const executive = {
    kind: 'executive' as const,
    metrics: [
      { key: 'customers', label: 'Clientes', value: 148 },
      { key: 'subscriptions', label: 'Assinaturas vigentes', value: 132 },
      { key: 'renewals', label: 'Renovações em 30 dias', value: 12 },
      { key: 'past_due', label: 'Assinaturas em risco', value: 4 },
      { key: 'support', label: 'Chamados abertos', value: 7 },
      { key: 'sla', label: 'SLAs violados', value: 1 },
      { key: 'onboarding', label: 'Implantações em curso', value: 3 },
    ],
    attention: [{
      type: 'renewal',
      label: 'Prefeitura de Aurora',
      detail: 'Plano Gestão',
      status: 'active',
      customerId: 'organization:aurora',
      dueAt: '2026-08-01T12:00:00Z',
    }],
    release: null,
  };
  return { executiveData: executive, dashboardState: { data: executive as unknown } };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: dashboardState.data,
    dataUpdatedAt: Date.now(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      displayName: 'Pedro Paulo',
      role: 'owner',
      permissions: ['customer.write', 'commercial.read', 'support.read'],
    },
    can: () => true,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

afterEach(() => {
  cleanup();
  dashboardState.data = executiveData;
});

describe('Dashboard executivo', () => {
  it('reproduz a composição executiva aprovada', () => {
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    // O hero saúda o usuário pelo nome (saudação varia por horário).
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeVisible();
    expect(screen.getByText('Assinaturas vigentes')).toBeVisible();
    expect(screen.getByText('Prefeitura de Aurora')).toBeVisible();
    expect(screen.getByText('Ações rápidas')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('apresenta a visão técnica do developer com releases e filas separadas', () => {
    dashboardState.data = {
      kind: 'technical',
      metrics: [
        { key: 'builds_running', label: 'Builds em execução', value: 2 },
        { key: 'builds_failed', label: 'Builds com falha', value: 1 },
        { key: 'sync', label: 'Sincronização', value: 3 },
        { key: 'storage', label: 'Armazenamento', value: 2 },
        { key: 'errors', label: 'Erros', value: 4 },
      ],
      attention: [{
        type: 'technical',
        label: 'Falha ao sincronizar lote',
        detail: 'sync · android',
        status: 'critical',
        customerId: 'organization:aurora',
        dueAt: null,
      }],
      release: { published: '2.17.0', minimum: '2.16.4', development: '2.18.0-beta.2' },
    };

    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // As três primeiras métricas técnicas aparecem como números monumentais
    expect(screen.getByText('Builds em execução')).toBeVisible();
    expect(screen.getByText('Builds com falha')).toBeVisible();
    expect(screen.getByText('Sincronização')).toBeVisible();
    // Atenções recentes e atalhos também estão presentes
    expect(screen.getByText('Falha ao sincronizar lote')).toBeVisible();
    expect(screen.getByText('Ações rápidas')).toBeVisible();
  });
});
