import type { SubscriptionContextValue, UsageItem } from '../context/SubscriptionContext';

export function needsSubscriptionConfirmation(
  subscription: SubscriptionContextValue['subscription'] | undefined,
  now = Date.now(),
): boolean {
  if (subscription?.status !== 'active' || subscription.renewal_required === false || !subscription.period_end) return false;
  const periodEnd = Date.parse(subscription.period_end);
  return Number.isFinite(periodEnd) && periodEnd <= now;
}

export function subscriptionAllowsCreation(context: SubscriptionContextValue | null, now = Date.now()): boolean {
  if (!context) return false;
  if (!context.enforced) return true;
  const subscription = context.subscription;
  if (!subscription || !['trial', 'active', 'grace'].includes(subscription.status)) return false;
  if (subscription.status === 'active' && subscription.renewal_required === false) return true;
  const deadline = subscription.status === 'grace' ? subscription.grace_ends_at : subscription.period_end;
  return !deadline || (Number.isFinite(Date.parse(deadline)) && Date.parse(deadline) > now);
}

export function featureIsAvailable(context: SubscriptionContextValue | null, code: string): boolean {
  return context !== null && (!context.enforced || (subscriptionAllowsCreation(context) && context.features[code] === true));
}

export function usagePercent(item: Pick<UsageItem, 'consumed' | 'limit'>): number | null {
  if (item.limit === null) return null;
  if (item.limit === 0) return item.consumed > 0 ? 100 : 0;
  return Math.min(100, Math.round(item.consumed * 100 / item.limit));
}

export function canConsume(item: Pick<UsageItem, 'consumed' | 'limit'>, amount = 1): boolean {
  return amount > 0 && (item.limit === null || item.consumed + amount <= item.limit);
}

export function canManageOrganization(role: 'owner' | 'coordinator' | 'supervisor' | 'agent' | null, action: 'invite_agent' | 'invite_supervisor' | 'end_session'): boolean {
  if (role === 'owner' || role === 'coordinator') return true;
  return role === 'supervisor' && action !== 'invite_supervisor';
}
