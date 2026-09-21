-- A campaign must remain visible in-product even when a device has not yet
-- registered a push endpoint. The unified inbox (domain_events +
-- inbox_recipients) is now the in-app record of every campaign: one event per
-- campaign and one per-user recipient row, so read state is individual.
-- The legacy notificacoes mirror is retired: it addressed rows by role, which
-- shared read state across every user of the same role/municipio, and no
-- screen consumes that table anymore.

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
    WHERE m.user_id::text = u.uid AND m.status = 'active'
    ORDER BY m.joined_at DESC
    LIMIT 1
  ) om ON true
  WHERE u."isApproved" = true
    AND u.uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (p_campaign.municipio IS NULL OR u.municipio = p_campaign.municipio)
    AND u.role = ANY (v_roles)
  ON CONFLICT DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'campaign_inbox_fanout_failed % %', p_campaign.id, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION private.mirror_campaign_to_unified_inbox()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.fan_out_campaign_to_inbox(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_campaigns_create_in_app_notification ON public.notification_campaigns;
DROP FUNCTION IF EXISTS private.mirror_campaign_to_in_app_notifications();

CREATE TRIGGER notification_campaigns_create_inbox_event
  AFTER INSERT ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.mirror_campaign_to_unified_inbox();

REVOKE ALL ON FUNCTION private.fan_out_campaign_to_inbox(public.notification_campaigns) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mirror_campaign_to_unified_inbox() FROM PUBLIC, anon, authenticated;

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

REVOKE ALL ON public.notificacoes FROM anon, authenticated;
COMMENT ON TABLE public.notificacoes IS 'Retired 2026-09-18: campaigns fan out to domain_events/inbox_recipients (unified inbox). Archival table without API access; legacy fn_notificar_* triggers still write here as postgres.';
