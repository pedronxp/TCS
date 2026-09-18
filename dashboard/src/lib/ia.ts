import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Módulo de IA — acessa as tabelas ai_* / chatbot_config / whatsapp_agent_sessions
 * APENAS via RPCs security definer (ver migration ai_panel_rpcs).
 * As tabelas têm RLS restritivo de propósito: somente equipe interna
 * (owner/developer/support) passa nas RPCs. As chaves de API nunca são
 * expostas — o painel recebe apenas um hint mascarado ("••••1234").
 *
 * O client tipado (Database) ainda não conhece as tabelas novas porque
 * src/types/supabase.ts é gerado do schema — por isso usamos este alias.
 */
const db = supabase as unknown as SupabaseClient;

// ---------- tipos ----------

export interface AiKeyRow {
  id: string;
  provider: string;
  label: string;
  model: string;
  use_for: string[];
  priority: number;
  status: 'active' | 'cooldown' | 'disabled' | 'error';
  cooldown_until: string | null;
  monthly_token_limit: number | null;
  tokens_used_month: number;
  last_ok_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  key_hint: string;
  created_at: string;
}

export interface AiOverview {
  keys: { status: string; total: number }[];
  usage_today: { total: number; ok: number; tokens: number };
  usage_30d: { total: number; tokens: number };
  sessions_active: number;
  fallbacks_24h: number;
}

export interface AiFeatureRow {
  key: string;
  name: string;
  description: string | null;
  surface: 'app' | 'whatsapp' | 'painel';
  stage: 'dev' | 'validation' | 'ga';
  grants_active: number;
}

export interface AiGrantRow {
  id: string;
  feature_key: string;
  organization_id: string | null;
  user_id: string | null;
  enabled: boolean;
  note: string | null;
  created_at: string;
  organization_name: string | null;
  user_email: string | null;
  user_name: string | null;
}

export interface AiUsageRow {
  created_at: string;
  feature: string | null;
  model: string | null;
  provider: string | null;
  success: boolean;
  fallback_used: boolean;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number | null;
  error_code: string | null;
  user_email: string | null;
}

export interface ChatbotConfig {
  id: string;
  organization_id: string | null;
  numero_bot: string | null;
  mode: string;
  welcome_message: string;
  session_ttl_hours: number;
  ia_enabled: boolean;
  accept_images: boolean;
  master_prompt: string | null;
  human_handoff_phone: string | null;
  feature_permissions: Record<string, string[]>;
  model_overrides: Record<string, string> | null;
  updated_at: string;
}

export interface WhatsappSessionRow {
  id: string;
  phone: string;
  state: string;
  consent_lgpd: boolean;
  last_interaction_at: string;
  expires_at: string | null;
  user_email: string | null;
  user_name: string | null;
  organization_name: string | null;
}

export interface CronStatus {
  jobs: { jobname: string; schedule: string; active: boolean }[];
  recent_runs: { jobname: string; status: string; return_message: string | null; start_time: string; end_time: string | null }[];
}

// ---------- chamadas RPC ----------

async function rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, params ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

export const iaApi = {
  overview: () => rpc<AiOverview>('ai_overview'),

  keysList: () => rpc<AiKeyRow[]>('ai_keys_list'),
  keySave: (input: {
    id?: string | null; provider: string; label: string; api_key?: string;
    model: string; use_for: string[]; priority: number; monthly_token_limit: number | null;
  }) => rpc<string>('ai_key_save', {
    p_id: input.id ?? null,
    p_provider: input.provider,
    p_label: input.label,
    p_api_key: input.api_key ?? null,
    p_model: input.model,
    p_use_for: input.use_for,
    p_priority: input.priority,
    p_monthly_token_limit: input.monthly_token_limit,
  }),
  keySetStatus: (id: string, status: 'active' | 'disabled') =>
    rpc<void>('ai_key_set_status', { p_id: id, p_status: status }),

  healthCheckNow: async (): Promise<{ ok: boolean; results?: unknown[] }> => {
    const { data, error } = await supabase.functions.invoke('ai-health-check', { body: {} });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; results?: unknown[] };
  },

  usageRecent: (limit = 50) => rpc<AiUsageRow[]>('ai_usage_recent', { p_limit: limit }),

  featuresList: () => rpc<AiFeatureRow[]>('ai_features_list'),
  featureSetStage: (key: string, stage: 'dev' | 'validation' | 'ga') =>
    rpc<void>('ai_feature_set_stage', { p_key: key, p_stage: stage }),

  grantsList: () => rpc<AiGrantRow[]>('ai_grants_list'),
  grantSet: (input: { feature_key: string; organization_id?: string | null; user_id?: string | null; enabled: boolean; note?: string | null }) =>
    rpc<string>('ai_grant_set', {
      p_feature_key: input.feature_key,
      p_organization_id: input.organization_id ?? null,
      p_user_id: input.user_id ?? null,
      p_enabled: input.enabled,
      p_note: input.note ?? null,
    }),
  grantRemove: (id: string) => rpc<void>('ai_grant_remove', { p_id: id }),

  chatbotConfigGet: () => rpc<ChatbotConfig | null>('chatbot_config_get'),
  chatbotConfigUpdate: (patch: Partial<{
    numero_bot: string; welcome_message: string; ia_enabled: boolean; accept_images: boolean;
    session_ttl_hours: number; master_prompt: string; human_handoff_phone: string;
    feature_permissions: Record<string, string[]>; model_overrides: Record<string, string>;
  }>) => rpc<void>('chatbot_config_update', {
    p_numero_bot: patch.numero_bot ?? null,
    p_welcome_message: patch.welcome_message ?? null,
    p_ia_enabled: patch.ia_enabled ?? null,
    p_accept_images: patch.accept_images ?? null,
    p_session_ttl_hours: patch.session_ttl_hours ?? null,
    p_master_prompt: patch.master_prompt ?? null,
    p_human_handoff_phone: patch.human_handoff_phone ?? null,
    p_feature_permissions: patch.feature_permissions ?? null,
    p_model_overrides: patch.model_overrides ?? null,
  }),

  whatsappSessions: () => rpc<WhatsappSessionRow[]>('whatsapp_sessions_list'),
  whatsappSessionRevoke: (id: string) => rpc<void>('whatsapp_session_revoke', { p_id: id }),

  cronStatus: () => rpc<CronStatus>('ai_cron_status'),

  modulesMatrix: () => rpc<{ modules: string[]; rows: { organization_id: string; org: string; module_key: string; enabled: boolean }[]; orgs: { id: string; name: string }[] }>('ai_modules_matrix'),
  moduleSet: (orgId: string, moduleKey: string, enabled: boolean) =>
    rpc<void>('ai_module_set', { p_organization_id: orgId, p_module_key: moduleKey, p_enabled: enabled }),


  /** Simulador do bot dentro do painel (equipe interna). */
  simulateBot: async (phone: string, message: string): Promise<{ replies: string[]; documents: { name: string; url: string }[] }> => {
    const { data, error } = await supabase.functions.invoke('whatsapp-agent', { body: { phone, message } });
    if (error) throw new Error(error.message);
    return data as { replies: string[]; documents: { name: string; url: string }[] };
  },
};
