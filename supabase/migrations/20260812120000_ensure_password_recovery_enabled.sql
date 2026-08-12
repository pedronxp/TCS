-- Garante que password_recovery_enabled está ativo no banco remoto.
-- A migration 20260808180000 define o flag como true, mas se ela não foi
-- aplicada ou foi revertida, a coluna permanece com o default false e a
-- função get_public_auth_capabilities retorna password_recovery = false,
-- bloqueando a recuperação de senha no dashboard web.

UPDATE public.subscription_settings
   SET password_recovery_enabled = true
 WHERE singleton;
