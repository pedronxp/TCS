-- Atualiza a configuracao remota para o APK Android 1.3.9.
-- Mantem mandatory=false ate validacao manual no aparelho.

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
  '1.3.9',
  13,
  13,
  'https://github.com/pedronxp/TCS-apk-releases/releases/download/v1.3.9/TCS-Relatorio-de-Risco-1.3.9-vc13.apk',
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
