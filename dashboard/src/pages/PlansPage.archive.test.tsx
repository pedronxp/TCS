// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlansPage } from './PlansPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/usePlanMutation', () => ({
  usePlanMutation: () => ({ mutateAsync: vi.fn() }),
}));

const retiredPlan = {
  id: 'plan-retired',
  code: 'municipal_legacy',
  name: 'Municipal Legado',
  description: 'Plano arquivado da geração anterior.',
  audience: 'organization',
  status: 'retired',
  current_version: 1,
  plan_features: [{ feature_code: 'reports_basic', enabled: true }],
  plan_limits: [
    { resource_code: 'users', hard_limit: 10, warning_percent: 80 },
    { resource_code: 'inspections', hard_limit: 50, warning_percent: 80 },
    { resource_code: 'invitations', hard_limit: 10, warning_percent: 80 },
    { resource_code: 'storage_bytes', hard_limit: 21474836480, warning_percent: 80 },
    { resource_code: 'sessions', hard_limit: 1, warning_percent: 100 },
  ],
  plan_versions: [{ version: 1, configuration: { commercial: { monthly_price_cents: 30000 } }, published_at: '2026-06-01T00:00:00.000Z' }],
  support_sla_policies: [{ priority: 'normal', response_minutes: 480, resolution_minutes: null, escalation_minutes: null }],
};

const activePlan = {
  ...retiredPlan,
  id: 'plan-active',
  code: 'municipal_basic',
  name: 'Municipal Básico',
  description: 'Plano ativo vigente.',
  status: 'active',
};

vi.mock('@/lib/supabase', () => {
  // thenable que também encadeia .order extra (features usa .order().order())
  const makeOrder = (data: unknown) => {
    const result = { data, error: null };
    const obj = {
      order: () => makeOrder(data),
      then: (onFulfilled: unknown) => Promise.resolve(result).then(onFulfilled as never),
    };
    return obj;
  };
  const chain = (data: unknown) => ({ select: () => makeOrder(data) });
  return {
    supabase: {
      from: vi.fn((table: string) => chain(table === 'features' ? [] : [retiredPlan, activePlan])),
    },
  };
});

afterEach(cleanup);

describe('Plano arquivado (retired)', () => {
  it('sinaliza que assinaturas ativas continuam mas novas ativações são bloqueadas', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Municipal Legado' })).toBeVisible();
    });

    const note = screen.getByText((_, node) =>
      Boolean(node?.getAttribute('role') === 'status') && /Plano arquivado/i.test(node.textContent ?? ''),
    );
    expect(note).toBeVisible();
    expect(note).toHaveTextContent(/assinaturas ativas continuam válidas, mas novas ativações não são permitidas/i);
    expect(note).toHaveTextContent(/Reative ou publique uma nova versão/i);
  });

  it('não exibe o aviso de arquivamento para planos ativos', async () => {
    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Municipal Básico' })).toBeVisible();
    });

    // somente o plano arquivado possui o status "Plano arquivado…"
    const archived = screen.getAllByRole('status').filter((node) => /Plano arquivado/i.test(node.textContent ?? ''));
    expect(archived).toHaveLength(1);
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<PlansPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Municipal Legado' })).toBeVisible());
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
