-- Password recovery quota is consumed atomically by the trusted Edge Function.
-- Browser roles cannot inspect or write this abuse-control table.
CREATE INDEX IF NOT EXISTS idx_password_recovery_requests_ip_time
  ON public.password_recovery_requests (ip, created_at DESC)
  WHERE ip IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_password_recovery_quota(p_email text, p_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip text := nullif(left(btrim(coalesce(p_ip, '')), 64), '');
  v_email_count integer;
  v_ip_count integer;
  v_oldest timestamptz;
  v_retry_seconds integer := 0;
BEGIN
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR char_length(v_email) > 254 THEN
    RAISE EXCEPTION 'invalid_recovery_request' USING ERRCODE = '22023';
  END IF;
  IF v_ip IS NULL THEN RAISE EXCEPTION 'invalid_recovery_request' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));
  DELETE FROM public.password_recovery_requests WHERE created_at < now() - interval '24 hours';
  SELECT count(*), min(created_at) INTO v_email_count, v_oldest
  FROM public.password_recovery_requests WHERE email = v_email AND created_at > now() - interval '1 hour';
  SELECT count(*) INTO v_ip_count
  FROM public.password_recovery_requests WHERE ip = v_ip AND created_at > now() - interval '1 hour';
  IF v_email_count >= 3 OR v_ip_count >= 12 THEN
    IF v_oldest IS NOT NULL THEN v_retry_seconds := greatest(1, ceil(extract(epoch FROM (v_oldest + interval '1 hour' - now())))::integer); END IF;
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry_seconds);
  END IF;
  INSERT INTO public.password_recovery_requests (email, ip) VALUES (v_email, v_ip);
  RETURN jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_password_recovery_quota(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_password_recovery_quota(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.check_password_recovery_rate_limit(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_password_recovery_request(text,text) FROM PUBLIC,anon,authenticated;
