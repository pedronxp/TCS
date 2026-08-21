import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const resetRedirectUrl = Deno.env.get('INTERNAL_PASSWORD_RESET_REDIRECT_URL') ?? 'https://tcs.com.br/console/redefinir-senha';
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

type StaffRole = 'developer' | 'support';
interface Body { email?: unknown; name?: unknown; role?: unknown; reason?: unknown; operation_id?: unknown; }
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: corsHeaders });

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320; }
function generatedPassword() { return `${crypto.randomUUID()}-${crypto.randomUUID()}A1`; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'authentication_required' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: 'invalid_session' }, 401);
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: profile, error: profileError } = await caller.rpc('get_internal_staff_profile');
  if (profileError || !profile?.permissions?.includes('staff.manage') || profile.role !== 'owner') {
    await caller.rpc('record_internal_access_denied', { p_action: 'staff.provision', p_target_type: 'internal_staff', p_reason: 'owner_staff_manage_required' });
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  if (profile.assurance_level !== 'aal2') return json({ ok: false, error: 'aal2_required' }, 403);
  let body: Body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = body.role as StaffRole;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const operationId = typeof body.operation_id === 'string' ? body.operation_id : '';
  if (!validEmail(email) || name.length < 2 || name.length > 150 || !['developer', 'support'].includes(role) || reason.length < 8 || reason.length > 500 || !/^[0-9a-f-]{36}$/i.test(operationId)) return json({ ok: false, error: 'invalid_request' }, 400);
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  const provisioned = existing ? { data: { user: existing }, error: null } : await admin.auth.admin.createUser({ email, password: generatedPassword(), email_confirm: true, user_metadata: { name } });
  const target = provisioned.data.user;
  if (provisioned.error || !target) return json({ ok: false, error: 'auth_provisioning_failed' }, 400);
  const { error: membershipError } = await admin.from('internal_staff').upsert({ user_id: target.id, role, status: 'active', display_name: name, created_by: user.id }, { onConflict: 'user_id' });
  if (membershipError) {
    if (!existing) await admin.auth.admin.deleteUser(target.id);
    return json({ ok: false, error: 'staff_provisioning_failed' }, 500);
  }
  await admin.from('internal_access_events').insert({ actor_id: user.id, actor_role: profile.role, action: 'staff.provision', target_type: 'internal_staff', target_id: target.id, result: 'allowed', reason, metadata: { role, email_delivery: 'password_reset_requested' } });
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl });
  if (resetError) return json({ ok: true, user_id: target.id, password_reset: 'failed' }, 202);
  return json({ ok: true, user_id: target.id, password_reset: 'sent' });
});
