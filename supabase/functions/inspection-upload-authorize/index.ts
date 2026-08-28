import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type UploadKind = 'photo' | 'laudo' | 'evidence_pdf' | 'evidence_signature';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  let body: { inspectionId?: string; kind?: UploadKind; documentId?: string; contentType?: string };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body.inspectionId || !body.kind) return json({ error: 'invalid_request' }, 400);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authorized, error: authorizationError } = await caller.rpc('authorize_inspection_upload', {
    p_inspection_id: body.inspectionId,
  });
  if (authorizationError || authorized !== true) return json({ error: 'forbidden' }, 403);

  const { data: inspection } = await admin
    .from('vistorias')
    .select('id, agenteUid, municipio, municipio_agente, status')
    .eq('id', body.inspectionId)
    .maybeSingle();
  if (!inspection) return json({ error: 'forbidden' }, 403);

  const inspectionMunicipio = inspection.municipio || inspection.municipio_agente || 'geral';

  let bucket: 'fotos' | 'laudos' | 'document-evidence';
  let path: string;
  let contentType: string;
  let upsert = false;
  switch (body.kind) {
    case 'photo':
      if (!['image/jpeg', 'image/png'].includes(body.contentType ?? '')) return json({ error: 'invalid_content_type' }, 400);
      bucket = 'fotos';
      path = `users/${user.id}/${inspectionMunicipio}/${inspection.id}/photos/${crypto.randomUUID()}.${body.contentType === 'image/png' ? 'png' : 'jpg'}`;
      contentType = body.contentType!;
      break;
    case 'laudo':
      if (body.contentType !== 'application/pdf' || inspection.status !== 'concluida') return json({ error: 'invalid_laudo_upload' }, 400);
      bucket = 'laudos';
      path = `users/${user.id}/${inspectionMunicipio}/${inspection.id}.pdf`;
      contentType = 'application/pdf';
      upsert = true;
      break;
    case 'evidence_pdf':
    case 'evidence_signature':
      if (!body.documentId || !/^[0-9a-f-]{36}$/i.test(body.documentId)) return json({ error: 'invalid_document_id' }, 400);
      contentType = body.kind === 'evidence_pdf' ? 'application/pdf' : 'application/json';
      if (body.contentType !== contentType) return json({ error: 'invalid_content_type' }, 400);
      bucket = 'document-evidence';
      path = `${user.id}/${inspection.id}/${body.documentId}/${body.kind === 'evidence_pdf' ? 'document.pdf' : 'signature.json'}`;
      break;
    default:
      return json({ error: 'invalid_upload_kind' }, 400);
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert });
  if (error || !data) {
    console.error('signed upload creation failed', error?.message);
    return json({ error: 'upload_authorization_failed' }, 500);
  }
  return json({ bucket, path, token: data.token, persistencePath: `${bucket}:${path}`, contentType });
});
