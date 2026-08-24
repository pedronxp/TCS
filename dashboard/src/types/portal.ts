export type PortalAccountKind = 'individual' | 'organization';
export type CustomerLifecycleState = 'creating' | 'under_review' | 'trial' | 'contracting_pending' | 'active' | 'blocked';
export type CustomerOnboardingItem = 'identity' | 'organization' | 'plan' | 'team' | 'configuration' | 'first_operation';
export type MunicipalRole = 'master' | 'admin' | 'supervisor' | 'agent';
export type PortalMembershipStatus = 'invited' | 'active' | 'suspended' | 'removed';
export type PortalSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'grace'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'none';

export type PortalPermission =
  | 'dashboard.read'
  | 'inspection.read'
  | 'inspection.create'
  | 'map.read'
  | 'appointment.read'
  | 'document.read'
  | 'report.read'
  | 'communication.read'
  | 'communication.write'
  | 'whatsapp.read'
  | 'whatsapp.write'
  | 'team.read'
  | 'team.manage'
  | 'invite.agent'
  | 'invite.manage'
  | 'usage.read'
  | 'billing.read'
  | 'billing.manage'
  | 'support.read'
  | 'support.create'
  | 'settings.read'
  | 'settings.manage'
  | 'profile.read'
  | 'profile.manage';

// ENTREGA A1: permissões efetivas de convite derivadas do servidor.
// Espelham private.portal_invite_role_allowed: master > admin > supervisor > agent.
// can_invite é false para contas individuais e memberships não ativas.
export type PortalInviteTargetRole = 'admin' | 'supervisor' | 'agent';

export interface PortalInvitePermissions {
  canInvite: boolean;
  targetRoles: PortalInviteTargetRole[];
}

export type PortalRestrictionCause =
  | 'subscription_inactive'
  | 'subscription_past_due'
  | 'membership_inactive'
  | 'plan_feature'
  | 'permission'
  | 'rollout_disabled';

export interface PortalAccessContext {
  accountKind: PortalAccountKind;
  userId: string;
  displayName: string;
  organizationId: string | null;
  organizationName: string | null;
  role: MunicipalRole | null;
  membershipStatus: PortalMembershipStatus | null;
  subscriptionStatus: PortalSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  planId: string | null;
  planVersionId: string | null;
  planName: string | null;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  usage: Record<string, number>;
  periodStart?: string | null;
  periodEnd?: string | null;
  permissions: PortalPermission[];
  // ENTREGA A1: permissões efetivas de convite (derivadas do servidor).
  // Marcado opcional para manter compatibilidade com consumidores legados; o
  // parser sempre o preenche a partir de get_portal_access_context.
  invitePermissions?: PortalInvitePermissions;
  creationAllowed: boolean;
  restrictionCause: PortalRestrictionCause | null;
}

export interface PortalCustomerEntryContext {
  accountKind: PortalAccountKind | 'internal' | null;
  entryState: string | null;
  lifecycleState: CustomerLifecycleState;
  individualBootstrapEnabled: boolean;
  municipalBootstrapEnabled: boolean;
  organizationName: string | null;
  subscriptionStatus: string | null;
  onboarding: {
    status: string;
    currentStep: CustomerOnboardingItem | 'completed' | null;
    checklist: Partial<Record<CustomerOnboardingItem, boolean>>;
    completedItems: number;
    totalItems: number;
    progressPercent: number;
  } | null;
}

export interface PortalDashboardData {
  metrics: Array<{ key: string; label: string; value: number; detail?: string }>;
  upcoming: Array<{ id: string; title: string; scheduledAt: string; status: string }>;
  recentInspections: Array<{
    id: string;
    protocol: string;
    status: string;
    riskLevel: string | null;
    occurredAt: string | null;
  }>;
}

export interface PortalWorkspaceData {
  section: string;
  items: Array<Record<string, unknown>>;
  summary: Record<string, number | string | boolean | null>;
}
