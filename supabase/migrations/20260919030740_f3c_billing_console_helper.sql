-- F3c — atalho do console para rodar o motor manualmente (só owner)
CREATE OR REPLACE FUNCTION public.run_billing_engine_now()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN RAISE EXCEPTION 'owner_only' USING ERRCODE='42501'; END IF;
  RETURN public.billing_daily_engine();
END $$;
REVOKE ALL ON FUNCTION public.run_billing_engine_now() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_billing_engine_now() TO authenticated;
