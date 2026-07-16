import { describe, expect, it } from 'vitest';
import { customerKeys } from './customerKeys';
import { parseCustomerDetail } from './useCustomerDetail';

describe('customer detail contract', () => {
  it('mantém caches separados ao trocar de cliente', () => {
    expect(customerKeys.detail('user:11111111-1111-1111-1111-111111111111'))
      .not.toEqual(customerKeys.detail('user:22222222-2222-2222-2222-222222222222'));
  });

  it('converte o JSON da RPC em domínio tipado', () => {
    const detail = parseCustomerDetail({
      customer: {
        customer_id: 'user:11111111-1111-1111-1111-111111111111',
        kind: 'individual',
        subject_id: '11111111-1111-1111-1111-111111111111',
        display_name: 'Cliente teste',
        status: 'active',
      },
      subscription: null,
      usage: [],
      users: [{ user_id: '11111111-1111-1111-1111-111111111111', status: 'active' }],
      sessions: [],
      inspections: [],
      tickets: [],
      onboarding: null,
      audit: [],
      can_view_sensitive: false,
    });
    expect(detail.customer.kind).toBe('individual');
    expect(detail.users).toHaveLength(1);
    expect(detail.can_view_sensitive).toBe(false);
  });

  it('rejeita resposta sem identidade do cliente', () => {
    expect(() => parseCustomerDetail({ customer: {}, users: [] })).toThrow(/obrigatório/);
  });
});
