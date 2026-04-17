import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Chave JSON da Service Account do Google (base64-encoded)
const GOOGLE_SA_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
const DRIVE_FOLDER_ROOT = Deno.env.get('DRIVE_FOLDER_ROOT_ID') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Helpers Google Drive ───────────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string | null> {
  if (!GOOGLE_SA_KEY) return null;
  try {
    const sa = JSON.parse(atob(GOOGLE_SA_KEY));
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));
    const toSign = `${header}.${payload}`;
    // Importa chave privada RSA
    const pemBody = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    const keyBuf = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', keyBuf,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign'],
    );
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(toSign));
    const jwt = `${toSign}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const json = await res.json();
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

async function ensureDriveFolder(token: string, parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(`'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (json.files?.length) return json.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const created = await create.json();
  return created.id;
}

async function uploadFileToDrive(
  token: string,
  folderId: string,
  name: string,
  blob: Blob,
  mimeType: string,
): Promise<string> {
  const meta = JSON.stringify({ name, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', blob, name);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  return json.id;
}

// ── Mover arquivo: Supabase Storage → Drive ───────────────────────────────────

async function moverArquivo(
  bucket: string,
  path: string,
  token: string,
  folderId: string,
  nome: string,
): Promise<string | null> {
  // Download do Supabase Storage
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  const mime = bucket === 'laudos' ? 'application/pdf' : (data.type || 'image/jpeg');
  const driveId = await uploadFileToDrive(token, folderId, nome, data, mime);
  // Move para quarentena (cópia de segurança por 30 dias)
  await supabase.storage.from(bucket).copy(path, `quarentena/${path}`);
  await supabase.storage.from(bucket).remove([path]);
  return driveId;
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Aceita POST com body { vistoria_ids?: string[] } ou roda tudo elegível
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const forceIds: string[] | undefined = body.vistoria_ids;

  // Carrega config
  const { data: cfg } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('id', 'arquivamento')
    .single();

  const config = cfg?.valor ?? { mode: 'manual', enabled: false, days_threshold: 7 };

  if (!config.enabled && !forceIds?.length) {
    return Response.json({ ok: true, message: 'Arquivamento desativado.' });
  }

  const daysThreshold: number = config.days_threshold ?? 7;
  const cutoff = new Date(Date.now() - daysThreshold * 86_400_000).toISOString();

  // Busca vistorias elegíveis
  let q = supabase
    .from('vistorias')
    .select('id, municipio, nivelRisco:nivelRisco, dataVistoria, fotoUrl, fotosUrls, protocolo')
    .eq('storage_location', 'supabase')
    .lt('dataVistoria', cutoff);

  if (forceIds?.length) {
    q = supabase
      .from('vistorias')
      .select('id, municipio, nivelRisco:nivelRisco, dataVistoria, fotoUrl, fotosUrls, protocolo')
      .in('id', forceIds);
  }

  const { data: vistorias, error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!vistorias?.length) return Response.json({ ok: true, archived: 0 });

  const token = await getGoogleAccessToken();
  const results: { id: string; status: string }[] = [];

  for (const v of vistorias) {
    try {
      // Marca como "archiving"
      await supabase.from('vistorias').update({ storage_location: 'archiving' }).eq('id', v.id);

      if (!token || !DRIVE_FOLDER_ROOT) {
        // Drive não configurado — mantém em archiving para retry futuro
        results.push({ id: v.id, status: 'archiving_no_drive' });
        continue;
      }

      // Monta pasta: Defesa Civil - Arquivo/{ano}/{mês}/{município}/vistoria-{id}-R{nivel}
      const dt = new Date(v.dataVistoria ?? Date.now());
      const ano = dt.getFullYear().toString();
      const mes = dt.toLocaleString('pt-BR', { month: 'long', timeZone: 'America/Belem' });
      const municipio = v.municipio ?? 'desconhecido';
      const nivel = (v.nivelRisco ?? 'r0').toUpperCase();

      const rootId = await ensureDriveFolder(token, DRIVE_FOLDER_ROOT, 'Defesa Civil - Arquivo');
      const anoId = await ensureDriveFolder(token, rootId, ano);
      const mesId = await ensureDriveFolder(token, anoId, mes);
      const munId = await ensureDriveFolder(token, mesId, municipio);
      const vstId = await ensureDriveFolder(token, munId, `vistoria-${v.id}-${nivel}`);

      const driveFileIds: Record<string, string> = {};

      // Laudo PDF
      if (v.municipio) {
        const laudoId = await moverArquivo('laudos', `${v.municipio}/${v.id}.pdf`, token, vstId, 'laudo.pdf');
        if (laudoId) driveFileIds['laudo'] = laudoId;
      }

      // Fotos
      const fotos: string[] = Array.isArray(v.fotosUrls) ? v.fotosUrls : (v.fotoUrl ? [v.fotoUrl] : []);
      for (let i = 0; i < fotos.length; i++) {
        const raw = fotos[i];
        const path = raw.includes(':') ? raw.split(':')[1] : raw;
        const bucket = raw.includes(':') ? raw.split(':')[0] : 'fotos';
        const fotoId = await moverArquivo(bucket, path, token, vstId, `foto_${i + 1}.jpg`);
        if (fotoId) driveFileIds[`foto_${i + 1}`] = fotoId;
      }

      const folderUrl = `https://drive.google.com/drive/folders/${vstId}`;
      await supabase.from('vistorias').update({
        storage_location: 'drive',
        drive_folder_url: folderUrl,
        drive_file_ids: driveFileIds,
        archived_at: new Date().toISOString(),
      }).eq('id', v.id);

      results.push({ id: v.id, status: 'drive' });
    } catch (err) {
      await supabase.from('vistorias').update({ storage_location: 'failed' }).eq('id', v.id);
      results.push({ id: v.id, status: 'failed' });
      console.error('Erro ao arquivar vistoria', v.id, err);
    }
  }

  return Response.json({ ok: true, archived: results.filter((r) => r.status === 'drive').length, results });
});
