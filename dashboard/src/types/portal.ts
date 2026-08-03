export type PortalAccountKind = 'individual' | 'organization';
export type CustomerLifecycleState = 'creating' | 'under_review' | 'trial' | 'contracting_pending' | 'active' | 'blocked';
export type CustomerOnboardingItem = 'identity' | 'organization' | 'plan' | 'team' | 'configuration' | 'first_operation';
export type MunicipalRole = 'coordinator' | 'supervisor' | 'agent';
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
  permissions: PortalPermission[];
  creationAllowed: boolean;
  restrictionCause: string | null;
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
