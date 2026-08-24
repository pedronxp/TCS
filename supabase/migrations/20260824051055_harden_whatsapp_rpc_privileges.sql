-- Mantém a RPC interna disponível apenas para sessões autenticadas.
-- A função já valida auth.uid() e a permissão interna; este grant remove a
-- superfície anônima redundante identificada pelo Security Advisor.

REVOKE ALL ON FUNCTION public.internal_listar_sessoes_bot()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.internal_listar_sessoes_bot()
  TO authenticated;

NOTIFY pgrst, 'reload schema';
