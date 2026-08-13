import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type {
  CustomerOnboardingItem,
  MunicipalRole,
  PortalAccessContext,
  PortalAccountKind,
  PortalCustomerEntryContext,
  PortalDashboardData,
  PortalMembershipStatus,
  PortalPermission,
  PortalSubscriptionStatus,
  PortalWorkspaceData,
} from '@/types/portal';

type RpcResult = { data: unknown; error: { message: string } | null };
type PortalRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

const rpc = supabase.rpc.bind(supabase) as unknown as PortalRpc;

const accountKinds = new Set<PortalAccountKind>(['individual', 'organization']);
const roles = new Set<MunicipalRole>(['master', 'admin', 'supervisor', 'agent']);
const membershipStatuses = new Set<PortalMembershipStatus>(['invited', 'active', 'suspended', 'removed']);
const subscriptionStatuses = new Set<PortalSubscriptionStatus>([
  'trial', 'active', 'grace', 'past_due', 'canceled', 'expired', 'none',
]);
const permissions = new Set<PortalPermission>([
  'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
  'appointment.read', 'document.read', 'report.read', 'team.read', 'team.manage',
  'invite.agent', 'invite.manage', 'usage.read', 'billing.read', 'billing.manage',
  'support.read', 'support.create', 'settings.read', 'settings.manage',
  'profile.read', 'profile.manage',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function boolean(value: unknown): boolean {
  return value === true;
}

function numericRecord(value: unknown): Record<string, number> {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function limitRecord(value: unknown): Record<string, number | null> {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, number | null] => entry[1] === null || typeof entry[1] === 'number',
    ),
  );
}

function featureRecord(value: unknown): Record<string, boolean> {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(Object.entries(source).map(([key, enabled]) => [key, enabled === true]));
}

export function parsePortalAccessContext(value: unknown, user?: User | null): PortalAccessContext | null {
  const source = record(value);
  const kind = string(source?.account_kind);
  const userId = string(source?.user_id) ?? user?.id ?? null;
  const role = string(source?.role);
  const membershipStatus = string(source?.membership_status);
  const subscriptionStatus = string(source?.subscription_status) ?? 'none';
  if (!source || !userId || !kind || !accountKinds.has(kind as PortalAccountKind)) return null;
  if (role && !roles.has(role as MunicipalRole)) return null;
  if (membershipStatus && !membershipStatuses.has(membershipStatus as PortalMembershipStatus)) return null;
  if (!subscriptionStatuses.has(subscriptionStatus as PortalSubscriptionStatus)) return null;

  return {
    accountKind: kind as PortalAccountKind,
    userId,
    displayName: string(source.display_name) ?? user?.user_metadata?.name ?? user?.email ?? 'Cliente TCS',
    organizationId: string(source.organization_id),
    organizationName: string(source.organization_name),
    role: role as MunicipalRole | null,
    membershipStatus: membershipStatus as PortalMembershipStatus | null,
    subscriptionStatus: subscriptionStatus as PortalSubscriptionStatus,
    cancelAtPeriodEnd: boolean(source.cancel_at_period_end),
    planId: string(source.plan_id),
    planVersionId: string(source.plan_version_id),
    planName: string(source.plan_name),
    features: featureRecord(source.features),
    limits: limitRecord(source.limits),
    usage: numericRecord(source.usage),
    periodStart: string(source.period_start),
    periodEnd: string(source.period_end),
    permissions: Array.isArray(source.permissions)
      ? source.permissions.filter((item): item is PortalPermission =>
        typeof item === 'string' && permissions.has(item as PortalPermission))
      : [],
    creationAllowed: boolean(source.creation_allowed),
    restrictionCause: string(source.restriction_cause),
  };
}

export async function fetchPortalAccessContext(user?: User | null) {
  const { data, error } = await rpc('get_portal_access_context');
  if (error) throw new Error(error.message);
  return parsePortalAccessContext(data, user);
}

export function parseInternalCustomerEntryContext(value: unknown): PortalCustomerEntryContext | null {
  const source = record(value);
  const role = string(source?.role);
  if (!source || source.status !== 'active' || !['owner', 'developer', 'support', 'auditor'].includes(role ?? '')) return null;
  return {
    accountKind: 'internal',
    entryState: 'internal_only',
    lifecycleState: 'active',
    individualBootstrapEnabled: false,
    municipalBootstrapEnabled: false,
    organizationName: null,
    subscriptionStatus: null,
    onboarding: null,
  };
}

export function parseCustomerEntryContext(value: unknown): PortalCustomerEntryContext {
  const source = record(value);
  const features = record(source?.features);
  const organization = record(source?.organization);
  const subscription = record(source?.subscription);
  const onboarding = record(source?.onboarding);
  const rawKind = string(source?.account_kind);
  const accountKind = rawKind === 'individual' || rawKind === 'organization' || rawKind === 'internal'
    ? rawKind
    : null;
  const lifecycle = string(source?.lifecycle_state);
  const allowedLifecycle = new Set(['creating', 'under_review', 'trial', 'contracting_pending', 'active', 'blocked']);
  const rawChecklist = record(onboarding?.checklist) ?? {};
  const rawCurrentStep = string(onboarding?.current_step);
  const allowedSteps = new Set([
    'identity', 'organization', 'plan', 'team', 'configuration', 'first_operation', 'completed',
  ]);
  const checklist = Object.fromEntries(
    Object.entries(rawChecklist).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
  return {
    accountKind,
    entryState: string(source?.entry_state),
    lifecycleState: allowedLifecycle.has(lifecycle ?? '')
      ? lifecycle as PortalCustomerEntryContext['lifecycleState']
      : 'creating',
    individualBootstrapEnabled: features?.individual_bootstrap === true,
    municipalBootstrapEnabled: features?.municipal_bootstrap === true,
    organizationName: string(organization?.display_name),
    subscriptionStatus: string(subscription?.status),
    onboarding: onboarding ? {
      status: string(onboarding.status) ?? 'in_progress',
      currentStep: allowedSteps.has(rawCurrentStep ?? '')
        ? rawCurrentStep as CustomerOnboardingItem | 'completed'
        : null,
      checklist,
      completedItems: typeof onboarding.completed_items === 'number' ? onboarding.completed_items : 0,
      totalItems: typeof onboarding.total_items === 'number' ? onboarding.total_items : Object.keys(checklist).length,
      progressPercent: typeof onboarding.progress_percent === 'number' ? onboarding.progress_percent : 0,
    } : null,
  };
}

export async function fetchCustomerEntryContext(): Promise<PortalCustomerEntryContext> {
  const { data, error } = await rpc('get_customer_entry_context');
  if (error) throw new Error(error.message);
  return parseCustomerEntryContext(data);
}

export async function fetchPortalDashboard(): Promise<PortalDashboardData> {
  const { data, error } = await rpc('portal_get_dashboard');
  if (error) throw new Error(error.message);
  const source = record(data);
  return {
    metrics: Array.isArray(source?.metrics) ? source.metrics as PortalDashboardData['metrics'] : [],
    upcoming: Array.isArray(source?.upcoming) ? source.upcoming as PortalDashboardData['upcoming'] : [],
    recentInspections: Array.isArray(source?.recent_inspections)
      ? source.recent_inspections as PortalDashboardData['recentInspections']
      : [],
  };
}

export async function fetchPortalWorkspace(section: string): Promise<PortalWorkspaceData> {
  const { data, error } = await rpc('portal_get_workspace', { p_section: section });
  if (error) throw new Error(error.message);
  const source = record(data);
  return {
    section,
    items: Array.isArray(source?.items) ? source.items.filter((item) => record(item) !== null) as Array<Record<string, unknown>> : [],
    summary: record(source?.summary) as PortalWorkspaceData['summary'] ?? {},
  };
}

export function portalHome(kind: PortalAccountKind | null | undefined) {
  return kind === 'organization' ? '/portal/municipal' : '/portal/individual';
}

export function safePortalDestination(candidate: string | null | undefined, kind: PortalAccountKind) {
  const root = portalHome(kind);
  if (!candidate?.startsWith('/') || candidate.startsWith('//')) return root;
  try {
    const url = new URL(candidate, 'https://portal.tcs.local');
    const allowed = url.pathname === root || url.pathname.startsWith(`${root}/`);
    return allowed ? `${url.pathname}${url.search}${url.hash}` : root;
  } catch {
    return root;
  }
}

export function portalRestrictionMessage(cause: string | null) {
  const messages: Record<string, string> = {
    membership_inactive: 'Seu vínculo municipal não está ativo. Fale com a coordenação.',
    subscription_past_due: 'Há uma pendência de pagamento. Consultas continuam disponíveis, mas novas operações estão pausadas.',
    subscription_inactive: 'A assinatura não permite novas operações neste momento.',
    plan_feature: 'Este recurso não faz parte do plano atual.',
    permission: 'Seu perfil não possui permissão para esta ação.',
    rollout_disabled: 'Este módulo ainda não foi liberado para sua coorte do piloto.',
  };
  return cause ? messages[cause] ?? 'A ação está indisponível para este acesso.' : '';
}

export function portalSubscriptionPresentation(
  status: PortalSubscriptionStatus,
  cancelAtPeriodEnd = false,
) {
  if (cancelAtPeriodEnd && ['trial', 'active', 'grace', 'past_due'].includes(status)) {
    return { label: 'Cancelamento agendado', tone: 'warning' as const, preservesRead: true, allowsCreate: status !== 'past_due' };
  }
  const states = {
    trial: { label: 'Período de teste', tone: 'info' as const, preservesRead: true, allowsCreate: true },
    active: { label: 'Assinatura ativa', tone: 'success' as const, preservesRead: true, allowsCreate: true },
    grace: { label: 'Em carência', tone: 'warning' as const, preservesRead: true, allowsCreate: true },
    past_due: { label: 'Pagamento pendente', tone: 'warning' as const, preservesRead: true, allowsCreate: false },
    canceled: { label: 'Cancelada', tone: 'destructive' as const, preservesRead: true, allowsCreate: false },
    expired: { label: 'Expirada', tone: 'destructive' as const, preservesRead: true, allowsCreate: false },
    none: { label: 'Sem assinatura', tone: 'destructive' as const, preservesRead: false, allowsCreate: false },
  };
  return states[status];
}
