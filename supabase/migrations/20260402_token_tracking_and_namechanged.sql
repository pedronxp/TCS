-- ============================================================
-- Migração: Campos para rastreio de uso de tokens + nameChanged
-- ============================================================

-- Base legada necessÃ¡ria para que este histÃ³rico tambÃ©m possa criar um
-- projeto vazio. Estas tabelas existiam antes da adoÃ§Ã£o de migrations;
-- mantÃª-las idempotentes preserva os ambientes jÃ¡ provisionados.
CREATE TABLE IF NOT EXISTS public.users (
  uid uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  username text NOT NULL DEFAULT '',
  email text,
  phone text,
  role text,
  municipio text,
  "isApproved" boolean DEFAULT false,
  "createdAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invite_tokens (
  codigo text PRIMARY KEY,
  role text,
  municipio text,
  "criadoPor" uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  "criadoPorNome" text,
  usado boolean NOT NULL DEFAULT false,
  "expiraEm" timestamptz,
  "criadoEm" timestamptz NOT NULL DEFAULT now(),
  email_destinatario text,
  notificadoExpirando boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.vistorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agenteUid" text,
  "agenteNome" text,
  "responsavelNome" text,
  municipio text,
  endereco text,
  latitude double precision,
  longitude double precision,
  "dataVistoria" timestamptz,
  "nivelRisco" text,
  "pontuacaoTotal" integer,
  "respostasJson" jsonb,
  "fotoUrl" text,
  "fotoPath" text,
  "fotosUrls" text[],
  "enderecoCep" text,
  municipio_agente text,
  storage_location text NOT NULL DEFAULT 'drive',
  protocolo text,
  protocolo_seq bigint,
  archived_at timestamptz,
  status text,
  sincronizado boolean,
  "criadoEm" timestamptz DEFAULT now(),
  "formularioVersao" integer
);

CREATE TABLE IF NOT EXISTS public.formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  perguntas jsonb,
  "criadoEm" timestamptz DEFAULT now(),
  ativo boolean DEFAULT false,
  municipio text,
  "criadoPorNome" text NOT NULL DEFAULT '',
  "criadoPorUid" text,
  "publicadoEm" timestamptz,
  "atualizadoEm" timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'rascunho',
  versao integer NOT NULL DEFAULT 1,
  classificacao jsonb,
  "tipoCalculo" text,
  fases jsonb
);

CREATE TABLE IF NOT EXISTS public.risk_configs (
  municipio text PRIMARY KEY,
  configuracao jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

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
