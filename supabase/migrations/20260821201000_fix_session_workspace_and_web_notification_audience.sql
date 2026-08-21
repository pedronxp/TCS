-- Keep the internal session workspace in a single SQL statement.  CTEs only
-- exist for one statement, so totals must be calculated before returning.
CREATE OR REPLACE FUNCTION public.get_internal_session_workspace(
  p_status text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_term text := nullif(trim(p_search), '');
  v_items jsonb;
  v_total bigint;
  v_active_total bigint;
  v_web_total bigint;
  v_android_total bigint;
  v_ios_total bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('session.read') THEN
    RAISE EXCEPTION 'session_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;

  WITH filtered AS (
    SELECT s.*, o.display_name, o.session_policy, o.session_timeout_minutes, o.offline_tolerance_minutes
    FROM public.active_sessions s
    LEFT JOIN public.organizations o ON o.id = s.organization_id
    WHERE (p_status IS NULL OR p_status = '' OR s.status = p_status)
      AND (p_platform IS NULL OR p_platform = '' OR s.platform = p_platform)
      AND (v_term IS NULL OR s.user_id::text ILIKE '%' || v_term || '%'
        OR coalesce(s.device_name, '') ILIKE '%' || v_term || '%'
        OR coalesce(s.platform, '') ILIKE '%' || v_term || '%'
        OR coalesce(o.display_name, '') ILIKE '%' || v_term || '%')
  ), active AS (
    SELECT platform FROM public.active_sessions WHERE status = 'active'
  ), page AS (
    SELECT * FROM filtered ORDER BY last_heartbeat_at DESC LIMIT p_limit
  )
  SELECT
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'user_id', user_id, 'organization_id', organization_id, 'device_id', device_id,
        'device_name', device_name, 'platform', platform, 'status', status, 'started_at', started_at,
        'last_heartbeat_at', last_heartbeat_at, 'ended_at', ended_at, 'end_reason', end_reason,
        'organizations', CASE WHEN organization_id IS NULL THEN NULL ELSE jsonb_build_object(
          'display_name', display_name, 'session_policy', session_policy,
          'session_timeout_minutes', session_timeout_minutes, 'offline_tolerance_minutes', offline_tolerance_minutes
        ) END
      ) ORDER BY last_heartbeat_at DESC)
      FROM page
    ), '[]'::jsonb),
    (SELECT count(*) FROM filtered),
    (SELECT count(*) FROM active),
    (SELECT count(*) FROM active WHERE platform = 'web'),
    (SELECT count(*) FROM active WHERE platform = 'android'),
    (SELECT count(*) FROM active WHERE platform = 'ios')
  INTO v_items, v_total, v_active_total, v_web_total, v_android_total, v_ios_total;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'overview', jsonb_build_object(
      'active_total', v_active_total,
      'platforms', jsonb_build_object('web', v_web_total, 'android', v_android_total, 'ios', v_ios_total)
    )
  );
END;
$$;

-- The in-app notification center is a valid Web delivery channel.  It must
-- remain auditable even if browser Push/VAPID is not configured yet.
ALTER TABLE private.notification_campaign_recipients
  DROP CONSTRAINT IF EXISTS notification_campaign_recipients_provider_check;

ALTER TABLE private.notification_campaign_recipients
  ADD CONSTRAINT notification_campaign_recipients_provider_check
  CHECK (provider IN ('expo', 'web_push', 'in_app'));

CREATE OR REPLACE FUNCTION public.create_notification_campaign(
  p_title text,
  p_body text,
  p_category text,
  p_priority text,
  p_municipio text,
  p_platforms text[],
  p_roles text[],
  p_payload jsonb,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_campaign_id uuid := gen_random_uuid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_municipio text := nullif(btrim(p_municipio), '');
  v_platforms text[];
  v_roles text[];
  v_hash text;
  v_previous jsonb;
  v_recipient_count integer;
  v_status text := 'queued';
BEGIN
  IF v_actor IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('notification.manage', v_actor) AND NOT private.has_internal_permission('technical.write', v_actor) THEN RAISE EXCEPTION 'notification_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 120 OR char_length(v_body) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_notification_content' USING ERRCODE = '22023'; END IF;
  IF p_category NOT IN ('operational', 'security', 'token', 'maintenance') OR p_priority NOT IN ('normal', 'high') THEN RAISE EXCEPTION 'invalid_notification_classification' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'invalid_notification_payload' USING ERRCODE = '22023'; END IF;

  SELECT coalesce(array_agg(DISTINCT btrim(value) ORDER BY btrim(value)), ARRAY[]::text[])
  INTO v_platforms FROM unnest(coalesce(p_platforms, ARRAY[]::text[])) value WHERE btrim(value) <> '';
  SELECT coalesce(array_agg(DISTINCT btrim(value) ORDER BY btrim(value)), ARRAY[]::text[])
  INTO v_roles FROM unnest(coalesce(p_roles, ARRAY[]::text[])) value WHERE btrim(value) <> '';
  IF cardinality(v_platforms) = 0 OR EXISTS (SELECT 1 FROM unnest(v_platforms) value WHERE value NOT IN ('android', 'ios', 'web', 'unknown')) THEN RAISE EXCEPTION 'invalid_notification_platforms' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_roles) value WHERE value NOT IN ('agent', 'supervisor', 'admin', 'master_admin')) THEN RAISE EXCEPTION 'invalid_notification_roles' USING ERRCODE = '22023'; END IF;

  v_hash := md5(concat_ws('|', v_title, v_body, p_category, p_priority, coalesce(v_municipio, ''), array_to_string(v_platforms, ','), array_to_string(v_roles, ','), coalesce(p_payload, '{}'::jsonb)::text, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;

  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'notification.campaign.create', v_hash);
  INSERT INTO public.notification_campaigns(id, title, body, category, priority, municipio, target_platforms, target_roles, payload, created_by)
  VALUES (v_campaign_id, v_title, v_body, p_category, p_priority, v_municipio, v_platforms, v_roles, private.sanitize_internal_metadata(coalesce(p_payload, '{}'::jsonb)), v_actor);

  INSERT INTO private.notification_campaign_recipients(campaign_id, user_id, platform, provider, endpoint, subscription, status, provider_receipt, attempted_at)
  SELECT v_campaign_id, endpoint.user_id, endpoint.platform, endpoint.provider, endpoint.endpoint, endpoint.subscription, 'queued', NULL::jsonb, NULL::timestamptz
  FROM public.notification_endpoints endpoint
  JOIN public.users profile ON profile.uid = endpoint.user_id
  WHERE endpoint.active AND endpoint.platform = ANY(v_platforms) AND profile."isApproved" = true
    AND (v_municipio IS NULL OR profile.municipio = v_municipio)
    AND (cardinality(v_roles) = 0 OR profile.role = ANY(v_roles))
  UNION ALL
  SELECT v_campaign_id, profile.uid, 'web', 'in_app', 'in_app://' || profile.uid::text, NULL::jsonb, 'sent', jsonb_build_object('channel', 'in_app'), now()
  FROM public.users profile
  WHERE 'web' = ANY(v_platforms) AND profile."isApproved" = true
    AND (v_municipio IS NULL OR profile.municipio = v_municipio)
    AND (cardinality(v_roles) = 0 OR profile.role = ANY(v_roles))
  ON CONFLICT (campaign_id, user_id, provider, endpoint) DO NOTHING;

  GET DIAGNOSTICS v_recipient_count = ROW_COUNT;
  IF v_recipient_count = 0 THEN
    v_status := 'no_recipients';
    UPDATE public.notification_campaigns SET status = v_status, completed_at = now(), failure_reason = 'no_eligible_recipients' WHERE id = v_campaign_id;
  ELSIF NOT EXISTS (SELECT 1 FROM private.notification_campaign_recipients WHERE campaign_id = v_campaign_id AND status = 'queued') THEN
    v_status := 'completed';
    UPDATE public.notification_campaigns SET status = v_status, completed_at = now(), failure_reason = NULL WHERE id = v_campaign_id;
  END IF;

  v_previous := jsonb_build_object('ok', true, 'campaign_id', v_campaign_id, 'recipient_count', v_recipient_count, 'status', v_status);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_previous, completed_at = now() WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'notification.campaign.create', 'notification_campaign', v_campaign_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('municipio', v_municipio, 'platforms', v_platforms, 'roles', v_roles, 'recipient_count', v_recipient_count, 'status', v_status));
  RETURN v_previous;
END;
$$;

-- Reconcile previous Web campaigns that were already mirrored to the in-app
-- notification center but were displayed as having no recipients.
INSERT INTO private.notification_campaign_recipients(campaign_id, user_id, platform, provider, endpoint, subscription, status, provider_receipt, attempted_at)
SELECT campaign.id, profile.uid, 'web', 'in_app', 'in_app://' || profile.uid::text, NULL::jsonb, 'sent', jsonb_build_object('channel', 'in_app'), now()
FROM public.notification_campaigns campaign
JOIN public.users profile ON profile."isApproved" = true
  AND (campaign.municipio IS NULL OR profile.municipio = campaign.municipio)
  AND (cardinality(campaign.target_roles) = 0 OR profile.role = ANY(campaign.target_roles))
WHERE campaign.status = 'no_recipients'
  AND 'web' = ANY(campaign.target_platforms)
ON CONFLICT (campaign_id, user_id, provider, endpoint) DO NOTHING;

UPDATE public.notification_campaigns campaign
SET status = 'completed', completed_at = coalesce(campaign.completed_at, now()), failure_reason = NULL
WHERE campaign.status = 'no_recipients'
  AND 'web' = ANY(campaign.target_platforms)
  AND EXISTS (
    SELECT 1 FROM private.notification_campaign_recipients recipient
    WHERE recipient.campaign_id = campaign.id AND recipient.provider = 'in_app'
  );

REVOKE ALL ON FUNCTION public.get_internal_session_workspace(text, text, text, integer), public.create_notification_campaign(text, text, text, text, text, text[], text[], jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_session_workspace(text, text, text, integer), public.create_notification_campaign(text, text, text, text, text, text[], text[], jsonb, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
