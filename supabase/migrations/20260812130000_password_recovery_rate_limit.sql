-- Rate limit de recuperação de senha POR E-MAIL (não global).
-- Registra cada solicitação e expira janela de 1 hora.
-- Aplicado em produção via MCP Supabase em 2026-08-12.

CREATE TABLE IF NOT EXISTS public.password_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_requests_email_time
  ON public.password_recovery_requests (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_recovery_requests_created_at
  ON public.password_recovery_requests (created_at);

-- Função anon-safe: any caller (portal público, sem sessão).
-- Janela 1h, máximo 3 solicitações por e-mail.
CREATE OR REPLACE FUNCTION public.check_password_recovery_rate_limit(p_email text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
  SELECT jsonb_build_object(
    'allowed',
      (SELECT count(*) FROM public.password_recovery_requests
       WHERE email = lower(p_email)
         AND created_at > now() - interval '1 hour') < 3,
    'remaining',
      (SELECT 3 - count(*) FROM public.password_recovery_requests
       WHERE email = lower(p_email)
         AND created_at > now() - interval '1 hour'),
    'window_minutes', 60
  );
$function$;

-- Registra a tentativa (insere antes do envio). Anon-safe: email já é público.
CREATE OR REPLACE FUNCTION public.record_password_recovery_request(p_email text, p_ip text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
  INSERT INTO public.password_recovery_requests (email, ip)
  VALUES (lower(p_email), p_ip);
$function$;

-- Cleanup de registros > 24h (chamado oportunisticamente).
CREATE OR REPLACE FUNCTION public.cleanup_password_recovery_requests()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
  DELETE FROM public.password_recovery_requests WHERE created_at < now() - interval '24 hours';
$function$;

COMMENT ON TABLE public.password_recovery_requests IS 'Rate limit de recuperação de senha por e-mail (janela 1h, máx 3).';
COMMENT ON FUNCTION public.check_password_recovery_rate_limit(text) IS 'Verifica se o e-mail ainda pode solicitar recuperação. Retorna {allowed, remaining, window_minutes}.';
COMMENT ON FUNCTION public.record_password_recovery_request(text, text) IS 'Registra uma solicitação de recuperação de senha para rate-limit por e-mail.';
