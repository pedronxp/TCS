-- ============================================================
-- Migração: Registro atômico via trigger + mark_token_used boolean
-- ============================================================

-- 1. Trigger em auth.users que cria public.users automaticamente
--    usando raw_user_meta_data passado no signUp.
--    Isso elimina a janela de usuário órfão no Auth.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só age se os metadados essenciais estiverem presentes
  -- (cadastros via convite passam name/role/municipio no metadata)
  IF NEW.raw_user_meta_data IS NOT NULL
     AND NEW.raw_user_meta_data->>'role' IS NOT NULL
  THEN
    INSERT INTO public.users (
      uid,
      name,
      username,
      email,
      phone,
      role,
      municipio,
      "isApproved",
      "createdAt"
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email, '@', 1)
      ),
      LOWER(TRIM(NEW.email)),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'role',
      NEW.raw_user_meta_data->>'municipio',
      true,
      NOW()
    )
    ON CONFLICT (uid) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Substituir mark_token_used para retornar boolean real
--    - Verifica que o token existe E ainda não foi usado (usado = false)
--    - Retorna TRUE se atualizou exatamente 1 linha, FALSE caso contrário

CREATE OR REPLACE FUNCTION public.mark_token_used(
  p_codigo text,
  p_uid    uuid    DEFAULT NULL,
  p_nome   text    DEFAULT NULL,
  p_ip     text    DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE invite_tokens
  SET
    usado          = true,
    "usadoPorUid"  = COALESCE(p_uid,  "usadoPorUid"),
    "usadoPorNome" = COALESCE(p_nome, "usadoPorNome"),
    "usadoPorIp"   = COALESCE(p_ip,   "usadoPorIp"),
    "usadoEm"      = NOW()
  WHERE codigo = p_codigo
    AND usado  = false;   -- garante idempotência: token já usado → 0 linhas → false

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
