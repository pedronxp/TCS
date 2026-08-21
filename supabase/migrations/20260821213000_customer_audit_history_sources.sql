-- Customer audit must join the historical sources that actually record the
-- customer's activity.  Subscription events alone omit the legacy audit and
-- activity logs used by individual accounts.
CREATE OR REPLACE FUNCTION public.get_internal_customer_detail(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb := private.get_internal_customer_detail_base(p_customer_id);
  customer_kind text := split_part(p_customer_id, ':', 1);
  subject_id uuid;
  identity_ids uuid[];
  enriched_inspections jsonb;
  enriched_users jsonb;
  customer_audit jsonb;
  latest_access timestamptz;
BEGIN
  IF result IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    subject_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;

  IF customer_kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;

  IF customer_kind = 'user' THEN
    identity_ids := private.resolve_internal_agent_ids(p_customer_id, subject_id);
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', history.source || ':' || history.event_id,
      'event_type', history.event_type,
      'entity_type', history.entity_type,
      'entity_id', history.entity_id,
      'summary', history.summary,
      'metadata', private.sanitize_internal_metadata(history.metadata),
      'created_at', history.created_at
    ) ORDER BY history.created_at DESC), '[]'::jsonb)
    INTO customer_audit
    FROM (
      SELECT * FROM (
        SELECT 'subscription'::text AS source, event.id::text AS event_id,
          event.event_type, event.entity_type, event.entity_id,
          NULL::text AS summary, event.metadata, event.created_at
        FROM public.subscription_audit_events event
        WHERE event.entity_id = ANY(ARRAY(SELECT identity_id::text FROM unnest(identity_ids) identity(identity_id)))

        UNION ALL

        SELECT 'audit_log', event.id::text, coalesce(nullif(trim(event.acao), ''), 'audit.log'),
          coalesce(nullif(trim(event.alvo_tipo), ''), 'account'), event.alvo_id,
          coalesce(nullif(trim(event.acao), ''), 'Ação registrada no log de auditoria'),
          event.detalhes, event.criado_em
        FROM public.audit_logs event
        WHERE event.ator_uid = ANY(identity_ids)
          OR event.alvo_id = ANY(ARRAY(SELECT identity_id::text FROM unnest(identity_ids) identity(identity_id)))

        UNION ALL

        SELECT 'activity_log', event.id::text, coalesce(nullif(trim(event.tipo), ''), 'activity.log'),
          'activity_log', NULL::text, nullif(trim(event.descricao), ''),
          jsonb_build_object('level', event.nivel, 'source', 'activity_logs'), event."criadoEm"
        FROM public.activity_logs event
        WHERE event."uidUsuario" = ANY(ARRAY(SELECT identity_id::text FROM unnest(identity_ids) identity(identity_id)))

        UNION ALL

        SELECT 'inspection_protocol', event.id::text, 'protocol.allocated', 'inspection', event.inspection_id::text,
          concat('Protocolo ', coalesce(event.protocol, 'não informado'), ' alocado'),
          jsonb_build_object('protocol', event.protocol, 'series', 'IND'), event.allocated_at
        FROM public.individual_protocol_allocation_events event
        WHERE event.user_id = ANY(identity_ids)

        UNION ALL

        SELECT 'usage', event.id::text, 'usage.recorded', 'usage', event.resource_code,
          concat('Uso registrado: ', event.resource_code),
          jsonb_build_object('resource_code', event.resource_code, 'amount', event.amount), event.created_at
        FROM public.usage_events event
        WHERE event.user_id = ANY(identity_ids)

        UNION ALL

        SELECT 'acknowledgement', event.id::text, concat('document.', event.event_kind), 'document', event.document_id::text,
          concat('Documento ', event.event_kind, ' registrado'),
          jsonb_build_object('outcome', event.outcome, 'capture_source', event.capture_source), event.recorded_at_server
        FROM public.document_acknowledgement_events event
        WHERE event.owner_user_id = ANY(identity_ids)
      ) raw_history
      ORDER BY created_at DESC
      LIMIT 100
    ) history;
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', history.source || ':' || history.event_id,
      'event_type', history.event_type,
      'entity_type', history.entity_type,
      'entity_id', history.entity_id,
      'summary', history.summary,
      'metadata', private.sanitize_internal_metadata(history.metadata),
      'created_at', history.created_at
    ) ORDER BY history.created_at DESC), '[]'::jsonb)
    INTO customer_audit
    FROM (
      SELECT * FROM (
        SELECT 'subscription'::text AS source, event.id::text AS event_id,
          event.event_type, event.entity_type, event.entity_id,
          NULL::text AS summary, event.metadata, event.created_at
        FROM public.subscription_audit_events event
        WHERE event.organization_id = subject_id

        UNION ALL

        SELECT 'audit_log', event.id::text, coalesce(nullif(trim(event.acao), ''), 'audit.log'),
          coalesce(nullif(trim(event.alvo_tipo), ''), 'organization'), event.alvo_id,
          coalesce(nullif(trim(event.acao), ''), 'Ação registrada no log de auditoria'),
          event.detalhes, event.criado_em
        FROM public.audit_logs event
        WHERE event.alvo_id = subject_id::text

        UNION ALL

        SELECT 'inspection_protocol', event.id::text, 'protocol.allocated', 'inspection', event.inspection_id::text,
          concat('Protocolo ', coalesce(event.protocol, 'não informado'), ' alocado'),
          jsonb_build_object('protocol', event.protocol, 'series', event.protocol_series), event.allocated_at
        FROM public.protocol_allocation_events event
        WHERE event.organization_id = subject_id

        UNION ALL

        SELECT 'usage', event.id::text, 'usage.recorded', 'usage', event.resource_code,
          concat('Uso registrado: ', event.resource_code),
          jsonb_build_object('resource_code', event.resource_code, 'amount', event.amount), event.created_at
        FROM public.usage_events event
        WHERE event.organization_id = subject_id

        UNION ALL

        SELECT 'acknowledgement', event.id::text, concat('document.', event.event_kind), 'document', event.document_id::text,
          concat('Documento ', event.event_kind, ' registrado'),
          jsonb_build_object('outcome', event.outcome, 'capture_source', event.capture_source), event.recorded_at_server
        FROM public.document_acknowledgement_events event
        WHERE event.organization_id = subject_id
      ) raw_history
      ORDER BY created_at DESC
      LIMIT 100
    ) history;
  END IF;

  SELECT coalesce(jsonb_agg(
    inspection.item || jsonb_build_object(
      'agent_name', coalesce(
        nullif(trim(v."agenteNome"), ''),
        nullif(trim(source_user.name), ''),
        CASE WHEN customer_kind = 'user' THEN nullif(trim(result #>> '{customer,display_name}'), '') END
      )
    ) ORDER BY inspection.position
  ), '[]'::jsonb)
  INTO enriched_inspections
  FROM jsonb_array_elements(coalesce(result->'inspections', '[]'::jsonb))
    WITH ORDINALITY AS inspection(item, position)
  LEFT JOIN public.vistorias v ON v.id = (inspection.item->>'id')::uuid
  LEFT JOIN public.users source_user ON source_user.uid::text = v."agenteUid"::text;

  SELECT coalesce(jsonb_agg(
    user_entry.item || jsonb_build_object('last_login', access.last_access)
    ORDER BY user_entry.position
  ), '[]'::jsonb)
  INTO enriched_users
  FROM jsonb_array_elements(coalesce(result->'users', '[]'::jsonb))
    WITH ORDINALITY AS user_entry(item, position)
  LEFT JOIN LATERAL (
    SELECT max(activity.occurred_at) AS last_access
    FROM (
      SELECT auth_user.last_sign_in_at AS occurred_at
      FROM auth.users auth_user
      WHERE auth_user.id = ANY(private.resolve_internal_agent_ids(p_customer_id, (user_entry.item->>'user_id')::uuid))
      UNION ALL
      SELECT public_user."lastLogin"
      FROM public.users public_user
      WHERE public_user.uid = ANY(private.resolve_internal_agent_ids(p_customer_id, (user_entry.item->>'user_id')::uuid))
      UNION ALL
      SELECT session.last_heartbeat_at
      FROM public.active_sessions session
      WHERE session.user_id = ANY(private.resolve_internal_agent_ids(p_customer_id, (user_entry.item->>'user_id')::uuid))
    ) activity
  ) access ON true;

  SELECT max((user_item->>'last_login')::timestamptz)
  INTO latest_access
  FROM jsonb_array_elements(enriched_users) user_item
  WHERE nullif(user_item->>'last_login', '') IS NOT NULL;

  result := jsonb_set(result, '{inspections}', enriched_inspections, true);
  result := jsonb_set(result, '{users}', enriched_users, true);
  result := jsonb_set(result, '{audit}', customer_audit, true);
  result := jsonb_set(result, '{customer,last_access_at}', coalesce(to_jsonb(latest_access), 'null'::jsonb), true);
  result := jsonb_set(result, '{customer,updated_at}', coalesce(to_jsonb(latest_access), result #> '{customer,updated_at}', 'null'::jsonb), true);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_customer_detail(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_customer_detail(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
