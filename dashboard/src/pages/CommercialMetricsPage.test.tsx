// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommercialMetricsPage } from './CommercialMetricsPage';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      metrics: [
        { key: 'customers', label: 'Clientes', value: 12 },
        { key: 'subscriptions', label: 'Assinaturas vigentes', value: 10 },
        { key: 'renewals', label: 'Renovações em 30 dias', value: 3 },
        { key: 'past_due', label: 'Assinaturas em risco', value: 1 },
        { key: 'support', label: 'Chamados abertos', value: 2 },
        { key: 'sla', label: 'SLAs violados', value: 1 },
      ],
      priorities: [{ type: 'renewal', label: 'Prefeitura de Aurora', detail: 'Municipal Pro', status: 'active', customerId: 'organization:aurora', dueAt: '2026-09-01T12:00:00.000Z' }],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: { userId: 'owner-1', role: 'owner' } }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));

afterEach(cleanup);

describe('Indicadores comerciais', () => {
  it('apresenta carteira e ações de negócio sem inventar estimativas', () => {
    render(<MemoryRouter><CommercialMetricsPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Indicadores' })).toBeVisible();
    expect(screen.getByText('Prioridades da carteira')).toBeVisible();
    expect(screen.getByText('Prefeitura de Aurora')).toBeVisible();
    expect(screen.getByRole('link', { name: /^Abrir$/ })).toHaveAttribute('href', '/app/clientes/organizacoes/aurora');
    expect(screen.getByRole('link', { name: /Revisar assinaturas/ })).toHaveAttribute('href', '/app/assinaturas');
  });
});
