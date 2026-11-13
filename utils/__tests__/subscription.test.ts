import { canConsume, canManageOrganization, featureIsAvailable, needsSubscriptionConfirmation, subscriptionAllowsCreation, usagePercent } from '../subscription';
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
  it.each(['monthly', 'annual'])('honors a server-confirmed free %s cycle without asking for payment', billing_cycle => {
    const subscription = { ...context().subscription!, period_end: '2020-01-01', billing_cycle, renewal_required: false };
    expect(subscriptionAllowsCreation(context({ subscription }))).toBe(true);
    expect(needsSubscriptionConfirmation(subscription)).toBe(false);
    expect(subscriptionAllowsCreation(context({ subscription: { ...subscription, renewal_required: undefined } }))).toBe(false);
    expect(needsSubscriptionConfirmation({ ...subscription, renewal_required: undefined })).toBe(true);
  });
  it('does not grant creation or paid features before a verified context exists', () => {
    expect(subscriptionAllowsCreation(null)).toBe(false);
    expect(featureIsAvailable(null, 'inspection_standard')).toBe(false);
  });
  it('does not reuse an elapsed paid cycle or grace deadline as a creation grant', () => {
    const now = Date.parse('2026-11-12T00:00:00Z');
    expect(subscriptionAllowsCreation(context({ subscription: { ...context().subscription!, period_end: '2026-10-13' } }), now)).toBe(false);
    expect(subscriptionAllowsCreation(context({ subscription: { ...context().subscription!, status: 'grace', grace_ends_at: '2026-11-11' } }), now)).toBe(false);
    expect(subscriptionAllowsCreation(context({ subscription: { ...context().subscription!, period_end: '2026-11-13' } }), now)).toBe(true);
  });
  it('marks only an active cycle with a valid elapsed end date for confirmation', () => {
    const subscription = { ...context().subscription!, period_end: '2026-10-13T00:00:00Z' };
    expect(needsSubscriptionConfirmation(subscription, Date.parse('2026-11-12'))).toBe(true);
    expect(needsSubscriptionConfirmation(subscription, Date.parse('2026-10-12'))).toBe(false);
    expect(needsSubscriptionConfirmation({ ...subscription, status: 'canceled' }, Date.parse('2026-11-12'))).toBe(false);
    expect(needsSubscriptionConfirmation({ ...subscription, period_end: 'invalid' })).toBe(false);
  });
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
