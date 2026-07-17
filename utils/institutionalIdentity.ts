import type { SubscriptionContextValue } from '../context/SubscriptionContext';

export function resolveInstitutionalIdentity(
  context: SubscriptionContextValue | null | undefined,
): { organizationName: string; role: string | null } | null {
  const organizationName = context?.organization?.display_name?.trim();
  if (!organizationName) return null;
  return {
    organizationName,
    role: context?.membership?.role || null,
  };
}
