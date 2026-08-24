import type { Session } from '@supabase/supabase-js';
import {
  buildInternalOwnerAppProfile,
  buildInternalStaffAppProfile,
  isInternalMobileRole,
  isNeutralCustomerProfile,
} from '../AppProfileService';

const session = {
  user: {
    id: 'owner-user-id',
    email: 'owner@example.com',
  },
} as Session;

describe('AppProfileService', () => {
  it('converte somente owner interno ativo no perfil operacional do app', () => {
    expect(buildInternalOwnerAppProfile(session, {
      user_id: 'owner-user-id',
      role: 'owner',
      status: 'active',
      display_name: 'Proprietário TCS',
    })).toMatchObject({
      uid: 'owner-user-id',
      role: 'owner',
      isApproved: true,
    });

    expect(buildInternalOwnerAppProfile(session, {
      user_id: 'owner-user-id',
      role: 'developer',
      status: 'active',
    })).toBeNull();
  });

  it('converte perfis internos ativos sem conceder acesso municipal', () => {
    expect(buildInternalStaffAppProfile(session, {
      user_id: 'owner-user-id',
      role: 'support',
      status: 'active',
      permissions: ['support.read'],
    })).toMatchObject({
      role: 'support',
      accountKind: 'internal',
      organizationId: null,
      permissions: ['support.read'],
      isApproved: true,
    });

    expect(buildInternalStaffAppProfile(session, {
      user_id: 'owner-user-id',
      role: 'developer',
      status: 'suspended',
    })).toBeNull();

    expect(buildInternalStaffAppProfile(session, {
      user_id: 'different-user-id',
      role: 'owner',
      status: 'active',
    })).toBeNull();

    expect(buildInternalStaffAppProfile(session, {
      user_id: 'owner-user-id',
      role: 'master_admin',
      status: 'active',
    })).toBeNull();

    expect(isInternalMobileRole('auditor')).toBe(true);
    expect(isInternalMobileRole('master_admin')).toBe(false);
  });

  it('reconhece cadastro web neutro sem conceder aprovação', () => {
    expect(isNeutralCustomerProfile({
      role: 'agent',
      isApproved: false,
      municipio: null,
      organization_id: null,
    })).toBe(true);

    expect(isNeutralCustomerProfile({
      role: 'admin',
      isApproved: false,
      municipio: 'Cataguases',
      organization_id: 'organization-id',
    })).toBe(false);
  });
});
