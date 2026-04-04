-- Rastreamento de documentos gerados por vistoria (anti-spam + auditoria)
-- Impede geração em loop e informa se documento já existe no dispositivo
ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS laudo_gerado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relatorio_gerado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termo_gerado_em TIMESTAMPTZ;
