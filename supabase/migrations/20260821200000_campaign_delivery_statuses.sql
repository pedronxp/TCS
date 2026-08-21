-- A campaign without a matching device endpoint is a completed audience
-- calculation, not work waiting for a dispatcher. Keep that distinction visible.

ALTER TABLE public.notification_campaigns
  DROP CONSTRAINT IF EXISTS notification_campaigns_status_check;

ALTER TABLE public.notification_campaigns
  ADD CONSTRAINT notification_campaigns_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'partial', 'failed', 'no_recipients'));

UPDATE public.notification_campaigns campaign
SET status = 'no_recipients',
    completed_at = COALESCE(campaign.completed_at, now()),
    failure_reason = 'no_eligible_recipients'
WHERE campaign.status = 'queued'
  AND NOT EXISTS (
    SELECT 1 FROM private.notification_campaign_recipients recipient
    WHERE recipient.campaign_id = campaign.id
  );

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
  v_actor uuid := auth.uid(); v_campaign_id uuid := gen_random_uuid(); v_title text := btrim(coalesce(p_title, '')); v_body text := btrim(coalesce(p_body, ''));
  v_municipio text := nullif(btrim(p_municipio), ''); v_platforms text[]; v_roles text[]; v_hash text; v_previous jsonb; v_recipient_count integer; v_status text := 'queued';
BEGIN
  IF v_actor IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('notification.manage', v_actor) AND NOT private.has_internal_permission('technical.write', v_actor) THEN RAISE EXCEPTION 'notification_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 120 OR char_length(v_body) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_notification_content' USING ERRCODE = '22023'; END IF;
  IF p_category NOT IN ('operational', 'security', 'token', 'maintenance') OR p_priority NOT IN ('normal', 'high') THEN RAISE EXCEPTION 'invalid_notification_classification' USING ERRCODE = '22023'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'invalid_notification_payload' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(array_agg(DISTINCT btrim(value) ORDER BY btrim(value)), ARRAY[]::text[]) INTO v_platforms FROM unnest(coalesce(p_platforms, ARRAY[]::text[])) value WHERE btrim(value) <> '';
  SELECT COALESCE(array_agg(DISTINCT btrim(value) ORDER BY btrim(value)), ARRAY[]::text[]) INTO v_roles FROM unnest(coalesce(p_roles, ARRAY[]::text[])) value WHERE btrim(value) <> '';
  IF cardinality(v_platforms) = 0 OR EXISTS (SELECT 1 FROM unnest(v_platforms) value WHERE value NOT IN ('android', 'ios', 'web', 'unknown')) THEN RAISE EXCEPTION 'invalid_notification_platforms' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_roles) value WHERE value NOT IN ('agent', 'supervisor', 'admin', 'master_admin')) THEN RAISE EXCEPTION 'invalid_notification_roles' USING ERRCODE = '22023'; END IF;
  v_hash := md5(concat_ws('|', v_title, v_body, p_category, p_priority, coalesce(v_municipio, ''), array_to_string(v_platforms, ','), array_to_string(v_roles, ','), coalesce(p_payload, '{}'::jsonb)::text, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash) VALUES (p_operation_id, v_actor, 'notification.campaign.create', v_hash);
  INSERT INTO public.notification_campaigns(id, title, body, category, priority, municipio, target_platforms, target_roles, payload, created_by)
  VALUES (v_campaign_id, v_title, v_body, p_category, p_priority, v_municipio, v_platforms, v_roles, private.sanitize_internal_metadata(coalesce(p_payload, '{}'::jsonb)), v_actor);
  INSERT INTO private.notification_campaign_recipients(campaign_id, user_id, platform, provider, endpoint, subscription)
  SELECT v_campaign_id, endpoint.user_id, endpoint.platform, endpoint.provider, endpoint.endpoint, endpoint.subscription
  FROM public.notification_endpoints endpoint
  JOIN public.users profile ON profile.uid = endpoint.user_id
  WHERE endpoint.active AND endpoint.platform = ANY(v_platforms) AND profile."isApproved" = true
    AND (v_municipio IS NULL OR profile.municipio = v_municipio)
    AND (cardinality(v_roles) = 0 OR profile.role = ANY(v_roles));
  GET DIAGNOSTICS v_recipient_count = ROW_COUNT;
  IF v_recipient_count = 0 THEN
    v_status := 'no_recipients';
    UPDATE public.notification_campaigns SET status = v_status, completed_at = now(), failure_reason = 'no_eligible_recipients' WHERE id = v_campaign_id;
  END IF;
  v_previous := jsonb_build_object('ok', true, 'campaign_id', v_campaign_id, 'recipient_count', v_recipient_count, 'status', v_status);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_previous, completed_at = now() WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'notification.campaign.create', 'notification_campaign', v_campaign_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('municipio', v_municipio, 'platforms', v_platforms, 'roles', v_roles, 'recipient_count', v_recipient_count, 'status', v_status));
  RETURN v_previous;
END;
$$;

DROP FUNCTION public.list_notification_campaigns();
CREATE FUNCTION public.list_notification_campaigns()
RETURNS TABLE(id uuid, title text, category text, priority text, municipio text, target_platforms text[], target_roles text[], status text, recipient_count bigint, sent_count bigint, failed_count bigint, skipped_count bigint, failure_reason text, created_at timestamptz, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('notification.manage') AND NOT private.has_internal_permission('technical.write') THEN RAISE EXCEPTION 'notification_management_not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT campaign.id, campaign.title, campaign.category, campaign.priority, campaign.municipio, campaign.target_platforms, campaign.target_roles, campaign.status,
    count(recipient.id), count(recipient.id) FILTER (WHERE recipient.status = 'sent'), count(recipient.id) FILTER (WHERE recipient.status = 'failed'), count(recipient.id) FILTER (WHERE recipient.status = 'skipped'), campaign.failure_reason, campaign.created_at, campaign.completed_at
  FROM public.notification_campaigns campaign
  LEFT JOIN private.notification_campaign_recipients recipient ON recipient.campaign_id = campaign.id
  GROUP BY campaign.id
  ORDER BY campaign.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_campaign(text, text, text, text, text, text[], text[], jsonb, text, uuid), public.list_notification_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification_campaign(text, text, text, text, text, text[], text[], jsonb, text, uuid), public.list_notification_campaigns() TO authenticated;
NOTIFY pgrst, 'reload schema';
