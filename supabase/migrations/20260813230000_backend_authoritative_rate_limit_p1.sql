-- Rate-limit identity, limit, and window are business rules. Never accept any
-- of them from the browser.
CREATE OR REPLACE FUNCTION public.enforce_my_operational_rate_limit(p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_max_count integer;
  v_window_seconds integer;
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND "isApproved") THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  CASE v_action
    WHEN 'gerar_pdf' THEN
      v_max_count := 10;
      v_window_seconds := 3600;
      v_window_start := date_trunc('hour', now());
    WHEN 'criar_vistoria' THEN
      v_max_count := 30;
      v_window_seconds := 86400;
      v_window_start := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
    ELSE
      RAISE EXCEPTION 'invalid_rate_limit_action' USING ERRCODE = '22023';
  END CASE;

  INSERT INTO public.rate_limits (uid, action, window_start, count)
  VALUES (auth.uid(), v_action, v_window_start, 1)
  ON CONFLICT (uid, action, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  DELETE FROM public.rate_limits
  WHERE uid = auth.uid() AND action = v_action
    AND window_start < now() - make_interval(secs => v_window_seconds * 3);

  RETURN v_count <= v_max_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_my_operational_rate_limit(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.enforce_my_operational_rate_limit(text) TO authenticated;

-- Retire a API legada que permitia ao cliente escolher outra identidade e teto.
-- check_rate_limit is absent from the versioned migration history (legacy
-- object whose definition was dropped from this branch). Condition this revoke
-- on catalog existence so the migration runs on a clean schema and keeps
-- hardening effective on legacy catalogs where the RPC exists.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'check_rate_limit'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, integer, integer'
  ) THEN
    REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
  END IF;
END $block$;

-- These helpers may still be used by authenticated RLS policies, but anonymous
-- callers have no legitimate self identity and must not execute them. Their
-- definitions are absent from the versioned history on this branch; condition
-- on catalog existence so the migration runs clean and hardens legacy catalogs.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_municipio'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION public.get_my_municipio() FROM anon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_role'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION public.get_my_role() FROM anon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'is_approved'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION public.is_approved() FROM anon;
  END IF;
END $block$;
REVOKE ALL ON FUNCTION public.training_expire_elapsed_classes() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_password_recovery_requests() FROM PUBLIC, anon, authenticated;
