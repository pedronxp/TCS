-- Corrects the commercial projection for projects where subscription audit events
-- keep the outcome and reason only in their metadata payload.

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
    SELECT 'internal'::text AS source, i.id::text AS event_id, i.action AS event_type,
      i.target_type AS entity_type, i.target_id AS entity_id, i.actor_id,
      COALESCE(s.display_name, i.actor_role, 'Sistema') AS actor_name,
      i.result, i.reason, private.sanitize_internal_metadata(i.metadata) AS metadata, i.created_at
    FROM public.internal_access_events AS i
    LEFT JOIN public.internal_staff AS s ON s.user_id = i.actor_id

    UNION ALL

    SELECT 'commercial', a.id::text, a.event_type, a.entity_type, a.entity_id, a.actor_id,
      COALESCE(s.display_name, 'Sistema'), 'allowed', a.metadata ->> 'reason',
      private.sanitize_internal_metadata(a.metadata), a.created_at
    FROM public.subscription_audit_events AS a
    LEFT JOIN public.internal_staff AS s ON s.user_id = a.actor_id

    UNION ALL

    SELECT 'support', e.id::text, e.event_type, 'support_ticket', e.ticket_id::text, e.actor_id,
      COALESCE(s.display_name, 'Usuário'), 'allowed', e.message,
      private.sanitize_internal_metadata(e.metadata), e.created_at
    FROM public.support_ticket_events AS e
    LEFT JOIN public.internal_staff AS s ON s.user_id = e.actor_id

    UNION ALL

    SELECT 'technical', t.event_key::text,
      concat_ws('.', 'telemetry', t.category, t.severity),
      'technical_event', COALESCE(t.correlation_id, t.event_key::text), NULL::uuid,
      'Sistema',
      CASE WHEN t.severity IN ('error', 'critical') THEN 'failed' ELSE 'allowed' END,
      t.summary, private.sanitize_internal_metadata(t.metadata), t.occurred_at
    FROM public.technical_events AS t
  ), filtered AS (
    SELECT * FROM events AS e
    WHERE (p_source IS NULL OR p_source = '' OR e.source = p_source)
      AND (p_result IS NULL OR p_result = '' OR e.result = p_result)
      AND (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to IS NULL OR e.created_at <= p_to)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR e.event_type ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(e.entity_id, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(e.actor_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(e.reason, '') ILIKE '%' || trim(p_search) || '%'
      )
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT * FROM filtered
    ORDER BY created_at DESC
    LIMIT greatest(1, least(p_limit, 500))
  ) AS row_data;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_audit_timeline(text,text,text,timestamptz,timestamptz,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_audit_timeline(text,text,text,timestamptz,timestamptz,integer)
  TO authenticated;

COMMENT ON FUNCTION public.list_internal_audit_timeline(text,text,text,timestamptz,timestamptz,integer) IS
  'Timeline interna unificada: console, comercial, suporte e telemetria técnica sanitizada.';

NOTIFY pgrst, 'reload schema';
