import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const db = new PGlite();
let failure = null;
const evidenceSchema = await readFile(new URL('../supabase/migrations/20260717233426_electronic_document_acknowledgement.sql', import.meta.url), 'utf8');
const tableDDL = name => { const start = evidenceSchema.indexOf(`CREATE TABLE public.${name} (`); return evidenceSchema.slice(start, evidenceSchema.indexOf('\n);', start) + 3); };
const owner = '10000000-0000-4000-8000-000000000001';
const agent = '10000000-0000-4000-8000-000000000002';
const stranger = '10000000-0000-4000-8000-000000000003';
const inspection = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const path = `fotos:users/${agent}/Town/${inspection}/photos/one.jpg`;
const manifest = (revision, items = [{ id: 'photo-1', position: 0, state: 'available', storagePath: path }]) => ({ version: 1, revision, expected: items.filter(i => i.state !== 'removed').length, available: items.filter(i => i.state === 'available').length, items });
const auth = async (id) => db.query("select set_config('test.actor',$1,false)", [id]);
const update = async (m, primary = path) => db.query('select public.update_inspection_media($1,$2,$3,$4::jsonb)', [inspection, primary, [], JSON.stringify(m)]);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA storage;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(input bytea,algorithm text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$SELECT sha256(input)$$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE FUNCTION private.current_internal_role(p_user_id uuid DEFAULT auth.uid()) RETURNS text LANGUAGE sql STABLE AS $$SELECT CASE WHEN p_user_id='${owner}' THEN 'owner' END$$;
    CREATE FUNCTION private.current_organization_id(p_user_id uuid DEFAULT auth.uid()) RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULL::uuid$$;
    CREATE FUNCTION private.is_owner_admin(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
    CREATE TABLE public.users(uid uuid PRIMARY KEY,role text,municipio text,"isApproved" boolean,name text);
    CREATE TABLE public.vistorias(id uuid PRIMARY KEY,"agenteUid" text,organization_id uuid,municipio text,"fotoUrl" text,"fotosUrls" text[],protocolo text,status text);
    CREATE TABLE public.organizations(id uuid PRIMARY KEY);
    ${tableDDL('generated_documents')}
    ${tableDDL('document_acknowledgement_events')}
    ALTER TABLE public.document_acknowledgement_events ADD COLUMN capture_source text DEFAULT 'device',ADD COLUMN remote_request_id uuid;
    CREATE TABLE public.document_acknowledgement_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid,organization_id uuid,owner_user_id uuid,token_hash text,status text,expires_at timestamptz,completed_event_id uuid,created_by uuid,created_at timestamptz DEFAULT now(),completed_at timestamptz);
    CREATE TABLE public.internal_access_events(actor_id uuid,actor_role text,action text,target_type text,target_id text,result text,metadata jsonb);
    CREATE TABLE storage.objects(bucket_id text,name text);
    CREATE FUNCTION public.sync_finalized_inspection(p_inspection jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN
      IF (p_inspection->>'agenteUid') IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'inspection_actor_mismatch'; END IF;
      RETURN jsonb_build_object('inspection_id',p_inspection->>'id','protocol','TCS-1'); END$$;
    CREATE FUNCTION public.get_internal_protocol_inspection(p_inspection_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('id',p_inspection_id)$$;
    CREATE FUNCTION public.update_inspection_media(uuid,text,text[]) RETURNS void LANGUAGE sql AS $$SELECT NULL::void$$;
    INSERT INTO public.vistorias VALUES('${inspection}','${agent}',NULL,'Town',NULL,NULL,'TCS-1','concluida');
    INSERT INTO public.vistorias VALUES('${other}','${agent}',NULL,'Town',NULL,NULL,'TCS-2','concluida');
    INSERT INTO storage.objects VALUES('fotos','${path.slice(6)}');
    INSERT INTO storage.objects VALUES('fotos','users/${agent}/Town/${other}/photos/other.jpg');
    INSERT INTO auth.users VALUES('${owner}'),('${agent}'),('${stranger}');
  `);
  const sql = await readFile(new URL('../supabase/migrations/20261112011951_owner_inspection_media_workflow.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(await readFile(new URL('../supabase/migrations/20260529000003_training_mode_access.sql', import.meta.url), 'utf8'));
  const classCode = 'QA23-TEST-2026';
  for (const migration of ['20260813222420_backend_authoritative_training_p1.sql', '20261114122017_allow_authorized_training_management.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  await db.query("insert into public.users(uid,role,\"isApproved\",name) values ($1,'agent',true,'Dono QA'),($2,'agent',true,'Agente QA')", [owner, agent]);
  const createClass = () => db.query("select public.create_training_class('Turma QA local',$1,1,now()-interval '1 minute',now()+interval '1 hour') as id", [classCode]);
  await auth(agent);
  await assert.rejects(createClass(), /forbidden/);
  await auth(owner);
  const classroom = (await createClass()).rows[0].id;
  await auth('');
  await db.exec('SET ROLE anon');
  const entry = await db.query('select public.training_class_entry($1,$2,$3) as result',
    [classCode, 'Participante QA', 'qa-device']);
  const full = await db.query('select public.training_class_entry($1,$2,$3) as result',
    [classCode, 'Segundo participante', 'qa-device-2']);
  await db.exec('RESET ROLE');
  assert.equal(entry.rows[0].result.ok, true);
  assert.equal(entry.rows[0].result.participantLimit, 1);
  assert.ok(entry.rows[0].result.allowedForms.includes('inspecao_ponte_passarela_v1'));
  assert.equal(full.rows[0].result.status, 'full');
  await auth(owner);
  await db.query('select public.close_training_class($1)', [classroom]);
  console.log('Código válido aceito para entrada anônima em turma de teste.');
  await auth(stranger);
  await assert.rejects(update(manifest(1)), /forbidden/);
  await assert.rejects(db.query('select public.get_inspection_media_status($1)', [inspection]), /scope_denied/);
  const orphan = '20000000-0000-4000-8000-000000000003';
  await db.query("insert into public.vistorias(id,protocolo,status) values($1,'TCS-ORPHAN','concluida')",[orphan]);
  await assert.rejects(db.query('select public.get_inspection_media_status($1)',[orphan]), /scope_denied/);
  const falseScope = (await db.query('select private.can_access_document_scope(null,null) as allowed')).rows[0].allowed;
  assert.equal(falseScope,false);
  await auth(owner);
  await assert.rejects(update({ version: 1, revision: 1, items: [{}] }), /invalid_media_manifest/);
  await assert.rejects(update(manifest(1, [{ id: 'bad', position: 0, state: 'available', storagePath: `fotos:users/${agent}/Town/${other}/photos/other.jpg` }])), /missing_or_invalid/);
  await update(manifest(100));
  await assert.rejects(update(manifest(100, []), null), /generation_mismatch/);
  await assert.rejects(db.query('update public.vistorias set "fotosUrls"=$1 where id=$2',[['fotos:a','fotos:b','fotos:c','fotos:d'],inspection]), /maximum_three/);
  let status = (await db.query('select public.get_inspection_media_status($1) as s', [inspection])).rows[0].s;
  assert.equal(status.complete, true);
  // Removing a photo is a newer revision. A late upload cannot resurrect it.
  await update(manifest(101, []), null);
  await assert.rejects(update(manifest(100)), /revision_conflict/);
  await assert.rejects(update({ ...manifest(10000), base_revision: 100 }), /revision_conflict/);
  await auth(agent);
  const partial = manifest(102, [{ id: 'new', position: 0, state: 'pending', storagePath: null }]);
  await db.query('select public.sync_finalized_inspection($1::jsonb)', [JSON.stringify({ id: inspection, agenteUid: agent, media_manifest: partial })]);
  status = (await db.query('select public.get_inspection_media_status($1) as s', [inspection])).rows[0].s;
  assert.equal(status.pending_count, 1);
  const documentId = '30000000-0000-4000-8000-000000000001';
  const signature = [{points:[{x:0,y:0},{x:1,y:1}]}];
  const issuancePayload = {document_id:documentId,vistoria_id:inspection,content_snapshot:{payload:{documentStatus:'final',mediaRevision:102,agentSignatureStrokes:signature}}};
  for (const invalid of [[{points:[]}],[{points:[null,null]}],[{points:[{x:0,y:0},{x:2,y:1}]}],[{points:[{x:0,y:0},{x:0,y:0}]}]]) {
    const bad = {...issuancePayload,content_snapshot:{payload:{documentStatus:'final',mediaRevision:102,agentSignatureStrokes:invalid}}};
    await assert.rejects(db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(bad)]),/technical_signature_required/);
  }
  const badImage = {...issuancePayload,content_snapshot:{payload:{documentStatus:'final',mediaRevision:102,agentSignatureImageBase64:'foo'}}};
  await assert.rejects(db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(badImage)]),/technical_signature_required/);
  await assert.rejects(db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(issuancePayload)]), /evidence_pending/);
  await auth(owner);
  await assert.rejects(db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(issuancePayload)]), /technical_responsibility/);
  await db.query('select public.waive_inspection_missing_media($1,$2,$3)',[inspection,'Evidência perdida, dispensa justificada para este teste',102]);
  const waiver = (await db.query('select public.get_inspection_media_status($1) as s',[inspection])).rows[0].s.waiver_reason;
  assert.ok(waiver);
  await auth(agent);
  const retry = manifest(102, [{ id: 'new', position: 0, state: 'available', storagePath: path }]);
  await db.query('select public.sync_finalized_inspection($1::jsonb)', [JSON.stringify({ id: inspection, agenteUid: agent, media_manifest: retry })]);
  const row = (await db.query('select "fotoUrl",protocolo from public.vistorias where id=$1',[inspection])).rows[0];
  assert.equal(row.fotoUrl,path); assert.equal(row.protocolo,'TCS-1');
  const legacy = (await db.query('select public.get_inspection_media_status($1) as s',[other])).rows[0].s;
  assert.equal(legacy.expected_count,null); assert.equal(legacy.complete,false);
  // A different authorized collector may acknowledge Pedro's already-frozen
  // PDF; its author and content identity are never transferred to the owner.
  const storagePath = `${agent}/${inspection}/${documentId}/document.pdf`;
  await db.query(`INSERT INTO public.generated_documents(id,vistoria_id,owner_user_id,document_type,document_version,template_version,content_snapshot,content_hash,pdf_hash,storage_path,byte_size,created_by,created_at_device)
    VALUES($1,$2,$3,'report',1,'v1','{}',$4,$5,$6,100,$3,now())`,[documentId,inspection,agent,'a'.repeat(64),'b'.repeat(64),storagePath]);
  await db.query("insert into storage.objects values('document-evidence',$1)",[storagePath]);
  await auth(owner);
  const outcome = { document_id:documentId,client_event_id:'40000000-0000-4000-8000-000000000001',event_id:'40000000-0000-4000-8000-000000000002',vistoria_id:inspection,
    document_type:'report',document_version:1,template_version:'v1',content_snapshot:{},content_hash:'a'.repeat(64),pdf_hash:'b'.repeat(64),storage_path:storagePath,byte_size:100,
    document_created_at_device:new Date().toISOString(),outcome:'refused',reason:'Não deseja assinar',recipient_name:'Morador',recipient_relationship:'Responsável',declaration_version:'v1',
    declaration_text:'Declaro que tive acesso a esta versão preservada do documento.',declaration_hash:'c'.repeat(64),occurred_at_device:new Date().toISOString() };
  outcome.declaration_hash = createHash('sha256').update(JSON.stringify({text:outcome.declaration_text,version:outcome.declaration_version})).digest('hex');
  await db.query('select private.finalize_document_acknowledgement($1::jsonb)',[JSON.stringify(outcome)]);
  const identity = (await db.query('select created_by from public.generated_documents where id=$1',[documentId])).rows[0];
  const collector = (await db.query('select created_by from public.document_acknowledgement_events where document_id=$1',[documentId])).rows[0];
  assert.equal(identity.created_by,agent); assert.equal(collector.created_by,owner);
  const remoteDocument = '30000000-0000-4000-8000-000000000002';
  await db.query(`INSERT INTO public.generated_documents(id,vistoria_id,owner_user_id,document_type,document_version,template_version,content_snapshot,content_hash,pdf_hash,storage_path,byte_size,created_by,created_at_device)
    SELECT $1,vistoria_id,owner_user_id,document_type,2,template_version,content_snapshot,content_hash,pdf_hash,storage_path,byte_size,created_by,created_at_device FROM public.generated_documents WHERE id=$2`,[remoteDocument,documentId]);
  const tokenHash = 'f'.repeat(64);
  await db.query("INSERT INTO public.document_acknowledgement_requests(document_id,owner_user_id,token_hash,status,expires_at,created_by) VALUES($1,$2,$3,'open',now()+interval '1 day',$4)",[remoteDocument,agent,tokenHash,owner]);
  await db.query('select private.finalize_remote_document_acknowledgement($1,$2::jsonb)',[tokenHash,JSON.stringify(outcome)]);
  const linkCollector = (await db.query('select created_by from public.document_acknowledgement_events where document_id=$1',[remoteDocument])).rows[0];
  assert.equal(linkCollector.created_by,owner);
  // The acknowledgement insertion path must not bypass issuance policy.
  const ownerDocument = '30000000-0000-4000-8000-000000000003';
  const ownerPath = `${owner}/${inspection}/${ownerDocument}/document.pdf`;
  await db.query("insert into storage.objects values('document-evidence',$1)",[ownerPath]);
  const directFinal = { ...outcome, document_id:ownerDocument,document_version:3,
    client_event_id:'41000000-0000-4000-8000-000000000003',event_id:'42000000-0000-4000-8000-000000000004',storage_path:ownerPath,
    content_snapshot:{payload:{documentStatus:'final',mediaRevision:102,agentSignatureStrokes:signature}} };
  await assert.rejects(db.query('select private.finalize_document_acknowledgement($1::jsonb)',[JSON.stringify(directFinal)]), /technical_responsibility/);
  const preliminary = { ...directFinal, content_snapshot:{payload:{documentStatus:'preliminary',mediaRevision:102,agentSignatureStrokes:null}} };
  await db.query('select private.finalize_document_acknowledgement($1::jsonb)',[JSON.stringify(preliminary)]);
  const preserved = (await db.query('select issuance_status,media_revision from public.generated_documents where id=$1',[ownerDocument])).rows[0];
  assert.equal(preserved.issuance_status,'preliminary'); assert.equal(preserved.media_revision,102);
  // Same hashes are insufficient when the caller changes the frozen snapshot.
  await assert.rejects(db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(directFinal)]), /identity_conflict/);
  await auth(agent); await update(manifest(103,[]),null); await auth(owner);
  await db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(preliminary)]);
  const retried = (await db.query('select issuance_status,media_revision from public.generated_documents where id=$1',[ownerDocument])).rows[0];
  assert.deepEqual(retried,preserved);
  await auth(agent);
  const finalDocument = '30000000-0000-4000-8000-000000000004';
  const finalPath = `${agent}/${inspection}/${finalDocument}/document.pdf`;
  await db.query("insert into storage.objects values('document-evidence',$1)",[finalPath]);
  const finalPayload = {...outcome,document_id:finalDocument,document_version:4,storage_path:finalPath,
    content_snapshot:{payload:{documentStatus:'final',mediaRevision:103,agentSignatureStrokes:signature}}};
  await db.query('select public.register_generated_document($1::jsonb)',[JSON.stringify(finalPayload)]);
  assert.equal((await db.query('select issuance_status from public.generated_documents where id=$1',[finalDocument])).rows[0].issuance_status,'final');
  await db.exec(await readFile(new URL('../supabase/migrations/20261113230346_resolve_document_predecessor.sql', import.meta.url), 'utf8'));
  for (const [inspectionId, formCode, predecessor] of [
    [inspection, 'risco_estrutural_novo_v2', finalDocument],
    [other, 'inspecao_ponte_passarela_v1', null],
  ]) {
    const id = crypto.randomUUID();
    const pdf = `${agent}/${inspectionId}/${id}/document.pdf`;
    const signaturePath = `${agent}/${inspectionId}/${id}/signature.json`;
    await db.query("insert into storage.objects values ('document-evidence',$1),('document-evidence',$2)", [pdf, signaturePath]);
    const receipt = {
      ...outcome,
      document_id: id, vistoria_id: inspectionId, document_version: 6,
      supersedes_id: crypto.randomUUID(), storage_path: pdf,
      event_id: crypto.randomUUID(), client_event_id: crypto.randomUUID(),
      content_snapshot: { payload: { formularioId: formCode, documentStatus: 'preliminary' } },
      outcome: 'acknowledged', reason: null,
      signature_strokes: signature, signature_hash: 'e'.repeat(64), signature_storage_path: signaturePath,
    };
    const { rows: [{ result }] } = await db.query('select private.finalize_document_acknowledgement($1::jsonb) as result', [JSON.stringify(receipt)]);
    assert.match(result.protocol, /^TCS-CIE-/);
    assert.equal((await db.query('select supersedes_id from public.generated_documents where id=$1', [id])).rows[0].supersedes_id, predecessor);
    const replay = await db.query('select private.finalize_document_acknowledgement($1::jsonb) as result', [JSON.stringify(receipt)]);
    assert.equal(replay.rows[0].result.protocol, result.protocol);
    console.log(`Ciência confirmada em banco de teste: ${formCode}`);
  }
  const pixels = Buffer.alloc(64*32*3,255);
  for (let x=4;x<60;x++) { const y=8+(x%13); pixels.fill(0,(y*64+x)*3,(y*64+x)*3+3); }
  const signaturePng = await sharp(pixels,{raw:{width:64,height:32,channels:3}}).png({compressionLevel:0}).toBuffer();
  const imageValue = `data:image/png;base64,${signaturePng.toString('base64')}`;
  assert.equal((await db.query('select private.has_renderable_technical_signature(null,$1) as valid',[imageValue])).rows[0].valid,true);
  assert.equal((await db.query('select private.has_renderable_technical_signature(null,$1) as valid',['data:image/png;base64,AAAA'])).rows[0].valid,false);
  console.log('inspection media SQL: scope, NULL-role denial, scoped storage, partial upload, retry, stale removal and legacy state passed');
} catch(error) { console.error(error.message, error.where ?? ''); failure=error; } finally { await db.close(); }
if (failure) process.exit(1);
