import type { UserProfile } from '../context/AuthContext';
import type { SubscriptionContextValue } from '../context/SubscriptionContext';
import { isInternalMobileRole } from './AppProfileService';

export type MobileAccessKind = 'internal' | 'organization' | 'individual' | 'organization_required';
export type MobileFieldOperation = 'new-inspection' | 'inspections' | 'tactical-map';

export const MOBILE_INSPECTION_MANAGE_PERMISSION = 'mobile.inspection.manage';
export const MOBILE_MAP_READ_PERMISSION = 'mobile.map.read';

export interface MobileOrganizationAccess {
  kind: MobileAccessKind;
  organizationId: string | null;
  organizationName: string | null;
  hasOrganization: boolean;
  requiresOrganizationLink: boolean;
}

type AccessProfile = Pick<UserProfile, 'role' | 'municipio' | 'organizationId'> | null | undefined;
type AccessSubscription = Pick<SubscriptionContextValue, 'organization' | 'membership' | 'plan'> | null | undefined;

export function getMobileFieldOperations(
  permissions: readonly string[] | null | undefined,
): MobileFieldOperation[] {
  const granted = new Set(permissions ?? []);
  const operations: MobileFieldOperation[] = [];

  if (granted.has(MOBILE_INSPECTION_MANAGE_PERMISSION)) {
    operations.push('new-inspection', 'inspections');
  }
  if (granted.has(MOBILE_MAP_READ_PERMISSION)) {
    operations.push('tactical-map');
  }

  return operations;
}

export function canAccessMobileFieldOperation(
  role: string | null | undefined,
  permissions: readonly string[] | null | undefined,
  operation: MobileFieldOperation,
): boolean {
  if (!isInternalMobileRole(role)) return true;
  return getMobileFieldOperations(permissions).includes(operation);
}

export function resolveMobileOrganizationAccess(
  profile: AccessProfile,
  subscription: AccessSubscription,
): MobileOrganizationAccess {
  if (!profile) {
    return {
      kind: 'individual',
      organizationId: null,
      organizationName: null,
      hasOrganization: false,
      requiresOrganizationLink: false,
    };
  }

  if (isInternalMobileRole(profile.role)) {
    return {
      kind: 'internal',
      organizationId: null,
      organizationName: null,
      hasOrganization: false,
      requiresOrganizationLink: false,
    };
  }

  if (subscription?.organization?.id && subscription.membership?.status === 'active') {
    return {
      kind: 'organization',
      organizationId: subscription.organization.id,
      organizationName: subscription.organization.display_name,
      hasOrganization: true,
      requiresOrganizationLink: false,
    };
  }

  // O contexto comercial vem de private.current_organization_id() e, portanto,
  // é a fonte de verdade: um organizationId legado não substitui membership ativo.
  if (subscription) {
    const individualPlan = subscription.plan?.audience === 'individual';
    const municipalAccount = !individualPlan && (
      Boolean(profile.organizationId)
      || profile.role !== 'agent'
      || Boolean(profile.municipio?.trim())
    );

    return {
      kind: municipalAccount ? 'organization_required' : 'individual',
      organizationId: null,
      organizationName: null,
      hasOrganization: false,
      requiresOrganizationLink: municipalAccount,
    };
  }

  // Compatibilidade com ambientes antigos sem get_subscription_context.
  if (profile.organizationId) {
    return {
      kind: 'organization',
      organizationId: profile.organizationId,
      organizationName: profile.municipio || null,
      hasOrganization: true,
      requiresOrganizationLink: false,
    };
  }

  const municipalAccount = profile.role !== 'agent' || Boolean(profile.municipio?.trim());
  return {
    kind: municipalAccount ? 'organization_required' : 'individual',
    organizationId: null,
    organizationName: null,
    hasOrganization: false,
    requiresOrganizationLink: municipalAccount,
  };
}
