import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Event = 'token_generated' | 'token_limit_request' | 'delete_inspection';
type RequestBody = { event?: Event; invitationCode?: string; inspectionId?: string; reason?: string };
type Profile = { uid: string; name: string | null; role: string; municipio: string | null; isApproved: boolean; token_limit: number | null };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function validExpoToken(token: unknown): token is string {
  return typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[^\]\r\n]{10,255}\]$/.test(token);
}

async function sendExpo(payloads: Record<string, unknown>[]) {
  if (payloads.length === 0) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
    });
    if (!response.ok) console.error('expo_push_rejected', response.status);
  } catch (error) {
    // A notification must never turn a successful privileged mutation into a reported failure.
    console.error('expo_push_failed', error instanceof Error ? error.message : String(error));
  }
}

async function masterTokens() {
  const { data, error } = await admin
    .from('users')
    .select('fcmToken')
    .eq('role', 'master_admin')
    .eq('isApproved', true)
    .not('fcmToken', 'is', null);
  if (error) throw error;
  return [...new Set((data ?? []).map((user) => user.fcmToken).filter(validExpoToken))];
}

function profileName(profile: Profile) {
  return (profile.name ?? 'Usuário').trim().slice(0, 80) || 'Usuário';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'unauthorized' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  let body: RequestBody;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!['token_generated', 'token_limit_request', 'delete_inspection'].includes(body.event ?? '')) {
    return json({ error: 'invalid_event' }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('uid,name,role,municipio,isApproved,token_limit')
    .eq('uid', user.id)
    .maybeSingle<Profile>();
  if (profileError || !profile?.isApproved) return json({ error: 'forbidden' }, 403);

  if (body.event === 'token_generated') {
    const code = typeof body.invitationCode === 'string' ? body.invitationCode.trim().toUpperCase() : '';
    if (!/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/.test(code)) return json({ error: 'invalid_invitation' }, 400);
    if (!['admin', 'master_admin'].includes(profile.role)) return json({ error: 'forbidden' }, 403);

    const { data: invitation, error } = await admin
      .from('invite_tokens')
      .select('role,municipio,criadoPor')
      .eq('codigo', code)
      .maybeSingle();
    if (error || !invitation || invitation.criadoPor !== user.id) return json({ error: 'forbidden' }, 403);

    const roles: Record<string, string> = { agent: 'Agente', supervisor: 'Supervisor', admin: 'Administrador' };
    const payloads = (await masterTokens()).map((token) => ({
      to: token,
      title: '🔑 Token de acesso gerado',
      body: `${profileName(profile)} gerou um convite de ${roles[invitation.role] ?? 'usuário'} em ${invitation.municipio}.`,
      data: { tipo: 'token_gerado', municipio: invitation.municipio },
      sound: 'default', channelId: 'tokens', priority: 'normal', ttl: 86400,
    }));
    await sendExpo(payloads);
    return json({ ok: true });
  }

  if (body.event === 'token_limit_request') {
    if (profile.role !== 'admin' || !profile.municipio) return json({ error: 'forbidden' }, 403);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(3, 0, 0, 0); // first day in America/Sao_Paulo during standard time
    const { count, error } = await admin
      .from('invite_tokens')
      .select('codigo', { count: 'exact', head: true })
      .eq('criadoPor', user.id)
      .gte('criadoEm', startOfMonth.toISOString());
    if (error) return json({ error: 'notification_context_failed' }, 500);
    const payloads = (await masterTokens()).map((token) => ({
      to: token,
      title: '📊 Solicitação de aumento de limite',
      body: `${profileName(profile)} (${profile.municipio}) usou ${count ?? 0}/${profile.token_limit ?? 20} tokens e solicita aumento de limite.`,
      data: { tipo: 'solicita_tokens', municipio: profile.municipio },
      sound: 'default', channelId: 'tokens', priority: 'high', ttl: 86400,
    }));
    await sendExpo(payloads);
    return json({ ok: true });
  }

  const inspectionId = typeof body.inspectionId === 'string' ? body.inspectionId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(inspectionId) || reason.length < 5 || reason.length > 500) {
    return json({ error: 'invalid_deletion_request' }, 400);
  }
  if (profile.role !== 'master_admin') return json({ error: 'forbidden' }, 403);

  const { data: inspection, error: inspectionError } = await admin
    .from('vistorias')
    .select('id,agenteUid,municipio,municipio_agente,endereco')
    .eq('id', inspectionId)
    .maybeSingle();
  if (inspectionError || !inspection) return json({ error: 'inspection_not_found' }, 404);

  // Execute the database mutation under the user's JWT, preserving the database authorization boundary.
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization! } },
  });
  const { error: deleteError } = await caller.rpc('delete_operational_inspection', {
    p_inspection_id: inspectionId,
    p_reason: reason,
  });
  if (deleteError) return json({ error: 'deletion_failed' }, 403);

  const municipio = inspection.municipio || inspection.municipio_agente || '';
  const [agentResult, staffResult] = await Promise.all([
    inspection.agenteUid
      ? admin.from('users').select('fcmToken').eq('uid', inspection.agenteUid).not('fcmToken', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    admin.from('users').select('fcmToken').eq('municipio', municipio).in('role', ['admin', 'supervisor']).eq('isApproved', true).not('fcmToken', 'is', null),
  ]);
  if (agentResult.error || staffResult.error) console.error('push_recipient_lookup_failed');
  const tokens = [...new Set([...(agentResult.data ?? []), ...(staffResult.data ?? [])].map((row) => row.fcmToken).filter(validExpoToken))];
  const address = String(inspection.endereco ?? 'Endereço não informado');
  const shortAddress = address.length > 50 ? `${address.slice(0, 47)}…` : address;
  await sendExpo(tokens.map((token) => ({
    to: token,
    title: 'Vistoria excluída',
    body: `"${shortAddress}" foi removida por ${profileName(profile)}. Motivo: ${reason}`,
    data: { tipo: 'vistoria_deletada', municipio },
    sound: 'default', channelId: 'alertas', priority: 'high', ttl: 86400,
  })));
  return json({ ok: true });
});
