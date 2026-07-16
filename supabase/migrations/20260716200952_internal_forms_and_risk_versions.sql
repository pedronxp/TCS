CREATE TABLE public.internal_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('rascunho','publicado','arquivado')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 8 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id, version)
);
CREATE INDEX internal_form_versions_form_created_idx ON public.internal_form_versions(form_id, created_at DESC);

CREATE TABLE public.internal_risk_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft','published','retired')),
  configuration jsonb NOT NULL CHECK (jsonb_typeof(configuration) = 'array'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 8 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(municipality, version)
);
CREATE INDEX internal_risk_versions_municipality_created_idx ON public.internal_risk_config_versions(municipality, created_at DESC);

INSERT INTO public.internal_form_versions(form_id, version, status, snapshot, created_by, reason)
SELECT f.id, greatest(f.versao,1), CASE WHEN f.status='publicado' THEN 'publicado' ELSE 'rascunho' END,
  to_jsonb(f), NULL, 'Importação inicial do formulário existente'
FROM public.formularios f
ON CONFLICT(form_id,version) DO NOTHING;

INSERT INTO public.internal_risk_config_versions(municipality, version, status, configuration, created_by, reason)
SELECT r.municipio, 1, 'published', r.configuracao, r.atualizado_por, 'Importação inicial da configuração existente'
FROM public.risk_configs r
ON CONFLICT(municipality,version) DO NOTHING;

ALTER TABLE public.internal_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_risk_config_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY internal_form_versions_staff_read ON public.internal_form_versions FOR SELECT TO authenticated USING (private.has_internal_permission('technical.read'));
CREATE POLICY internal_risk_versions_staff_read ON public.internal_risk_config_versions FOR SELECT TO authenticated USING (private.has_internal_permission('technical.read'));
REVOKE ALL ON TABLE public.internal_form_versions, public.internal_risk_config_versions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.internal_form_versions, public.internal_risk_config_versions TO authenticated;

CREATE OR REPLACE FUNCTION private.valid_internal_risk_configuration(p_configuration jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  WITH ranges AS (
    SELECT ordinality, (item->>'minPontos')::numeric min_points, (item->>'maxPontos')::numeric max_points,
      lag((item->>'maxPontos')::numeric) OVER (ORDER BY ordinality) previous_max
    FROM jsonb_array_elements(p_configuration) WITH ORDINALITY AS valueset(item, ordinality)
    WHERE jsonb_typeof(item)='object' AND item ? 'nivel' AND item ? 'label'
      AND (item->>'minPontos') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
      AND (item->>'maxPontos') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
  )
  SELECT jsonb_typeof(p_configuration)='array'
    AND jsonb_array_length(p_configuration)>=2
    AND (SELECT count(*) FROM ranges)=jsonb_array_length(p_configuration)
    AND COALESCE((SELECT bool_and(min_points<=max_points AND (previous_max IS NULL OR min_points>previous_max)) FROM ranges),false);
$$;

CREATE OR REPLACE FUNCTION public.list_internal_forms()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',f.id,'title',f.titulo,'description',f.descricao,'status',f.status,'active',f.ativo,
    'municipality',f.municipio,'version',f.versao,'questions',f.perguntas,'classification',f.classificacao,
    'phases',f.fases,'calculation_type',f."tipoCalculo",'updated_at',f."atualizadoEm",
    'versions',COALESCE((SELECT jsonb_agg(jsonb_build_object('version',v.version,'status',v.status,'reason',v.reason,'created_at',v.created_at) ORDER BY v.version DESC) FROM public.internal_form_versions v WHERE v.form_id=f.id),'[]'::jsonb)
  ) ORDER BY f."atualizadoEm" DESC),'[]'::jsonb) INTO result FROM public.formularios f;
  RETURN result;
END;
$$;

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
DECLARE actor uuid:=auth.uid(); actor_name text; target public.formularios; target_id uuid; source_version public.internal_form_versions; v_request_hash text; v_result jsonb; next_version integer;
BEGIN
  IF p_action IN ('publish','rollback') THEN
    IF NOT private.has_internal_permission('configuration.publish',actor) THEN RAISE EXCEPTION 'form_publish_not_allowed' USING ERRCODE='42501'; END IF;
    IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
  ELSIF NOT private.has_internal_permission('configuration.prepare',actor) AND NOT private.has_internal_permission('configuration.publish',actor) THEN
    RAISE EXCEPTION 'form_prepare_not_allowed' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('create','save_draft','publish','rollback') THEN RAISE EXCEPTION 'invalid_form_action'; END IF;
  IF char_length(trim(p_reason))<8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'invalid_form_payload'; END IF;
  v_request_hash:=md5(concat_ws('|',p_form_id,p_action,p_payload::text,p_reason));
  SELECT io.result INTO v_result FROM public.internal_operations io WHERE io.actor_id=actor AND io.operation_id=p_operation_id AND io.request_hash=v_request_hash;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  INSERT INTO public.internal_operations(operation_id,actor_id,action,request_hash) VALUES(p_operation_id,actor,'form.'||p_action,v_request_hash);
  SELECT COALESCE(display_name,role) INTO actor_name FROM public.internal_staff WHERE user_id=actor;
  IF p_action='create' THEN
    IF char_length(trim(COALESCE(p_payload->>'title','')))<3 THEN RAISE EXCEPTION 'form_title_required'; END IF;
    INSERT INTO public.formularios(titulo,descricao,perguntas,"criadoEm",ativo,municipio,"criadoPorNome","publicadoEm","atualizadoEm",status,versao,"criadoPorUid",classificacao,"tipoCalculo",fases)
    VALUES(trim(p_payload->>'title'),nullif(trim(p_payload->>'description'),''),COALESCE(p_payload->'questions','[]'::jsonb),now(),false,nullif(trim(p_payload->>'municipality'),''),COALESCE(actor_name,'Equipe interna'),NULL,now(),'rascunho',1,actor::text,p_payload->'classification',COALESCE(p_payload->>'calculation_type','soma_total'),p_payload->'phases') RETURNING * INTO target;
  ELSE
    BEGIN target_id:=p_form_id::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_form_id'; END;
    SELECT * INTO target FROM public.formularios WHERE id=target_id FOR UPDATE;
    IF target.id IS NULL THEN RAISE EXCEPTION 'form_not_found'; END IF;
    next_version:=target.versao+1;
    IF p_action='save_draft' THEN
      UPDATE public.formularios SET titulo=COALESCE(nullif(trim(p_payload->>'title'),''),titulo),descricao=CASE WHEN p_payload?'description' THEN nullif(trim(p_payload->>'description'),'') ELSE descricao END,perguntas=CASE WHEN p_payload?'questions' THEN p_payload->'questions' ELSE perguntas END,classificacao=CASE WHEN p_payload?'classification' THEN p_payload->'classification' ELSE classificacao END,fases=CASE WHEN p_payload?'phases' THEN p_payload->'phases' ELSE fases END,"tipoCalculo"=COALESCE(nullif(p_payload->>'calculation_type',''),"tipoCalculo"),status='rascunho',ativo=false,"publicadoEm"=NULL,versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    ELSIF p_action='publish' THEN
      UPDATE public.formularios SET status='publicado',ativo=true,"publicadoEm"=now(),versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    ELSE
      SELECT * INTO source_version FROM public.internal_form_versions WHERE form_id=target_id AND version=(p_payload->>'version')::integer;
      IF source_version.id IS NULL THEN RAISE EXCEPTION 'form_version_not_found'; END IF;
      UPDATE public.formularios SET titulo=source_version.snapshot->>'titulo',descricao=source_version.snapshot->>'descricao',perguntas=COALESCE(source_version.snapshot->'perguntas','[]'::jsonb),classificacao=source_version.snapshot->'classificacao',fases=source_version.snapshot->'fases',"tipoCalculo"=source_version.snapshot->>'tipoCalculo',status='publicado',ativo=true,"publicadoEm"=now(),versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    END IF;
  END IF;
  INSERT INTO public.internal_form_versions(form_id,version,status,snapshot,created_by,reason) VALUES(target.id,target.versao,CASE WHEN target.status='publicado' THEN 'publicado' ELSE 'rascunho' END,to_jsonb(target),actor,left(trim(p_reason),500));
  v_result:=jsonb_build_object('ok',true,'form_id',target.id,'version',target.versao,'status',target.status);
  UPDATE public.internal_operations SET status='succeeded',result=v_result,completed_at=now() WHERE actor_id=actor AND operation_id=p_operation_id;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata) VALUES(actor,private.current_internal_role(actor),'form.'||p_action,'form',target.id::text,'allowed',left(trim(p_reason),500),jsonb_build_object('version',target.versao,'status',target.status));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_risk_configs()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('municipality',m.municipality,'published',r.configuracao,'updated_at',r.atualizado_em,'versions',COALESCE((SELECT jsonb_agg(jsonb_build_object('version',v.version,'status',v.status,'configuration',v.configuration,'reason',v.reason,'created_at',v.created_at) ORDER BY v.version DESC) FROM public.internal_risk_config_versions v WHERE v.municipality=m.municipality),'[]'::jsonb)) ORDER BY m.municipality),'[]'::jsonb) INTO result
  FROM (SELECT municipio municipality FROM public.risk_configs UNION SELECT municipality FROM public.internal_risk_config_versions) m LEFT JOIN public.risk_configs r ON r.municipio=m.municipality;
  RETURN result;
END;$$;

CREATE OR REPLACE FUNCTION public.simulate_internal_risk_config(p_configuration jsonb,p_score numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.has_internal_permission('technical.read') THEN RAISE EXCEPTION 'technical_read_not_allowed' USING ERRCODE='42501'; END IF;
  IF NOT private.valid_internal_risk_configuration(p_configuration) THEN RAISE EXCEPTION 'invalid_risk_configuration'; END IF;
  SELECT item INTO result FROM jsonb_array_elements(p_configuration) item WHERE p_score BETWEEN (item->>'minPontos')::numeric AND (item->>'maxPontos')::numeric ORDER BY (item->>'minPontos')::numeric LIMIT 1;
  RETURN COALESCE(result,jsonb_build_object('nivel','unclassified','label','Fora dos intervalos','score',p_score));
END;$$;

CREATE OR REPLACE FUNCTION public.mutate_internal_risk_config(p_municipality text,p_action text,p_configuration jsonb,p_target_version integer,p_reason text,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); v_request_hash text; v_result jsonb; selected_config jsonb; next_version integer;
BEGIN
  IF p_action IN ('publish','rollback') THEN
    IF NOT private.has_internal_permission('configuration.publish',actor) THEN RAISE EXCEPTION 'risk_publish_not_allowed' USING ERRCODE='42501'; END IF;
    IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
  ELSIF NOT private.has_internal_permission('configuration.prepare',actor) AND NOT private.has_internal_permission('configuration.publish',actor) THEN RAISE EXCEPTION 'risk_prepare_not_allowed' USING ERRCODE='42501'; END IF;
  IF p_action NOT IN ('save_draft','publish','rollback') OR char_length(trim(p_municipality))<2 THEN RAISE EXCEPTION 'invalid_risk_action'; END IF;
  IF char_length(trim(p_reason))<8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_action='rollback' THEN SELECT configuration INTO selected_config FROM public.internal_risk_config_versions WHERE municipality=trim(p_municipality) AND version=p_target_version;
  ELSE selected_config:=p_configuration; END IF;
  IF NOT private.valid_internal_risk_configuration(selected_config) THEN RAISE EXCEPTION 'invalid_risk_configuration'; END IF;
  v_request_hash:=md5(concat_ws('|',p_municipality,p_action,selected_config::text,p_target_version,p_reason));
  SELECT io.result INTO v_result FROM public.internal_operations io WHERE io.actor_id=actor AND io.operation_id=p_operation_id AND io.request_hash=v_request_hash;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  INSERT INTO public.internal_operations(operation_id,actor_id,action,request_hash) VALUES(p_operation_id,actor,'risk.'||p_action,v_request_hash);
  SELECT COALESCE(max(version),0)+1 INTO next_version FROM public.internal_risk_config_versions WHERE municipality=trim(p_municipality);
  IF p_action IN ('publish','rollback') THEN
    UPDATE public.internal_risk_config_versions SET status='retired' WHERE municipality=trim(p_municipality) AND status='published';
    INSERT INTO public.risk_configs(municipio,configuracao,atualizado_por,atualizado_em) VALUES(trim(p_municipality),selected_config,actor,now()) ON CONFLICT(municipio) DO UPDATE SET configuracao=EXCLUDED.configuracao,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now();
  END IF;
  INSERT INTO public.internal_risk_config_versions(municipality,version,status,configuration,created_by,reason) VALUES(trim(p_municipality),next_version,CASE WHEN p_action='save_draft' THEN 'draft' ELSE 'published' END,selected_config,actor,left(trim(p_reason),500));
  v_result:=jsonb_build_object('ok',true,'municipality',trim(p_municipality),'version',next_version,'status',CASE WHEN p_action='save_draft' THEN 'draft' ELSE 'published' END);
  UPDATE public.internal_operations SET status='succeeded',result=v_result,completed_at=now() WHERE actor_id=actor AND operation_id=p_operation_id;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata) VALUES(actor,private.current_internal_role(actor),'risk.'||p_action,'risk_config',trim(p_municipality),'allowed',left(trim(p_reason),500),jsonb_build_object('version',next_version));
  RETURN v_result;
END;$$;

REVOKE ALL ON FUNCTION private.valid_internal_risk_configuration(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.list_internal_forms(),public.mutate_internal_form(text,text,jsonb,text,uuid),public.list_internal_risk_configs(),public.simulate_internal_risk_config(jsonb,numeric),public.mutate_internal_risk_config(text,text,jsonb,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_internal_forms(),public.mutate_internal_form(text,text,jsonb,text,uuid),public.list_internal_risk_configs(),public.simulate_internal_risk_config(jsonb,numeric),public.mutate_internal_risk_config(text,text,jsonb,integer,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
