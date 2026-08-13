-- REVOKE FROM anon alone does not override a legacy PUBLIC grant.
REVOKE ALL ON FUNCTION public.get_my_municipio() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_approved() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.training_expire_elapsed_classes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_municipio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_expire_elapsed_classes() TO authenticated;
