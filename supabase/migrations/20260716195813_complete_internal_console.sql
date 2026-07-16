-- Complete the internal console read models and audited release operations.

CREATE TABLE public.internal_app_versions (
  version text PRIMARY KEY CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$'),
  status text NOT NULL CHECK (status IN ('development', 'published', 'retired')),
  changelog text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX internal_app_versions_one_development
  ON public.internal_app_versions(status) WHERE status = 'development';

CREATE TABLE public.internal_release_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  published_version text NOT NULL REFERENCES public.internal_app_versions(version),
  minimum_version text NOT NULL REFERENCES public.internal_app_versions(version),
  development_version text NOT NULL REFERENCES public.internal_app_versions(version),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.internal_app_versions(version, status, changelog, published_at)
VALUES ('1.3.16', 'development', 'Versão encontrada no app.json ao iniciar o catálogo interno.', now())
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.internal_release_settings(
  singleton, published_version, minimum_version, development_version
)
VALUES (true, '1.3.16', '1.3.16', '1.3.16')
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.internal_app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_release_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_app_versions_staff_read
ON public.internal_app_versions FOR SELECT TO authenticated
USING (private.has_internal_permission('technical.read'));

CREATE POLICY internal_release_settings_staff_read
ON public.internal_release_settings FOR SELECT TO authenticated
USING (private.has_internal_permission('technical.read'));

REVOKE ALL ON TABLE public.internal_app_versions, public.internal_release_settings FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.internal_app_versions, public.internal_release_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.get_internal_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  role_name text := private.current_internal_role();
  result jsonb;
BEGIN
  IF role_name = 'owner' THEN
    IF NOT private.has_internal_permission('dashboard.executive.read') THEN
      RAISE EXCEPTION 'executive_dashboard_not_allowed' USING ERRCODE = '42501';
    END IF;
    SELECT jsonb_build_object(
      'kind', 'executive',
      'metrics', jsonb_build_array(
        jsonb_build_object('key', 'customers', 'label', 'Clientes', 'value',
          (SELECT count(*) FROM public.organizations) +
          (SELECT count(*) FROM public.users WHERE organization_id IS NULL AND role <> 'master_admin')),
        jsonb_build_object('key', 'subscriptions', 'label', 'Assinaturas vigentes', 'value',
          (SELECT count(*) FROM public.subscriptions WHERE status IN ('trial','active','grace'))),
        jsonb_build_object('key', 'renewals', 'label', 'Renovações em 30 dias', 'value',
          (SELECT count(*) FROM public.subscriptions WHERE status IN ('trial','active','grace')
            AND current_period_end BETWEEN now() AND now() + interval '30 days')),
        jsonb_build_object('key', 'past_due', 'label', 'Assinaturas em risco', 'value',
          (SELECT count(*) FROM public.subscriptions WHERE status = 'past_due')),
        jsonb_build_object('key', 'support', 'label', 'Chamados abertos', 'value',
          (SELECT count(*) FROM public.support_tickets WHERE status NOT IN ('resolved','closed'))),
        jsonb_build_object('key', 'sla', 'label', 'SLAs violados', 'value',
          (SELECT count(*) FROM public.support_tickets WHERE status NOT IN ('resolved','closed')
            AND (response_due_at < now() OR resolution_due_at < now()))),
        jsonb_build_object('key', 'onboarding', 'label', 'Implantações em curso', 'value',
          (SELECT count(*) FROM public.organizations WHERE status IN ('onboarding','pilot')))
      ),
      'attention', COALESCE((
        SELECT jsonb_agg(item ORDER BY sort_at)
        FROM (
          SELECT jsonb_build_object(
            'type', 'renewal', 'label', COALESCE(o.display_name, u.name, 'Cliente'),
            'detail', p.name, 'status', s.status,
            'customer_id', CASE WHEN s.organization_id IS NOT NULL THEN 'organization:' || s.organization_id ELSE 'user:' || s.user_id END,
            'due_at', s.current_period_end
          ) AS item, s.current_period_end AS sort_at
          FROM public.subscriptions s
          JOIN public.plans p ON p.id = s.plan_id
          LEFT JOIN public.organizations o ON o.id = s.organization_id
          LEFT JOIN public.users u ON u.uid = s.user_id
          WHERE s.status IN ('trial','active','grace','past_due')
            AND (s.status = 'past_due' OR s.current_period_end <= now() + interval '30 days')
          UNION ALL
          SELECT jsonb_build_object(
            'type', 'support', 'label', t.public_code || ' · ' || t.subject,
            'detail', COALESCE(o.display_name, u.name, 'Conta individual'),
            'status', t.priority,
            'customer_id', CASE WHEN t.organization_id IS NOT NULL THEN 'organization:' || t.organization_id ELSE 'user:' || t.user_id END,
            'due_at', COALESCE(t.response_due_at, t.resolution_due_at, t.escalate_at)
          ), COALESCE(t.response_due_at, t.resolution_due_at, t.escalate_at)
          FROM public.support_tickets t
          LEFT JOIN public.organizations o ON o.id = t.organization_id
          LEFT JOIN public.users u ON u.uid = t.user_id
          WHERE t.status NOT IN ('resolved','closed')
            AND (t.response_due_at < now() OR t.resolution_due_at < now() OR t.escalate_at < now())
          LIMIT 12
        ) attention_items
      ), '[]'::jsonb)
    ) INTO result;
  ELSIF role_name = 'developer' THEN
    IF NOT private.has_internal_permission('dashboard.technical.read') THEN
      RAISE EXCEPTION 'technical_dashboard_not_allowed' USING ERRCODE = '42501';
    END IF;
    SELECT jsonb_build_object(
      'kind', 'technical',
      'release', (SELECT to_jsonb(s) - 'singleton' - 'updated_by' FROM public.internal_release_settings s WHERE singleton),
      'metrics', jsonb_build_array(
        jsonb_build_object('key', 'builds_running', 'label', 'Builds em andamento', 'value',
          (SELECT count(*) FROM public.builds WHERE status IN ('queued','building'))),
        jsonb_build_object('key', 'builds_failed', 'label', 'Builds com falha (7d)', 'value',
          (SELECT count(*) FROM public.builds WHERE status = 'failed' AND created_at >= now() - interval '7 days')),
        jsonb_build_object('key', 'sync', 'label', 'Falhas de sincronização (24h)', 'value',
          (SELECT count(*) FROM public.technical_events WHERE category = 'sync' AND severity IN ('warning','error','critical') AND occurred_at >= now() - interval '24 hours')),
        jsonb_build_object('key', 'storage', 'label', 'Falhas de armazenamento (24h)', 'value',
          (SELECT count(*) FROM public.technical_events WHERE category = 'storage' AND severity IN ('warning','error','critical') AND occurred_at >= now() - interval '24 hours')),
        jsonb_build_object('key', 'errors', 'label', 'Erros críticos (24h)', 'value',
          (SELECT count(*) FROM public.technical_events WHERE severity IN ('error','critical') AND occurred_at >= now() - interval '24 hours'))
      ),
      'attention', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'type', 'technical', 'label', e.summary, 'detail', e.category || ' · ' || e.platform,
          'status', e.severity,
          'customer_id', CASE WHEN e.organization_id IS NOT NULL THEN 'organization:' || e.organization_id END,
          'due_at', e.occurred_at
        ) ORDER BY e.occurred_at DESC)
        FROM (SELECT * FROM public.technical_events WHERE severity IN ('warning','error','critical') ORDER BY occurred_at DESC LIMIT 12) e
      ), '[]'::jsonb)
    ) INTO result;
  ELSE
    RAISE EXCEPTION 'internal_dashboard_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_support_queue(
  p_search text DEFAULT NULL,
  p_customer_id text DEFAULT NULL,
  p_plan_id text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_assignee_id text DEFAULT NULL,
  p_sla text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('support.read') THEN
    RAISE EXCEPTION 'support_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  WITH queue AS (
    SELECT
      t.id, t.public_code, t.subject, t.description, t.category, t.priority, t.status,
      t.assigned_to, staff.display_name AS assigned_to_name,
      t.response_due_at, t.resolution_due_at, t.escalate_at, t.created_at, t.updated_at,
      p.id AS plan_id, p.name AS plan_name,
      CASE WHEN t.organization_id IS NOT NULL THEN 'organization:' || t.organization_id ELSE 'user:' || t.user_id END AS customer_id,
      COALESCE(o.display_name, u.name, 'Conta individual') AS customer_name,
      (t.status NOT IN ('resolved','closed') AND (t.response_due_at < now() OR t.resolution_due_at < now())) AS sla_breached,
      (t.status NOT IN ('resolved','closed') AND t.escalate_at IS NOT NULL AND t.escalate_at <= now()) AS escalated
    FROM public.support_tickets t
    LEFT JOIN public.organizations o ON o.id = t.organization_id
    LEFT JOIN public.users u ON u.uid = t.user_id
    LEFT JOIN public.plans p ON p.id = t.plan_id
    LEFT JOIN public.internal_staff staff ON staff.user_id = t.assigned_to
  ), filtered AS (
    SELECT * FROM queue q
    WHERE (p_search IS NULL OR trim(p_search) = '' OR q.public_code ILIKE '%' || trim(p_search) || '%' OR q.subject ILIKE '%' || trim(p_search) || '%')
      AND (p_customer_id IS NULL OR p_customer_id = '' OR q.customer_id = p_customer_id)
      AND (p_plan_id IS NULL OR p_plan_id = '' OR q.plan_id::text = p_plan_id)
      AND (p_priority IS NULL OR p_priority = '' OR q.priority = p_priority)
      AND (p_status IS NULL OR p_status = '' OR q.status = p_status)
      AND (p_assignee_id IS NULL OR p_assignee_id = '' OR q.assigned_to::text = p_assignee_id)
      AND (p_sla IS NULL OR p_sla = '' OR p_sla = 'all'
        OR (p_sla = 'breached' AND q.sla_breached)
        OR (p_sla = 'escalated' AND q.escalated)
        OR (p_sla = 'healthy' AND NOT q.sla_breached AND NOT q.escalated))
  ), page AS (
    SELECT * FROM filtered ORDER BY sla_breached DESC, escalated DESC, created_at DESC
    LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(0, p_offset)
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'assignees', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', user_id, 'name', COALESCE(display_name, role)) ORDER BY display_name) FROM public.internal_staff WHERE status = 'active' AND role IN ('owner','developer')), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_audit_timeline(
  p_search text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_result text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('audit.read') THEN
    RAISE EXCEPTION 'audit_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  WITH events AS (
    SELECT 'internal'::text source, i.id::text event_id, i.action event_type,
      i.target_type entity_type, i.target_id entity_id, i.actor_id,
      COALESCE(s.display_name, i.actor_role, 'Sistema') actor_name,
      i.result, i.reason, private.sanitize_internal_metadata(i.metadata) metadata, i.created_at
    FROM public.internal_access_events i LEFT JOIN public.internal_staff s ON s.user_id = i.actor_id
    UNION ALL
    SELECT 'commercial', a.id::text, a.event_type, a.entity_type, a.entity_id, a.actor_id,
      COALESCE(s.display_name, 'Sistema'), 'allowed', a.metadata->>'reason', private.sanitize_internal_metadata(a.metadata), a.created_at
    FROM public.subscription_audit_events a LEFT JOIN public.internal_staff s ON s.user_id = a.actor_id
    UNION ALL
    SELECT 'support', e.id::text, e.event_type, 'support_ticket', e.ticket_id::text, e.actor_id,
      COALESCE(s.display_name, 'Usuário'), 'allowed', e.message,
      private.sanitize_internal_metadata(e.metadata), e.created_at
    FROM public.support_ticket_events e LEFT JOIN public.internal_staff s ON s.user_id = e.actor_id
  ), filtered AS (
    SELECT * FROM events e
    WHERE (p_source IS NULL OR p_source = '' OR e.source = p_source)
      AND (p_result IS NULL OR p_result = '' OR e.result = p_result)
      AND (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to IS NULL OR e.created_at <= p_to)
      AND (p_search IS NULL OR trim(p_search) = '' OR e.event_type ILIKE '%' || trim(p_search) || '%' OR COALESCE(e.entity_id, '') ILIKE '%' || trim(p_search) || '%' OR COALESCE(e.actor_name, '') ILIKE '%' || trim(p_search) || '%')
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY created_at DESC), '[]'::jsonb)
  INTO result
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT greatest(1, least(p_limit, 500))) row_data;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_customer_operations(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  kind text := split_part(p_customer_id, ':', 1);
  target_id uuid;
  can_sensitive boolean;
  result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'customer_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  BEGIN target_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_customer_id'; END;
  IF kind NOT IN ('organization','user') THEN RAISE EXCEPTION 'invalid_customer_id'; END IF;
  can_sensitive := private.can_access_sensitive_customer(p_customer_id);

  SELECT jsonb_build_object(
    'appointments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.titulo, 'status', a.status, 'scheduled_at', a.data_agendada,
      'agent_name', a.agente_nome, 'address', CASE WHEN can_sensitive THEN a.endereco END,
      'latitude', CASE WHEN can_sensitive THEN a.lat END, 'longitude', CASE WHEN can_sensitive THEN a.lng END
    ) ORDER BY a.data_agendada DESC) FROM (SELECT * FROM public.agendamentos WHERE (kind='organization' AND organization_id=target_id) OR (kind='user' AND agente_uid=target_id) ORDER BY data_agendada DESC LIMIT 100) a), '[]'::jsonb),
    'map_points', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'status', v.status,
      'occurred_at', v."dataVistoria", 'latitude', CASE WHEN can_sensitive THEN v.latitude END,
      'longitude', CASE WHEN can_sensitive THEN v.longitude END,
      'address', CASE WHEN can_sensitive THEN COALESCE(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
    ) ORDER BY v."dataVistoria" DESC) FROM (SELECT * FROM public.vistorias WHERE (kind='organization' AND organization_id=target_id) OR (kind='user' AND "agenteUid"=target_id::text) ORDER BY "dataVistoria" DESC LIMIT 250) v), '[]'::jsonb),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'generated_at', v.laudo_gerado_em,
      'url', v.laudo_url, 'storage_location', v.storage_location
    ) ORDER BY v.laudo_gerado_em DESC) FROM (SELECT * FROM public.vistorias WHERE ((kind='organization' AND organization_id=target_id) OR (kind='user' AND "agenteUid"=target_id::text)) AND laudo_url IS NOT NULL ORDER BY laudo_gerado_em DESC LIMIT 100) v), '[]'::jsonb),
    'reports', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'score', v."pontuacaoTotal",
      'form_id', v."formularioId", 'form_version', v."formularioVersao", 'generated_at', v.relatorio_gerado_em
    ) ORDER BY COALESCE(v.relatorio_gerado_em, v."dataVistoria") DESC) FROM (SELECT * FROM public.vistorias WHERE ((kind='organization' AND organization_id=target_id) OR (kind='user' AND "agenteUid"=target_id::text)) ORDER BY "dataVistoria" DESC LIMIT 250) v), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_technical_events(
  p_customer_id text DEFAULT NULL,
  p_version text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_severity text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN
    RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY occurred_at DESC), '[]'::jsonb)
  INTO result FROM (
    SELECT e.id, e.event_key, e.organization_id, e.user_id, e.app_version, e.platform,
      e.category, e.severity, e.correlation_id, e.summary, e.occurred_at,
      CASE WHEN e.organization_id IS NOT NULL THEN 'organization:' || e.organization_id WHEN e.user_id IS NOT NULL THEN 'user:' || e.user_id END customer_id,
      COALESCE(o.display_name, u.name) customer_name
    FROM public.technical_events e
    LEFT JOIN public.organizations o ON o.id = e.organization_id
    LEFT JOIN public.users u ON u.uid = e.user_id
    WHERE (p_customer_id IS NULL OR p_customer_id = '' OR (CASE WHEN e.organization_id IS NOT NULL THEN 'organization:' || e.organization_id WHEN e.user_id IS NOT NULL THEN 'user:' || e.user_id END) = p_customer_id)
      AND (p_version IS NULL OR p_version = '' OR e.app_version = p_version)
      AND (p_platform IS NULL OR p_platform = '' OR e.platform = p_platform)
      AND (p_category IS NULL OR p_category = '' OR e.category = p_category)
      AND (p_severity IS NULL OR p_severity = '' OR e.severity = p_severity)
      AND (p_from IS NULL OR e.occurred_at >= p_from)
      AND (p_to IS NULL OR e.occurred_at <= p_to)
    ORDER BY e.occurred_at DESC LIMIT greatest(1, least(p_limit, 500))
  ) row_data;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mutate_internal_release(
  p_action text,
  p_version text,
  p_changelog text,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor uuid := auth.uid(); v_request_hash text; prior jsonb; v_result jsonb;
BEGIN
  IF p_action = 'set_development' THEN
    IF NOT private.has_internal_permission('configuration.prepare', actor) AND NOT private.has_internal_permission('configuration.publish', actor) THEN
      RAISE EXCEPTION 'release_prepare_not_allowed' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT private.has_internal_permission('configuration.publish', actor) THEN RAISE EXCEPTION 'release_publish_not_allowed' USING ERRCODE = '42501'; END IF;
    IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  END IF;
  IF p_action NOT IN ('set_development','publish','set_minimum') OR p_version !~ '^[0-9]+\.[0-9]+\.[0-9]+' THEN RAISE EXCEPTION 'invalid_release_action'; END IF;
  IF char_length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  v_request_hash := md5(concat_ws('|', p_action, p_version, p_changelog, p_reason));
  SELECT io.result INTO v_result FROM public.internal_operations io WHERE io.actor_id=actor AND io.operation_id=p_operation_id AND io.request_hash=v_request_hash;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  INSERT INTO public.internal_operations(operation_id,actor_id,action,request_hash) VALUES(p_operation_id,actor,'release.'||p_action,v_request_hash);
  SELECT to_jsonb(s) INTO prior FROM public.internal_release_settings s WHERE singleton FOR UPDATE;
  IF p_action = 'set_development' THEN
    UPDATE public.internal_app_versions SET status='retired', updated_at=now() WHERE status='development' AND version<>p_version;
    INSERT INTO public.internal_app_versions(version,status,changelog,created_by) VALUES(p_version,'development',left(COALESCE(p_changelog,''),5000),actor)
    ON CONFLICT(version) DO UPDATE SET status='development', changelog=EXCLUDED.changelog, updated_at=now();
    UPDATE public.internal_release_settings SET development_version=p_version,updated_by=actor,updated_at=now() WHERE singleton;
  ELSIF p_action = 'publish' THEN
    INSERT INTO public.internal_app_versions(version,status,changelog,created_by,published_at) VALUES(p_version,'published',left(COALESCE(p_changelog,''),5000),actor,now())
    ON CONFLICT(version) DO UPDATE SET status='published',changelog=EXCLUDED.changelog,published_at=now(),updated_at=now();
    UPDATE public.internal_release_settings SET published_version=p_version,development_version=p_version,updated_by=actor,updated_at=now() WHERE singleton;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.internal_app_versions WHERE version=p_version) THEN RAISE EXCEPTION 'version_not_found'; END IF;
    UPDATE public.internal_release_settings SET minimum_version=p_version,updated_by=actor,updated_at=now() WHERE singleton;
  END IF;
  v_result:=jsonb_build_object('ok',true,'action',p_action,'version',p_version);
  UPDATE public.internal_operations SET status='succeeded',result=v_result,completed_at=now() WHERE actor_id=actor AND operation_id=p_operation_id;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata)
  VALUES(actor,private.current_internal_role(actor),'release.'||p_action,'app_version',p_version,'allowed',left(trim(p_reason),500),jsonb_build_object('before',prior));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_dashboard(),
  public.list_internal_support_queue(text,text,text,text,text,text,text,integer,integer),
  public.list_internal_audit_timeline(text,text,text,timestamptz,timestamptz,integer),
  public.get_internal_customer_operations(text),
  public.list_internal_technical_events(text,text,text,text,text,timestamptz,timestamptz,integer),
  public.mutate_internal_release(text,text,text,text,uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_internal_dashboard(),
  public.list_internal_support_queue(text,text,text,text,text,text,text,integer,integer),
  public.list_internal_audit_timeline(text,text,text,timestamptz,timestamptz,integer),
  public.get_internal_customer_operations(text),
  public.list_internal_technical_events(text,text,text,text,text,timestamptz,timestamptz,integer),
  public.mutate_internal_release(text,text,text,text,uuid)
TO authenticated;

NOTIFY pgrst, 'reload schema';
