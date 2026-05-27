-- Configuracao remota para atualizacao obrigatoria do APK.
-- A leitura e publica porque a verificacao acontece antes do login.

CREATE TABLE IF NOT EXISTS app_update_config (
  platform TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  latest_version TEXT NOT NULL,
  latest_version_code INTEGER NOT NULL,
  min_required_version_code INTEGER NOT NULL,
  apk_url TEXT,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_update_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_update_config_public_read" ON app_update_config;
CREATE POLICY "app_update_config_public_read"
  ON app_update_config
  FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE);

GRANT SELECT ON app_update_config TO anon, authenticated;

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
  '1.3.6',
  10,
  9,
  NULL,
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
