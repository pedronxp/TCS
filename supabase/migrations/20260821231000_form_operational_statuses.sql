-- Estados operacionais do catálogo de formulários.
-- O aplicativo continua recebendo apenas formulários ativos; manutenção e
-- desativado deixam o formulário indisponível sem apagar seu histórico.

CREATE OR REPLACE FUNCTION public.mutate_internal_form(
  p_form_id text,
  p_action text,
  p_payload jsonb,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid(); actor_name text; target public.formularios; target_id uuid;
  source_version public.internal_form_versions; v_request_hash text; v_result jsonb; next_version integer;
  requested_status text;
BEGIN
  IF p_action IN ('publish','rollback','deactivate','set_status') THEN
    IF NOT private.has_internal_permission('configuration.publish',actor) THEN RAISE EXCEPTION 'form_publish_not_allowed' USING ERRCODE='42501'; END IF;
    IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
  ELSIF NOT private.has_internal_permission('configuration.prepare',actor) AND NOT private.has_internal_permission('configuration.publish',actor) THEN
    RAISE EXCEPTION 'form_prepare_not_allowed' USING ERRCODE='42501';
  END IF;

  IF p_action NOT IN ('create','save_draft','publish','rollback','deactivate','set_status') THEN RAISE EXCEPTION 'invalid_form_action'; END IF;
  IF char_length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'invalid_form_payload'; END IF;

  v_request_hash := md5(concat_ws('|',p_form_id,p_action,p_payload::text,p_reason));
  SELECT io.result INTO v_result FROM public.internal_operations io WHERE io.actor_id=actor AND io.operation_id=p_operation_id AND io.request_hash=v_request_hash;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  INSERT INTO public.internal_operations(operation_id,actor_id,action,request_hash) VALUES(p_operation_id,actor,'form.'||p_action,v_request_hash);
  SELECT COALESCE(display_name,role) INTO actor_name FROM public.internal_staff WHERE user_id=actor;

  IF p_action='create' THEN
    IF char_length(trim(COALESCE(p_payload->>'title',''))) < 3 THEN RAISE EXCEPTION 'form_title_required'; END IF;
    INSERT INTO public.formularios(titulo,descricao,perguntas,"criadoEm",ativo,municipio,"criadoPorNome","publicadoEm","atualizadoEm",status,versao,"criadoPorUid",classificacao,"tipoCalculo",fases)
    VALUES(trim(p_payload->>'title'),nullif(trim(p_payload->>'description'),''),COALESCE(p_payload->'questions','[]'::jsonb),now(),false,nullif(trim(p_payload->>'municipality'),''),COALESCE(actor_name,'Equipe interna'),NULL,now(),'rascunho',1,actor::text,p_payload->'classification',COALESCE(p_payload->>'calculation_type','soma_total'),p_payload->'phases') RETURNING * INTO target;
  ELSE
    BEGIN target_id:=p_form_id::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_form_id'; END;
    SELECT * INTO target FROM public.formularios WHERE id=target_id FOR UPDATE;
    IF target.id IS NULL THEN RAISE EXCEPTION 'form_not_found'; END IF;
    next_version := target.versao + 1;

    IF p_action='save_draft' THEN
      UPDATE public.formularios SET titulo=COALESCE(nullif(trim(p_payload->>'title'),''),titulo),descricao=CASE WHEN p_payload?'description' THEN nullif(trim(p_payload->>'description'),'') ELSE descricao END,perguntas=CASE WHEN p_payload?'questions' THEN p_payload->'questions' ELSE perguntas END,classificacao=CASE WHEN p_payload?'classification' THEN p_payload->'classification' ELSE classificacao END,fases=CASE WHEN p_payload?'phases' THEN p_payload->'phases' ELSE fases END,"tipoCalculo"=COALESCE(nullif(p_payload->>'calculation_type',''),"tipoCalculo"),status='rascunho',ativo=false,"publicadoEm"=NULL,versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    ELSIF p_action='publish' THEN
      UPDATE public.formularios SET status='publicado',ativo=true,"publicadoEm"=now(),versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    ELSIF p_action IN ('deactivate', 'set_status') THEN
      requested_status := CASE WHEN p_action = 'deactivate' THEN 'inactive' ELSE COALESCE(p_payload->>'status', '') END;
      IF requested_status NOT IN ('active', 'maintenance', 'inactive') THEN RAISE EXCEPTION 'invalid_form_operational_status'; END IF;
      UPDATE public.formularios
      SET status = CASE requested_status WHEN 'active' THEN 'publicado' WHEN 'maintenance' THEN 'manutencao' ELSE 'suspenso' END,
          ativo = requested_status = 'active',
          "publicadoEm" = CASE WHEN requested_status = 'active' THEN now() ELSE "publicadoEm" END,
          versao = next_version,
          "atualizadoEm" = now()
      WHERE id=target_id
      RETURNING * INTO target;
    ELSE
      SELECT * INTO source_version FROM public.internal_form_versions WHERE form_id=target_id AND version=(p_payload->>'version')::integer;
      IF source_version.id IS NULL THEN RAISE EXCEPTION 'form_version_not_found'; END IF;
      UPDATE public.formularios SET titulo=source_version.snapshot->>'titulo',descricao=source_version.snapshot->>'descricao',perguntas=COALESCE(source_version.snapshot->'perguntas','[]'::jsonb),classificacao=source_version.snapshot->'classificacao',fases=source_version.snapshot->'fases',"tipoCalculo"=source_version.snapshot->>'tipoCalculo',status='publicado',ativo=true,"publicadoEm"=now(),versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    END IF;
  END IF;

  INSERT INTO public.internal_form_versions(form_id,version,status,snapshot,created_by,reason) VALUES(target.id,target.versao,target.status,to_jsonb(target),actor,left(trim(p_reason),500));
  v_result:=jsonb_build_object('ok',true,'form_id',target.id,'version',target.versao,'status',target.status,'active',target.ativo);
  UPDATE public.internal_operations SET status='succeeded',result=v_result,completed_at=now() WHERE actor_id=actor AND operation_id=p_operation_id;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata) VALUES(actor,private.current_internal_role(actor),'form.'||p_action,'form',target.id::text,'allowed',left(trim(p_reason),500),jsonb_build_object('version',target.versao,'status',target.status,'active',target.ativo));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_internal_form(text,text,jsonb,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_internal_form(text,text,jsonb,text,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
