import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

const EAS_TOKEN = Deno.env.get('EAS_TOKEN') ?? '';
const EAS_PROJECT_ID = Deno.env.get('EAS_PROJECT_ID') ?? '';
const GITHUB_TOKEN = Deno.env.get('GH_ACTIONS_TOKEN') ?? '';
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? '';

async function triggerEAS(buildProfile: string, version: string): Promise<string | null> {
  if (!EAS_TOKEN || !EAS_PROJECT_ID) return null;
  const res = await fetch(`https://api.expo.dev/v2/projects/${EAS_PROJECT_ID}/builds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${EAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      buildProfile,
      platform: 'android',
      metadata: { appVersion: version },
    }),
  });
  if (!res.ok) {
    console.error('EAS build request failed', res.status);
    return null;
  }
  const json = await res.json();
  return json.data?.id ?? null;
}

async function triggerGitHub(
  buildProfile: string,
  version: string,
  changelog: string,
): Promise<string | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/build-apk.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { profile: buildProfile, version, changelog },
      }),
    },
  );
  if (!res.ok) {
    console.error('GitHub build dispatch failed', res.status);
    return null;
  }
  return 'pending';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await caller.rpc('get_internal_staff_profile');
  if (profileError || !profile || !profile.permissions?.includes('build.request')) {
    await caller.rpc('record_internal_access_denied', {
      p_action: 'build.execute',
      p_target_type: 'build_request',
      p_reason: 'missing_internal_build_permission',
    });
    return new Response('Forbidden', { status: 403 });
  }
  if (profile.assurance_level !== 'aal2') {
    return Response.json({ ok: false, error: 'aal2_required' }, { status: 403 });
  }

  const body = await req.json();
  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  if (!requestId) {
    return Response.json({ ok: false, error: 'request_id é obrigatório' }, { status: 400 });
  }

  const { data: buildRequest, error: requestError } = await admin
    .from('internal_build_requests')
    .select('id,requested_by,approved_by,provider,environment,version,profile,changelog,status')
    .eq('id', requestId)
    .single();
  if (requestError || !buildRequest) return new Response('Build request not found', { status: 404 });
  if (buildRequest.status !== 'approved') {
    return Response.json({ ok: false, error: 'build_request_not_approved' }, { status: 409 });
  }
  if (buildRequest.environment === 'production' && !buildRequest.approved_by) {
    return Response.json({ ok: false, error: 'production_approval_required' }, { status: 403 });
  }
  if (buildRequest.requested_by !== user.id && profile.role !== 'owner') {
    return new Response('Forbidden', { status: 403 });
  }

  const {
    provider,
    version,
    profile: buildProfile,
    changelog,
    environment,
  } = buildRequest;

  const { data: build, error: insertError } = await admin
    .from('builds')
    .insert({
      provider,
      version,
      profile: buildProfile,
      changelog,
      status: 'queued',
      initiated_by: user.id,
      initiated_by_name: profile.display_name ?? user.email,
    })
    .select()
    .single();

  if (insertError) {
    return Response.json({ ok: false, error: 'build_record_failed' }, { status: 500 });
  }

  let externalId: string | null = null;
  let updateData: Record<string, string> = {};
  if (provider === 'eas') {
    externalId = await triggerEAS(buildProfile, version);
    updateData = externalId ? { status: 'building', eas_build_id: externalId } : { status: 'failed' };
  } else {
    externalId = await triggerGitHub(buildProfile, version, changelog);
    updateData = externalId ? { status: 'building' } : { status: 'failed' };
  }

  await admin.from('builds').update(updateData).eq('id', build.id);
  await admin
    .from('internal_build_requests')
    .update({
      status: externalId ? 'executed' : 'failed',
      executed_at: new Date().toISOString(),
    })
    .eq('id', buildRequest.id)
    .eq('status', 'approved');

  await admin.from('technical_events').insert({
    organization_id: null,
    user_id: user.id,
    app_version: version,
    platform: 'server',
    category: 'build',
    severity: externalId ? 'info' : 'error',
    correlation_id: buildRequest.id,
    summary: externalId ? 'Build iniciado' : 'Falha ao iniciar build',
    metadata: { provider, environment, profile: buildProfile, build_id: build.id },
  });

  return Response.json({
    ok: externalId !== null,
    build_id: build.id,
    external_id: externalId,
    status: updateData.status,
    request_id: buildRequest.id,
  });
});
