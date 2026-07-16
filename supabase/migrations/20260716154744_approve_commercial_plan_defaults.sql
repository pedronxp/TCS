-- Commercial defaults approved by the product owner on 2026-07-16.
-- Hosted migration version: 20260716154744.
-- Prices are in BRL cents. Annual prices charge ten monthly installments
-- (approximately 16.7% discount) to encourage annual commitment.

CREATE TEMP TABLE approved_commercial_defaults ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('individual_basic', 7990, 79900, 14, 7, 'block', 'standard', '["E-mail"]'::jsonb, 'Dias úteis, 9h às 18h (BRT)', 'Para o profissional autônomo que está iniciando a operação digital.'),
  ('individual_professional', 14990, 149900, 14, 7, 'block', 'priority', '["E-mail","Portal"]'::jsonb, 'Dias úteis, 8h às 18h (BRT)', 'Para profissionais com maior volume de vistorias e relatórios avançados.'),
  ('municipal_basic', 149000, 1490000, 30, 15, 'manual_review', 'standard', '["E-mail","Portal"]'::jsonb, 'Dias úteis, 8h às 18h (BRT)', 'Para prefeituras com equipes de até 10 agentes e operação municipal essencial.'),
  ('municipal_professional', 399000, 3990000, 30, 15, 'manual_review', 'priority', '["E-mail","Portal","WhatsApp"]'::jsonb, 'Dias úteis, 8h às 18h (BRT), com prioridade', 'Para prefeituras com equipes de até 30 agentes, indicadores completos e suporte prioritário.'),
  ('municipal_complete', 699000, 6990000, 30, 30, 'custom', 'specialized', '["E-mail","Portal","WhatsApp","Telefone"]'::jsonb, 'Atendimento estendido e plantão crítico conforme contrato', 'Plano municipal completo a partir do valor-base, com ARV, treinamento e condições ajustáveis por contrato.')
) AS value(
  plan_code,
  monthly_price_cents,
  annual_price_cents,
  trial_days,
  grace_days,
  overage_policy,
  support_tier,
  support_channels,
  support_hours,
  description
);

INSERT INTO public.plan_versions(plan_id, version, configuration)
SELECT
  plan.id,
  plan.current_version + 1,
  jsonb_build_object(
    'commercial',
    jsonb_build_object(
      'monthly_price_cents', approved.monthly_price_cents,
      'annual_price_cents', approved.annual_price_cents,
      'currency', 'BRL',
      'trial_days', approved.trial_days,
      'grace_days', approved.grace_days,
      'overage_policy', approved.overage_policy,
      'support_tier', approved.support_tier,
      'support_channels', approved.support_channels,
      'support_hours', approved.support_hours
    )
  )
FROM public.plans AS plan
JOIN approved_commercial_defaults AS approved ON approved.plan_code = plan.code;

UPDATE public.plans AS plan
SET current_version = plan.current_version + 1,
    status = 'draft',
    description = approved.description,
    updated_at = now()
FROM approved_commercial_defaults AS approved
WHERE approved.plan_code = plan.code;

INSERT INTO public.plan_limits(plan_id, resource_code, hard_limit, warning_percent)
SELECT plan.id, approved.resource_code, approved.hard_limit, approved.warning_percent
FROM public.plans AS plan
JOIN (VALUES
  ('individual_basic', 'users', 1::bigint, 80),
  ('individual_basic', 'inspections', 30::bigint, 80),
  ('individual_basic', 'invitations', 10::bigint, 80),
  ('individual_basic', 'storage_bytes', 1073741824::bigint, 80),
  ('individual_basic', 'sessions', 1::bigint, 100),
  ('individual_professional', 'users', 1::bigint, 80),
  ('individual_professional', 'inspections', 150::bigint, 80),
  ('individual_professional', 'invitations', 50::bigint, 80),
  ('individual_professional', 'storage_bytes', 5368709120::bigint, 80),
  ('individual_professional', 'sessions', 1::bigint, 100),
  ('municipal_basic', 'users', 10::bigint, 80),
  ('municipal_basic', 'inspections', 300::bigint, 80),
  ('municipal_basic', 'invitations', 50::bigint, 80),
  ('municipal_basic', 'storage_bytes', 21474836480::bigint, 80),
  ('municipal_basic', 'sessions', 1::bigint, 100),
  ('municipal_professional', 'users', 30::bigint, 80),
  ('municipal_professional', 'inspections', 1000::bigint, 80),
  ('municipal_professional', 'invitations', 200::bigint, 80),
  ('municipal_professional', 'storage_bytes', 107374182400::bigint, 80),
  ('municipal_professional', 'sessions', 1::bigint, 100),
  ('municipal_complete', 'users', 100::bigint, 80),
  ('municipal_complete', 'inspections', 5000::bigint, 80),
  ('municipal_complete', 'invitations', 1000::bigint, 80),
  ('municipal_complete', 'storage_bytes', 536870912000::bigint, 80),
  ('municipal_complete', 'sessions', 1::bigint, 100)
) AS approved(plan_code, resource_code, hard_limit, warning_percent)
  ON approved.plan_code = plan.code
ON CONFLICT (plan_id, resource_code) DO UPDATE
SET hard_limit = EXCLUDED.hard_limit,
    warning_percent = EXCLUDED.warning_percent;

INSERT INTO public.support_sla_policies(
  plan_id,
  priority,
  response_minutes,
  resolution_minutes,
  escalation_minutes
)
SELECT plan.id, approved.priority, approved.response_minutes, approved.resolution_minutes, approved.escalation_minutes
FROM public.plans AS plan
JOIN (VALUES
  ('individual_basic', 'low', 4320, 10080, 2880),
  ('individual_basic', 'normal', 2880, 7200, 1440),
  ('individual_basic', 'high', 1440, 4320, 720),
  ('individual_basic', 'critical', 720, 2880, 360),
  ('individual_professional', 'low', 2880, 7200, 1440),
  ('individual_professional', 'normal', 1440, 4320, 720),
  ('individual_professional', 'high', 480, 2880, 240),
  ('individual_professional', 'critical', 240, 1440, 120),
  ('municipal_basic', 'low', 2880, 7200, 1440),
  ('municipal_basic', 'normal', 1440, 4320, 720),
  ('municipal_basic', 'high', 480, 2880, 240),
  ('municipal_basic', 'critical', 240, 1440, 120),
  ('municipal_professional', 'low', 1440, 4320, 720),
  ('municipal_professional', 'normal', 480, 2880, 240),
  ('municipal_professional', 'high', 240, 1440, 120),
  ('municipal_professional', 'critical', 120, 720, 60),
  ('municipal_complete', 'low', 480, 2880, 240),
  ('municipal_complete', 'normal', 240, 1440, 120),
  ('municipal_complete', 'high', 120, 720, 60),
  ('municipal_complete', 'critical', 60, 480, 30)
) AS approved(plan_code, priority, response_minutes, resolution_minutes, escalation_minutes)
  ON approved.plan_code = plan.code
ON CONFLICT (plan_id, priority) DO UPDATE
SET response_minutes = EXCLUDED.response_minutes,
    resolution_minutes = EXCLUDED.resolution_minutes,
    escalation_minutes = EXCLUDED.escalation_minutes;

INSERT INTO public.subscription_audit_events(event_type, entity_type, entity_id, metadata)
SELECT
  'commercial_defaults_approved',
  'plan',
  plan.id::text,
  jsonb_build_object(
    'plan_code', plan.code,
    'version', plan.current_version,
    'approval_date', '2026-07-16',
    'source', 'product_owner_instruction'
  )
FROM public.plans AS plan
JOIN approved_commercial_defaults AS approved ON approved.plan_code = plan.code;

-- Enforcement remains disabled until the municipal pilot is measured and approved.
UPDATE public.subscription_settings
SET entitlement_enforcement_enabled = false,
    session_enforcement_enabled = false,
    updated_at = now()
WHERE singleton;
