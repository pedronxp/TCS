import { describe, expectTypeOf, it } from 'vitest';
import type { Database, Json } from './supabase';

type Functions = Database['public']['Functions'];
type Tables = Database['public']['Tables'];

type PortalFunctionContract = {
  get_portal_access_context: { Args: never; Returns: Json };
  portal_ensure_individual_profile: { Args: never; Returns: Json };
  portal_get_dashboard: { Args: never; Returns: Json };
  portal_get_workspace: { Args: { p_section: string }; Returns: Json };
  portal_create_appointment: {
    Args: {
      p_inspection_id: string | null;
      p_notes?: string | null;
      p_scheduled_at: string;
      p_title: string;
    };
    Returns: Json;
  };
  portal_get_inspection: { Args: { p_inspection_id: string }; Returns: Json };
  portal_list_own_sessions: { Args: never; Returns: Json };
  portal_end_own_session: { Args: { p_session_id: string }; Returns: boolean };
  portal_authorize_inspection_document: {
    Args: { p_inspection_id: string };
    Returns: Json;
  };
  portal_get_invite_preview: { Args: { p_token: string }; Returns: Json };
  portal_create_organization_invite: {
    Args: { p_email: string; p_expires_in_hours?: number; p_role: string };
    Returns: Json;
  };
  portal_accept_organization_invite: {
    Args: { p_token: string };
    Returns: Json;
  };
  portal_revoke_organization_invite: {
    Args: { p_invite_id: string };
    Returns: boolean;
  };
  portal_create_checkout: {
    Args: {
      p_idempotency_key: string;
      p_periodicity: string;
      p_plan_code: string;
    };
    Returns: Json;
  };
  portal_get_checkout_status: {
    Args: { p_checkout_id: string };
    Returns: Json;
  };
  portal_update_organization_member: {
    Args: {
      p_confirmation: string;
      p_member_id: string;
      p_reason: string;
      p_role: string;
      p_status: string;
    };
    Returns: Json;
  };
  portal_update_organization_settings: {
    Args: {
      p_confirmation: string;
      p_contact_email: string;
      p_contact_name: string;
      p_display_name: string;
      p_reason: string;
      p_session_timeout_minutes: number;
    };
    Returns: Json;
  };
  portal_process_payment_event: {
    Args: {
      p_event_type: string;
      p_payload_hash: string;
      p_provider: string;
      p_provider_event_id: string;
      p_provider_event_time: string;
      p_provider_session_id: string;
      p_provider_subscription_id?: string | null;
      p_subscription_status: string;
    };
    Returns: Json;
  };
};

describe('contrato Supabase do portal', () => {
  it('mantém todos os RPCs e argumentos usados pelas superfícies do portal', () => {
    expectTypeOf<Pick<Functions, keyof PortalFunctionContract>>()
      .toEqualTypeOf<PortalFunctionContract>();
  });

  it('mantém tabelas e colunas introduzidas pela fundação do portal', () => {
    expectTypeOf<Tables['organization_members']['Row']>()
      .toMatchTypeOf<{ scope: Json }>();
    expectTypeOf<Tables['subscriptions']['Row']>()
      .toMatchTypeOf<{
        cancel_at_period_end: boolean;
        plan_version_id: string | null;
        provider: string | null;
        provider_customer_id: string | null;
        provider_event_time: string | null;
        provider_subscription_id: string | null;
      }>();
    expectTypeOf<Tables['plan_version_features']['Row']>()
      .toMatchTypeOf<{
        plan_version_id: string;
        feature_code: string;
        enabled: boolean;
        configuration: Json;
      }>();
    expectTypeOf<Tables['plan_version_limits']['Row']>()
      .toMatchTypeOf<{
        plan_version_id: string;
        resource_code: string;
        hard_limit: number | null;
      }>();
    expectTypeOf<Tables['portal_rollout_settings']['Row']>()
      .toMatchTypeOf<{ singleton: boolean; billing_enabled: boolean }>();
    expectTypeOf<Tables['portal_checkout_sessions']['Row']>()
      .toMatchTypeOf<{
        requester_id: string;
        idempotency_key: string;
        plan_version_id: string;
        status: string;
      }>();
    expectTypeOf<Tables['portal_payment_events']['Row']>()
      .toMatchTypeOf<{
        provider_event_id: string;
        provider_event_time: string;
        payload_hash: string;
        status: string;
      }>();
  });
});
