import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? '';
const provider = Deno.env.get('PAYMENT_PROVIDER') ?? 'provider';
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacHex(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!webhookSecret) return Response.json({ ok: false, error: 'webhook_not_configured' }, { status: 503 });
  const rawBody = await request.text();
  const suppliedSignature = request.headers.get('x-tcs-signature')?.replace(/^sha256=/, '') ?? '';
  const expectedSignature = await hmacHex(rawBody);
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) {
    return Response.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const eventId = typeof event.id === 'string' ? event.id : '';
  const eventType = typeof event.type === 'string' ? event.type : '';
  const eventTime = typeof event.created_at === 'string' ? event.created_at : '';
  const sessionId = typeof event.checkout_session_id === 'string' ? event.checkout_session_id : '';
  const subscriptionStatus = typeof event.subscription_status === 'string' ? event.subscription_status : '';
  const subscriptionId = typeof event.subscription_id === 'string' ? event.subscription_id : null;
  if (!eventId || !eventType || !eventTime || !sessionId || !subscriptionStatus) {
    return Response.json({ ok: false, error: 'invalid_event_contract' }, { status: 400 });
  }

  const { data, error } = await admin.rpc('portal_process_payment_event', {
    p_provider: provider,
    p_provider_event_id: eventId,
    p_provider_event_time: eventTime,
    p_event_type: eventType,
    p_payload_hash: await sha256Hex(rawBody),
    p_provider_session_id: sessionId,
    p_subscription_status: subscriptionStatus,
    p_provider_subscription_id: subscriptionId,
  });
  if (error) {
    console.error('payment_webhook_processing_failed', error.code);
    return Response.json({ ok: false, error: 'event_processing_failed' }, { status: 500 });
  }
  if (data?.processed === false) {
    return Response.json({ ok: false, error: data.reason ?? 'event_processing_failed' }, { status: 500 });
  }
  return Response.json({ ok: true, result: data });
});
