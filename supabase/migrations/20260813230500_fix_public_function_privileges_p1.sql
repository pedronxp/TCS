-- REVOKE FROM anon alone does not override a legacy PUBLIC grant. The identity
-- helpers get_my_municipio/get_my_role/is_approved are absent from the versioned
-- migration history on this branch; condition each REVOKE+GRANT block on catalog
-- existence so this migration runs clean on a fresh schema and applies the exact
-- intended hardening on legacy catalogs where the functions exist.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_municipio'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION public.get_my_municipio() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.get_my_municipio() TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_role'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'is_approved'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    REVOKE ALL ON FUNCTION public.is_approved() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;
  END IF;
END $block$;
REVOKE ALL ON FUNCTION public.training_expire_elapsed_classes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_expire_elapsed_classes() TO authenticated;
