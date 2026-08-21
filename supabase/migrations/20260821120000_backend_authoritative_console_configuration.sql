-- Console configuration changes are server-authoritative. Browser clients can
-- request a policy update, but only the database validates, applies and audits it.

CREATE OR REPLACE FUNCTION public.update_internal_archive_configuration(
  p_mode text,
  p_enabled boolean,
  p_days_threshold integer,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_mode text := btrim(coalesce(p_mode, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before jsonb;
  v_result jsonb;
  v_hash text;
BEGIN
  IF v_actor IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_internal_permission('configuration.publish', v_actor) THEN
    RAISE EXCEPTION 'archive_configuration_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF v_mode NOT IN ('auto', 'manual') OR p_enabled IS NULL OR p_days_threshold NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'invalid_archive_configuration' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  v_hash := md5(concat_ws('|', v_mode, p_enabled::text, p_days_threshold::text, v_reason));
  SELECT result INTO v_result
  FROM public.internal_operations
  WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'archive.configuration.update', v_hash);

  SELECT valor INTO v_before
  FROM public.configuracoes
  WHERE id = 'arquivamento'
  FOR UPDATE;

  INSERT INTO public.configuracoes(id, valor, "atualizadoEm")
  VALUES ('arquivamento', jsonb_build_object('mode', v_mode, 'enabled', p_enabled, 'days_threshold', p_days_threshold), now())
  ON CONFLICT (id) DO UPDATE
  SET valor = EXCLUDED.valor, "atualizadoEm" = EXCLUDED."atualizadoEm";

  v_result := jsonb_build_object(
    'ok', true,
    'config', jsonb_build_object('mode', v_mode, 'enabled', p_enabled, 'days_threshold', p_days_threshold)
  );
  UPDATE public.internal_operations
  SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (
    v_actor,
    private.current_internal_role(v_actor),
    'archive.configuration.update',
    'configuration',
    'arquivamento',
    'allowed',
    v_reason,
    jsonb_build_object('before', coalesce(v_before, '{}'::jsonb), 'after', v_result->'config')
  );
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.internal_operations
  SET status = 'failed', completed_at = now(), result = jsonb_build_object('ok', false)
  WHERE actor_id = v_actor AND operation_id = p_operation_id AND status = 'processing';
  RAISE;
END;
$$;

-- The console no longer mutates this setting through PostgREST. Edge Functions
-- retain their service-role access for scheduled archive processing.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.configuracoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_internal_archive_configuration(text, boolean, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_internal_archive_configuration(text, boolean, integer, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_notification_campaign_municipalities()
RETURNS TABLE(nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('notification.manage')
    AND NOT private.has_internal_permission('technical.write') THEN
    RAISE EXCEPTION 'notification_management_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT municipality.nome
  FROM public.municipios AS municipality
  WHERE municipality.ativo = true
  ORDER BY municipality.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.list_notification_campaign_municipalities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_notification_campaign_municipalities() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_internal_support_plan_options()
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('support.read') THEN
    RAISE EXCEPTION 'support_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT plan.id, plan.name
  FROM public.plans AS plan
  WHERE plan.status <> 'retired'
  ORDER BY plan.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_plan_catalog()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('commercial.read') THEN
    RAISE EXCEPTION 'commercial_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', plan.id,
        'code', plan.code,
        'name', plan.name,
        'description', plan.description,
        'audience', plan.audience,
        'status', plan.status,
        'current_version', plan.current_version,
        'plan_features', COALESCE((SELECT jsonb_agg(jsonb_build_object('feature_code', feature.feature_code, 'enabled', feature.enabled) ORDER BY feature.feature_code) FROM public.plan_features AS feature WHERE feature.plan_id = plan.id), '[]'::jsonb),
        'plan_limits', COALESCE((SELECT jsonb_agg(jsonb_build_object('resource_code', limit_row.resource_code, 'hard_limit', limit_row.hard_limit, 'warning_percent', limit_row.warning_percent) ORDER BY limit_row.resource_code) FROM public.plan_limits AS limit_row WHERE limit_row.plan_id = plan.id), '[]'::jsonb),
        'plan_versions', COALESCE((SELECT jsonb_agg(jsonb_build_object('version', version_row.version, 'configuration', version_row.configuration, 'published_at', version_row.published_at) ORDER BY version_row.version DESC) FROM public.plan_versions AS version_row WHERE version_row.plan_id = plan.id), '[]'::jsonb),
        'support_sla_policies', COALESCE((SELECT jsonb_agg(jsonb_build_object('priority', policy.priority, 'response_minutes', policy.response_minutes, 'resolution_minutes', policy.resolution_minutes, 'escalation_minutes', policy.escalation_minutes) ORDER BY policy.priority) FROM public.support_sla_policies AS policy WHERE policy.plan_id = plan.id), '[]'::jsonb)
      ) ORDER BY plan.name)
      FROM public.plans AS plan
    ), '[]'::jsonb),
    'features', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', feature.code, 'name', feature.name, 'category', feature.category, 'description', feature.description, 'active', feature.active) ORDER BY feature.category, feature.name)
      FROM public.features AS feature
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_release_catalog()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN
    RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'settings', COALESCE((
      SELECT jsonb_build_object(
        'published_version', settings.published_version,
        'minimum_version', settings.minimum_version,
        'development_version', settings.development_version,
        'updated_at', settings.updated_at
      )
      FROM public.internal_release_settings AS settings
      WHERE settings.singleton = true
      LIMIT 1
    ), '{}'::jsonb),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version', version_row.version,
        'status', version_row.status,
        'changelog', version_row.changelog,
        'published_at', version_row.published_at,
        'updated_at', version_row.updated_at,
        'adoption', (SELECT count(*) FROM public.technical_events AS event WHERE event.app_version = version_row.version)
      ) ORDER BY version_row.updated_at DESC)
      FROM public.internal_app_versions AS version_row
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_builds_dashboard(
  p_request_limit integer DEFAULT 100,
  p_event_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_limit integer := greatest(1, least(coalesce(p_request_limit, 100), 100));
  v_event_limit integer := greatest(1, least(coalesce(p_event_limit, 50), 100));
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN
    RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'requests', COALESCE((SELECT jsonb_agg(to_jsonb(request_row) ORDER BY request_row.created_at DESC) FROM (SELECT * FROM public.internal_build_requests ORDER BY created_at DESC LIMIT v_request_limit) AS request_row), '[]'::jsonb),
    'builds', COALESCE((SELECT jsonb_agg(to_jsonb(build_row) ORDER BY build_row.created_at DESC NULLS LAST) FROM (SELECT * FROM public.builds ORDER BY created_at DESC NULLS LAST LIMIT v_request_limit) AS build_row), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('event_key', event.event_key, 'app_version', event.app_version, 'severity', event.severity, 'correlation_id', event.correlation_id, 'summary', event.summary, 'occurred_at', event.occurred_at) ORDER BY event.occurred_at DESC) FROM (SELECT * FROM public.technical_events WHERE category = 'build' ORDER BY occurred_at DESC LIMIT v_event_limit) AS event), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_support_plan_options(), public.list_internal_plan_catalog(), public.get_internal_release_catalog(), public.get_internal_builds_dashboard(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_support_plan_options(), public.list_internal_plan_catalog(), public.get_internal_release_catalog(), public.get_internal_builds_dashboard(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_internal_token_municipalities()
RETURNS TABLE(nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('token.manage')
    AND NOT private.has_internal_permission('commercial.write') THEN
    RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT municipality.nome
  FROM public.municipios AS municipality
  WHERE municipality.ativo = true
  ORDER BY municipality.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_token_municipalities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_token_municipalities() TO authenticated;
NOTIFY pgrst, 'reload schema';
