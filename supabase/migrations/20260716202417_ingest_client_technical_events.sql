-- Mobile clients can report only a small, sanitized technical-event envelope.
-- Organization and actor are always resolved from the authenticated session.
CREATE OR REPLACE FUNCTION public.ingest_client_technical_event(
  p_event_key uuid,
  p_app_version text,
  p_platform text,
  p_category text,
  p_severity text,
  p_correlation_id text,
  p_summary text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_org uuid;
  event_id bigint;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_platform NOT IN ('android', 'ios', 'web', 'unknown') THEN
    RAISE EXCEPTION 'invalid_platform' USING ERRCODE = '22023';
  END IF;
  IF p_category NOT IN ('sync', 'storage', 'runtime', 'version') THEN
    RAISE EXCEPTION 'invalid_category' USING ERRCODE = '22023';
  END IF;
  IF p_severity NOT IN ('info', 'warning', 'error', 'critical') THEN
    RAISE EXCEPTION 'invalid_severity' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'invalid_metadata' USING ERRCODE = '22023';
  END IF;
  IF trim(COALESCE(p_summary, '')) = '' THEN
    RAISE EXCEPTION 'summary_required' USING ERRCODE = '22023';
  END IF;

  actor_org := private.current_organization_id(actor);

  INSERT INTO public.technical_events(
    event_key, organization_id, user_id, app_version, platform, category,
    severity, correlation_id, summary, metadata
  ) VALUES (
    p_event_key, actor_org, actor, nullif(left(trim(p_app_version), 50), ''),
    p_platform, p_category, p_severity, nullif(left(trim(p_correlation_id), 120), ''),
    left(trim(p_summary), 500), private.sanitize_internal_metadata(p_metadata)
  )
  ON CONFLICT (event_key) DO UPDATE SET event_key = EXCLUDED.event_key
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_client_technical_event(uuid,text,text,text,text,text,text,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_client_technical_event(uuid,text,text,text,text,text,text,jsonb)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
