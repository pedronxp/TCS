import type { Session } from '@supabase/supabase-js';

export interface InternalStaffProfilePayload {
  user_id?: string;
  role?: string;
  status?: string;
  display_name?: string;
  permissions?: string[];
}

export type InternalMobileRole = 'owner' | 'developer' | 'support' | 'auditor';

const INTERNAL_MOBILE_ROLES = new Set<InternalMobileRole>([
  'owner',
  'developer',
  'support',
  'auditor',
]);

export interface LegacyAccessProfile {
  role?: string | null;
  isApproved?: boolean | null;
  municipio?: string | null;
  organization_id?: string | null;
}

export function isNeutralCustomerProfile(profile: LegacyAccessProfile | null): boolean {
  return Boolean(
    profile
    && profile.role === 'agent'
    && !profile.isApproved
    && !profile.municipio
    && !profile.organization_id
  );
}

export function buildInternalStaffAppProfile(
  session: Session,
  staff: InternalStaffProfilePayload | null,
) {
  if (
    !staff
    || staff.user_id !== session.user.id
    || !INTERNAL_MOBILE_ROLES.has(staff.role as InternalMobileRole)
    || staff.status !== 'active'
  ) {
    return null;
  }

  const role = staff.role as InternalMobileRole;

  return {
    uid: session.user.id,
    name: staff.display_name?.trim() || session.user.email?.split('@')[0] || 'Equipe TCS',
    email: session.user.email || '',
    role,
    municipio: '',
    organizationId: null,
    accountKind: 'internal' as const,
    permissions: Array.isArray(staff.permissions)
      ? staff.permissions.filter((permission): permission is string => typeof permission === 'string')
      : [],
    isApproved: true,
  };
}

export function buildInternalOwnerAppProfile(
  session: Session,
  staff: InternalStaffProfilePayload | null,
) {
  if (staff?.role !== 'owner') return null;
  return buildInternalStaffAppProfile(session, staff);
}

export function isInternalMobileRole(role: string | null | undefined): role is InternalMobileRole {
  return INTERNAL_MOBILE_ROLES.has(role as InternalMobileRole);
}

export function isActiveInternalMobileStaff(
  staff: Pick<InternalStaffProfilePayload, 'role' | 'status'> | null | undefined,
): boolean {
  return Boolean(staff && staff.status === 'active' && isInternalMobileRole(staff.role));
}
