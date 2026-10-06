-- Encerra automaticamente períodos de teste vencidos. Antes disto, o status
-- 'trial' permanecia indefinidamente após trial_ends_at, mantendo ciclos
-- "vencidos" vivos na carteira e sem definição comercial.

-- 1) Repara os ciclos já vencidos hoje.
UPDATE public.subscriptions
SET status = 'expired'
WHERE status = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < now();

-- 2) Manutenção idempotente reutilizável por jobs futuros.
CREATE OR REPLACE FUNCTION public.expire_overdue_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_trials() FROM PUBLIC, anon, authenticated;

-- 3) Agenda diária quando o pg_cron está disponível (mesma guarda usada em
--    20260811185229_expire_stale_sessions.sql). Sem pg_cron, chame
--    public.expire_overdue_trials() por outro job.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      PERFORM cron.unschedule('expire-overdue-trials');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'expire-overdue-trials',
      '30 3 * * *',
      $job$SELECT public.expire_overdue_trials();$job$
    );
  END IF;
END;
$do$;

NOTIFY pgrst, 'reload schema';
