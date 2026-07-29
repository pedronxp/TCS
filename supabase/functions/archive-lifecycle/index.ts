import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const googleServiceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
const driveFolderRoot = Deno.env.get('DRIVE_FOLDER_ROOT_ID') ?? '';
const admin = createClient(supabaseUrl, serviceKey);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ArchiveEntry = {
  key: string;
  name: string;
  bucket: string;
  path: string;
  drive_id: string;
  content_type: string;
  sha256: string;
  size: number;
};

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(): Promise<string> {
  if (!googleServiceAccountKey) throw new Error('google_drive_not_configured');
  const serviceAccount = JSON.parse(atob(googleServiceAccountKey));
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
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
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${base64Url(new Uint8Array(signature))}`,
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

async function ensureDriveFolder(token: string, parentId: string, name: string): Promise<string> {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const existingResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!existingResponse.ok) throw new Error(`drive_folder_lookup_failed:${existingResponse.status}`);
  const existing = await existingResponse.json();
  if (existing.files?.length) return existing.files[0].id;
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  if (!createResponse.ok) throw new Error(`drive_folder_create_failed:${createResponse.status}`);
  const created = await createResponse.json();
  return created.id;
}

async function moveFile(
  bucket: string,
  path: string,
  token: string,
  folderId: string,
  name: string,
  key: string,
): Promise<ArchiveEntry | null> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;
  const contentType = bucket === 'laudos' ? 'application/pdf' : (data.type || 'image/jpeg');
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', data, name);
  const upload = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  );
  if (!upload.ok) throw new Error(`drive_upload_failed:${upload.status}`);
  const uploaded = await upload.json();
  const checksum = await sha256(data);
  const quarantine = `quarentena/${path}`;
  const { error: copyError } = await admin.storage.from(bucket).copy(path, quarantine);
  if (copyError) throw new Error(`quarantine_copy_failed:${copyError.message}`);
  const { error: removeError } = await admin.storage.from(bucket).remove([path]);
  if (removeError) throw new Error(`storage_remove_failed:${removeError.message}`);
  return {
    key,
    name,
    bucket,
    path,
    drive_id: uploaded.id,
    content_type: contentType,
    sha256: checksum,
    size: data.size,
  };
}

async function authorize(request: Request): Promise<boolean> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  if (authorization === `Bearer ${serviceKey}`) return true;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { error } = await userClient.rpc('list_internal_archive_lifecycle', { p_limit: 1 });
  return !error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders });
  }
  if (!await authorize(request)) {
    return Response.json({ error: 'archive_write_not_allowed' }, { status: 403, headers: corsHeaders });
  }

  const body = await request.json().catch(() => ({}));
  const forcedIds = Array.isArray(body.vistoria_ids)
    ? body.vistoria_ids.filter((id: unknown): id is string => typeof id === 'string').slice(0, 50)
    : undefined;
  const { data: configRow } = await admin
    .from('configuracoes').select('valor').eq('id', 'arquivamento').single();
  const config = configRow?.valor ?? { mode: 'manual', enabled: false, days_threshold: 7 };
  if (!config.enabled && !forcedIds?.length) {
    return Response.json({ ok: true, message: 'Arquivamento desativado.' }, { headers: corsHeaders });
  }

  const cutoff = new Date(
    Date.now() - Math.max(1, Math.min(365, config.days_threshold ?? 7)) * 86_400_000,
  ).toISOString();
  const fields = 'id, municipio, nivelRisco, dataVistoria, fotoUrl, fotosUrls, protocolo';
  const query = forcedIds?.length
    ? admin.from('vistorias').select(fields).in('id', forcedIds).eq('storage_location', 'supabase')
    : admin.from('vistorias').select(fields).eq('storage_location', 'supabase').lt('dataVistoria', cutoff);
  const { data: inspections, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
  if (!inspections?.length) return Response.json({ ok: true, archived: 0 }, { headers: corsHeaders });

  const results: Array<{ id: string; status: string }> = [];
  let driveToken: string;
  try {
    driveToken = await getGoogleAccessToken();
    if (!driveFolderRoot) throw new Error('drive_folder_root_not_configured');
  } catch (cause) {
    return Response.json({
      ok: false,
      error: cause instanceof Error ? cause.message : 'google_drive_not_configured',
    }, { status: 503, headers: corsHeaders });
  }

  for (const inspection of inspections) {
    try {
      await admin.from('vistorias').update({ storage_location: 'archiving' }).eq('id', inspection.id);
      const date = new Date(inspection.dataVistoria ?? Date.now());
      const year = date.getFullYear().toString();
      const month = date.toLocaleString('pt-BR', {
        month: 'long',
        timeZone: 'America/Belem',
      });
      const municipality = inspection.municipio ?? 'desconhecido';
      const risk = (inspection.nivelRisco ?? 'r0').toUpperCase();
      const archiveRoot = await ensureDriveFolder(driveToken, driveFolderRoot, 'Defesa Civil - Arquivo');
      const yearFolder = await ensureDriveFolder(driveToken, archiveRoot, year);
      const monthFolder = await ensureDriveFolder(driveToken, yearFolder, month);
      const municipalityFolder = await ensureDriveFolder(driveToken, monthFolder, municipality);
      const inspectionFolder = await ensureDriveFolder(
        driveToken,
        municipalityFolder,
        `vistoria-${inspection.id}-${risk}`,
      );

      const manifest: ArchiveEntry[] = [];
      const laudo = await moveFile(
        'laudos',
        `${municipality}/${inspection.id}.pdf`,
        driveToken,
        inspectionFolder,
        'laudo.pdf',
        'laudo',
      );
      if (laudo) manifest.push(laudo);
      const photos: string[] = Array.isArray(inspection.fotosUrls)
        ? inspection.fotosUrls
        : (inspection.fotoUrl ? [inspection.fotoUrl] : []);
      for (let index = 0; index < photos.length; index += 1) {
        const raw = photos[index];
        const separator = raw.indexOf(':');
        const bucket = separator > 0 ? raw.slice(0, separator) : 'fotos';
        const path = separator > 0 ? raw.slice(separator + 1) : raw;
        const key = `foto_${index + 1}`;
        const photo = await moveFile(
          bucket, path, driveToken, inspectionFolder, `${key}.jpg`, key,
        );
        if (photo) manifest.push(photo);
      }
      if (!manifest.length) throw new Error('archive_has_no_files');

      const manifestIdentity = new Blob([JSON.stringify(manifest.map((entry) => ({
        key: entry.key,
        drive_id: entry.drive_id,
        sha256: entry.sha256,
        size: entry.size,
      })))], { type: 'application/json' });
      const driveFileIds = Object.fromEntries(manifest.map((entry) => [entry.key, entry.drive_id]));
      const { error: updateError } = await admin.from('vistorias').update({
        storage_location: 'drive',
        drive_folder_url: `https://drive.google.com/drive/folders/${inspectionFolder}`,
        drive_file_ids: driveFileIds,
        archive_manifest: manifest,
        archive_checksum: await sha256(manifestIdentity),
        archived_at: new Date().toISOString(),
      }).eq('id', inspection.id);
      if (updateError) throw new Error(`archive_update_failed:${updateError.message}`);
      results.push({ id: inspection.id, status: 'drive' });
    } catch (cause) {
      await admin.from('vistorias').update({ storage_location: 'failed' }).eq('id', inspection.id);
      results.push({ id: inspection.id, status: 'failed' });
      console.error('archive_failed', inspection.id, cause);
    }
  }
  return Response.json({
    ok: true,
    archived: results.filter((result) => result.status === 'drive').length,
    results,
  }, { headers: corsHeaders });
});
