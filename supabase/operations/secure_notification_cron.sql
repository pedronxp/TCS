-- Protege a credencial de uma rotina existente sem revelar seu conteúdo.
-- A migração acontece inteiramente dentro do banco e preserva o agendamento.

DO $migration$
DECLARE
  current_job_id bigint;
  current_command text;
  current_token text;
  current_url text;
  existing_secret_id uuid;
  protected_command text;
BEGIN
  SELECT jobid, command
  INTO current_job_id, current_command
  FROM cron.job
  WHERE jobname = 'notify-expiring-tokens';

  IF current_job_id IS NULL THEN
    RAISE EXCEPTION 'notification_cron_job_not_found';
  END IF;

  IF current_command LIKE '%vault.decrypted_secrets%' THEN
    RETURN;
  END IF;

  current_token := substring(
    current_command
    FROM '"Authorization"[[:space:]]*:[[:space:]]*"Bearer[[:space:]]+([^"]+)"'
  );
  current_url := substring(
    current_command
    FROM 'url[[:space:]]*:=[[:space:]]*''([^'']+)'''
  );

  IF current_token IS NULL OR char_length(current_token) < 40 OR current_url IS NULL THEN
    RAISE EXCEPTION 'notification_cron_configuration_invalid';
  END IF;

  SELECT id
  INTO existing_secret_id
  FROM vault.secrets
  WHERE name = 'notify_expiring_tokens_auth';

  IF existing_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      current_token,
      'notify_expiring_tokens_auth',
      'Credencial criptografada da rotina de notificações.'
    );
  ELSE
    PERFORM vault.update_secret(existing_secret_id, current_token);
  END IF;

  protected_command := format(
    $job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'notify_expiring_tokens_auth'
          )
        ),
        body := '{}'::jsonb
      );
    $job$,
    current_url
  );

  PERFORM cron.alter_job(job_id := current_job_id, command := protected_command);
END;
$migration$;

SELECT
  jobname,
  active,
  command LIKE '%vault.decrypted_secrets%' AS uses_encrypted_vault,
  command ~ 'eyJ[A-Za-z0-9_-]{15,}' AS contains_inline_token
FROM cron.job
WHERE jobname = 'notify-expiring-tokens';
