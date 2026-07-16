-- Follow-up from validation against the hosted PostgreSQL schema.
-- Hosted migration version: 20260716142121.
-- Restores UTF-8 seed labels and addresses advisor findings introduced by the subscription platform.

UPDATE public.features AS feature
SET name = seed.name,
    description = seed.description
FROM (VALUES
  ('inspection_standard', 'Vistoria padrão', 'Fluxos de vistoria já disponíveis no aplicativo'),
  ('inspection_arv', 'Vistoria de Árvores (ARV)', 'Formulário técnico para vistoria de árvores'),
  ('training_mode', 'Modo treinamento', 'Turmas e vistorias de treinamento'),
  ('reports_basic', 'Relatórios básicos', 'Laudos e exportações essenciais'),
  ('reports_advanced', 'Relatórios avançados', 'Relatórios e análises ampliadas'),
  ('reports_institutional', 'Relatórios institucionais', 'Relatórios personalizados para organizações'),
  ('indicators_essential', 'Indicadores essenciais', 'Indicadores e mapas essenciais'),
  ('indicators_complete', 'Indicadores completos', 'Indicadores e mapas completos'),
  ('indicators_custom', 'Indicadores customizados', 'Indicadores configurados para a organização'),
  ('municipal_coordination', 'Coordenação municipal', 'Agentes, convites e sessões da organização')
) AS seed(code, name, description)
WHERE feature.code = seed.code;

UPDATE public.plans AS plan
SET name = seed.name,
    description = seed.description
FROM (VALUES
  ('compatibility', 'Compatibilidade', 'Fluxo legado durante migração; não comercializável'),
  ('individual_basic', 'Individual Básico', 'Proposta inicial do documento comercial; preço pendente de aprovação'),
  ('individual_professional', 'Individual Profissional', 'Proposta inicial do documento comercial; add-ons pendentes de aprovação'),
  ('municipal_basic', 'Municipal Básico', 'Proposta inicial para equipes de até 10 agentes'),
  ('municipal_professional', 'Municipal Profissional', 'Proposta inicial para equipes de até 30 agentes'),
  ('municipal_complete', 'Municipal Completo', 'Plano customizado; valores definidos por contrato')
) AS seed(code, name, description)
WHERE plan.code = seed.code;

UPDATE public.plan_versions
SET configuration = jsonb_set(
  configuration,
  '{commercial,support_hours}',
  to_jsonb('Dias úteis, horário comercial'::text),
  true
)
WHERE configuration ? 'commercial';

CREATE INDEX IF NOT EXISTS active_sessions_ended_by_idx ON public.active_sessions(ended_by);
CREATE INDEX IF NOT EXISTS organization_invites_accepted_by_idx ON public.organization_invites(accepted_by);
CREATE INDEX IF NOT EXISTS organization_invites_created_by_idx ON public.organization_invites(created_by);
CREATE INDEX IF NOT EXISTS owner_admins_created_by_idx ON public.owner_admins(created_by);
CREATE INDEX IF NOT EXISTS plan_features_feature_code_idx ON public.plan_features(feature_code);
CREATE INDEX IF NOT EXISTS plan_versions_created_by_idx ON public.plan_versions(created_by);
CREATE INDEX IF NOT EXISTS subscription_audit_events_actor_id_idx ON public.subscription_audit_events(actor_id);
CREATE INDEX IF NOT EXISTS subscription_settings_updated_by_idx ON public.subscription_settings(updated_by);
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS support_sla_policies_default_assignee_idx ON public.support_sla_policies(default_assignee);
CREATE INDEX IF NOT EXISTS support_ticket_events_actor_id_idx ON public.support_ticket_events(actor_id);
CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_id_idx ON public.support_ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_to_idx ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS support_tickets_plan_id_idx ON public.support_tickets(plan_id);
CREATE INDEX IF NOT EXISTS support_tickets_requester_id_idx ON public.support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON public.usage_events(user_id);

-- FOR ALL also creates a SELECT policy. Split owner writes so they do not overlap
-- the dedicated read policies and force PostgreSQL to evaluate two permissive paths.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('organizations', 'organizations_owner_write'),
      ('plans', 'plans_owner_write'),
      ('plan_versions', 'plan_versions_owner_write'),
      ('features', 'features_owner_write'),
      ('plan_features', 'plan_features_owner_write'),
      ('plan_limits', 'plan_limits_owner_write'),
      ('subscriptions', 'subscriptions_owner_write'),
      ('support_ticket_events', 'ticket_events_owner_write'),
      ('support_sla_policies', 'support_sla_owner_write'),
      ('organization_onboarding', 'onboarding_owner_write')
    ) AS policies(table_name, policy_name)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', target.policy_name, target.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_owner_admin()))',
      target.policy_name || '_insert',
      target.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()))',
      target.policy_name || '_update',
      target.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT private.is_owner_admin()))',
      target.policy_name || '_delete',
      target.table_name
    );
  END LOOP;
END;
$$;
