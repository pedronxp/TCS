import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const recipients = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'private' } });
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Campaign = { id: string; title: string; body: string; priority: 'normal' | 'high'; category: string; payload: Record<string, unknown> };
type Recipient = { id: string; platform: string; provider: 'expo' | 'web_push'; endpoint: string; status: string };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function isExpoEndpoint(endpoint: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]\r\n]{10,255}\]$/.test(endpoint);
}

async function canDispatch(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (authorization === `Bearer ${serviceRoleKey}`) return true;
  if (!authorization) return false;
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await caller.rpc('get_internal_staff_profile');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return false;
  const permissions = (data as { permissions?: unknown }).permissions;
  return Array.isArray(permissions) && (permissions.includes('notification.manage') || permissions.includes('technical.write'));
}

async function sendExpo(campaign: Campaign, rows: Recipient[]) {
  const payload = rows.map((recipient) => ({
    to: recipient.endpoint,
    title: campaign.title,
    body: campaign.body,
    data: { ...campaign.payload, notification_campaign_id: campaign.id, category: campaign.category },
    sound: 'default',
    priority: campaign.priority,
  }));
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`expo_push_http_${response.status}`);
  const body = await response.json() as { data?: Array<{ status?: string; id?: string; message?: string; details?: unknown }> };
  return rows.map((recipient, index) => ({ recipient, receipt: body.data?.[index] }));
}

async function updateRecipient(id: string, status: 'sent' | 'failed' | 'skipped', receipt?: unknown, errorCode?: string) {
  await recipients.from('notification_campaign_recipients').update({
    status,
    provider_receipt: receipt ?? null,
    error_code: errorCode ?? null,
    attempted_at: new Date().toISOString(),
  }).eq('id', id);
}

async function processCampaign(candidate: Campaign) {
  const { data: campaign } = await admin.from('notification_campaigns')
    .update({ status: 'processing', started_at: new Date().toISOString(), failure_reason: null })
    .eq('id', candidate.id).eq('status', 'queued')
    .select('id,title,body,priority,category,payload').maybeSingle<Campaign>();
  if (!campaign) return { claimed: false, sent: 0, failed: 0, skipped: 0 };

  const { data: rows, error } = await recipients.from('notification_campaign_recipients')
    .select('id,platform,provider,endpoint,status').eq('campaign_id', campaign.id).eq('status', 'queued');
  if (error) throw error;
  const all = (rows ?? []) as Recipient[];
  const expoRows = all.filter((row) => row.provider === 'expo' && isExpoEndpoint(row.endpoint));
  const invalidExpoRows = all.filter((row) => row.provider === 'expo' && !isExpoEndpoint(row.endpoint));
  const webRows = all.filter((row) => row.provider === 'web_push');
  await Promise.all(invalidExpoRows.map((row) => updateRecipient(row.id, 'failed', undefined, 'invalid_expo_endpoint')));
  // Web Push delivery is deliberately fail-closed until VAPID credentials and a
  // service worker are configured.  The campaign stays observable as partial
  // instead of claiming that a browser notification was delivered.
  await Promise.all(webRows.map((row) => updateRecipient(row.id, 'skipped', undefined, 'web_push_not_configured')));

  let sent = 0;
  let failed = invalidExpoRows.length;
  for (let index = 0; index < expoRows.length; index += 100) {
    const batch = expoRows.slice(index, index + 100);
    try {
      const results = await sendExpo(campaign, batch);
      await Promise.all(results.map(async ({ recipient, receipt }) => {
        if (receipt?.status === 'ok') { sent += 1; await updateRecipient(recipient.id, 'sent', receipt); }
        else { failed += 1; await updateRecipient(recipient.id, 'failed', receipt, receipt?.message ?? 'expo_push_rejected'); }
      }));
    } catch (cause) {
      failed += batch.length;
      const errorCode = cause instanceof Error ? cause.message : 'expo_push_failed';
      await Promise.all(batch.map((row) => updateRecipient(row.id, 'failed', undefined, errorCode)));
    }
  }
  const skipped = webRows.length;
  const status = failed || skipped ? 'partial' : 'completed';
  await admin.from('notification_campaigns').update({
    status,
    completed_at: new Date().toISOString(),
    failure_reason: skipped ? 'web_push_not_configured' : null,
  }).eq('id', campaign.id);
  return { claimed: true, sent, failed, skipped };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!await canDispatch(request)) return json({ error: 'unauthorized' }, 401);
  const { data: queued, error } = await admin.from('notification_campaigns')
    .select('id,title,body,priority,category,payload').eq('status', 'queued').order('created_at').limit(10);
  if (error) return json({ error: 'campaign_query_failed' }, 500);
  const results = [];
  for (const campaign of (queued ?? []) as Campaign[]) {
    try { results.push(await processCampaign(campaign)); }
    catch (cause) {
      await admin.from('notification_campaigns').update({ status: 'failed', completed_at: new Date().toISOString(), failure_reason: cause instanceof Error ? cause.message : 'dispatch_failed' }).eq('id', campaign.id);
      results.push({ claimed: true, sent: 0, failed: 0, skipped: 0, error: 'dispatch_failed' });
    }
  }
  return json({ processed: results.filter((result) => result.claimed).length, results });
});
