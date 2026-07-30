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

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!authorization || !token) return json({ ok: false, error: 'authentication_required' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: 'invalid_session' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const inspectionId = typeof body.inspection_id === 'string' ? body.inspection_id : '';
  const mode = body.mode === 'download' ? 'download' : 'view';
  if (!/^[0-9a-f-]{36}$/i.test(inspectionId)) {
    return json({ ok: false, error: 'invalid_inspection_id' }, 400);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await caller.rpc('portal_authorize_inspection_document', {
    p_inspection_id: inspectionId,
  });
  if (error || !data) {
    return json(
      { ok: false, error: error?.code === '42501' ? 'document_not_allowed' : 'document_not_found' },
      error?.code === '42501' ? 403 : 404,
    );
  }
  const descriptor = data as { bucket?: unknown; path?: unknown; expires_in?: unknown; filename?: unknown };
  const path = typeof descriptor.path === 'string' ? descriptor.path : '';
  if (descriptor.bucket !== 'laudos' || !path || path.startsWith('/') || path.split('/').includes('..')) {
    return json({ ok: false, error: 'invalid_storage_path' }, 422);
  }
  const expiresIn = Math.min(60, Math.max(15, Number(descriptor.expires_in) || 60));
  const { data: signed, error: signedError } = await admin.storage
    .from('laudos')
    .createSignedUrl(
      path,
      expiresIn,
      mode === 'download' ? { download: typeof descriptor.filename === 'string' ? descriptor.filename : true } : undefined,
    );
  if (signedError || !signed?.signedUrl) return json({ ok: false, error: 'document_signing_failed' }, 502);
  return json({ ok: true, signed_url: signed.signedUrl, expires_in: expiresIn, disposition: mode });
});
