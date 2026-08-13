-- Supabase grants EXECUTE to anon by default for newly-created functions.
-- Revoke that explicit grant as well as PUBLIC before granting authenticated.
REVOKE ALL ON FUNCTION public.update_my_display_name(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_phone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_push_token(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_approval(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_municipio(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_municipio_email_domains(text, text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_my_display_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_approval(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_municipio(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_municipio_email_domains(text, text[]) TO authenticated;
