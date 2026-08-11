// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const mocks = vi.hoisted(() => ({ calls: [] as Array<[string, string, number]> }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: (search: string, status: string, page: number) => {
    mocks.calls.push([search, status, page]);
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

afterEach(() => { cleanup(); mocks.calls = []; });

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

  it('restaura busca, status e paginação pela URL e mantém os filtros ao reconsultar', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/app/clientes?q=Aurora&status=active&page=2']}><CustomersPage /></MemoryRouter>);

    expect(screen.getByPlaceholderText('Nome, município, contato ou identificador')).toHaveValue('Aurora');
    expect(screen.getByRole('button', { name: 'Ativos' })).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.calls).toContainEqual(['Aurora', 'active', 2]);

    await user.click(screen.getByRole('button', { name: 'Onboarding' }));
    expect(mocks.calls).toContainEqual(['Aurora', 'onboarding', 0]);
  });
});
