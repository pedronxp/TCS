import { useQuery } from '@tanstack/react-query';
import { jsonArray, jsonNumber, jsonObject, jsonString, type JsonObject } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type {
  CustomerAuditEvent, CustomerDetail, CustomerDetailRecord, CustomerInspection,
  CustomerOnboarding, CustomerSession, CustomerSubscription, CustomerTicket,
  CustomerUsage, CustomerUser,
} from '@/types/domain';
import type { Json } from '@/types/supabase';
import { customerKeys } from './customerKeys';

function objects(value: Json | undefined): JsonObject[] {
  return jsonArray(value).map(jsonObject).filter((item): item is JsonObject => item !== null);
}

function requiredString(record: JsonObject, key: string): string {
  const value = jsonString(record[key]);
  if (!value) throw new Error(`Campo obrigatório ausente: ${key}`);
  return value;
}

function parseCustomer(record: JsonObject): CustomerDetailRecord {
  const kind = requiredString(record, 'kind');
  if (kind !== 'organization' && kind !== 'individual') throw new Error('Tipo de cliente inválido.');
  return {
    customer_id: requiredString(record, 'customer_id'), kind,
    subject_id: requiredString(record, 'subject_id'), display_name: requiredString(record, 'display_name'),
    legal_name: jsonString(record.legal_name), municipality_name: jsonString(record.municipality_name),
    state_code: jsonString(record.state_code), status: requiredString(record, 'status'),
    contact_name: jsonString(record.contact_name), contact_email: jsonString(record.contact_email),
    contract_reference: jsonString(record.contract_reference), subscription_status: null, plan_name: null,
    active_users: 0, last_activity_at: jsonString(record.updated_at),
    session_policy: jsonString(record.session_policy), session_timeout_minutes: jsonNumber(record.session_timeout_minutes),
    offline_tolerance_minutes: jsonNumber(record.offline_tolerance_minutes),
    created_at: jsonString(record.created_at), updated_at: jsonString(record.updated_at),
    last_access_at: jsonString(record.last_access_at),
  };
}

function parseSubscription(value: Json | undefined): CustomerSubscription | null {
  const record = jsonObject(value);
  if (!record) return null;
  return {
    id: requiredString(record, 'id'), plan_id: requiredString(record, 'plan_id'),
    plan_name: requiredString(record, 'plan_name'), status: requiredString(record, 'status'),
    starts_at: requiredString(record, 'starts_at'), trial_ends_at: jsonString(record.trial_ends_at),
    current_period_start: requiredString(record, 'current_period_start'),
    current_period_end: jsonString(record.current_period_end), grace_ends_at: jsonString(record.grace_ends_at),
    canceled_at: jsonString(record.canceled_at), overrides: record.overrides ?? {},
  };
}

function parseUsage(record: JsonObject): CustomerUsage {
  return {
    resource_code: requiredString(record, 'resource_code'), consumed: jsonNumber(record.consumed) ?? 0,
    hard_limit: jsonNumber(record.hard_limit), warning_percent: jsonNumber(record.warning_percent),
    period_start: requiredString(record, 'period_start'), period_end: requiredString(record, 'period_end'),
  };
}

function parseUser(record: JsonObject): CustomerUser {
  return {
    id: jsonString(record.id), user_id: requiredString(record, 'user_id'), name: jsonString(record.name),
    email: jsonString(record.email), role: jsonString(record.role), status: requiredString(record, 'status'),
    joined_at: jsonString(record.joined_at), last_login: jsonString(record.last_login),
  };
}

function parseSession(record: JsonObject): CustomerSession {
  return {
    id: requiredString(record, 'id'), user_id: requiredString(record, 'user_id'),
    device_name: jsonString(record.device_name), platform: requiredString(record, 'platform'),
    status: requiredString(record, 'status'), last_heartbeat_at: requiredString(record, 'last_heartbeat_at'),
    started_at: requiredString(record, 'started_at'), ended_at: jsonString(record.ended_at),
    end_reason: jsonString(record.end_reason),
  };
}

function parseInspection(record: JsonObject): CustomerInspection {
  return {
    id: requiredString(record, 'id'), protocol: jsonString(record.protocol), risk: jsonString(record.risk),
    status: jsonString(record.status), occurred_at: jsonString(record.occurred_at),
    agent_name: jsonString(record.agent_name), address: jsonString(record.address),
  };
}

function parseTicket(record: JsonObject): CustomerTicket {
  return {
    id: requiredString(record, 'id'), public_code: requiredString(record, 'public_code'),
    subject: requiredString(record, 'subject'), priority: requiredString(record, 'priority'),
    status: requiredString(record, 'status'), assigned_to: jsonString(record.assigned_to),
    response_due_at: jsonString(record.response_due_at), resolution_due_at: jsonString(record.resolution_due_at),
    escalate_at: jsonString(record.escalate_at), created_at: requiredString(record, 'created_at'),
  };
}

function parseOnboarding(value: Json | undefined): CustomerOnboarding | null {
  const record = jsonObject(value);
  if (!record) return null;
  return {
    pilot_started_at: jsonString(record.pilot_started_at), coordinator_trained_at: jsonString(record.coordinator_trained_at),
    checklist: record.checklist ?? {}, review_due_at: jsonString(record.review_due_at),
    review_completed_at: jsonString(record.review_completed_at), updated_at: requiredString(record, 'updated_at'),
  };
}

function parseAudit(record: JsonObject): CustomerAuditEvent {
  return {
    id: jsonString(record.id) ?? String(jsonNumber(record.id) ?? 0), event_type: requiredString(record, 'event_type'),
    entity_type: requiredString(record, 'entity_type'), entity_id: jsonString(record.entity_id),
    summary: jsonString(record.summary),
    metadata: record.metadata ?? {}, created_at: requiredString(record, 'created_at'),
  };
}

export function parseCustomerDetail(value: Json | null): CustomerDetail {
  const root = jsonObject(value);
  const customer = jsonObject(root?.customer);
  if (!root || !customer) throw new Error('Resposta inválida ao carregar o cliente.');
  return {
    customer: parseCustomer(customer), subscription: parseSubscription(root.subscription),
    usage: objects(root.usage).map(parseUsage), users: objects(root.users).map(parseUser),
    sessions: objects(root.sessions).map(parseSession), inspections: objects(root.inspections).map(parseInspection),
    tickets: objects(root.tickets).map(parseTicket), onboarding: parseOnboarding(root.onboarding),
    audit: objects(root.audit).map(parseAudit), can_view_sensitive: root.can_view_sensitive === true,
  };
}

export function useCustomerDetail(customerId: string) {
  return useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_customer_detail', { p_customer_id: customerId });
      if (error) throw error;
      return parseCustomerDetail(data);
    },
    enabled: Boolean(customerId),
  });
}
