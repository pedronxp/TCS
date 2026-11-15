// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://portal.tcs.test/"}
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PortalBillingPage, validatedCheckoutUrl } from './PortalBillingPage';

const state = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: state.invoke } } }));
vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({
    can: () => true,
    access: { accountKind: 'individual', subscriptionStatus: 'past_due', planName: 'Individual Profissional',
      usage: {}, limits: {}, cancelAtPeriodEnd: false, subscriptionSummary: {} },
  }),
}));
vi.mock('@/components/auth/TurnstileChallenge', () => ({
  turnstileEnabled: true,
  TurnstileChallenge: ({ onToken, action }: { onToken: (token: string) => void; action: string }) =>
    <button data-action={action} onClick={() => onToken('qa-proof')}>Verificar pagamento</button>,
}));
beforeEach(() => state.invoke.mockReset().mockResolvedValue({ data: { error: 'payment_provider_not_configured' }, error: null }));
afterEach(cleanup);

it('permite renovar o plano vencido após verificação e preserva a operação nas tentativas', async () => {
  const user = userEvent.setup();
  render(<PortalBillingPage />);
  const renew = screen.getByRole('button', { name: 'Renovar plano' });
  expect(renew).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Verificar pagamento' })).toHaveAttribute('data-action', 'portal_checkout');
  await user.click(screen.getByRole('button', { name: 'Verificar pagamento' }));
  await user.click(renew);
  expect(await screen.findByRole('alert')).toHaveTextContent('provedor de pagamento ainda não está configurado');
  expect(state.invoke).toHaveBeenCalledWith('create-portal-checkout', expect.objectContaining({
    body: expect.objectContaining({ turnstile_token: 'qa-proof', plan_code: 'individual_professional' }),
  }));
  expect(renew).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Verificar pagamento' }));
  await user.click(renew);
  expect(state.invoke.mock.calls[1][1].body.idempotency_key).toBe(state.invoke.mock.calls[0][1].body.idempotency_key);
});

it('aceita o checkout pendente do Mercado Pago com valor e identidade validados', () => {
  const payload = { ok: true, checkout: {
    checkout_id: '11111111-1111-4111-8111-111111111111',
    plan_version_id: '22222222-2222-4222-8222-222222222222',
    amount_cents: 14990, currency: 'BRL', status: 'awaiting_payment',
    provider_configuration_required: false,
    checkout_url: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=qa',
  } };
  expect(validatedCheckoutUrl(payload, 14990)).toBe(payload.checkout.checkout_url);
  expect(validatedCheckoutUrl(payload, 15000)).toBeNull();
  expect(validatedCheckoutUrl({ ...payload, checkout: { ...payload.checkout, checkout_url: 'https://www.mercadopago.com.br.evil.example/checkout/v1/redirect' } }, 14990)).toBeNull();
});
