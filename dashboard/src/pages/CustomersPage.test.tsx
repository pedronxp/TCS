// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomersPage } from './CustomersPage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const customer = {
  customer_id: 'customer-1',
  subject_id: 'organization-1',
  kind: 'organization' as const,
  display_name: 'Prefeitura de Aurora',
  legal_name: null,
  municipality_name: 'Aurora',
  state_code: 'SP',
  status: 'active',
  contact_name: null,
  contact_email: null,
  subscription_status: 'active',
  plan_name: 'Municipal Pro',
  active_users: 24,
  last_activity_at: new Date().toISOString(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: (_search: string, status: string) => {
    const totals: Record<string, number> = { '': 148, onboarding: 12, pilot: 4, active: 129, suspended: 7 };
    return {
      data: {
        items: status === '' ? [customer] : [],
        total: totals[status] ?? 0,
        limit: 25,
        offset: 0,
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

vi.mock('@/components/customers/OrganizationFormDialog', () => ({
  OrganizationFormDialog: () => null,
}));

vi.mock('@/components/customers/IndividualClientDialog', () => ({
  IndividualClientDialog: () => null,
}));

afterEach(cleanup);

describe('Carteira de clientes', () => {
  it('reproduz indicadores, filtros, tabela e radar aprovados', () => {
    render(<MemoryRouter initialEntries={['/app/clientes']}><CustomersPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    expect(screen.getByText('Total da base')).toBeVisible();
    expect(screen.getByText('Carteira completa')).toBeVisible();
    expect(screen.getByText('Prefeitura de Aurora')).toBeVisible();
    expect(screen.getByText('Radar de implantação')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/app/clientes']}><CustomersPage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
