-- Gestão web de formulários e evidências de ciência.
-- Mídias de formulário são públicas por definição funcional: apenas imagens de
-- referência de cards publicados são armazenadas aqui; nenhum dado pessoal é aceito.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('form-media', 'form-media', true, 4194304, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS form_media_internal_upload ON storage.objects;
CREATE POLICY form_media_internal_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'form-media'
    AND (
      private.has_internal_permission('configuration.prepare')
      OR private.has_internal_permission('configuration.publish')
    )
  );

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
BEGIN
  IF p_action IN ('publish','rollback','deactivate') THEN
    IF NOT private.has_internal_permission('configuration.publish',actor) THEN RAISE EXCEPTION 'form_publish_not_allowed' USING ERRCODE='42501'; END IF;
    IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
  ELSIF NOT private.has_internal_permission('configuration.prepare',actor) AND NOT private.has_internal_permission('configuration.publish',actor) THEN
    RAISE EXCEPTION 'form_prepare_not_allowed' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('create','save_draft','publish','rollback','deactivate') THEN RAISE EXCEPTION 'invalid_form_action'; END IF;
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
    ELSIF p_action='deactivate' THEN
      UPDATE public.formularios SET status='suspenso',ativo=false,versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    ELSE
      SELECT * INTO source_version FROM public.internal_form_versions WHERE form_id=target_id AND version=(p_payload->>'version')::integer;
      IF source_version.id IS NULL THEN RAISE EXCEPTION 'form_version_not_found'; END IF;
      UPDATE public.formularios SET titulo=source_version.snapshot->>'titulo',descricao=source_version.snapshot->>'descricao',perguntas=COALESCE(source_version.snapshot->'perguntas','[]'::jsonb),classificacao=source_version.snapshot->'classificacao',fases=source_version.snapshot->'fases',"tipoCalculo"=source_version.snapshot->>'tipoCalculo',status='publicado',ativo=true,"publicadoEm"=now(),versao=next_version,"atualizadoEm"=now() WHERE id=target_id RETURNING * INTO target;
    END IF;
  END IF;
  INSERT INTO public.internal_form_versions(form_id,version,status,snapshot,created_by,reason) VALUES(target.id,target.versao,CASE WHEN target.status='publicado' THEN 'publicado' ELSE 'rascunho' END,to_jsonb(target),actor,left(trim(p_reason),500));
  v_result:=jsonb_build_object('ok',true,'form_id',target.id,'version',target.versao,'status',target.status,'active',target.ativo);
  UPDATE public.internal_operations SET status='succeeded',result=v_result,completed_at=now() WHERE actor_id=actor AND operation_id=p_operation_id;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata) VALUES(actor,private.current_internal_role(actor),'form.'||p_action,'form',target.id::text,'allowed',left(trim(p_reason),500),jsonb_build_object('version',target.versao,'status',target.status,'active',target.ativo));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_list_acknowledgements()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_context jsonb; v_org uuid; v_result jsonb;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT ((v_context->'permissions') ? 'document.read') THEN RAISE EXCEPTION 'document_read_not_allowed' USING ERRCODE='42501'; END IF;
  v_org := NULLIF(v_context->>'organization_id','')::uuid;
  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'created_at' DESC),'[]'::jsonb) INTO v_result FROM (
    SELECT jsonb_build_object(
      'id', document.id,
      'acknowledgement_id', event.id,
      'title', COALESCE(inspection.protocolo, event.protocol, document.id::text),
      'subtitle', COALESCE(event.recipient_name, 'Aguardando destinatário'),
      'status', CASE WHEN event.id IS NOT NULL THEN event.outcome WHEN request.id IS NOT NULL AND request.status='open' THEN 'link_sent' ELSE 'pending' END,
      'inspection_protocol', inspection.protocolo,
      'recipient_name', event.recipient_name,
      'recipient_relationship', event.recipient_relationship,
      'created_at', COALESCE(event.recorded_at_server, document.created_at),
      'outcome', event.outcome,
      'reason', event.reason,
      'document_available', true,
      'signature_available', event.outcome='acknowledged' AND event.signature_storage_path IS NOT NULL,
      'acknowledged_at', event.recorded_at_server
    ) AS item
    FROM public.generated_documents document
    JOIN public.vistorias inspection ON inspection.id=document.vistoria_id
    LEFT JOIN LATERAL (
      SELECT * FROM public.document_acknowledgement_events outcome
      WHERE outcome.document_id=document.id AND outcome.event_kind='outcome'
      ORDER BY outcome.recorded_at_server DESC LIMIT 1
    ) event ON true
    LEFT JOIN LATERAL (
      SELECT * FROM public.document_acknowledgement_requests open_request
      WHERE open_request.document_id=document.id AND open_request.status='open'
      ORDER BY open_request.created_at DESC LIMIT 1
    ) request ON true
    WHERE document.training_mode=false AND document.status='available' AND (
      (v_org IS NULL AND document.organization_id IS NULL AND document.owner_user_id=v_user)
      OR (v_org IS NOT NULL AND document.organization_id=v_org AND private.portal_agent_allowed(v_org, document.owner_user_id::text, v_user))
    )
    ORDER BY COALESCE(event.recorded_at_server, document.created_at) DESC LIMIT 100
  ) scoped;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_authorize_acknowledgement_document(p_event_id uuid, p_asset text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_context jsonb; v_org uuid; v_event public.document_acknowledgement_events; v_document public.generated_documents; v_path text; v_filename text;
BEGIN
  IF p_asset NOT IN ('document','signature') THEN RAISE EXCEPTION 'invalid_acknowledgement_asset' USING ERRCODE='22023'; END IF;
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT ((v_context->'permissions') ? 'document.read') THEN RAISE EXCEPTION 'document_read_not_allowed' USING ERRCODE='42501'; END IF;
  v_org := NULLIF(v_context->>'organization_id','')::uuid;
  SELECT * INTO v_event FROM public.document_acknowledgement_events WHERE id=p_event_id AND event_kind='outcome';
  IF NOT FOUND OR NOT ((v_org IS NULL AND v_event.organization_id IS NULL AND v_event.owner_user_id=v_user) OR (v_org IS NOT NULL AND v_event.organization_id=v_org AND private.portal_agent_allowed(v_org,v_event.owner_user_id::text,v_user))) THEN RAISE EXCEPTION 'acknowledgement_not_found' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_document FROM public.generated_documents WHERE id=v_event.document_id AND status='available' AND training_mode=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'document_not_found' USING ERRCODE='P0002'; END IF;
  IF p_asset='signature' THEN
    IF v_event.outcome <> 'acknowledged' OR v_event.signature_storage_path IS NULL THEN RAISE EXCEPTION 'signature_not_available' USING ERRCODE='P0002'; END IF;
    v_path:=v_event.signature_storage_path; v_filename:=COALESCE(v_event.protocol,'ciencia') || '-assinatura.json';
  ELSE
    v_path:=v_document.storage_path; v_filename:=COALESCE(v_event.protocol,'ciencia') || '-documento.pdf';
  END IF;
  IF v_path LIKE '/%' OR position('..' in v_path)>0 THEN RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('bucket','document-evidence','path',v_path,'filename',v_filename,'expires_in',60,'asset',p_asset);
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_internal_form(text,text,jsonb,text,uuid), public.portal_list_acknowledgements(), public.portal_authorize_acknowledgement_document(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_internal_form(text,text,jsonb,text,uuid), public.portal_list_acknowledgements(), public.portal_authorize_acknowledgement_document(uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
