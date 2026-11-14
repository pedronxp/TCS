CREATE FUNCTION private.can_manage_training_classes()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.uid = auth.uid() AND u."isApproved" IS TRUE
      AND (u.role = 'master_admin' OR private.current_internal_role(u.uid) = 'owner')
  );
$$;

REVOKE ALL ON FUNCTION private.can_manage_training_classes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_manage_training_classes() TO authenticated;

CREATE POLICY authorized_training_class_read ON public.training_classes
  FOR SELECT TO authenticated USING (private.can_manage_training_classes());
CREATE POLICY authorized_training_participant_read ON public.training_participants
  FOR SELECT TO authenticated USING (private.can_manage_training_classes());
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
  WHERE uid = auth.uid() AND private.can_manage_training_classes();
  IF NOT private.can_manage_training_classes() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
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
    ARRAY['vistoria_deslizamento_v3','risco_estrutural_novo_v2','avaliacao_arvore_cbmmg_v1','inspecao_ponte_passarela_v1']::text[], auth.uid(), v_creator_name
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
  IF NOT private.can_manage_training_classes() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.training_classes
  SET ativo = false, encerrado_em = now(), atualizado_em = now()
  WHERE id = p_class_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'training_class_not_found_or_closed' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.training_participants
  SET status = 'encerrado', ultimo_acesso_em = now()
  WHERE training_class_id = p_class_id AND status = 'ativo';
END;
$function$;


