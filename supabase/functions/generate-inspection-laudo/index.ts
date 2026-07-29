import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from 'https://esm.sh/pdf-lib@1.17.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GenerationRequest {
  inspection_id?: unknown;
  customer_id?: unknown;
  force?: unknown;
}

interface GenerationAuthorization {
  inspection_id: string;
  path: string;
  document_status: 'available' | 'pending_generation' | 'missing_file';
  already_available: boolean;
}

interface GenerationFinalization {
  inspection_id: string;
  path: string;
  generated_at: string;
  document_status: 'available';
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, '*')
    .replace(/[^\u0009\u000a\u000d\u0020-\u00ff]/g, '')
    .trim();
}

function storageRef(value: unknown): { bucket: string; path: string } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('http')) return { bucket: '', path: value };
  const separator = value.indexOf(':');
  if (separator > 0) {
    return { bucket: value.slice(0, separator), path: value.slice(separator + 1) };
  }
  return { bucket: 'fotos', path: value };
}

async function loadImage(value: unknown): Promise<{ bytes: Uint8Array; extension: string } | null> {
  const reference = storageRef(value);
  if (!reference) return null;
  try {
    if (!reference.bucket) {
      const response = await fetch(reference.path);
      if (!response.ok) return null;
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        extension: reference.path.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg',
      };
    }
    if (reference.path.startsWith('/') || reference.path.split('/').includes('..')) return null;
    const { data, error } = await admin.storage.from(reference.bucket).download(reference.path);
    if (error || !data) return null;
    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      extension: reference.path.split('.').pop()?.toLowerCase() || 'jpg',
    };
  } catch {
    return null;
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of pdfText(text).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

async function buildPdf(inspection: Record<string, unknown>): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 42;
  const contentWidth = pageSize[0] - margin * 2;
  let page: PDFPage;
  let cursorY: number;

  const addPage = () => {
    page = document.addPage(pageSize);
    page.drawRectangle({ x: 0, y: pageSize[1] - 8, width: pageSize[0], height: 8, color: rgb(0.48, 0.33, 0.23) });
    cursorY = pageSize[1] - 42;
  };
  const ensureSpace = (height: number) => {
    if (cursorY - height < 58) addPage();
  };
  const line = (text: string, size = 10, options: { strong?: boolean; color?: [number, number, number] } = {}) => {
    const font = options.strong ? bold : regular;
    const color: [number, number, number] = options.color || [0.12, 0.11, 0.1];
    for (const value of wrap(text, font, size, contentWidth)) {
      ensureSpace(size + 7);
      page.drawText(value, { x: margin, y: cursorY - size, size, font, color: rgb(...color) });
      cursorY -= size + 6;
    }
  };
  const section = (title: string) => {
    ensureSpace(34);
    cursorY -= 8;
    line(title.toUpperCase(), 9, { strong: true, color: [0.48, 0.33, 0.23] });
    page.drawLine({
      start: { x: margin, y: cursorY - 2 },
      end: { x: pageSize[0] - margin, y: cursorY - 2 },
      thickness: 0.5,
      color: rgb(0.82, 0.79, 0.75),
    });
    cursorY -= 8;
  };
  const field = (label: string, value: unknown) => {
    ensureSpace(28);
    page.drawText(pdfText(label), { x: margin, y: cursorY - 10, size: 9, font: bold, color: rgb(0.38, 0.35, 0.32) });
    const values = wrap(pdfText(value) || '-', regular, 10, contentWidth - 142);
    values.forEach((entry, index) => {
      if (index > 0) cursorY -= 13;
      page.drawText(entry, { x: margin + 142, y: cursorY - 10, size: 10, font: regular, color: rgb(0.12, 0.11, 0.1) });
    });
    cursorY -= 19;
  };

  addPage();
  line('TCS - RELATORIO DE RISCO', 10, { strong: true, color: [0.48, 0.33, 0.23] });
  line('Laudo Tecnico de Vistoria', 21, { strong: true });
  line('Documento tecnico gerado a partir da vistoria concluida', 9, { color: [0.45, 0.42, 0.39] });

  section('Identificacao');
  field('Protocolo', inspection.protocolo || String(inspection.id).slice(0, 8).toUpperCase());
  field('Data da vistoria', inspection.dataVistoria ? new Date(String(inspection.dataVistoria)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-');
  field('Municipio', inspection.municipio || inspection.municipio_agente);
  field('Agente responsavel', inspection.agenteNome);
  field('Responsavel pelo imovel', inspection.responsavelNome);

  section('Local vistoriado');
  field(
    'Endereco',
    inspection.endereco
      || [inspection.enderecoRua, inspection.enderecoNumero, inspection.enderecoBairro].filter(Boolean).join(', '),
  );
  field('Coordenadas', inspection.latitude && inspection.longitude ? `${inspection.latitude}, ${inspection.longitude}` : '-');

  section('Resultado tecnico');
  field('Nivel de risco', String(inspection.nivelRisco || 'nao classificado').toUpperCase());
  field('Pontuacao', inspection.pontuacaoTotal);
  field('Formulario', inspection.formularioId);

  let answers: Record<string, unknown> = {};
  try {
    const raw = inspection.respostasJson;
    answers = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>) || {};
  } catch {
    answers = {};
  }
  const answerEntries = Object.entries(answers).filter(([, value]) => value !== null && value !== undefined && String(value).trim());
  if (answerEntries.length) {
    section('Itens vistoriados');
    for (const [key, value] of answerEntries) field(key, typeof value === 'object' ? JSON.stringify(value) : value);
  }

  const photos = [
    ...(Array.isArray(inspection.fotosUrls) ? inspection.fotosUrls : []),
    ...(!Array.isArray(inspection.fotosUrls) && inspection.fotoUrl ? [inspection.fotoUrl] : []),
  ].slice(0, 6);
  if (photos.length) {
    section(`Registro fotografico (${photos.length})`);
    for (let index = 0; index < photos.length; index += 1) {
      const loaded = await loadImage(photos[index]);
      if (!loaded) continue;
      try {
        const image = loaded.extension === 'png'
          ? await document.embedPng(loaded.bytes)
          : await document.embedJpg(loaded.bytes);
        ensureSpace(230);
        const dimensions = image.scaleToFit(contentWidth, 205);
        page.drawImage(image, {
          x: margin + (contentWidth - dimensions.width) / 2,
          y: cursorY - dimensions.height,
          width: dimensions.width,
          height: dimensions.height,
        });
        cursorY -= dimensions.height + 8;
        line(`Foto ${index + 1}`, 8, { color: [0.45, 0.42, 0.39] });
      } catch {
        // A foto permanece registrada na vistoria mesmo quando o formato não
        // pode ser incorporado ao PDF.
      }
    }
  }

  section('Responsabilidade tecnica');
  line('Este documento reproduz os dados registrados na vistoria e deve ser analisado em conjunto com as evidencias e normas aplicaveis.', 9);
  cursorY -= 28;
  page.drawLine({
    start: { x: margin + 90, y: cursorY },
    end: { x: pageSize[0] - margin - 90, y: cursorY },
    thickness: 0.6,
    color: rgb(0.38, 0.35, 0.32),
  });
  cursorY -= 16;
  line(pdfText(inspection.agenteNome) || 'Agente responsavel', 9, { strong: true });

  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  document.getPages().forEach((item, index) => {
    item.drawLine({
      start: { x: margin, y: 38 },
      end: { x: pageSize[0] - margin, y: 38 },
      thickness: 0.4,
      color: rgb(0.82, 0.79, 0.75),
    });
    item.drawText(`TCS - Laudo gerado em ${generatedAt} - Pagina ${index + 1}/${document.getPageCount()}`, {
      x: margin,
      y: 23,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.42, 0.39),
    });
  });

  document.setTitle(`Laudo ${pdfText(inspection.protocolo) || inspection.id}`);
  document.setCreator('TCS');
  return document.save();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'authentication_required' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ ok: false, error: 'invalid_session' }, 401);

  let body: GenerationRequest;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!isUuid(body.inspection_id) || (body.customer_id !== undefined && typeof body.customer_id !== 'string')) {
    return json({ ok: false, error: 'invalid_generation_request' }, 400);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authorizationData, error: authorizationError } = await caller.rpc(
    'authorize_inspection_laudo_generation',
    {
      p_inspection_id: body.inspection_id,
      p_customer_id: typeof body.customer_id === 'string' ? body.customer_id : null,
    },
  );
  if (authorizationError || !authorizationData) {
    const forbidden = authorizationError?.code === '42501';
    return json({ ok: false, error: forbidden ? 'generation_not_allowed' : 'inspection_not_available' }, forbidden ? 403 : 404);
  }

  const authorization = authorizationData as unknown as GenerationAuthorization;
  if (!authorization.path || authorization.path.startsWith('/') || authorization.path.split('/').includes('..')) {
    return json({ ok: false, error: 'invalid_storage_path' }, 422);
  }

  if (authorization.already_available && body.force !== true) {
    const generatedAt = new Date().toISOString();
    const { data: finalizationData, error: finalizationError } = await admin.rpc(
      'finalize_inspection_laudo_generation',
      {
        p_inspection_id: body.inspection_id,
        p_storage_path: authorization.path,
        p_generated_at: generatedAt,
      },
    );
    if (finalizationError || !finalizationData) {
      console.error('[generate-inspection-laudo:finalize-existing]', {
        code: finalizationError?.code,
        message: finalizationError?.message,
      });
      return json({ ok: false, error: 'document_finalize_failed' }, 502);
    }
    const finalization = finalizationData as unknown as GenerationFinalization;
    const { data: signed, error } = await admin.storage.from('laudos').createSignedUrl(authorization.path, 60);
    if (!error && signed?.signedUrl) {
      return json({
        ok: true,
        reused: true,
        document_status: 'available',
        signed_url: signed.signedUrl,
        expires_in: 60,
        generated_at: finalization.generated_at,
      });
    }
    console.error('[generate-inspection-laudo:sign-existing]', {
      message: error?.message,
    });
    return json({ ok: false, error: 'document_signing_failed' }, 502);
  }

  const { data: inspection, error: inspectionError } = await admin
    .from('vistorias')
    .select('*')
    .eq('id', body.inspection_id)
    .single();
  if (inspectionError || !inspection) return json({ ok: false, error: 'inspection_not_found' }, 404);

  try {
    const pdf = await buildPdf(inspection);
    const { error: uploadError } = await admin.storage
      .from('laudos')
      .upload(authorization.path, pdf, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });
    if (uploadError) {
      console.error('[generate-inspection-laudo:upload]', {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
      });
      return json({ ok: false, error: 'document_upload_failed' }, 502);
    }

    const generatedAt = new Date().toISOString();
    const { data: finalizationData, error: finalizationError } = await admin.rpc(
      'finalize_inspection_laudo_generation',
      {
        p_inspection_id: body.inspection_id,
        p_storage_path: authorization.path,
        p_generated_at: generatedAt,
      },
    );
    if (finalizationError || !finalizationData) {
      console.error('[generate-inspection-laudo:finalize]', {
        code: finalizationError?.code,
        message: finalizationError?.message,
      });
      return json({ ok: false, error: 'document_finalize_failed' }, 502);
    }

    const { data: signed, error: signedError } = await admin.storage
      .from('laudos')
      .createSignedUrl(authorization.path, 60);
    if (signedError || !signed?.signedUrl) {
      console.error('[generate-inspection-laudo:sign]', {
        message: signedError?.message,
      });
      return json({ ok: false, error: 'document_signing_failed' }, 502);
    }

    await admin.from('audit_logs').insert({
      uid: user.id,
      acao: 'generate_laudo',
      entidade: 'vistoria',
      entidade_id: body.inspection_id,
      metadata: {
        source: typeof body.customer_id === 'string' ? 'web' : 'app_sync',
        size_bytes: pdf.byteLength,
      },
      criado_em: generatedAt,
    });

    return json({
      ok: true,
      reused: false,
      document_status: 'available',
      signed_url: signed.signedUrl,
      expires_in: 60,
      generated_at: generatedAt,
      size_bytes: pdf.byteLength,
    });
  } catch (error) {
    console.error('[generate-inspection-laudo]', error);
    return json({ ok: false, error: 'document_generation_failed' }, 500);
  }
});
