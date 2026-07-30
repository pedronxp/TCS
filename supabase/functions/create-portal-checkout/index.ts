import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
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
  if (!authorization) return json({ ok: false, error: 'authentication_required' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const planCode = typeof body.plan_code === 'string' ? body.plan_code : '';
  const periodicity = typeof body.periodicity === 'string' ? body.periodicity : '';
  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
  if (!/^[a-z0-9_]+$/.test(planCode) || !['monthly', 'annual'].includes(periodicity)) {
    return json({ ok: false, error: 'invalid_checkout_request' }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return json({ ok: false, error: 'invalid_idempotency_key' }, 400);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await caller.rpc('portal_create_checkout', {
    p_plan_code: planCode,
    p_periodicity: periodicity,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const forbidden = error.code === '42501';
    return json({ ok: false, error: forbidden ? 'checkout_not_allowed' : 'checkout_creation_failed' }, forbidden ? 403 : 400);
  }

  // Provider checkout creation is deliberately adapter-based. The database has
  // already frozen the subject, plan version and price. Until a provider is
  // configured, no URL is invented and no entitlement is activated.
  if (data?.provider_configuration_required) {
    return json({ ok: false, error: 'payment_provider_not_configured', checkout: data }, 503);
  }
  return json({ ok: true, checkout: data });
});
