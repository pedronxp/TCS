-- Training administration is server-owned. Public entry remains deliberately
-- available for the token-based classroom flow, but creation/closure requires
-- an approved master administrator.
CREATE OR REPLACE FUNCTION public.create_training_class(
  p_nome text,
  p_token text,
  p_limite_participantes integer,
  p_inicio_em timestamptz,
  p_fim_em timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_nome text := btrim(coalesce(p_nome, ''));
  v_token text := upper(btrim(coalesce(p_token, '')));
  v_creator_name text;
  v_id uuid;
BEGIN
  SELECT name INTO v_creator_name
  FROM public.users
  WHERE uid = auth.uid() AND role = 'master_admin' AND coalesce("isApproved", false);
  IF v_creator_name IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_nome) NOT BETWEEN 2 AND 120
     OR v_token !~ '^[A-Z0-9-]{6,64}$'
     OR p_limite_participantes NOT BETWEEN 1 AND 500
     OR p_inicio_em IS NULL OR p_fim_em IS NULL
     OR p_fim_em <= p_inicio_em
     OR p_fim_em > now() + interval '90 days'
     OR p_inicio_em < now() - interval '1 day' THEN
    RAISE EXCEPTION 'invalid_training_class' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.training_classes(
    nome, token, limite_participantes, inicio_em, fim_em, ativo,
    formularios_permitidos, criado_por, criado_por_nome
  ) VALUES (
    v_nome, v_token, p_limite_participantes, p_inicio_em, p_fim_em, true,
    ARRAY['vistoria_deslizamento_v3','risco_estrutural_novo_v2','avaliacao_arvore_cbmmg_v1']::text[], auth.uid(), v_creator_name
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_training_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = auth.uid() AND role = 'master_admin' AND coalesce("isApproved", false)
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.training_classes
  SET ativo = false, encerrado_em = now(), atualizado_em = now()
  WHERE id = p_class_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'training_class_not_found_or_closed' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.training_participants
  SET status = 'encerrado', ultimo_acesso_em = now()
  WHERE training_class_id = p_class_id AND status = 'ativo';
END;
$function$;

REVOKE ALL ON FUNCTION public.create_training_class(text,text,integer,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_training_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_training_class(text,text,integer,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_training_class(uuid) TO authenticated;

-- Existing token-based participant entry is intentionally callable without an
-- app account. Pin its search path and keep only the minimal anon execute grant.
ALTER FUNCTION public.training_class_entry(text,text,text) SET search_path TO 'public', 'pg_catalog';
REVOKE ALL ON FUNCTION public.training_class_entry(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.training_class_entry(text,text,text) TO anon, authenticated;
