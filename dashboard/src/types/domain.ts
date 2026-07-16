import type { Json } from './supabase';

export type CustomerKind = 'organization' | 'individual';

export interface CustomerRecord {
  customer_id: string;
  kind: CustomerKind;
  subject_id: string;
  display_name: string;
  legal_name: string | null;
  municipality_name: string | null;
  state_code: string | null;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  subscription_status: string | null;
  plan_name: string | null;
  active_users: number;
  last_activity_at: string | null;
}

export interface CustomerPage {
  items: CustomerRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomerDetailRecord extends CustomerRecord {
  contract_reference: string | null;
  session_policy: string | null;
  session_timeout_minutes: number | null;
  offline_tolerance_minutes: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerSubscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  starts_at: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
  grace_ends_at: string | null;
  canceled_at: string | null;
  overrides: Json;
}

export interface CustomerUsage {
  resource_code: string;
  consumed: number;
  hard_limit: number | null;
  warning_percent: number | null;
  period_start: string;
  period_end: string;
}

export interface CustomerUser {
  id: string | null;
  user_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  status: string;
  joined_at: string | null;
  last_login: string | null;
}

export interface CustomerSession {
  id: string;
  user_id: string;
  device_name: string | null;
  platform: string;
  status: string;
  last_heartbeat_at: string;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
}

export interface CustomerInspection {
  id: string;
  protocol: string | null;
  risk: string | null;
  status: string | null;
  occurred_at: string | null;
  agent_name: string | null;
  address: string | null;
}

export interface CustomerTicket {
  id: string;
  public_code: string;
  subject: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  response_due_at: string | null;
  resolution_due_at: string | null;
  escalate_at: string | null;
  created_at: string;
}

export interface CustomerOnboarding {
  pilot_started_at: string | null;
  coordinator_trained_at: string | null;
  checklist: Json;
  review_due_at: string | null;
  review_completed_at: string | null;
  updated_at: string;
}

export interface CustomerAuditEvent {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
}

export interface CustomerDetail {
  customer: CustomerDetailRecord;
  subscription: CustomerSubscription | null;
  usage: CustomerUsage[];
  users: CustomerUser[];
  sessions: CustomerSession[];
  inspections: CustomerInspection[];
  tickets: CustomerTicket[];
  onboarding: CustomerOnboarding | null;
  audit: CustomerAuditEvent[];
  can_view_sensitive: boolean;
}

export interface CustomerAppointment { id: string; title: string; status: string; scheduled_at: string | null; agent_name: string | null; address: string | null; latitude: number | null; longitude: number | null }
export interface CustomerMapPoint { id: string; protocol: string | null; risk: string | null; status: string | null; occurred_at: string | null; latitude: number | null; longitude: number | null; address: string | null }
export interface CustomerDocument { id: string; protocol: string | null; risk: string | null; generated_at: string | null; url: string; storage_location: string | null }
export interface CustomerReport { id: string; protocol: string | null; risk: string | null; score: number | null; form_id: string | null; form_version: number | null; generated_at: string | null }
export interface CustomerOperations { appointments: CustomerAppointment[]; mapPoints: CustomerMapPoint[]; documents: CustomerDocument[]; reports: CustomerReport[] }

export interface TechnicalEvent {
  id: number;
  event_key: string;
  organization_id: string | null;
  app_version: string | null;
  platform: string;
  category: string;
  severity: string;
  correlation_id: string | null;
  summary: string;
  occurred_at: string;
}

export interface MutationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  operationId: string;
}
