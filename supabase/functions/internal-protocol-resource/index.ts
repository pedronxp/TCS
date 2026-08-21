import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ResourceKind = 'laudo' | 'photo';
type ResourceDescriptor = { bucket?: unknown; path?: unknown; filename?: unknown };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.split('/').includes('..');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'authentication_required' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: 'invalid_session' }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const kind: ResourceKind | null = body.kind === 'laudo' || body.kind === 'photo' ? body.kind : null;
  const mode = body.mode === 'download' ? 'download' : 'view';
  if (!isUuid(body.inspection_id) || !kind) return json({ ok: false, error: 'invalid_resource_request' }, 400);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization! } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await caller.rpc('authorize_internal_protocol_resource', {
    p_inspection_id: body.inspection_id,
    p_kind: kind,
  });
  if (error || !data || typeof data !== 'object') {
    const forbidden = error?.code === '42501';
    return json({ ok: false, error: forbidden ? 'sensitive_access_required' : 'resource_not_found' }, forbidden ? 403 : 404);
  }
  const payload = data as { expires_in?: unknown; resources?: unknown };
  const descriptors = Array.isArray(payload.resources) ? payload.resources.slice(0, 8) as ResourceDescriptor[] : [];
  if (!descriptors.length) return json({ ok: false, error: 'resource_not_found' }, 404);
  const expiresIn = Math.min(60, Math.max(15, Number(payload.expires_in) || 60));
  const expectedBucket = kind === 'laudo' ? 'laudos' : 'fotos';
  const resources: Array<{ url: string; filename: string }> = [];
  for (const descriptor of descriptors) {
    if (descriptor.bucket !== expectedBucket || !validPath(descriptor.path)) return json({ ok: false, error: 'invalid_storage_path' }, 422);
    const { data: signed, error: signedError } = await admin.storage.from(expectedBucket).createSignedUrl(
      descriptor.path,
      expiresIn,
      mode === 'download' && kind === 'laudo' ? { download: typeof descriptor.filename === 'string' ? descriptor.filename : true } : undefined,
    );
    if (signedError || !signed?.signedUrl) return json({ ok: false, error: 'resource_signing_failed' }, 502);
    resources.push({ url: signed.signedUrl, filename: typeof descriptor.filename === 'string' ? descriptor.filename : 'arquivo' });
  }
  return json({ ok: true, kind, disposition: mode, expires_in: expiresIn, resources });
});
