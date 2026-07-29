// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsPage } from './SubscriptionsPage';

const queryFixtures = vi.hoisted(() => ({
  plan: { id: 'plan-1', name: 'Municipal Pro', audience: 'organization', status: 'active' },
  subscription: {
    id: 'subscription-1',
    plan_id: 'plan-1',
    organization_id: 'organization-1',
    user_id: null,
    status: 'active',
    starts_at: '2026-01-01T00:00:00.000Z',
    trial_ends_at: null,
    current_period_start: '2026-07-01T00:00:00.000Z',
    current_period_end: '2026-08-10T00:00:00.000Z',
    grace_ends_at: null,
    canceled_at: null,
    overrides: {},
    created_at: '2026-01-01T00:00:00.000Z',
    plans: {
      name: 'Municipal Pro',
      audience: 'organization',
      current_version: 2,
      plan_versions: [{ version: 2, configuration: { commercial: { monthly_price_cents: 399000 } } }],
    },
    organizations: { display_name: 'Prefeitura de Aurora' },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'commercial-plans-options' ? [queryFixtures.plan] : [queryFixtures.subscription],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    data: { items: [{ customer_id: 'organization-1', subject_id: 'organization-1', display_name: 'Prefeitura de Aurora', kind: 'organization' }] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useSubscriptionMutation', () => ({
  useSubscriptionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

afterEach(cleanup);

describe('Ciclos de assinatura', () => {
  it('reproduz fluxo, indicadores, tabela e radar de renovação', () => {
    render(<SubscriptionsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Assinaturas' })).toBeVisible();
    expect(screen.getByText('Fluxo de ciclo')).toBeVisible();
    expect(screen.getByText('MRR contratado')).toBeVisible();
    expect(screen.getByText('Ciclos prioritários')).toBeVisible();
    expect(screen.getByText('Radar de renovação')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<SubscriptionsPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
