import type { UserProfile } from '../../context/AuthContext';
import type { SubscriptionContextValue } from '../../context/SubscriptionContext';
import { resolveMobileOrganizationAccess } from '../MobileAccessService';

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'user-1',
    name: 'Usuário TCS',
    email: 'user@example.com',
    role: 'agent',
    municipio: '',
    isApproved: true,
    ...overrides,
  };
}

function subscription(
  overrides: Partial<SubscriptionContextValue> = {},
): SubscriptionContextValue {
  return {
    enforced: true,
    organization: null,
    membership: null,
    subscription: null,
    plan: null,
    features: {},
    usage: [],
    ...overrides,
  };
}

describe('MobileAccessService', () => {
  it('aceita somente organização com membership ativo confirmado pelo backend', () => {
    const result = resolveMobileOrganizationAccess(profile({ role: 'supervisor' }), subscription({
      organization: { id: 'org-1', display_name: 'Organização A', status: 'active' },
      membership: { role: 'supervisor', status: 'active' },
    }));

    expect(result).toMatchObject({
      kind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Organização A',
      hasOrganization: true,
    });
  });

  it('não autoriza organizationId legado quando não existe membership ativo', () => {
    const result = resolveMobileOrganizationAccess(
      profile({ role: 'admin', municipio: 'Município A', organizationId: 'org-legado' }),
      subscription(),
    );

    expect(result).toMatchObject({
      kind: 'organization_required',
      organizationId: null,
      hasOrganization: false,
      requiresOrganizationLink: true,
    });
  });

  it('bloqueia organização com vínculo convidado ou suspenso', () => {
    for (const status of ['invited', 'suspended'] as const) {
      const result = resolveMobileOrganizationAccess(
        profile({ role: 'agent', municipio: 'Município A', organizationId: 'org-1' }),
        subscription({
          organization: { id: 'org-1', display_name: 'Organização A', status: 'active' },
          membership: { role: 'agent', status },
        }),
      );

      expect(result).toMatchObject({
        kind: 'organization_required',
        organizationId: null,
        requiresOrganizationLink: true,
      });
    }
  });

  it('usa a organização confirmada pelo backend quando o perfil legado aponta para outra', () => {
    const result = resolveMobileOrganizationAccess(
      profile({ role: 'supervisor', organizationId: 'org-antiga' }),
      subscription({
        organization: { id: 'org-atual', display_name: 'Organização atual', status: 'active' },
        membership: { role: 'supervisor', status: 'active' },
      }),
    );

    expect(result).toMatchObject({
      kind: 'organization',
      organizationId: 'org-atual',
      organizationName: 'Organização atual',
    });
  });

  it('mantém uma conta profissional individual separada de organizações', () => {
    const result = resolveMobileOrganizationAccess(profile(), subscription({
      plan: {
        id: 'plan-1',
        code: 'individual',
        name: 'Individual',
        audience: 'individual',
        version: 1,
      },
    }));

    expect(result.kind).toBe('individual');
    expect(result.requiresOrganizationLink).toBe(false);
  });

  it('nunca transforma um perfil interno em membro municipal', () => {
    const result = resolveMobileOrganizationAccess(profile({
      role: 'owner',
      organizationId: 'org-antiga',
      municipio: 'Município A',
    }), subscription({
      organization: { id: 'org-1', display_name: 'Organização A', status: 'active' },
      membership: { role: 'master', status: 'active' },
    }));

    expect(result).toMatchObject({ kind: 'internal', organizationId: null, hasOrganization: false });
  });
});
