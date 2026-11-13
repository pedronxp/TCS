// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsPage } from './SubscriptionsPage';

// jsdom não implementa ResizeObserver/scrollIntoView — usados pelo Radix Select ao abrir.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = () => {};
// jsdom não implementa pointer capture — o trigger do Radix Select consulta hasPointerCapture no pointerdown.
Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false });
Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {} });
Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {} });

const fixes = vi.hoisted(() => ({
  plans: [
    { id: 'plan-1', name: 'Municipal Pro', audience: 'organization', status: 'active' },
    { id: 'plan-2', name: 'Municipal Básico', audience: 'organization', status: 'active' },
  ],
  subscription: {
    id: 'subscription-1',
    plan_id: 'plan-1',
    organization_id: 'organization-1',
    user_id: null,
    status: 'active',
    starts_at: '2026-01-01T00:00:00.000Z',
    trial_ends_at: null,
    current_period_start: '2026-07-01T00:00:00.000Z',
    current_period_end: '2026-08-31T00:00:00.000Z',
    grace_ends_at: null,
    canceled_at: null,
    overrides: {},
    created_at: '2026-01-01T00:00:00.000Z',
    plans: { name: 'Municipal Pro', audience: 'organization', current_version: 2, plan_versions: [{ version: 2, configuration: { commercial: { monthly_price_cents: 399000 } } }] },
    organizations: { display_name: 'Prefeitura de Aurora' },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === 'commercial-plans-options' ? fixes.plans : [fixes.subscription],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

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

async function openDialog() {
  const user = userEvent.setup();
  render(<SubscriptionsPage />);
  await user.click(screen.getByRole('button', { name: 'Editar assinatura de Prefeitura de Aurora' }));
  await screen.findByText('Editar assinatura');
  return { user };
}

function statusTrigger() {
  return document.getElementById('subscription-status') as HTMLElement;
}

function planTrigger() {
  return document.getElementById('subscription-plano') as HTMLElement;
}

type UserEventInstance = ReturnType<typeof userEvent.setup>;

/** Abre o Select Radix do diálogo e escolhe a opção pelo texto visível. */
async function pickOption(user: UserEventInstance, trigger: HTMLElement, optionName: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: optionName }));
}

function transitionNote() {
  const statuses = screen.queryAllByRole('status', {});
  // a legenda de transição fica na seção "Status e Ciclo" e cita os termos de transição
  return statuses.find((node) => /Mudança de plano|Cancelamento registrado|Acesso suspenso|Carência ativa|Pagamento pendente|Período de teste|expirada/i.test(node.textContent ?? '')) ?? null;
}

describe('Assinatura: transições e transparência', () => {
  it('explica cancelamento ao mudar o status para cancelado', async () => {
    const { user } = await openDialog();

    await pickOption(user, statusTrigger(), 'Cancelado');

    const note = transitionNote();
    expect(note).not.toBeNull();
    expect(note).toHaveTextContent(/Cancelamento registrado/i);
    expect(note).toHaveTextContent(/abra uma nova assinatura ou reative dentro do ciclo/i);
  });

  it('explica suspensão e bloqueia novas operações', async () => {
    const { user } = await openDialog();

    await pickOption(user, statusTrigger(), 'Suspenso');

    const note = transitionNote();
    expect(note).not.toBeNull();
    expect(note).toHaveTextContent(/Acesso suspenso/i);
    expect(note).toHaveTextContent(/nenhuma operação é permitida/i);
  });

  it('sinaliza mudança de plano (upgrade/downgrade) como mudança auditável do próximo ciclo', async () => {
    const { user } = await openDialog();

    // troca do plano atual (Municipal Pro) para o Municipal Básico — downgrade visível
    await pickOption(user, planTrigger(), 'Municipal Básico');

    const note = transitionNote();
    expect(note).not.toBeNull();
    expect(note).toHaveTextContent(/Mudança de plano/i);
    expect(note).toHaveTextContent(/a partir do próximo ciclo/i);
    expect(note).toHaveTextContent(/registra o plano anterior na auditoria/i);
  });

  it('mantém o status ativo sem legenda de transição', async () => {
    await openDialog();
    expect(transitionNote()).toBeNull();
  });
});
