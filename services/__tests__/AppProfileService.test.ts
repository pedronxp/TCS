import type { Session } from '@supabase/supabase-js';
import {
  buildInternalOwnerAppProfile,
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
