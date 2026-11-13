-- Explicit media completeness; a protocol is not proof that all photos arrived.
ALTER TABLE public.vistorias ADD COLUMN IF NOT EXISTS media_manifest jsonb;
ALTER TABLE public.generated_documents ADD COLUMN IF NOT EXISTS issuance_status text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.generated_documents ADD COLUMN IF NOT EXISTS media_revision bigint;

CREATE OR REPLACE FUNCTION private.can_access_document_scope(p_organization_id uuid,p_owner_user_id uuid,p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(p_user_id IS NOT NULL AND (p_owner_user_id=p_user_id
  OR (p_organization_id IS NOT NULL AND p_organization_id=private.current_organization_id(p_user_id))
  OR coalesce(private.is_owner_admin(p_user_id),false) OR coalesce(private.current_internal_role(p_user_id)='owner',false)),false);
$$;

CREATE OR REPLACE FUNCTION private.validate_inspection_media_manifest(p_manifest jsonb,p_inspection_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; n integer; available integer:=0; ids text[]:='{}'; positions text[]:='{}';
BEGIN
  IF p_manifest IS NULL OR jsonb_typeof(p_manifest)<>'object' OR (p_manifest->>'version') IS DISTINCT FROM '1'
    OR jsonb_typeof(p_manifest->'items') IS DISTINCT FROM 'array' OR coalesce(p_manifest->>'revision','') !~ '^[0-9]{1,16}$'
    OR coalesce(p_manifest->>'expected','') !~ '^[0-3]$' OR coalesce(p_manifest->>'available','') !~ '^[0-3]$' THEN
    RAISE EXCEPTION 'invalid_media_manifest' USING ERRCODE='22023';
  END IF;
  n:=jsonb_array_length(p_manifest->'items');
  IF n>3 THEN RAISE EXCEPTION 'maximum_three_inspection_photos' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_manifest->'items') LOOP
    IF nullif(item->>'id','') IS NULL OR (item->>'id')=ANY(ids) OR (item->>'position')=ANY(positions) OR coalesce(item->>'position','') !~ '^[0-2]$' OR coalesce(item->>'state','') NOT IN ('pending','failed','available','removed') THEN
      RAISE EXCEPTION 'invalid_media_item' USING ERRCODE='22023';
    END IF;
    ids:=array_append(ids,item->>'id');
    positions:=array_append(positions,item->>'position');
    IF item->>'state'='available' THEN
      IF coalesce(item->>'storagePath','') !~ '^fotos:[^/][^[:cntrl:]]*$' OR position('..' in item->>'storagePath')>0
        OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='fotos' AND name=substring(item->>'storagePath' FROM 7) AND (position('/'||p_inspection_id::text||'/' in '/'||name)>0
          OR EXISTS(SELECT 1 FROM public.vistorias old WHERE old.id=p_inspection_id AND (old."fotoUrl"=item->>'storagePath' OR (item->>'storagePath')=ANY(coalesce(old."fotosUrls",'{}'::text[])))))) THEN
        RAISE EXCEPTION 'media_file_missing_or_invalid' USING ERRCODE='22023';
      END IF;
      available:=available+1;
    ELSIF nullif(item->>'storagePath','') IS NOT NULL THEN
      RAISE EXCEPTION 'pending_media_must_not_have_path' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF (p_manifest->>'expected')::integer<>(SELECT count(*) FROM jsonb_array_elements(p_manifest->'items') i WHERE i->>'state'<>'removed')
    OR (p_manifest->>'available')::integer<>available THEN RAISE EXCEPTION 'media_count_mismatch' USING ERRCODE='22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_inspection_media_manifest(jsonb,uuid) FROM PUBLIC,anon,authenticated;

-- Keep protocol allocation and subscription checks; add media updates even when
-- the allocator returns an already allocated protocol on an idempotent retry.
ALTER FUNCTION public.sync_finalized_inspection(jsonb) SET SCHEMA private;
ALTER FUNCTION private.sync_finalized_inspection(jsonb) RENAME TO sync_finalized_inspection_before_media;
REVOKE ALL ON FUNCTION private.sync_finalized_inspection_before_media(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sync_finalized_inspection(p_inspection jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; v public.vistorias%ROWTYPE; m jsonb:=p_inspection->'media_manifest'; paths text[];
BEGIN
  IF m IS NOT NULL THEN PERFORM private.validate_inspection_media_manifest(m,(p_inspection->>'id')::uuid); END IF;
  result:=private.sync_finalized_inspection_before_media(p_inspection-'media_manifest');
  SELECT * INTO v FROM public.vistorias WHERE id=(result->>'inspection_id')::uuid FOR UPDATE;
  IF v."agenteUid"::text IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'inspection_actor_mismatch' USING ERRCODE='42501'; END IF;
  IF m IS NOT NULL THEN
    IF v.media_manifest IS NOT NULL AND m ? 'base_revision' AND (m->>'revision')::bigint IS DISTINCT FROM (v.media_manifest->>'revision')::bigint
      AND nullif(m->>'base_revision','')::bigint IS DISTINCT FROM (v.media_manifest->>'revision')::bigint THEN
      RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001';
    END IF;
    IF v.media_manifest IS NOT NULL AND (m->>'revision')::bigint<(v.media_manifest->>'revision')::bigint THEN
      RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001';
    END IF;
    SELECT coalesce(array_agg(i->>'storagePath' ORDER BY (i->>'position')::integer),'{}'::text[]) INTO paths
    FROM jsonb_array_elements(m->'items') i WHERE i->>'state'='available';
    UPDATE public.vistorias SET media_manifest=m,"fotoUrl"=paths[1],"fotosUrls"=nullif(paths[2:cardinality(paths)],'{}'::text[]) WHERE id=v.id;
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_finalized_inspection(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_finalized_inspection(jsonb) TO authenticated;

CREATE FUNCTION public.get_inspection_media_status(p_inspection_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vistorias%ROWTYPE; expected integer; available integer;
BEGIN
  SELECT * INTO v FROM public.vistorias WHERE id=p_inspection_id;
  IF auth.uid() IS NULL OR v.id IS NULL OR private.can_access_document_scope(v.organization_id,nullif(v."agenteUid"::text,'')::uuid) IS NOT TRUE THEN
    RAISE EXCEPTION 'inspection_scope_denied' USING ERRCODE='42501';
  END IF;
  expected:=CASE WHEN v.media_manifest IS NOT NULL THEN (v.media_manifest->>'expected')::integer END;
  available:=CASE WHEN v.media_manifest IS NOT NULL THEN (v.media_manifest->>'available')::integer
    ELSE (SELECT count(DISTINCT p) FROM unnest(array_prepend(v."fotoUrl",coalesce(v."fotosUrls",'{}'::text[]))) p WHERE p IS NOT NULL) END;
  RETURN jsonb_build_object('expected_count',expected,'available_count',available,'pending_count',CASE WHEN expected IS NOT NULL THEN greatest(0,expected-available) END,
    'complete',expected IS NOT NULL AND expected=available,'revision',v.media_manifest->'revision','manifest',v.media_manifest,
    'waiver_reason',(SELECT reason FROM public.inspection_media_waivers WHERE inspection_id=v.id AND media_revision=(v.media_manifest->>'revision')::bigint));
END;
$$;
REVOKE ALL ON FUNCTION public.get_inspection_media_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_inspection_media_status(uuid) TO authenticated;

ALTER FUNCTION public.get_internal_protocol_inspection(uuid) SET SCHEMA private;
ALTER FUNCTION private.get_internal_protocol_inspection(uuid) RENAME TO get_internal_protocol_inspection_before_media;
REVOKE ALL ON FUNCTION private.get_internal_protocol_inspection_before_media(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_internal_protocol_inspection(p_inspection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  result:=private.get_internal_protocol_inspection_before_media(p_inspection_id);
  RETURN result||jsonb_build_object('media_status',public.get_inspection_media_status(p_inspection_id),'agent_uid',(SELECT "agenteUid"::text FROM public.vistorias WHERE id=p_inspection_id));
END;
$$;
REVOKE ALL ON FUNCTION public.get_internal_protocol_inspection(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_internal_protocol_inspection(uuid) TO authenticated;

DROP FUNCTION public.update_inspection_media(uuid,text,text[]);
CREATE FUNCTION public.update_inspection_media(p_inspection_id uuid,p_primary_photo text DEFAULT NULL,p_extra_photos text[] DEFAULT NULL,p_media_manifest jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vistorias%ROWTYPE; paths text[]:=array_remove(array_prepend(p_primary_photo,coalesce(p_extra_photos,'{}'::text[])),NULL); m jsonb:=p_media_manifest; actor_role text; actor_municipio text;
BEGIN
  SELECT * INTO v FROM public.vistorias WHERE id=p_inspection_id FOR UPDATE;
  SELECT role,municipio INTO actor_role,actor_municipio FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF auth.uid() IS NULL OR v.id IS NULL OR NOT coalesce((v."agenteUid"::text=auth.uid()::text OR private.current_internal_role(auth.uid())='owner'
    OR actor_role='master_admin' OR (actor_role='admin' AND v.municipio=actor_municipio)),false) THEN
    RAISE EXCEPTION 'inspection_not_found_or_forbidden' USING ERRCODE='42501';
  END IF;
  IF cardinality(paths)>3 THEN RAISE EXCEPTION 'maximum_three_inspection_photos' USING ERRCODE='22023'; END IF;
  IF m IS NULL THEN
    SELECT jsonb_build_object('version',1,'revision',greatest(floor(extract(epoch FROM clock_timestamp())*1000)::bigint,coalesce((v.media_manifest->>'revision')::bigint,0)+1),
      'expected',cardinality(paths),'available',cardinality(paths),'items',coalesce(jsonb_agg(jsonb_build_object('id',v.id::text||':photo:'||(ord-1),'position',ord-1,'state','available','storagePath',path)),'[]'::jsonb)) INTO m
    FROM unnest(paths) WITH ORDINALITY t(path,ord);
  END IF;
  PERFORM private.validate_inspection_media_manifest(m,p_inspection_id);
  IF v.media_manifest IS NOT NULL AND m ? 'base_revision' AND (m->>'revision')::bigint IS DISTINCT FROM (v.media_manifest->>'revision')::bigint
    AND nullif(m->>'base_revision','')::bigint IS DISTINCT FROM (v.media_manifest->>'revision')::bigint THEN
    RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001';
  END IF;
  IF v.media_manifest IS NOT NULL AND (m->>'revision')::bigint<(v.media_manifest->>'revision')::bigint THEN RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001'; END IF;
  IF ARRAY(SELECT i->>'storagePath' FROM jsonb_array_elements(m->'items') i WHERE i->>'state'='available' ORDER BY (i->>'position')::integer) IS DISTINCT FROM paths THEN
    RAISE EXCEPTION 'media_paths_mismatch' USING ERRCODE='22023';
  END IF;
  UPDATE public.vistorias SET "fotoUrl"=p_primary_photo,"fotosUrls"=nullif(p_extra_photos,'{}'::text[]),media_manifest=m WHERE id=v.id;
  IF private.current_internal_role(auth.uid()) IS NOT NULL THEN
    INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,metadata)
    VALUES(auth.uid(),private.current_internal_role(auth.uid()),'inspection.media.update','inspection',v.id::text,'allowed',jsonb_build_object('revision',m->'revision','available',m->'available','expected',m->'expected'));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_inspection_media(uuid,text,text[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_inspection_media(uuid,text,text[],jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Existing immutable document can be acknowledged by another authorized collector.
CREATE OR REPLACE FUNCTION private.finalize_document_acknowledgement(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_document_id uuid := nullif(p_payload->>'document_id','')::uuid;
  v_client_event_id uuid := nullif(p_payload->>'client_event_id','')::uuid;
  v_vistoria_id uuid := nullif(p_payload->>'vistoria_id','')::uuid;
  v_event_id uuid := nullif(p_payload->>'event_id','')::uuid;
  v_existing public.document_acknowledgement_events%ROWTYPE;
  v_vistoria public.vistorias%ROWTYPE;
  v_document public.generated_documents%ROWTYPE;
  v_org uuid;
  v_outcome text := p_payload->>'outcome';
  v_signature jsonb := p_payload->'signature_strokes';
  v_witness jsonb := p_payload->'witness';
  v_storage_path text := p_payload->>'storage_path';
  v_signature_path text := nullif(p_payload->>'signature_storage_path','');
  v_protocol text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_document_id IS NULL OR v_client_event_id IS NULL OR v_vistoria_id IS NULL OR v_event_id IS NULL THEN
    RAISE EXCEPTION 'invalid_identifiers' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
    FROM public.document_acknowledgement_events
   WHERE client_event_id = v_client_event_id;
  IF FOUND THEN
    IF v_existing.created_by <> v_user OR v_existing.document_id <> v_document_id OR v_existing.id <> v_event_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'event_id', v_existing.id,
      'protocol', v_existing.protocol,
      'recorded_at_server', v_existing.recorded_at_server,
      'signature_storage_path', v_existing.signature_storage_path,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_vistoria FROM public.vistorias WHERE id = v_vistoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002'; END IF;
  v_org := v_vistoria.organization_id;

  IF private.can_access_document_scope(v_org,nullif(v_vistoria."agenteUid"::text,'')::uuid,v_user) IS NOT TRUE THEN
    RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501';
  END IF;

  IF p_payload->>'document_type' NOT IN ('report','technical_report','interdiction_term')
     OR coalesce((p_payload->>'training_mode')::boolean, false)
     OR coalesce((p_payload->>'document_version')::integer, 0) <= 0
     OR coalesce(p_payload->>'content_hash','') !~ '^[0-9a-f]{64}$'
     OR coalesce(p_payload->>'pdf_hash','') !~ '^[0-9a-f]{64}$'
     OR coalesce((p_payload->>'byte_size')::bigint, 0) NOT BETWEEN 1 AND 20971520 THEN
    RAISE EXCEPTION 'invalid_document_payload' USING ERRCODE = '22023';
  END IF;
  IF position(v_user::text || '/' in v_storage_path) <> 1 AND NOT EXISTS (SELECT 1 FROM public.generated_documents d WHERE d.id=v_document_id AND d.vistoria_id=v_vistoria_id AND d.storage_path=v_storage_path AND private.can_access_document_scope(d.organization_id,d.owner_user_id,v_user)) THEN
    RAISE EXCEPTION 'invalid_storage_scope' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
     WHERE bucket_id = 'document-evidence' AND name = v_storage_path
  ) THEN
    RAISE EXCEPTION 'document_object_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.generated_documents WHERE id=v_document_id) THEN
    PERFORM public.register_generated_document(p_payload);
  END IF;

  INSERT INTO public.generated_documents(
    id, vistoria_id, organization_id, owner_user_id, document_type,
    document_version, template_version, content_snapshot, content_hash,
    pdf_hash, storage_path, byte_size, supersedes_id, training_mode,
    created_by, created_at_device
  ) VALUES (
    v_document_id, v_vistoria_id, v_org, v_user, p_payload->>'document_type',
    (p_payload->>'document_version')::integer, p_payload->>'template_version',
    p_payload->'content_snapshot', p_payload->>'content_hash', p_payload->>'pdf_hash',
    v_storage_path, (p_payload->>'byte_size')::bigint,
    nullif(p_payload->>'supersedes_id','')::uuid, coalesce((p_payload->>'training_mode')::boolean,false),
    v_user, (p_payload->>'document_created_at_device')::timestamptz
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_document FROM public.generated_documents WHERE id = v_document_id;
  IF NOT FOUND OR private.can_access_document_scope(v_document.organization_id,v_document.owner_user_id,v_user) IS NOT TRUE OR v_document.vistoria_id <> v_vistoria_id
     OR v_document.content_hash <> p_payload->>'content_hash'
     OR v_document.pdf_hash <> p_payload->>'pdf_hash' THEN
    RAISE EXCEPTION 'document_identity_conflict' USING ERRCODE = '23505';
  END IF;

  UPDATE public.generated_documents
     SET status = 'superseded'
   WHERE vistoria_id = v_vistoria_id AND document_type = v_document.document_type
     AND id <> v_document_id AND document_version < v_document.document_version
     AND status <> 'superseded';

  IF v_outcome NOT IN ('acknowledged','refused','unable_to_sign')
     OR length(btrim(coalesce(p_payload->>'recipient_name',''))) < 2
     OR length(btrim(coalesce(p_payload->>'recipient_relationship',''))) < 2
     OR length(btrim(coalesce(p_payload->>'declaration_text',''))) < 20
     OR coalesce(p_payload->>'declaration_hash','') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_acknowledgement_payload' USING ERRCODE = '22023';
  END IF;
  IF encode(extensions.digest(convert_to(
       '{"text":' || to_jsonb(p_payload->>'declaration_text')::text ||
       ',"version":' || to_jsonb(p_payload->>'declaration_version')::text || '}',
       'UTF8'
     ), 'sha256'), 'hex') <> p_payload->>'declaration_hash' THEN
    RAISE EXCEPTION 'declaration_hash_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_outcome = 'acknowledged' THEN
    IF v_signature IS NULL OR jsonb_typeof(v_signature) <> 'array'
       OR jsonb_array_length(v_signature) = 0
       OR coalesce(p_payload->>'signature_hash','') !~ '^[0-9a-f]{64}$'
       OR v_signature_path IS NULL OR position(v_user::text || '/' in v_signature_path) <> 1
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects
          WHERE bucket_id = 'document-evidence' AND name = v_signature_path
       ) THEN
      RAISE EXCEPTION 'signature_required' USING ERRCODE = '22023';
    END IF;
  ELSIF length(btrim(coalesce(p_payload->>'reason',''))) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF coalesce((p_payload->>'witness_required')::boolean,false)
     AND length(btrim(coalesce(v_witness->>'name',''))) < 2 THEN
    RAISE EXCEPTION 'witness_required' USING ERRCODE = '22023';
  END IF;

  v_protocol := 'TCS-CIE-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(v_event_id::text, '-', ''), 1, 8));

  INSERT INTO public.document_acknowledgement_events(
    id, client_event_id, document_id, organization_id, owner_user_id,
    event_kind, outcome, declaration_version, declaration_text,
    declaration_hash, recipient_name, recipient_relationship,
    signature_strokes, signature_hash, signature_storage_path, reason,
    witness, occurred_at_device, device_id_hash, created_by, protocol
  ) VALUES (
    v_event_id, v_client_event_id, v_document_id, v_org, v_user,
    'outcome', v_outcome, p_payload->>'declaration_version',
    p_payload->>'declaration_text', p_payload->>'declaration_hash',
    btrim(p_payload->>'recipient_name'), btrim(p_payload->>'recipient_relationship'),
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN p_payload->>'signature_hash' ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature_path ELSE NULL END,
    CASE WHEN v_outcome <> 'acknowledged' THEN btrim(p_payload->>'reason') ELSE NULL END,
    CASE WHEN v_witness IS NULL OR v_witness = 'null'::jsonb THEN NULL ELSE v_witness END,
    (p_payload->>'occurred_at_device')::timestamptz,
    nullif(p_payload->>'device_id_hash',''), v_user, v_protocol
  );

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'protocol', v_protocol,
    'recorded_at_server', (SELECT recorded_at_server FROM public.document_acknowledgement_events WHERE id = v_event_id),
    'signature_storage_path', CASE WHEN v_outcome = 'acknowledged' THEN v_signature_path ELSE NULL END,
    'idempotent', false
  );
END;
$$;
REVOKE ALL ON FUNCTION private.finalize_document_acknowledgement(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.register_generated_document_before_issuance(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_document_id uuid := nullif(p_payload->>'document_id', '')::uuid;
  v_vistoria_id uuid := nullif(p_payload->>'vistoria_id', '')::uuid;
  v_document public.generated_documents%ROWTYPE;
  v_vistoria public.vistorias%ROWTYPE;
  v_storage_path text := nullif(p_payload->>'storage_path', '');
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_document_id IS NULL OR v_vistoria_id IS NULL
     OR p_payload->>'document_type' NOT IN ('report', 'technical_report', 'interdiction_term')
     OR coalesce((p_payload->>'document_version')::integer, 0) <= 0
     OR coalesce(p_payload->>'content_hash', '') !~ '^[0-9a-f]{64}$'
     OR coalesce(p_payload->>'pdf_hash', '') !~ '^[0-9a-f]{64}$'
     OR coalesce((p_payload->>'byte_size')::bigint, 0) NOT BETWEEN 1 AND 20971520
     OR coalesce((p_payload->>'training_mode')::boolean, false)
     OR v_storage_path IS NULL
  THEN RAISE EXCEPTION 'invalid_document_payload' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_vistoria FROM public.vistorias WHERE id = v_vistoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002'; END IF;
  v_org := v_vistoria.organization_id;
  IF private.can_access_document_scope(v_org,nullif(v_vistoria."agenteUid"::text,'')::uuid,v_user) IS NOT TRUE
  THEN RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501'; END IF;
  IF position(v_user::text || '/' in v_storage_path) <> 1
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'document-evidence' AND name = v_storage_path)
  THEN RAISE EXCEPTION 'invalid_storage_scope' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.generated_documents(
    id, vistoria_id, organization_id, owner_user_id, document_type, document_version,
    template_version, content_snapshot, content_hash, pdf_hash, storage_path, byte_size,
    supersedes_id, training_mode, created_by, created_at_device
  ) VALUES (
    v_document_id, v_vistoria_id, v_org, v_user, p_payload->>'document_type',
    (p_payload->>'document_version')::integer, p_payload->>'template_version',
    p_payload->'content_snapshot', p_payload->>'content_hash', p_payload->>'pdf_hash',
    v_storage_path, (p_payload->>'byte_size')::bigint, nullif(p_payload->>'supersedes_id', '')::uuid,
    false, v_user, (p_payload->>'document_created_at_device')::timestamptz
  ) ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_document FROM public.generated_documents WHERE id = v_document_id;
  IF NOT FOUND OR v_document.vistoria_id <> v_vistoria_id OR v_document.created_by <> v_user
     OR v_document.content_hash <> p_payload->>'content_hash' OR v_document.pdf_hash <> p_payload->>'pdf_hash'
  THEN RAISE EXCEPTION 'document_identity_conflict' USING ERRCODE = '23505'; END IF;

  UPDATE public.generated_documents
     SET status = 'superseded'
   WHERE vistoria_id = v_vistoria_id AND document_type = v_document.document_type
     AND id <> v_document_id AND document_version < v_document.document_version AND status <> 'superseded';

  RETURN jsonb_build_object('document_id', v_document.id, 'status', v_document.status);
END;
$$;
REVOKE ALL ON FUNCTION private.register_generated_document_before_issuance(jsonb) FROM PUBLIC,anon,authenticated;

CREATE TABLE public.inspection_media_waivers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.vistorias(id),
  media_revision bigint NOT NULL,
  reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 8 AND 1000),
  created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspection_id,media_revision)
);
ALTER TABLE public.inspection_media_waivers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inspection_media_waivers FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.waive_inspection_missing_media(p_inspection_id uuid,p_reason text,p_media_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vistorias%ROWTYPE; r text; m text;
BEGIN
  SELECT * INTO v FROM public.vistorias WHERE id=p_inspection_id FOR UPDATE;
  SELECT role,municipio INTO r,m FROM public.users WHERE uid=auth.uid() AND "isApproved" IS TRUE;
  IF auth.uid() IS NULL OR v.id IS NULL OR NOT coalesce((private.current_internal_role(auth.uid())='owner' OR r='master_admin' OR (r IN ('admin','supervisor') AND m=v.municipio)),false) THEN
    RAISE EXCEPTION 'media_waiver_not_allowed' USING ERRCODE='42501'; END IF;
  IF v.media_manifest IS NULL OR p_media_revision IS DISTINCT FROM (v.media_manifest->>'revision')::bigint THEN RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001'; END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 1000 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.inspection_media_waivers(inspection_id,media_revision,reason,created_by) VALUES(v.id,p_media_revision,btrim(p_reason),auth.uid()) ON CONFLICT(inspection_id,media_revision) DO NOTHING;
  RETURN jsonb_build_object('ok',true,'media_revision',p_media_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.waive_inspection_missing_media(uuid,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.waive_inspection_missing_media(uuid,text,bigint) TO authenticated;

CREATE FUNCTION private.has_renderable_technical_signature(p_strokes jsonb,p_image text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE stroke jsonb; point jsonb; first_point jsonb; has_ink boolean:=false; bytes bytea; image_hex text; width bigint; height bigint;
BEGIN
  -- The PDF builder prefers an uploaded image when one is supplied. Do not
  -- accept invalid image markup merely because a different stroke is valid.
  IF nullif(p_image,'') IS NOT NULL THEN
    IF length(p_image)>7000000 OR p_image !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$' THEN RETURN false; END IF;
    bytes:=decode(split_part(p_image,',',2),'base64');
    IF octet_length(bytes)<128 OR octet_length(bytes)>5242880 THEN RETURN false; END IF;
    image_hex:=encode(bytes,'hex');
    IF p_image LIKE 'data:image/png;%' THEN
      IF left(image_hex,16)<>'89504e470d0a1a0a' OR substring(image_hex FROM 25 FOR 8)<>'49484452'
        OR right(image_hex,24)<>'0000000049454e44ae426082' OR position('49444154' in image_hex)=0 THEN RETURN false; END IF;
      width:=get_byte(bytes,16)::bigint*16777216+get_byte(bytes,17)::bigint*65536+get_byte(bytes,18)::bigint*256+get_byte(bytes,19);
      height:=get_byte(bytes,20)::bigint*16777216+get_byte(bytes,21)::bigint*65536+get_byte(bytes,22)::bigint*256+get_byte(bytes,23);
      RETURN width BETWEEN 16 AND 8192 AND height BETWEEN 16 AND 8192;
    END IF;
    RETURN left(image_hex,6)='ffd8ff' AND right(image_hex,4)='ffd9' AND position('ffda' in image_hex)>0
      AND (position('ffc0' in image_hex)>0 OR position('ffc2' in image_hex)>0);
  END IF;
  IF jsonb_typeof(p_strokes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_strokes) NOT BETWEEN 1 AND 80 THEN RETURN false; END IF;
  FOR stroke IN SELECT value FROM jsonb_array_elements(p_strokes) LOOP
    IF jsonb_typeof(stroke->'points') IS DISTINCT FROM 'array' OR jsonb_array_length(stroke->'points') NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
    first_point:=NULL;
    FOR point IN SELECT value FROM jsonb_array_elements(stroke->'points') LOOP
      IF jsonb_typeof(point->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(point->'y') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      IF (point->>'x')::numeric NOT BETWEEN 0 AND 1 OR (point->>'y')::numeric NOT BETWEEN 0 AND 1 THEN RETURN false; END IF;
      IF first_point IS NOT NULL AND ((point->>'x')::numeric<>(first_point->>'x')::numeric OR (point->>'y')::numeric<>(first_point->>'y')::numeric) THEN has_ink:=true; END IF;
      IF first_point IS NULL THEN first_point:=point; END IF;
    END LOOP;
  END LOOP;
  RETURN has_ink;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION private.has_renderable_technical_signature(jsonb,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.register_generated_document(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vistorias%ROWTYPE; result jsonb; issuance text; current_media jsonb; waiver text; existing public.generated_documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_payload->>'document_id',0));
  SELECT * INTO existing FROM public.generated_documents WHERE id=(p_payload->>'document_id')::uuid FOR UPDATE;
  IF FOUND THEN
    IF existing.created_by IS DISTINCT FROM auth.uid() OR private.can_access_document_scope(existing.organization_id,existing.owner_user_id) IS NOT TRUE THEN
      RAISE EXCEPTION 'document_scope_denied' USING ERRCODE='42501'; END IF;
    IF existing.vistoria_id IS DISTINCT FROM (p_payload->>'vistoria_id')::uuid
      OR existing.content_hash IS DISTINCT FROM p_payload->>'content_hash' OR existing.pdf_hash IS DISTINCT FROM p_payload->>'pdf_hash'
      OR existing.storage_path IS DISTINCT FROM p_payload->>'storage_path' OR existing.content_snapshot IS DISTINCT FROM p_payload->'content_snapshot'
      OR existing.document_type IS DISTINCT FROM p_payload->>'document_type' OR existing.template_version IS DISTINCT FROM p_payload->>'template_version'
      OR existing.document_version IS DISTINCT FROM (p_payload->>'document_version')::integer THEN
      RAISE EXCEPTION 'document_identity_conflict' USING ERRCODE='23505'; END IF;
    RETURN jsonb_build_object('document_id',existing.id,'status',existing.status,'issuance_status',existing.issuance_status);
  END IF;
  SELECT * INTO v FROM public.vistorias WHERE id=(p_payload->>'vistoria_id')::uuid FOR UPDATE;
  IF v.id IS NULL OR private.can_access_document_scope(v.organization_id,nullif(v."agenteUid"::text,'')::uuid) IS NOT TRUE THEN RAISE EXCEPTION 'document_scope_denied' USING ERRCODE='42501'; END IF;
  issuance:=coalesce(p_payload#>>'{content_snapshot,payload,documentStatus}','preliminary');
  IF issuance NOT IN ('preliminary','final') THEN RAISE EXCEPTION 'invalid_issuance_status' USING ERRCODE='22023'; END IF;
  current_media:=public.get_inspection_media_status(v.id);
  IF issuance='final' THEN
    IF nullif(p_payload#>>'{content_snapshot,payload,mediaRevision}','')::bigint IS DISTINCT FROM (current_media->>'revision')::bigint THEN RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001'; END IF;
    IF v."agenteUid"::text IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'technical_responsibility_required' USING ERRCODE='42501'; END IF;
    IF private.has_renderable_technical_signature(p_payload#>'{content_snapshot,payload,agentSignatureStrokes}',p_payload#>>'{content_snapshot,payload,agentSignatureImageBase64}') IS NOT TRUE THEN
      RAISE EXCEPTION 'technical_signature_required' USING ERRCODE='22023'; END IF;
    SELECT reason INTO waiver FROM public.inspection_media_waivers WHERE inspection_id=v.id AND media_revision=(current_media->>'revision')::bigint;
    IF NOT coalesce((current_media->>'complete')::boolean,false) AND waiver IS NULL THEN RAISE EXCEPTION 'inspection_evidence_pending' USING ERRCODE='22023'; END IF;
    IF waiver IS NOT NULL AND p_payload#>>'{content_snapshot,payload,mediaWaiverReason}' IS DISTINCT FROM waiver THEN RAISE EXCEPTION 'waiver_must_appear_in_document' USING ERRCODE='22023'; END IF;
  END IF;
  result:=private.register_generated_document_before_issuance(p_payload);
  UPDATE public.generated_documents SET issuance_status=issuance,media_revision=(current_media->>'revision')::bigint WHERE id=(p_payload->>'document_id')::uuid;
  RETURN result||jsonb_build_object('issuance_status',issuance);
END;
$$;
REVOKE ALL ON FUNCTION public.register_generated_document(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_generated_document(jsonb) TO authenticated;

-- RLS may allow an operator to update the inspection table directly. Enforce
-- the same wire contract there, not only in the convenient RPC endpoints.
CREATE FUNCTION private.guard_inspection_media_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE paths text[]:=array_remove(array_prepend(NEW."fotoUrl",coalesce(NEW."fotosUrls",'{}'::text[])),NULL); previous_item jsonb; current_item jsonb;
BEGIN
  IF cardinality(paths)>3 THEN RAISE EXCEPTION 'maximum_three_inspection_photos' USING ERRCODE='22023'; END IF;
  IF NEW.media_manifest IS NULL THEN
    IF TG_OP='UPDATE' AND OLD.media_manifest IS NOT NULL THEN RAISE EXCEPTION 'media_manifest_required' USING ERRCODE='22023'; END IF;
    RETURN NEW;
  END IF;
  PERFORM private.validate_inspection_media_manifest(NEW.media_manifest,NEW.id);
  IF ARRAY(SELECT i->>'storagePath' FROM jsonb_array_elements(NEW.media_manifest->'items') i WHERE i->>'state'='available' ORDER BY (i->>'position')::integer) IS DISTINCT FROM paths THEN
    RAISE EXCEPTION 'media_paths_mismatch' USING ERRCODE='22023'; END IF;
  IF TG_OP='UPDATE' AND OLD.media_manifest IS NOT NULL THEN
    IF (NEW.media_manifest->>'revision')::bigint<(OLD.media_manifest->>'revision')::bigint THEN RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001'; END IF;
    IF (NEW.media_manifest->>'revision')::bigint=(OLD.media_manifest->>'revision')::bigint THEN
      IF NEW.media_manifest->>'expected' IS DISTINCT FROM OLD.media_manifest->>'expected' THEN RAISE EXCEPTION 'media_generation_mismatch' USING ERRCODE='40001'; END IF;
      FOR previous_item IN SELECT value FROM jsonb_array_elements(OLD.media_manifest->'items') LOOP
        SELECT value INTO current_item FROM jsonb_array_elements(NEW.media_manifest->'items') WHERE value->>'id'=previous_item->>'id';
        IF current_item IS NULL OR current_item->>'position' IS DISTINCT FROM previous_item->>'position'
          OR (previous_item->>'state'='available' AND current_item IS DISTINCT FROM previous_item) THEN
          RAISE EXCEPTION 'media_generation_mismatch' USING ERRCODE='40001'; END IF;
      END LOOP;
    ELSIF NEW.media_manifest ? 'base_revision' AND nullif(NEW.media_manifest->>'base_revision','')::bigint IS DISTINCT FROM (OLD.media_manifest->>'revision')::bigint THEN
      RAISE EXCEPTION 'media_revision_conflict' USING ERRCODE='40001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_inspection_media_state() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER vistorias_guard_media_state BEFORE INSERT OR UPDATE OF media_manifest,"fotoUrl","fotosUrls" ON public.vistorias FOR EACH ROW EXECUTE FUNCTION private.guard_inspection_media_state();

-- Link issuer is the initiating collector; preserve the document author separately.
CREATE OR REPLACE FUNCTION private.finalize_remote_document_acknowledgement(
  p_token_hash text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.document_acknowledgement_requests%ROWTYPE;
  v_document public.generated_documents%ROWTYPE;
  v_event_id uuid := gen_random_uuid();
  v_protocol text;
  v_outcome text := p_payload->>'outcome';
  v_signature jsonb := p_payload->'signature_strokes';
  v_signature_path text := nullif(p_payload->>'signature_storage_path', '');
BEGIN
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_link' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_request FROM public.document_acknowledgement_requests WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'link_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status = 'open' AND v_request.expires_at <= clock_timestamp() THEN
    UPDATE public.document_acknowledgement_requests SET status = 'expired' WHERE id = v_request.id;
    RAISE EXCEPTION 'link_expired' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status <> 'open' THEN RAISE EXCEPTION 'link_unavailable' USING ERRCODE = '23505'; END IF;
  SELECT * INTO v_document FROM public.generated_documents WHERE id = v_request.document_id;
  IF NOT FOUND OR v_document.status <> 'available' OR v_document.training_mode THEN RAISE EXCEPTION 'document_unavailable' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.document_acknowledgement_events WHERE document_id = v_document.id AND event_kind = 'outcome') THEN
    RAISE EXCEPTION 'document_already_acknowledged' USING ERRCODE = '23505';
  END IF;
  IF v_outcome NOT IN ('acknowledged', 'refused', 'unable_to_sign')
     OR length(btrim(coalesce(p_payload->>'recipient_name', ''))) < 2
     OR length(btrim(coalesce(p_payload->>'recipient_relationship', ''))) < 2
     OR length(btrim(coalesce(p_payload->>'declaration_text', ''))) < 20
     OR coalesce(p_payload->>'declaration_hash', '') !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'invalid_acknowledgement_payload' USING ERRCODE = '22023'; END IF;
  IF v_outcome = 'acknowledged' THEN
    IF v_signature IS NULL OR jsonb_typeof(v_signature) <> 'array' OR jsonb_array_length(v_signature) = 0
      OR coalesce(p_payload->>'signature_hash', '') !~ '^[0-9a-f]{64}$' OR v_signature_path IS NULL
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'document-evidence' AND name = v_signature_path)
    THEN RAISE EXCEPTION 'signature_required' USING ERRCODE = '22023'; END IF;
  ELSIF length(btrim(coalesce(p_payload->>'reason', ''))) < 3 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;

  v_protocol := 'TCS-CIE-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_event_id::text, '-', ''), 1, 8));
  INSERT INTO public.document_acknowledgement_events(
    id, client_event_id, document_id, organization_id, owner_user_id, event_kind, outcome,
    declaration_version, declaration_text, declaration_hash, recipient_name, recipient_relationship,
    signature_strokes, signature_hash, signature_storage_path, reason, occurred_at_device,
    created_by, protocol, capture_source, remote_request_id
  ) VALUES (
    v_event_id, gen_random_uuid(), v_document.id, v_document.organization_id, v_document.owner_user_id, 'outcome', v_outcome,
    p_payload->>'declaration_version', p_payload->>'declaration_text', p_payload->>'declaration_hash',
    btrim(p_payload->>'recipient_name'), btrim(p_payload->>'recipient_relationship'),
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN p_payload->>'signature_hash' ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature_path ELSE NULL END,
    CASE WHEN v_outcome <> 'acknowledged' THEN btrim(p_payload->>'reason') ELSE NULL END,
    clock_timestamp(), v_request.created_by, v_protocol, 'remote_link', v_request.id
  );
  UPDATE public.document_acknowledgement_requests
     SET status = 'completed', completed_event_id = v_event_id, completed_at = clock_timestamp()
   WHERE id = v_request.id;
  RETURN jsonb_build_object('event_id', v_event_id, 'protocol', v_protocol, 'recorded_at_server', clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION private.finalize_remote_document_acknowledgement(text,jsonb) FROM PUBLIC,anon,authenticated;
