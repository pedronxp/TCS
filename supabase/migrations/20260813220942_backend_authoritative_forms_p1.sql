-- Form definitions determine operational risk assessment and are managed only
-- through narrowly-scoped administrative RPCs.
CREATE OR REPLACE FUNCTION public.create_operational_form(p_titulo text, p_descricao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE v_role text; v_municipio text; v_name text; v_id uuid; v_titulo text := btrim(coalesce(p_titulo,''));
BEGIN
  SELECT role, municipio, name INTO v_role, v_municipio, v_name FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role NOT IN ('admin','master_admin') OR char_length(v_titulo) NOT BETWEEN 2 AND 180 THEN RAISE EXCEPTION 'forbidden_or_invalid_form' USING ERRCODE='42501'; END IF;
  INSERT INTO public.formularios(titulo,descricao,perguntas,versao,status,ativo,municipio,"criadoPorNome","criadoPorUid")
  VALUES(v_titulo,nullif(btrim(coalesce(p_descricao,'')),''),'[]'::jsonb,1,'rascunho',false,v_municipio,coalesce(v_name,''),auth.uid()::text)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_operational_form_publication(p_id uuid,p_publicado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','auth','pg_catalog'
AS $function$
DECLARE v_role text; v_municipio text;
BEGIN
  SELECT role,municipio INTO v_role,v_municipio FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role NOT IN ('admin','master_admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.formularios SET status=CASE WHEN p_publicado THEN 'publicado' ELSE 'rascunho' END,ativo=p_publicado,"publicadoEm"=CASE WHEN p_publicado THEN now() ELSE NULL END,"atualizadoEm"=now()
  WHERE id=p_id AND (v_role='master_admin' OR municipio=v_municipio);
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_found_or_forbidden' USING ERRCODE='42501'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.duplicate_operational_form(p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','auth','pg_catalog'
AS $function$
DECLARE v_role text;v_municipio text;v_name text;v_source public.formularios;v_id uuid;
BEGIN
  SELECT role,municipio,name INTO v_role,v_municipio,v_name FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role NOT IN ('admin','master_admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_source FROM public.formularios WHERE id=p_id AND (v_role='master_admin' OR municipio=v_municipio);
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_found_or_forbidden' USING ERRCODE='42501'; END IF;
  INSERT INTO public.formularios(titulo,descricao,perguntas,versao,status,ativo,municipio,"criadoPorNome","criadoPorUid",classificacao,"tipoCalculo",fases)
  VALUES(left(v_source.titulo || ' (cópia)',180),v_source.descricao,coalesce(v_source.perguntas,'[]'::jsonb),1,'rascunho',false,v_source.municipio,coalesce(v_name,''),auth.uid()::text,v_source.classificacao,v_source."tipoCalculo",v_source.fases)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_operational_form(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','auth','pg_catalog'
AS $function$
DECLARE v_role text;v_municipio text;
BEGIN
  SELECT role,municipio INTO v_role,v_municipio FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role NOT IN ('admin','master_admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  DELETE FROM public.formularios WHERE id=p_id AND (v_role='master_admin' OR municipio=v_municipio);
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_found_or_forbidden' USING ERRCODE='42501'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_operational_form_questions(p_id uuid,p_perguntas jsonb,p_tipo_calculo text DEFAULT NULL,p_classificacao jsonb DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','auth','pg_catalog'
AS $function$
DECLARE v_role text;v_municipio text;v_version integer;
BEGIN
  SELECT role,municipio INTO v_role,v_municipio FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role NOT IN ('admin','master_admin') OR jsonb_typeof(p_perguntas)<>'array' OR jsonb_array_length(p_perguntas)>200 THEN RAISE EXCEPTION 'forbidden_or_invalid_questions' USING ERRCODE='42501'; END IF;
  UPDATE public.formularios
  SET perguntas=p_perguntas,versao=CASE WHEN status='publicado' THEN versao+1 ELSE versao END,"atualizadoEm"=now(),"tipoCalculo"=coalesce(nullif(btrim(coalesce(p_tipo_calculo,'')),''),"tipoCalculo"),classificacao=coalesce(p_classificacao,classificacao)
  WHERE id=p_id AND (v_role='master_admin' OR municipio=v_municipio)
  RETURNING versao INTO v_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'form_not_found_or_forbidden' USING ERRCODE='42501'; END IF;
  RETURN v_version;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_operational_form(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_operational_form_publication(uuid,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.duplicate_operational_form(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_operational_form(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_operational_form_questions(uuid,jsonb,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_operational_form(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_operational_form_publication(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_operational_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_operational_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_operational_form_questions(uuid,jsonb,text,jsonb) TO authenticated;
