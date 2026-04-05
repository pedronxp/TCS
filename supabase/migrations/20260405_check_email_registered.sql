-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: check_email_registered
-- Verifica se um e-mail já existe em auth.users (tabela interna do Supabase).
-- Necessária porque o client JS não tem acesso direto ao schema auth.
-- Chamada pelo fluxo de registro para evitar o falso negativo onde a
-- verificação em public.users retorna "livre" mas auth.users já tem o e-mail.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- precisa de SECURITY DEFINER para acessar auth.users
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = lower(trim(p_email))
  );
END;
$$;

-- Garante que apenas usuários anônimos/autenticados possam chamar (não precisa de session)
GRANT EXECUTE ON FUNCTION public.check_email_registered(TEXT) TO anon, authenticated;
