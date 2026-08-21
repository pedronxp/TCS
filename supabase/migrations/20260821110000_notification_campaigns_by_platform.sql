-- Notification campaigns keep audience selection and delivery state in the
-- database.  Browser clients never receive device endpoints; a service-role
-- Edge Function dispatches the queued recipient records.

CREATE TABLE IF NOT EXISTS public.notification_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
  provider text NOT NULL CHECK (provider IN ('expo', 'web_push')),
  endpoint text NOT NULL,
  subscription jsonb,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, endpoint)
);
CREATE INDEX IF NOT EXISTS notification_endpoints_active_audience_idx
  ON public.notification_endpoints(user_id, platform) WHERE active;

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  category text NOT NULL DEFAULT 'operational' CHECK (category IN ('operational', 'security', 'token', 'maintenance')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  municipio text,
  target_platforms text[] NOT NULL CHECK (cardinality(target_platforms) > 0),
  target_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'partial', 'failed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text
);
CREATE INDEX IF NOT EXISTS notification_campaigns_status_created_idx
  ON public.notification_campaigns(status, created_at DESC);

CREATE TABLE IF NOT EXISTS private.notification_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
  provider text NOT NULL CHECK (provider IN ('expo', 'web_push')),
  endpoint text NOT NULL,
  subscription jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider_receipt jsonb,
  error_code text,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, provider, endpoint)
);
CREATE INDEX IF NOT EXISTS notification_campaign_recipients_campaign_status_idx
  ON private.notification_campaign_recipients(campaign_id, status);

ALTER TABLE public.notification_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.notification_campaign_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_endpoints, public.notification_campaigns, private.notification_campaign_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notification_campaigns TO authenticated;
GRANT ALL ON TABLE public.notification_endpoints, public.notification_campaigns, private.notification_campaign_recipients TO service_role;
DROP POLICY IF EXISTS notification_campaigns_manager_select ON public.notification_campaigns;
CREATE POLICY notification_campaigns_manager_select ON public.notification_campaigns
  FOR SELECT TO authenticated USING (private.has_internal_permission('notification.manage'));

CREATE OR REPLACE FUNCTION public.register_my_notification_endpoint(
  p_platform text,
  p_provider text,
  p_endpoint text,
  p_subscription jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_platform text := btrim(coalesce(p_platform, '')); v_provider text := btrim(coalesce(p_provider, '')); v_endpoint text := btrim(coalesce(p_endpoint, ''));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_platform NOT IN ('android', 'ios', 'web', 'unknown') OR v_provider NOT IN ('expo', 'web_push') THEN RAISE EXCEPTION 'invalid_notification_endpoint' USING ERRCODE = '22023'; END IF;
  IF char_length(v_endpoint) NOT BETWEEN 20 AND 4096 OR v_endpoint ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_notification_endpoint' USING ERRCODE = '22023'; END IF;
  IF v_provider = 'expo' AND v_platform NOT IN ('android', 'ios', 'unknown') THEN RAISE EXCEPTION 'invalid_notification_provider' USING ERRCODE = '22023'; END IF;
  IF v_provider = 'web_push' AND (p_subscription IS NULL OR jsonb_typeof(p_subscription) <> 'object') THEN RAISE EXCEPTION 'invalid_web_push_subscription' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.notification_endpoints(user_id, platform, provider, endpoint, subscription, active, last_seen_at)
  VALUES (v_user, v_platform, v_provider, v_endpoint, p_subscription, true, now())
  ON CONFLICT (user_id, provider, endpoint) DO UPDATE SET platform = EXCLUDED.platform, subscription = EXCLUDED.subscription, active = true, last_seen_at = now(), updated_at = now();
  -- Keep legacy token notifications working until their callers are migrated.
  IF v_provider = 'expo' THEN UPDATE public.users SET "fcmToken" = v_endpoint WHERE uid = v_user; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

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
  v_municipio text := nullif(btrim(p_municipio), ''); v_platforms text[]; v_roles text[]; v_hash text; v_previous jsonb; v_recipient_count integer;
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
  v_previous := jsonb_build_object('ok', true, 'campaign_id', v_campaign_id, 'recipient_count', v_recipient_count, 'status', CASE WHEN v_recipient_count = 0 THEN 'queued_without_recipients' ELSE 'queued' END);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_previous, completed_at = now() WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'notification.campaign.create', 'notification_campaign', v_campaign_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('municipio', v_municipio, 'platforms', v_platforms, 'roles', v_roles, 'recipient_count', v_recipient_count));
  RETURN v_previous;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_notification_campaigns()
RETURNS TABLE(id uuid, title text, category text, priority text, municipio text, target_platforms text[], target_roles text[], status text, recipient_count bigint, sent_count bigint, failed_count bigint, created_at timestamptz, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_internal_permission('notification.manage') AND NOT private.has_internal_permission('technical.write') THEN RAISE EXCEPTION 'notification_management_not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT campaign.id, campaign.title, campaign.category, campaign.priority, campaign.municipio, campaign.target_platforms, campaign.target_roles, campaign.status,
    count(recipient.id), count(recipient.id) FILTER (WHERE recipient.status = 'sent'), count(recipient.id) FILTER (WHERE recipient.status = 'failed'), campaign.created_at, campaign.completed_at
  FROM public.notification_campaigns campaign
  LEFT JOIN private.notification_campaign_recipients recipient ON recipient.campaign_id = campaign.id
  GROUP BY campaign.id
  ORDER BY campaign.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.register_my_notification_endpoint(text, text, text, jsonb), public.create_notification_campaign(text, text, text, text, text, text[], text[], jsonb, text, uuid), public.list_notification_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_my_notification_endpoint(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification_campaign(text, text, text, text, text, text[], text[], jsonb, text, uuid), public.list_notification_campaigns() TO authenticated;
NOTIFY pgrst, 'reload schema';
