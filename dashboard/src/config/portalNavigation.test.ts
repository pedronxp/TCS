import { describe, expect, it } from 'vitest';
import { getPortalNavigation } from './portalNavigation';
import type { PortalAccessContext } from '@/types/portal';

function access(overrides: Partial<PortalAccessContext> = {}): PortalAccessContext {
  return {
    accountKind: 'individual',
    userId: 'user-1',
    displayName: 'Ana Lima',
    organizationId: null,
    organizationName: null,
    role: null,
    membershipStatus: null,
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Profissional',
    features: {},
    limits: {},
    usage: {},
    permissions: ['dashboard.read'],
    creationAllowed: true,
    restrictionCause: null,
    ...overrides,
  };
}

describe('navegação do portal', () => {
  it('mantém destinos individuais e agrupa somente módulos permitidos', () => {
    const items = getPortalNavigation(access({
      permissions: ['dashboard.read', 'inspection.read', 'billing.read', 'support.read'],
    }));

    expect(items.map(({ label, path, group }) => ({ label, path, group }))).toEqual([
      { label: 'Visão geral', path: '/portal/individual', group: 'work' },
      { label: 'Vistorias', path: '/portal/individual/vistorias', group: 'work' },
      { label: 'Assinatura', path: '/portal/individual/assinatura', group: 'management' },
      { label: 'Suporte', path: '/portal/individual/suporte', group: 'account' },
    ]);
  });

  it('não mistura destinos internos ou individuais no portal municipal', () => {
    const items = getPortalNavigation(access({
      accountKind: 'organization',
      organizationId: 'org-1',
      organizationName: 'Município Piloto',
      role: 'agent',
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'inspection.read', 'team.read', 'profile.read'],
    }));

    expect(items.every((item) => item.path.startsWith('/portal/municipal'))).toBe(true);
    expect(items.map((item) => item.label)).toEqual(['Visão geral', 'Vistorias', 'Equipe', 'Perfil']);
  });
});
