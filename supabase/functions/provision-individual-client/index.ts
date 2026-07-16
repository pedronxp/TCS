import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const inviteRedirectUrl = Deno.env.get('INDIVIDUAL_INVITE_REDIRECT_URL') ?? 'tcs://reset-password';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProvisioningMode = 'email_invite' | 'initial_password';

interface ProvisioningBody {
  email?: unknown;
  name?: unknown;
  mode?: unknown;
  password?: unknown;
  reason?: unknown;
  operation_id?: unknown;
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function validPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'authentication_required' }, 401);

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: 'invalid_session' }, 401);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: profile, error: profileError } = await caller.rpc('get_internal_staff_profile');
  if (profileError || !profile || !profile.permissions?.includes('customer.write')) {
    await caller.rpc('record_internal_access_denied', {
      p_action: 'customer.individual.provision',
      p_target_type: 'user',
      p_reason: 'missing_customer_write_permission',
    });
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  if (profile.assurance_level !== 'aal2') {
    return json({ ok: false, error: 'aal2_required' }, 403);
  }

  let body: ProvisioningBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const mode = body.mode as ProvisioningMode;
  const password = typeof body.password === 'string' ? body.password : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const operationId = typeof body.operation_id === 'string' ? body.operation_id : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }
  if (name.length < 2 || name.length > 150) return json({ ok: false, error: 'invalid_name' }, 400);
  if (mode !== 'email_invite' && mode !== 'initial_password') {
    return json({ ok: false, error: 'invalid_mode' }, 400);
  }
  if (mode === 'initial_password' && !validPassword(password)) {
    return json({ ok: false, error: 'weak_password' }, 400);
  }
  if (reason.length < 8 || reason.length > 500) return json({ ok: false, error: 'reason_required' }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(operationId)) return json({ ok: false, error: 'invalid_operation_id' }, 400);

  const authResult = mode === 'email_invite'
    ? await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        redirectTo: inviteRedirectUrl,
      })
    : await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

  if (authResult.error || !authResult.data.user) {
    const duplicate = authResult.error?.message.toLowerCase().includes('already') ?? false;
    return json({ ok: false, error: duplicate ? 'email_already_registered' : 'auth_provisioning_failed' }, duplicate ? 409 : 400);
  }

  const createdUser = authResult.data.user;
  const { data: finalized, error: finalizeError } = await caller.rpc(
    'finalize_internal_individual_provisioning',
    {
      p_user_id: createdUser.id,
      p_email: email,
      p_name: name,
      p_mode: mode,
      p_reason: reason,
      p_operation_id: operationId,
    },
  );

  if (finalizeError || !finalized?.ok) {
    await admin.auth.admin.deleteUser(createdUser.id);
    return json({ ok: false, error: 'profile_provisioning_failed' }, 500);
  }

  return json({
    ok: true,
    customer_id: finalized.customer_id,
    user_id: createdUser.id,
    mode,
    status: finalized.status,
  });
});
