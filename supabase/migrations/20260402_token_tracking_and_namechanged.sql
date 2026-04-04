-- ============================================================
-- Migração: Campos para rastreio de uso de tokens + nameChanged
-- ============================================================

-- 1. invite_tokens: campos de rastreio de quem usou
ALTER TABLE invite_tokens
  ADD COLUMN IF NOT EXISTS "usadoPorUid"  uuid        REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS "usadoPorNome" text,
  ADD COLUMN IF NOT EXISTS "usadoPorIp"   text,
  ADD COLUMN IF NOT EXISTS "usadoEm"      timestamptz;

-- 2. users: flag para controlar se o nome já foi editado
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "nameChanged" boolean DEFAULT false;

-- 3. Atualizar a RPC mark_token_used para gravar os novos campos
CREATE OR REPLACE FUNCTION mark_token_used(
  p_codigo text,
  p_uid uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE invite_tokens
  SET
    usado = true,
    "usadoPorUid" = COALESCE(p_uid, "usadoPorUid"),
    "usadoPorNome" = COALESCE(p_nome, "usadoPorNome"),
    "usadoPorIp" = COALESCE(p_ip, "usadoPorIp"),
    "usadoEm" = now()
  WHERE codigo = p_codigo;
END;
$$;
