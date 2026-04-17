import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
  if (!res.ok) { console.error('EAS error', await res.text()); return null; }
  const json = await res.json();
  return json.data?.id ?? null;
}

async function triggerGitHub(buildProfile: string, version: string, changelog: string): Promise<string | null> {
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
      body: JSON.stringify({ ref: 'main', inputs: { profile: buildProfile, version, changelog } }),
    },
  );
  if (!res.ok) { console.error('GitHub dispatch error', await res.text()); return null; }
  return 'pending';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  const { data: userRow } = await supabase
    .from('users')
    .select('role, name')
    .eq('uid', user.id)
    .single();
  if (userRow?.role !== 'master_admin') return new Response('Forbidden', { status: 403 });

  const body = await req.json();
  const { provider = 'eas', version, profile: buildProfile = 'preview', changelog = '' } = body;

  if (!version) return Response.json({ ok: false, error: 'version é obrigatório' }, { status: 400 });

  const { data: build, error: insertError } = await supabase
    .from('builds')
    .insert({
      provider,
      version,
      profile: buildProfile,
      changelog,
      status: 'queued',
      initiated_by: user.id,
      initiated_by_name: userRow?.name ?? user.email,
    })
    .select()
    .single();

  if (insertError) return Response.json({ ok: false, error: insertError.message }, { status: 500 });

  let externalId: string | null = null;
  let updateData: Record<string, string> = {};

  if (provider === 'eas') {
    externalId = await triggerEAS(buildProfile, version);
    updateData = externalId ? { status: 'building', eas_build_id: externalId } : { status: 'failed' };
  } else {
    externalId = await triggerGitHub(buildProfile, version, changelog);
    updateData = externalId ? { status: 'building' } : { status: 'failed' };
  }

  await supabase.from('builds').update(updateData).eq('id', build.id);

  return Response.json({
    ok: externalId !== null,
    build_id: build.id,
    external_id: externalId,
    status: updateData.status,
  });
});
