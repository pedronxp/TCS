-- Keeps the operational definition of an active session aligned with its
-- heartbeat policy. A session that exceeded its allowed offline window must
-- never remain visible as active just because its owner has not logged in again.

CREATE OR REPLACE FUNCTION public.expire_stale_active_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expired_count integer;
  unscoped_expired_count integer;
BEGIN
  UPDATE public.active_sessions AS session
  SET
    status = 'expired',
    ended_at = now(),
    end_reason = 'heartbeat_timeout'
  FROM public.organizations AS organization
  WHERE session.status = 'active'
    AND session.organization_id = organization.id
    AND session.last_heartbeat_at < now() - make_interval(
      mins => organization.session_timeout_minutes + organization.offline_tolerance_minutes
    );

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  UPDATE public.active_sessions AS session
  SET
    status = 'expired',
    ended_at = now(),
    end_reason = 'heartbeat_timeout'
  WHERE session.status = 'active'
    AND session.organization_id IS NULL
    AND session.last_heartbeat_at < now() - interval '24 hours';

  GET DIAGNOSTICS unscoped_expired_count = ROW_COUNT;
  RETURN expired_count + unscoped_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_active_sessions() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.expire_stale_active_sessions() IS
  'Encerra sessões ativas cujo último heartbeat ultrapassou a política da organização.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      PERFORM cron.unschedule('expire_stale_active_sessions_every_minute');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'expire_stale_active_sessions_every_minute',
      '* * * * *',
      $job$SELECT public.expire_stale_active_sessions();$job$
    );
  END IF;
END;
$$;
