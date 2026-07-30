-- Reconcile legacy grants and permissive policies reported by Supabase
-- Security Advisor before the customer portals are enabled.
--
-- The application no longer inserts public.users directly: auth.users is the
-- authoritative source and handle_new_auth_user creates the profile. Likewise,
-- invite consumption goes through mark_token_used, so direct table updates are
-- unnecessary.
DROP POLICY IF EXISTS allow_self_insert_on_signup ON public.users;
DROP POLICY IF EXISTS allow_mark_token_used ON public.invite_tokens;

-- These legacy policies expose object listing. The buckets remain public for
-- backwards compatibility with historical URLs; removing SELECT policies does
-- not change public download URLs.
DROP POLICY IF EXISTS leitura_publica_fotos ON storage.objects;
DROP POLICY IF EXISTS "Vistorias Public Read" ON storage.objects;

-- Trigger functions never need to be called directly by API roles. PostgreSQL
-- checks their ownership when the trigger is created and invokes them through
-- the trigger boundary afterwards.
DO $$
DECLARE
  function_signature regprocedure;
BEGIN
  FOR function_signature IN
    SELECT procedure.oid::regprocedure
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname IN ('public', 'private')
      AND procedure.prosecdef
      AND procedure.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_signature
    );
  END LOOP;
END;
$$;

-- Keep the registration RPCs available only to the roles that actually use
-- them, instead of inheriting PostgreSQL's default EXECUTE grant to PUBLIC.
REVOKE ALL ON FUNCTION public.mark_token_used(text, uuid, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_token_used(text, uuid, text, text)
  TO anon, authenticated;
ALTER FUNCTION public.mark_token_used(text, uuid, text, text)
  SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.check_email_registered(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_registered(text)
  TO anon, authenticated;
ALTER FUNCTION public.check_email_registered(text)
  SET search_path = '';

-- Password reset is an authenticated, database-authorized administrative RPC.
REVOKE ALL ON FUNCTION public.admin_reset_password(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(uuid, text)
  TO authenticated;
