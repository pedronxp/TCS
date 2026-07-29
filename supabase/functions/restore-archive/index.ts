import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const googleServiceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');

type ArchiveEntry = {
  key?: string;
  name?: string;
  bucket?: string;
  path?: string;
  drive_id?: string;
  content_type?: string;
  sha256?: string;
  size?: number;
};

type Claim = {
  request_id: string;
  inspection_id: string;
  municipality: string | null;
  drive_folder_url: string | null;
  drive_file_ids: Record<string, string>;
  archive_manifest: ArchiveEntry[];
  archive_checksum: string | null;
  photo_references: string[];
};

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getGoogleAccessToken(): Promise<string> {
  if (!googleServiceAccountKey) throw new Error('google_drive_not_configured');
  const raw = atob(googleServiceAccountKey);
  const serviceAccount = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const pem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (char) => char.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`google_auth_failed:${response.status}`);
  const body = await response.json();
  if (!body.access_token) throw new Error('google_auth_failed:no_token');
  return body.access_token;
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeSegment(value: string | null | undefined, fallback: string): string {
  const cleaned = (value ?? '').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function folderIdFromUrl(url: string | null): string | null {
  return url?.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

async function listLegacyFolderFiles(token: string, folderId: string): Promise<ArchiveEntry[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,md5Checksum)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`drive_list_failed:${response.status}`);
  const body = await response.json();
  return (body.files ?? []).map((file: Record<string, string>) => ({
    key: file.name === 'laudo.pdf' ? 'laudo' : file.name.replace(/\.[^.]+$/, ''),
    name: file.name,
    drive_id: file.id,
    content_type: file.mimeType,
    size: Number(file.size || 0),
  }));
}

function legacyEntries(claim: Claim): ArchiveEntry[] {
  return Object.entries(claim.drive_file_ids ?? {}).map(([key, driveId]) => ({
    key,
    name: key === 'laudo' ? 'laudo.pdf' : `${key}.jpg`,
    drive_id: driveId,
    content_type: key === 'laudo' ? 'application/pdf' : 'image/jpeg',
  }));
}

function storageDestination(entry: ArchiveEntry, claim: Claim, index: number) {
  if (entry.bucket && entry.path) return { bucket: entry.bucket, path: entry.path };
  if (entry.key === 'laudo' || entry.name === 'laudo.pdf') {
    return {
      bucket: 'laudos',
      path: `${safeSegment(claim.municipality, 'geral')}/${claim.inspection_id}.pdf`,
    };
  }
  const original = claim.photo_references[index - 1];
  if (original) {
    const separator = original.indexOf(':');
    return separator > 0
      ? { bucket: original.slice(0, separator), path: original.slice(separator + 1) }
      : { bucket: 'fotos', path: original };
  }
  return {
    bucket: 'fotos',
    path: `restauradas/${claim.inspection_id}/${safeSegment(entry.name, `foto-${index}.jpg`)}`,
  };
}

async function markFailed(
  admin: ReturnType<typeof createClient>,
  claim: Partial<Claim>,
  actorId: string | null,
  message: string,
) {
  if (!claim.request_id) return;
  await admin.rpc('fail_archive_restore_internal', {
    p_request_id: claim.request_id,
    p_actor_id: actorId,
    p_error: message.slice(0, 500),
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'authentication_required' }, { status: 401, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let claim: Partial<Claim> = {};
  let actorId: string | null = null;
  const uploaded: Array<{ bucket: string; path: string }> = [];

  try {
    const body = await request.json();
    if (typeof body?.request_id !== 'string') throw new Error('request_id_required');

    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error('authentication_required');
    actorId = userData.user.id;

    const { data, error } = await userClient.rpc('claim_internal_archive_restore', {
      p_request_id: body.request_id,
    });
    if (error) throw new Error(error.message);
    claim = data as unknown as Claim;

    const driveToken = await getGoogleAccessToken();
    let entries = Array.isArray(claim.archive_manifest) && claim.archive_manifest.length
      ? claim.archive_manifest
      : legacyEntries(claim as Claim);
    if (!entries.length) {
      const folderId = folderIdFromUrl(claim.drive_folder_url ?? null);
      if (!folderId) throw new Error('archive_manifest_unavailable');
      entries = await listLegacyFolderFiles(driveToken, folderId);
    }
    if (!entries.length) throw new Error('archive_empty');

    const restoredManifest: ArchiveEntry[] = [];
    let photoIndex = 0;
    for (const entry of entries) {
      if (!entry.drive_id) throw new Error(`drive_file_missing:${entry.key ?? entry.name ?? 'unknown'}`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.drive_id)}?alt=media`,
        { headers: { Authorization: `Bearer ${driveToken}` } },
      );
      if (!response.ok) throw new Error(`drive_download_failed:${response.status}`);
      const blob = await response.blob();
      const checksum = await sha256(blob);
      if (entry.sha256 && checksum !== entry.sha256) {
        throw new Error(`checksum_mismatch:${entry.key ?? entry.name ?? entry.drive_id}`);
      }
      if (entry.size && blob.size !== entry.size) {
        throw new Error(`size_mismatch:${entry.key ?? entry.name ?? entry.drive_id}`);
      }

      if (entry.key !== 'laudo' && entry.name !== 'laudo.pdf') photoIndex += 1;
      const destination = storageDestination(entry, claim as Claim, photoIndex);
      const { error: uploadError } = await admin.storage
        .from(destination.bucket)
        .upload(destination.path, blob, {
          contentType: entry.content_type || blob.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: true,
        });
      if (uploadError) throw new Error(`storage_upload_failed:${uploadError.message}`);
      uploaded.push(destination);
      restoredManifest.push({
        ...entry,
        bucket: destination.bucket,
        path: destination.path,
        sha256: checksum,
        size: blob.size,
      });
    }

    const { error: finalizeError } = await admin.rpc('finalize_archive_restore_internal', {
      p_request_id: claim.request_id,
      p_actor_id: actorId,
      p_restored_manifest: restoredManifest,
    });
    if (finalizeError) throw new Error(`restore_finalize_failed:${finalizeError.message}`);
    return Response.json({
      ok: true,
      request_id: claim.request_id,
      inspection_id: claim.inspection_id,
      restored_files: restoredManifest.length,
    }, { headers: corsHeaders });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'restore_failed';
    for (const item of uploaded) {
      await admin.storage.from(item.bucket).remove([item.path]);
    }
    await markFailed(admin, claim, actorId, message);
    const status = message.includes('not_allowed') || message.includes('aal2')
      ? 403
      : message.includes('authentication') ? 401 : 400;
    return Response.json({ ok: false, error: message }, { status, headers: corsHeaders });
  }
});
