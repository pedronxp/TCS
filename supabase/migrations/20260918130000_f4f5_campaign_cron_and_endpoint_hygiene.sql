-- Campaign dispatch must not depend on the console tab staying open: pg_cron
-- invokes the dispatch edge function every 5 minutes as a safety net for
-- queued campaigns. Endpoint hygiene keeps the audience healthy: Expo reports
-- DeviceNotRegistered (deactivated by the dispatcher at receipt time) and
-- stale endpoints (180 days unseen) are deactivated daily. The dispatch
-- credential stays in the Vault, reusing the same service-role secret that
-- protects the notify-expiring-tokens job.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-notification-campaigns') THEN
    PERFORM cron.schedule(
      'dispatch-notification-campaigns',
      '*/5 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://vobcapzssxchdckazfnr.supabase.co/functions/v1/dispatch-notification-campaigns',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_expiring_tokens_auth')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deactivate-stale-notification-endpoints') THEN
    PERFORM cron.schedule(
      'deactivate-stale-notification-endpoints',
      '30 2 * * *',
      $cron$
      UPDATE public.notification_endpoints
      SET active = false, updated_at = now()
      WHERE active = true AND last_seen_at < now() - interval '180 days';
      $cron$
    );
  END IF;
END
$$;
