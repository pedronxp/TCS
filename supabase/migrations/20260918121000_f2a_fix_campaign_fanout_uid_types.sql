-- users.uid is a uuid column (not text): the fan-out join compared
-- organization_members.user_id::text with users.uid and applied a text regex
-- to an uuid value, raising inside the safety handler and silently rolling
-- back every campaign fan-out. Recreate the helper with correct types and
-- replay the backfill (idempotent by dedupe key).

CREATE OR REPLACE FUNCTION private.fan_out_campaign_to_inbox(p_campaign public.notification_campaigns)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
  v_roles text[];
  v_severity text;
BEGIN
  v_roles := CASE WHEN cardinality(coalesce(p_campaign.target_roles, ARRAY[]::text[])) = 0
    THEN ARRAY['agent', 'supervisor', 'admin', 'master_admin']::text[]
    ELSE p_campaign.target_roles
  END;
  v_severity := CASE WHEN p_campaign.priority = 'high' OR p_campaign.category = 'security'
    THEN 'warning'
    ELSE 'info'
  END;

  INSERT INTO public.domain_events (
    event_type, module_key, actor_context, actor_user_id, entity_type, entity_id,
    severity, title, body, route_key, payload, dedupe_key, thread_key
  )
  VALUES (
    'notification.campaign', 'notifications', 'internal', p_campaign.created_by,
    'notification_campaign', p_campaign.id::text, v_severity, p_campaign.title, p_campaign.body,
    'notifications.campaign',
    jsonb_build_object(
      'campaign_id', p_campaign.id, 'category', p_campaign.category,
      'priority', p_campaign.priority, 'municipio', p_campaign.municipio,
      'source', 'notification_campaign'
    ),
    'notification_campaign:' || p_campaign.id::text, 'notification_campaigns'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM public.domain_events
    WHERE dedupe_key = 'notification_campaign:' || p_campaign.id::text;
  END IF;
  IF v_event_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.inbox_recipients (event_id, recipient_user_id, workspace_kind, organization_id)
  SELECT v_event_id, u.uid, 'organization', om.organization_id
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT m.organization_id
    FROM public.organization_members m
    WHERE m.user_id = u.uid AND m.status = 'active'
    ORDER BY m.joined_at DESC
    LIMIT 1
  ) om ON true
  WHERE u."isApproved" = true
    AND (p_campaign.municipio IS NULL OR u.municipio = p_campaign.municipio)
    AND u.role = ANY (v_roles)
  ON CONFLICT DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'campaign_inbox_fanout_failed % %', p_campaign.id, SQLERRM;
END;
$$;

DO $$
DECLARE
  v_campaign public.notification_campaigns%ROWTYPE;
BEGIN
  FOR v_campaign IN
    SELECT * FROM public.notification_campaigns c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.domain_events de
      WHERE de.dedupe_key = 'notification_campaign:' || c.id::text
    )
  LOOP
    PERFORM private.fan_out_campaign_to_inbox(v_campaign);
  END LOOP;
END;
$$;
