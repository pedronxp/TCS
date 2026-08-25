import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = [
  /^https:\/\/tcsvistoria\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.tcsvistoria\.pages\.dev$/,
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowedOrigin = allowedOrigins.some((pattern) => pattern.test(origin))
    ? origin
    : 'https://tcsvistoria.pages.dev';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function clientIp(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwarded = request.headers.get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers });
  }

  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.some((pattern) => pattern.test(origin))) {
    return Response.json({ error: 'origin_not_allowed' }, { status: 403, headers });
  }

  const body = await request.json().catch(() => ({}));
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : '';
  const action = body.action === 'claim' ? 'claim' : 'status';
  if (deviceId.length < 16 || deviceId.length > 128 || !/^[a-z0-9._:-]+$/i.test(deviceId)) {
    return Response.json({ error: 'invalid_device_id' }, { status: 400, headers });
  }

  const rpc = action === 'claim'
    ? 'claim_public_preview_attempt'
    : 'get_public_preview_status';
  const { data, error } = await admin.rpc(rpc, {
    p_client_ip: clientIp(request),
    p_device_id: deviceId,
  });
  if (error) {
    console.error('public_preview_access_failed', error.code);
    return Response.json({ error: 'preview_access_unavailable' }, { status: 503, headers });
  }

  return Response.json(data, {
    // A limit reached is an expected product state, not a transport failure.
    status: 200,
    headers: { ...headers, 'Cache-Control': 'no-store' },
  });
});
