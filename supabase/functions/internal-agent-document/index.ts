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

interface DocumentRequest {
  customer_id?: unknown;
  user_id?: unknown;
  inspection_id?: unknown;
  kind?: unknown;
  mode?: unknown;
}

interface AuthorizedDocument {
  bucket: string;
  path: string;
  expires_in: number;
  filename: string;
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function uuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'authentication_required' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: 'invalid_session' }, 401);

  let body: DocumentRequest;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const hasAgentScope = uuid(body.user_id);
  const mode = body.mode === 'view' ? 'view' : 'download';
  if (typeof body.customer_id !== 'string'
    || (body.user_id !== undefined && !hasAgentScope)
    || !uuid(body.inspection_id) || body.kind !== 'laudo') {
    return json({ ok: false, error: 'invalid_document_request' }, 400);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = hasAgentScope
    ? await caller.rpc('authorize_internal_agent_document', {
        p_customer_id: body.customer_id,
        p_user_id: body.user_id,
        p_inspection_id: body.inspection_id,
        p_kind: body.kind,
      })
    : await caller.rpc('authorize_internal_customer_document', {
        p_customer_id: body.customer_id,
        p_inspection_id: body.inspection_id,
        p_kind: body.kind,
      });
  if (error || !data) {
    const forbidden = error?.code === '42501';
    return json({ ok: false, error: forbidden ? 'sensitive_support_access_required' : 'document_not_found' }, forbidden ? 403 : 404);
  }

  const authorization = data as unknown as AuthorizedDocument;
  let path: string;
  try {
    path = decodeURIComponent(authorization.path);
  } catch {
    return json({ ok: false, error: 'invalid_storage_path' }, 422);
  }
  if (authorization.bucket !== 'laudos' || !path || path.startsWith('/') || path.split('/').includes('..')) {
    return json({ ok: false, error: 'invalid_storage_path' }, 422);
  }

  const expiresIn = Math.min(60, Math.max(15, authorization.expires_in || 60));
  const { data: signed, error: signedError } = await admin.storage
    .from(authorization.bucket)
    .createSignedUrl(
      path,
      expiresIn,
      mode === 'download' ? { download: authorization.filename || true } : undefined,
    );
  if (signedError || !signed?.signedUrl) {
    return json({ ok: false, error: 'document_signing_failed' }, 502);
  }
  return json({
    ok: true,
    signed_url: signed.signedUrl,
    expires_in: expiresIn,
    disposition: mode,
  });
});
