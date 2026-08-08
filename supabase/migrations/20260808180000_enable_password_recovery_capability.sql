-- Habilita somente as capacidades de autenticação já suportadas pelo projeto remoto.
-- Google continua condicionado às credenciais OAuth configuradas no Supabase.

ALTER TABLE public.subscription_settings
  ADD COLUMN IF NOT EXISTS password_recovery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_customer_auth_enabled boolean NOT NULL DEFAULT false;

UPDATE public.subscription_settings
   SET password_recovery_enabled = true
 WHERE singleton;

CREATE OR REPLACE FUNCTION public.get_public_auth_capabilities()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'google_auth', coalesce(settings.google_customer_auth_enabled, false),
    'password_recovery', coalesce(settings.password_recovery_enabled, false)
  )
  FROM public.subscription_settings AS settings
  WHERE settings.singleton
$$;

CREATE OR REPLACE FUNCTION public.record_password_recovery_completed(
  p_other_sessions_revoked boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.subscription_audit_events(actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_user, 'password_recovery_completed', 'customer_identity', v_user::text,
    jsonb_build_object('other_sessions_revoked', coalesce(p_other_sessions_revoked, false)));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_auth_capabilities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_auth_capabilities() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.record_password_recovery_completed(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_password_recovery_completed(boolean) TO authenticated;
