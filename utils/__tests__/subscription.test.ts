import { canConsume, canManageOrganization, featureIsAvailable, subscriptionAllowsCreation, usagePercent } from '../subscription';
import type { SubscriptionContextValue } from '../../context/SubscriptionContext';

function context(overrides: Partial<SubscriptionContextValue> = {}): SubscriptionContextValue {
  return {
    enforced: true,
    organization: null,
    membership: null,
    subscription: { id: 's1', status: 'active', period_start: '2026-07-01', period_end: null, grace_ends_at: null },
    plan: { id: 'p1', code: 'test', name: 'Teste', audience: 'individual', version: 1 },
    features: { inspection_standard: true, inspection_arv: false },
    usage: [],
    ...overrides,
  };
}

describe('subscription entitlements', () => {
  it.each(['trial', 'active', 'grace'] as const)('allows creation for %s', status => {
    expect(subscriptionAllowsCreation(context({ subscription: { ...context().subscription!, status } }))).toBe(true);
  });

  it.each(['past_due', 'canceled', 'expired'] as const)('blocks creation for %s when enforced', status => {
    expect(subscriptionAllowsCreation(context({ subscription: { ...context().subscription!, status } }))).toBe(false);
  });

  it('keeps compatibility mode permissive', () => {
    expect(featureIsAvailable(context({ enforced: false, subscription: null, features: {} }), 'inspection_arv')).toBe(true);
  });

  it('checks explicit feature entitlement', () => {
    expect(featureIsAvailable(context(), 'inspection_standard')).toBe(true);
    expect(featureIsAvailable(context(), 'inspection_arv')).toBe(false);
  });

  it('computes warnings and hard limits', () => {
    expect(usagePercent({ consumed: 8, limit: 10 })).toBe(80);
    expect(canConsume({ consumed: 9, limit: 10 })).toBe(true);
    expect(canConsume({ consumed: 10, limit: 10 })).toBe(false);
    expect(canConsume({ consumed: 999, limit: null })).toBe(true);
  });

  it('enforces municipal membership permissions', () => {
    expect(canManageOrganization('coordinator', 'invite_supervisor')).toBe(true);
    expect(canManageOrganization('supervisor', 'invite_agent')).toBe(true);
    expect(canManageOrganization('supervisor', 'invite_supervisor')).toBe(false);
    expect(canManageOrganization('agent', 'end_session')).toBe(false);
  });
});
