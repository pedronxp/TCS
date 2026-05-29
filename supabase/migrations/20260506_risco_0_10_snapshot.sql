-- Padronizacao de risco R1-R4 em escala oficial 0-10.
-- calculoRisco guarda a regra, os limites e os pesos efetivamente aplicados
-- no momento da vistoria, evitando divergencia entre app, PDF e historico.

ALTER TABLE vistorias
  ADD COLUMN IF NOT EXISTS "calculoRisco" JSONB;

ALTER TABLE vistorias
  ALTER COLUMN "pontuacaoTotal" TYPE NUMERIC(4,1)
  USING "pontuacaoTotal"::NUMERIC;

CREATE INDEX IF NOT EXISTS idx_vistorias_calculo_risco_regra
  ON vistorias (("calculoRisco"->>'versaoRegra'));
