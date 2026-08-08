import type { Session } from '@supabase/supabase-js';

export interface InternalStaffProfilePayload {
  user_id?: string;
  role?: string;
  status?: string;
  display_name?: string;
}

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

export function buildInternalOwnerAppProfile(
  session: Session,
  staff: InternalStaffProfilePayload | null,
) {
  if (
    !staff
    || staff.user_id !== session.user.id
    || staff.role !== 'owner'
    || staff.status !== 'active'
  ) {
    return null;
  }

  return {
    uid: session.user.id,
    name: staff.display_name?.trim() || session.user.email?.split('@')[0] || 'Proprietário TCS',
    email: session.user.email || '',
    role: 'owner' as const,
    municipio: '',
    isApproved: true,
  };
}
