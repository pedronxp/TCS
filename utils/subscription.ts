import type { SubscriptionContextValue, UsageItem } from '../context/SubscriptionContext';

export function subscriptionAllowsCreation(context: SubscriptionContextValue | null): boolean {
  if (!context?.enforced) return true;
  return ['trial', 'active', 'grace'].includes(context.subscription?.status || '');
}

export function featureIsAvailable(context: SubscriptionContextValue | null, code: string): boolean {
  return !context?.enforced || (subscriptionAllowsCreation(context) && context.features[code] === true);
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
