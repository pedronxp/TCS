-- Atualiza a configuracao remota para o APK Android 1.3.7.
-- Mantem mandatory=false para permitir teste controlado antes de bloquear versoes antigas.

INSERT INTO app_update_config (
  platform,
  enabled,
  mandatory,
  latest_version,
  latest_version_code,
  min_required_version_code,
  apk_url,
  message
) VALUES (
  'android',
  TRUE,
  FALSE,
  '1.3.7',
  11,
  11,
  'https://github.com/pedronxp/TCS-apk-releases/releases/download/v1.3.7/TCS-Relatorio-de-Risco-1.3.7-vc11.apk',
  'Existe uma nova versao do aplicativo. Atualize para continuar usando o sistema.'
)
ON CONFLICT (platform) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  mandatory = EXCLUDED.mandatory,
  latest_version = EXCLUDED.latest_version,
  latest_version_code = EXCLUDED.latest_version_code,
  min_required_version_code = EXCLUDED.min_required_version_code,
  apk_url = EXCLUDED.apk_url,
  message = EXCLUDED.message,
  updated_at = NOW();
