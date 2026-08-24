import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set(['https://tcsvisto.netlify.app', 'http://localhost:5173', 'http://127.0.0.1:5173']);

function response(body: Record<string, unknown>, status: number, origin?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' };
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') ?? '';
  if (request.method === 'OPTIONS') return response({}, allowedOrigins.has(origin) ? 204 : 403, origin);
  if (request.method !== 'POST' || !allowedOrigins.has(origin)) return response({ error: 'not_found' }, 404);
  let email = '';
  let captchaToken: string | null = null;
  try {
    const payload = await request.json() as { email?: unknown; captchaToken?: unknown };
    email = String(payload.email ?? '').trim().toLowerCase();
    captchaToken = typeof payload.captchaToken === 'string' ? payload.captchaToken.trim() : null;
  } catch {
    return response({ error: 'invalid_request' }, 400, origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return response({ error: 'invalid_request' }, 400, origin);
  if (captchaToken && captchaToken.length > 4096) return response({ error: 'invalid_request' }, 400, origin);
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || request.headers.get('cf-connecting-ip')?.trim() || '';
  const { data: quota, error: quotaError } = await admin.rpc('consume_password_recovery_quota', { p_email: email, p_ip: ip });
  if (quotaError || !quota) return response({ error: 'request_unavailable' }, 503, origin);
  const quotaData = quota as { allowed?: boolean; retry_after_seconds?: number };
  if (!quotaData.allowed) return response({ accepted: false, retry_after_seconds: quotaData.retry_after_seconds ?? 60 }, 429, origin);
  const recover = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      redirect_to: `${origin}/redefinir-senha`,
      ...(captchaToken ? { captcha_token: captchaToken } : {}),
    }),
  });
  if (!recover.ok) {
    console.error('password_recovery_auth_error', recover.status);
    return response({ error: 'request_unavailable' }, 503, origin);
  }
  return response({ accepted: true }, 200, origin);
});
