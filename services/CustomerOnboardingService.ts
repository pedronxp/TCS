import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';

export type CustomerAccountKind = 'individual' | 'organization';
export type CustomerLifecycleState =
  | 'creating'
  | 'under_review'
  | 'trial'
  | 'contracting_pending'
  | 'active'
  | 'blocked';
export type CustomerOnboardingItem =
  | 'identity'
  | 'organization'
  | 'plan'
  | 'team'
  | 'configuration'
  | 'first_operation';

export interface CustomerOnboardingContext {
  entry_state?: string;
  account_kind?: CustomerAccountKind | 'internal' | null;
  lifecycle_state?: CustomerLifecycleState;
  features?: {
    individual_bootstrap?: boolean;
    municipal_bootstrap?: boolean;
  };
  organization?: {
    id?: string;
    display_name?: string;
    municipality_name?: string;
    state_code?: string;
    status?: string;
  } | null;
  subscription?: {
    status?: string;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
  } | null;
  onboarding?: {
    status?: string;
    current_step?: CustomerOnboardingItem | 'completed';
    checklist?: Partial<Record<CustomerOnboardingItem, boolean>>;
    completed_items?: number;
    total_items?: number;
    progress_percent?: number;
    updated_at?: string;
  } | null;
  activation?: {
    commercially_active?: boolean;
    self_service_state?: CustomerLifecycleState;
    requires_support_contact?: boolean;
  } | null;
}

export interface MunicipalBootstrapInput {
  displayName: string;
  municipalityName: string;
  stateCode: string;
  responsibleName: string;
  termsVersion: string;
}

export interface MunicipalInviteAcceptance {
  accepted: boolean;
  reason?: string;
  organization_id?: string;
  role?: string;
}

export const CUSTOMER_ONBOARDING_ITEMS: Array<{
  key: CustomerOnboardingItem;
  label: string;
  customerManaged: boolean;
}> = [
  { key: 'identity', label: 'Identidade confirmada', customerManaged: false },
  { key: 'organization', label: 'Organização criada', customerManaged: false },
  { key: 'plan', label: 'Plano ou trial definido', customerManaged: false },
  { key: 'team', label: 'Primeiro integrante da equipe', customerManaged: false },
  { key: 'configuration', label: 'Configuração inicial', customerManaged: true },
  { key: 'first_operation', label: 'Primeira vistoria', customerManaged: false },
];

export function customerOnboardingSource(): 'web' | 'android' | 'ios' | 'unknown' {
  if (Platform.OS === 'web' || Platform.OS === 'android' || Platform.OS === 'ios') return Platform.OS;
  return 'unknown';
}

export function createCustomerRequestId(): string {
  const random = Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12);
  const timestamp = Date.now().toString(16).padStart(12, '0').slice(-12);
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-4${random.slice(0, 3)}-a${random.slice(3, 6)}-${random.slice(6).padEnd(12, '0')}`;
}

export async function getCustomerOnboardingContext(): Promise<CustomerOnboardingContext> {
  const { data, error } = await supabase.rpc('get_customer_entry_context');
  if (error) throw error;
  return (data ?? {}) as CustomerOnboardingContext;
}

export async function bootstrapIndividualCustomer(
  userId: string,
  termsVersion: string,
): Promise<CustomerOnboardingContext> {
  const { data, error } = await supabase.rpc('bootstrap_individual_customer', {
    p_idempotency_key: `individual-${userId}`,
    p_terms_version: termsVersion,
  });
  if (error) throw error;
  return (data ?? {}) as CustomerOnboardingContext;
}

export async function bootstrapMunicipalCustomer(
  userId: string,
  input: MunicipalBootstrapInput,
): Promise<CustomerOnboardingContext> {
  const { data, error } = await supabase.rpc('bootstrap_municipal_customer', {
    p_idempotency_key: `municipal-${userId}`,
    p_payload: {
      display_name: input.displayName.trim(),
      municipality_name: input.municipalityName.trim(),
      state_code: input.stateCode.trim().toUpperCase(),
      responsible_name: input.responsibleName.trim(),
      terms_version: input.termsVersion,
    },
  });
  if (error) throw error;
  return (data ?? {}) as CustomerOnboardingContext;
}

export async function acceptMunicipalCustomerInvite(token: string): Promise<MunicipalInviteAcceptance> {
  const normalized = token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (normalized.length < 12) return { accepted: false, reason: 'invalid' };
  const { data, error } = await supabase.rpc('portal_accept_organization_invite', {
    p_token: normalized,
  });
  if (error) throw error;
  const modern = (data ?? { accepted: false, reason: 'invalid' }) as MunicipalInviteAcceptance;
  if (modern.accepted || modern.reason !== 'invalid') return modern;

  const { data: legacyData, error: legacyError } = await supabase.rpc(
    'accept_legacy_municipal_invite',
    { p_token: normalized },
  );
  if (legacyError) throw legacyError;
  return (legacyData ?? modern) as MunicipalInviteAcceptance;
}

export async function updateCustomerOnboardingItem(
  item: 'team' | 'configuration',
  completed = true,
): Promise<CustomerOnboardingContext> {
  const { data, error } = await supabase.rpc('update_customer_onboarding_checklist', {
    p_item: item,
    p_completed: completed,
    p_request_id: createCustomerRequestId(),
    p_source: customerOnboardingSource(),
  });
  if (error) throw error;
  return (data ?? {}) as CustomerOnboardingContext;
}

export async function recordCustomerOnboardingEvent(
  event:
    | 'onboarding_viewed'
    | 'account_kind_selected'
    | 'details_started'
    | 'terms_accepted'
    | 'bootstrap_submitted'
    | 'onboarding_resumed',
): Promise<void> {
  await supabase.rpc('record_customer_onboarding_funnel', {
    p_event: event,
    p_request_id: createCustomerRequestId(),
    p_source: customerOnboardingSource(),
  });
}

export function customerLifecycleMessage(state?: CustomerLifecycleState): string {
  const messages: Record<CustomerLifecycleState, string> = {
    creating: 'Finalize os dados iniciais para criar seu acesso.',
    under_review: 'Cadastro recebido. A implantação está em análise, sem bloquear a preparação inicial.',
    trial: 'Seu período de avaliação está ativo. A contratação definitiva continua separada.',
    contracting_pending: 'A operação está preparada e aguarda a formalização comercial.',
    active: 'Cliente ativo para operação.',
    blocked: 'Este acesso está bloqueado. Consulte o motivo exibido antes de tentar novamente.',
  };
  return state ? messages[state] : messages.creating;
}
