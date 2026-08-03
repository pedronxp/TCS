import { describe, expect, it } from 'vitest';
import { getPortalNavigation } from '@/config/portalNavigation';
import {
  parseInternalCustomerEntryContext,
  parsePortalAccessContext,
  portalRestrictionMessage,
  portalSubscriptionPresentation,
  safePortalDestination,
} from './portal';
import type { PortalAccessContext } from '@/types/portal';

function context(overrides: Partial<PortalAccessContext> = {}): PortalAccessContext {
  return {
    accountKind: 'individual',
    userId: '01b00bbc-9b55-49c6-8bf1-c3f853ad9a47',
    displayName: 'Ana Cliente',
    organizationId: null,
    organizationName: null,
    role: null,
    membershipStatus: null,
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: 'plan',
    planVersionId: 'version',
    planName: 'Individual Profissional',
    features: { reports: true },
    limits: { inspections: 150 },
    usage: { inspections: 12 },
    permissions: ['dashboard.read', 'inspection.read', 'billing.read', 'profile.read'],
    creationAllowed: true,
    restrictionCause: null,
    ...overrides,
  };
}

describe('contrato de acesso do portal', () => {
  it('interpreta apenas papéis, estados e permissões conhecidos', () => {
    const parsed = parsePortalAccessContext({
      account_kind: 'organization',
      user_id: '01b00bbc-9b55-49c6-8bf1-c3f853ad9a47',
      display_name: 'Coordenação',
      organization_id: '632ec060-0db8-444c-b914-4854375687da',
      organization_name: 'Município Piloto',
      role: 'coordinator',
      membership_status: 'active',
      subscription_status: 'grace',
      permissions: ['dashboard.read', 'team.manage', 'internal_staff.manage'],
      features: { municipal_portal: true },
      limits: { users: 10 },
      usage: { users: 4 },
      creation_allowed: true,
    });
    expect(parsed?.role).toBe('coordinator');
    expect(parsed?.permissions).toEqual(['dashboard.read', 'team.manage']);
    expect(parsed?.subscriptionStatus).toBe('grace');
  });

  it('rejeita contexto com audiência ou estado adulterado', () => {
    expect(parsePortalAccessContext({ account_kind: 'internal', user_id: 'user' })).toBeNull();
    expect(parsePortalAccessContext({
      account_kind: 'individual',
      user_id: 'user',
      subscription_status: 'free_forever',
    })).toBeNull();
  });

  it('reconhece somente owner ou developer internos ativos na entrada pública', () => {
    expect(parseInternalCustomerEntryContext({ role: 'owner', status: 'active' })).toMatchObject({
      accountKind: 'internal',
      entryState: 'internal_only',
    });
    expect(parseInternalCustomerEntryContext({ role: 'developer', status: 'active' })?.accountKind).toBe('internal');
    expect(parseInternalCustomerEntryContext({ role: 'owner', status: 'suspended' })).toBeNull();
    expect(parseInternalCustomerEntryContext({ role: 'support', status: 'active' })).toBeNull();
  });

  it('não permite redirecionamento externo, travessia ou troca de portal', () => {
    expect(safePortalDestination('/portal/individual/vistorias?nova=1', 'individual'))
      .toBe('/portal/individual/vistorias?nova=1');
    expect(safePortalDestination('/portal/municipal', 'individual')).toBe('/portal/individual');
    expect(safePortalDestination('/portal/individual/../municipal', 'individual')).toBe('/portal/individual');
    expect(safePortalDestination('//example.com/portal/individual', 'individual')).toBe('/portal/individual');
  });

  it('deriva a navegação somente das permissões efetivas', () => {
    const individual = getPortalNavigation(context());
    expect(individual.map((item) => item.label)).toEqual(['Visão geral', 'Vistorias', 'Assinatura', 'Perfil']);

    const agent = getPortalNavigation(context({
      accountKind: 'organization',
      organizationId: 'org',
      role: 'agent',
      membershipStatus: 'active',
      permissions: ['dashboard.read', 'inspection.read', 'support.read', 'profile.read'],
    }));
    expect(agent.map((item) => item.path)).not.toContain('/portal/municipal/equipe');
    expect(agent.map((item) => item.path)).not.toContain('/portal/municipal/assinatura');
  });

  it('representa todos os estados financeiros sem bloquear leitura histórica', () => {
    expect(portalSubscriptionPresentation('trial')).toMatchObject({ label: 'Período de teste', allowsCreate: true });
    expect(portalSubscriptionPresentation('active')).toMatchObject({ tone: 'success', allowsCreate: true });
    expect(portalSubscriptionPresentation('grace')).toMatchObject({ preservesRead: true, allowsCreate: true });
    expect(portalSubscriptionPresentation('past_due')).toMatchObject({ preservesRead: true, allowsCreate: false });
    expect(portalSubscriptionPresentation('canceled')).toMatchObject({ preservesRead: true, allowsCreate: false });
    expect(portalSubscriptionPresentation('expired')).toMatchObject({ preservesRead: true, allowsCreate: false });
    expect(portalSubscriptionPresentation('none')).toMatchObject({ preservesRead: false, allowsCreate: false });
    expect(portalSubscriptionPresentation('active', true)).toMatchObject({ label: 'Cancelamento agendado', tone: 'warning' });
  });

  it('mantém causas de restrição explícitas e não sensíveis', () => {
    for (const cause of ['membership_inactive', 'subscription_past_due', 'subscription_inactive', 'plan_feature', 'permission', 'rollout_disabled']) {
      expect(portalRestrictionMessage(cause)).not.toHaveLength(0);
    }
    expect(portalRestrictionMessage('policy_row_123')).toBe('A ação está indisponível para este acesso.');
  });

  it('não concede destinos internos ao coordenador municipal', () => {
    const coordinator = getPortalNavigation(context({
      accountKind: 'organization',
      organizationId: 'org',
      role: 'coordinator',
      membershipStatus: 'active',
      permissions: [
        'dashboard.read', 'inspection.read', 'team.read', 'team.manage',
        'billing.read', 'settings.read', 'settings.manage',
      ],
    }));
    expect(coordinator.every((item) => item.path.startsWith('/portal/municipal'))).toBe(true);
    expect(coordinator.some((item) => item.path.startsWith('/app'))).toBe(false);
  });
});
