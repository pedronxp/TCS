import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0';
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from 'https://esm.sh/pdf-lib@1.17.1';
import {
  hexToPdfRgb,
  humanizePdfFieldKey,
  PDF_COLORS,
  PDF_DESIGN_LABEL,
  PDF_DESIGN_VERSION,
  PDF_PAGE,
  PDF_RISK_COLORS,
} from '../_shared/pdfDesignSystem.ts';
import { DEFESA_CIVIL_LOGO_BASE64 } from '../_shared/defesaCivilLogo.ts';
import { formatGeoForDocument, readExifGeo } from '../_shared/exifGps.ts';
import { canonicalInspectionSnapshot, inspectionPhotoSources, resolveInspectionIssuance } from '../_shared/inspectionIssuance.ts';

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
  document_id?: unknown;
  issuance_status?: unknown;
  notes?: unknown;
  requester_name?: unknown;
  technical_signature_strokes?: unknown;
  media_waiver_reason?: unknown;
  base_legal?: unknown;
  technical_role?: unknown;
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

function readInspectionField(
  inspection: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const value = inspection[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function displayAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map(pdfText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return pdfText(value) || '-';
}

function formatPdfNumber(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return pdfText(value) || '0';
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

/**
 * Linhas de proveniência de uma foto, lidas do próprio arquivo.
 *
 * Sem convênio com o órgão municipal, o registro precisa se sustentar sozinho:
 * as coordenadas, o instante e o hash impressos aqui saem do JPEG, e podem ser
 * conferidos por qualquer auditor com `exiftool` e `sha256sum`, sem depender
 * do TCS ou do banco de dados.
 */
async function buildPhotoProvenance(bytes: Uint8Array): Promise<string[]> {
  const lines: string[] = [];
  try {
    const geo = formatGeoForDocument(readExifGeo(bytes));
    lines.push(geo ?? 'Foto sem georreferência — captura sem sinal de GPS.');
  } catch {
    lines.push('Foto sem georreferência — captura sem sinal de GPS.');
  }
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    const hash = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    lines.push(`SHA-256 ${hash.slice(0, 16)}…`);
  } catch {
    // Sem hash não há linha de integridade — a georreferência permanece.
  }
  return lines;
}

export async function buildPdf(inspection: Record<string, unknown>): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const institutionalLogo = await document.embedJpg(Uint8Array.from(
    atob(DEFESA_CIVIL_LOGO_BASE64.split(',')[1]),
    character => character.charCodeAt(0),
  ));
  const pageSize: [number, number] = [PDF_PAGE.widthPt, PDF_PAGE.heightPt];
  const margin = PDF_PAGE.marginPt;
  const contentWidth = pageSize[0] - margin * 2;
  const contentBottom = PDF_PAGE.footerHeightPt + 22;
  const protocol = pdfText(
    readInspectionField(inspection, 'protocolo')
      || String(readInspectionField(inspection, 'id') || '').slice(0, 8).toUpperCase(),
  ) || '-';
  const riskLevel = pdfText(
    readInspectionField(inspection, 'nivelRisco', 'nivel_risco') || 'não classificado',
  ).toLowerCase();
  const riskKey = riskLevel.includes('r4') || riskLevel.includes('iminente')
    ? 'r4'
    : riskLevel.includes('r3')
      ? 'r3'
      : riskLevel.includes('r2')
        ? 'r2'
        : 'r1';
  const riskColor = rgb(...hexToPdfRgb(PDF_RISK_COLORS[riskKey]));
  const color = (hex: string) => rgb(...hexToPdfRgb(hex));
  let page!: PDFPage;
  let cursorY = 0;

  const drawHeader = () => {
    const headerTop = pageSize[1] - 38;
    page.drawImage(institutionalLogo, {
      x: margin,
      y: headerTop - 40,
      width: 46,
      height: 46,
    });

    const title = 'RELATÓRIO TÉCNICO DE VISTORIA';
    const titleSize = 12;
    page.drawText(title, {
      x: pageSize[0] - margin - bold.widthOfTextAtSize(title, titleSize),
      y: headerTop - 8,
      size: titleSize,
      font: bold,
      color: color(PDF_COLORS.navy),
    });
    const meta = `Protocolo ${protocol}`;
    page.drawText(meta, {
      x: pageSize[0] - margin - regular.widthOfTextAtSize(meta, 8),
      y: headerTop - 23,
      size: 8,
      font: regular,
      color: color(PDF_COLORS.muted),
    });
    page.drawLine({
      start: { x: margin, y: headerTop - 40 },
      end: { x: pageSize[0] - margin, y: headerTop - 40 },
      thickness: 1.2,
      color: color(PDF_COLORS.navy),
    });
  };

  const addPage = () => {
    page = document.addPage(pageSize);
    const isFirstPage = document.getPageCount() === 1;
    if (isFirstPage) drawHeader();
    cursorY = isFirstPage ? pageSize[1] - 103 : pageSize[1] - margin;
  };
  const ensureSpace = (height: number) => {
    if (cursorY - height < contentBottom) addPage();
  };
  const line = (
    text: string,
    size = 10,
    options: {
      strong?: boolean;
      color?: string;
      x?: number;
      width?: number;
      lineHeight?: number;
    } = {},
  ) => {
    const font = options.strong ? bold : regular;
    const x = options.x ?? margin;
    const width = options.width ?? contentWidth;
    const lineHeight = options.lineHeight ?? size + 5;
    for (const value of wrap(text, font, size, width)) {
      ensureSpace(lineHeight);
      page.drawText(value, {
        x,
        y: cursorY - size,
        size,
        font,
        color: color(options.color || PDF_COLORS.ink),
      });
      cursorY -= lineHeight;
    }
  };
  const section = (title: string) => {
    ensureSpace(30);
    cursorY -= 6;
    line(title.toUpperCase(), 8, { strong: true, color: PDF_COLORS.navy, lineHeight: 12 });
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: pageSize[0] - margin, y: cursorY },
      thickness: 0.5,
      color: color(PDF_COLORS.line),
    });
    cursorY -= 7;
  };
  const field = (label: string, value: unknown, labelWidth = 132) => {
    const lineHeight = 12.5;
    const values = wrap(pdfText(value) || '-', regular, 9.5, contentWidth - labelWidth - 18);
    let offset = 0;
    let firstChunk = true;
    while (offset < values.length) {
      if (cursorY - 28 < contentBottom) addPage();
      const available = cursorY - contentBottom - 10;
      const maxLines = Math.max(1, Math.floor((available - 10) / lineHeight));
      const chunk = values.slice(offset, offset + maxLines);
      const rowHeight = Math.max(25, chunk.length * lineHeight + 10);
      ensureSpace(rowHeight);
      page.drawRectangle({
        x: margin,
        y: cursorY - rowHeight,
        width: labelWidth,
        height: rowHeight,
        color: color(PDF_COLORS.surface),
      });
      page.drawRectangle({
        x: margin,
        y: cursorY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        borderWidth: 0.45,
        borderColor: color(PDF_COLORS.lineSoft),
      });
      page.drawText(pdfText(firstChunk ? label : `${label} (continuação)`), {
        x: margin + 9,
        y: cursorY - 15,
        size: 7.5,
        font: bold,
        color: color(PDF_COLORS.muted),
      });
      chunk.forEach((entry, index) => {
        page.drawText(entry, {
          x: margin + labelWidth + 9,
          y: cursorY - 15 - index * lineHeight,
          size: 9.5,
          font: regular,
          color: color(PDF_COLORS.ink),
        });
      });
      cursorY -= rowHeight;
      offset += chunk.length;
      firstChunk = false;
    }
  };

  addPage();
  if (inspection.documentStatus === 'preliminary') {
    line('VERSÃO PRELIMINAR - NÃO REPRESENTA EMISSÃO TÉCNICA FINAL', 9, { strong: true, color: PDF_COLORS.danger });
    const media = inspection.mediaCompleteness as { expected_count?: number | null; available_count?: number; pending_count?: number | null } | undefined;
    if (media) line(media.expected_count == null ? `${media.available_count ?? 0} foto(s) disponível(is); quantidade esperada não informada.` : `${media.available_count ?? 0} de ${media.expected_count} fotos disponíveis; ${media.pending_count ?? 0} pendente(s).`, 8);
    cursorY -= 8;
  }
  if (typeof inspection.mediaWaiverReason === 'string' && inspection.mediaWaiverReason) line(`Dispensa de evidências pendentes: ${inspection.mediaWaiverReason}`, 8);
  const score = formatPdfNumber(readInspectionField(inspection, 'pontuacaoTotal', 'pontuacao_total') || '0');
  ensureSpace(70);
  page.drawRectangle({
    x: margin,
    y: cursorY - 62,
    width: contentWidth * 0.6,
    height: 62,
    color: riskColor,
  });
  page.drawRectangle({
    x: margin + contentWidth * 0.6,
    y: cursorY - 62,
    width: contentWidth * 0.4,
    height: 62,
    color: color(riskKey === 'r1' ? PDF_COLORS.successSoft : riskKey === 'r2' ? PDF_COLORS.warningSoft : PDF_COLORS.dangerSoft),
  });
  page.drawText('CLASSIFICAÇÃO TÉCNICA', {
    x: margin + 14,
    y: cursorY - 18,
    size: 7.5,
    font: bold,
    color: color(PDF_COLORS.white),
  });
  page.drawText(pdfText(riskLevel.toUpperCase()), {
    x: margin + 14,
    y: cursorY - 43,
    size: 19,
    font: bold,
    color: color(PDF_COLORS.white),
  });
  const scoreLabel = 'PONTUAÇÃO APURADA';
  page.drawText(scoreLabel, {
    x: pageSize[0] - margin - 14 - bold.widthOfTextAtSize(scoreLabel, 7.5),
    y: cursorY - 18,
    size: 7.5,
    font: bold,
    color: riskColor,
  });
  page.drawText(score, {
    x: pageSize[0] - margin - 14 - bold.widthOfTextAtSize(score, 19),
    y: cursorY - 43,
    size: 19,
    font: bold,
    color: riskColor,
  });
  cursorY -= 76;

  section('Dados da vistoria');
  const inspectionDate = readInspectionField(inspection, 'dataVistoria', 'data_vistoria');
  field('Protocolo', protocol);
  field(
    'Data e hora',
    inspectionDate
      ? new Date(String(inspectionDate)).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      : '-',
  );
  field('Município', readInspectionField(inspection, 'municipio', 'municipio_agente'));
  field('Agente responsável', readInspectionField(inspection, 'agenteNome', 'agente_nome'));
  field('Responsável pelo imóvel', readInspectionField(inspection, 'responsavelNome', 'responsavel_nome'));
  field(
    'Endereço',
    readInspectionField(inspection, 'endereco')
      || [
        readInspectionField(inspection, 'enderecoRua', 'endereco_rua'),
        readInspectionField(inspection, 'enderecoNumero', 'endereco_numero'),
        readInspectionField(inspection, 'enderecoBairro', 'endereco_bairro'),
      ].filter(Boolean).join(', '),
  );
  const calculation = parseObject(readInspectionField(inspection, 'calculoRisco', 'calculo_risco', 'calculo_json'));
  const calculationItems = Array.isArray(calculation.itens)
    ? calculation.itens.filter((item): item is Record<string, unknown> => (
      Boolean(item && typeof item === 'object')
      && !pdfText((item as Record<string, unknown>).pergunta).toLowerCase().includes('conduta recomendada')
    ))
    : [];
  const answers = parseObject(readInspectionField(inspection, 'respostasJson', 'respostas_json'));
  const answerEntries: Array<[string, unknown]> = calculationItems.length
    ? calculationItems.map((item, index) => [
      pdfText(item.pergunta) || `Item ${index + 1}`,
      `${displayAnswer(item.resposta)}${Number(item.pesoRisco) > 0 ? ` (+${formatPdfNumber(item.pesoRisco)} pts)` : ''}${item.observacao ? ` - Observação: ${displayAnswer(item.observacao)}` : ''}`,
    ])
    : Object.entries(answers).filter(([key, value]) => (
      !key.toLowerCase().includes('foto')
      && !key.toLowerCase().includes('conduta_recomendada')
      && !key.toLowerCase().includes('formulario_utilizado')
      && key.toLowerCase() !== 'formularioid'
      && value !== null
      && value !== undefined
      && String(value).trim()
    ));
  if (answerEntries.length) {
    section('Itens vistoriados');
    answerEntries.forEach(([key, value], index) => {
      field(
      `${String(index + 1).padStart(2, '0')} - ${calculationItems.length ? key : humanizePdfFieldKey(key)}`,
        displayAnswer(value),
        215,
      );
    });
  }

  const photos = inspectionPhotoSources(inspection).slice(0,3);
  if (photos.length) {
    const embeddedPhotos: Array<{
      image: PDFImage;
      index: number;
      /** Linhas de proveniência impressas sob a foto. */
      provenance: string[];
    }> = [];
    for (let index = 0; index < photos.length; index += 1) {
      const loaded = await loadImage(photos[index]);
      if (!loaded) continue;
      try {
        const image = loaded.extension === 'png'
          ? await document.embedPng(loaded.bytes)
          : await document.embedJpg(loaded.bytes);
        embeddedPhotos.push({
          image,
          index,
          provenance: await buildPhotoProvenance(loaded.bytes),
        });
      } catch {
        // A foto permanece registrada na vistoria mesmo quando o formato não
        // pode ser incorporado ao PDF.
      }
    }
    if (embeddedPhotos.length) {
      section(`Registro fotográfico (${embeddedPhotos.length})`);
      const gap = 10;
      const cardWidth = (contentWidth - gap) / 2;
      for (let index = 0; index < embeddedPhotos.length; index += 2) {
        const row = embeddedPhotos.slice(index, index + 2);
        const dimensions = row.map(entry => entry.image.scaleToFit(cardWidth - 12, 142));
        const provenanceHeight = Math.max(
          0,
          ...row.map(entry => (entry.provenance.length ? entry.provenance.length * 9 + 4 : 0)),
        );
        const rowHeight = Math.max(...dimensions.map(entry => entry.height)) + 28 + provenanceHeight;
        ensureSpace(rowHeight + 8);
        row.forEach((entry, column) => {
          const x = margin + column * (cardWidth + gap);
          const imageSize = dimensions[column];
          page.drawRectangle({
            x,
            y: cursorY - rowHeight,
            width: cardWidth,
            height: rowHeight,
            borderWidth: 0.5,
            borderColor: color(PDF_COLORS.line),
          });
          page.drawImage(entry.image, {
            x: x + (cardWidth - imageSize.width) / 2,
            y: cursorY - 8 - imageSize.height,
            width: imageSize.width,
            height: imageSize.height,
          });
          const caption = `Evidência fotográfica ${entry.index + 1}`;
          page.drawText(caption, {
            x: x + (cardWidth - regular.widthOfTextAtSize(caption, 7.5)) / 2,
            y: cursorY - rowHeight + 8,
            size: 7.5,
            font: regular,
            color: color(PDF_COLORS.muted),
          });
          entry.provenance.forEach((line, lineIndex) => {
            const isHash = line.startsWith('SHA-256');
            page.drawText(line, {
              x: x + (cardWidth - regular.widthOfTextAtSize(line, 6.8)) / 2,
              y: cursorY - rowHeight + 8 - 10 - lineIndex * 9,
              size: 6.8,
              font: regular,
              color: color(isHash ? PDF_COLORS.muted : PDF_COLORS.text),
            });
          });
        });
        cursorY -= rowHeight + 8;
      }
    }
  }

  const technicalNotes = readInspectionField(
    inspection,
    'observacoesTecnicas',
    'observacoes_tecnicas',
    'observacoes',
  );
  if (technicalNotes) {
    section('Observações técnicas');
    line(pdfText(technicalNotes), 9.5, { color: PDF_COLORS.text, lineHeight: 14 });
  }

  // Mantém o bloco de encerramento unido para evitar títulos ou frases
  // isolados entre páginas.
  ensureSpace(205);
  section('Base legal');
  line(
    typeof inspection.baseLegal === 'string' && inspection.baseLegal.trim() ? inspection.baseLegal : 'Este relatório técnico foi elaborado em conformidade com a Lei Federal nº 12.608/2012, que institui a Política Nacional de Proteção e Defesa Civil, e com a Lei Federal nº 10.257/2001, denominada Estatuto da Cidade. Esses dispositivos estabelecem diretrizes para a prevenção de desastres e a proteção da vida.',
    8.5,
    { color: PDF_COLORS.muted, lineHeight: 12.5 },
  );

  section('Responsabilidade técnica');
  line('Documento emitido com base nas condições observadas na data da vistoria. Sua interpretação deve considerar os registros fotográficos e as normas técnicas aplicáveis.', 9);
  cursorY -= 28;
  const signatureStrokes = inspection.agentSignatureStrokes;
  if (Array.isArray(signatureStrokes)) {
    ensureSpace(95);
    const startX = (pageSize[0] - 180) / 2;
    for (const stroke of signatureStrokes) {
      const points = stroke && typeof stroke === 'object' && Array.isArray(stroke.points) ? stroke.points : [];
      for (let index = 1; index < points.length; index++) {
        const a = points[index - 1], b = points[index];
        if (![a?.x,a?.y,b?.x,b?.y].every(n => typeof n === 'number' && n >= 0 && n <= 1)) continue;
        page.drawLine({ start: { x: startX + a.x * 180, y: cursorY + (1-a.y)*45 }, end: { x: startX+b.x*180, y: cursorY+(1-b.y)*45 }, thickness: 0.8, color: color(PDF_COLORS.ink) });
      }
    }
    cursorY -= 8;
  }
  ensureSpace(68);
  page.drawLine({
    start: { x: margin + 90, y: cursorY },
    end: { x: pageSize[0] - margin - 90, y: cursorY },
    thickness: 0.6,
    color: color(PDF_COLORS.navy),
  });
  cursorY -= 18;
  const signatureName = pdfText(readInspectionField(inspection, 'agenteNome', 'agente_nome'))
    || 'Agente responsável';
  const signatureRole = pdfText(readInspectionField(inspection, 'cargo'))
    || 'Agente de Proteção e Defesa Civil';
  page.drawText(signatureName, {
    x: (pageSize[0] - bold.widthOfTextAtSize(signatureName, 9)) / 2,
    y: cursorY,
    size: 9,
    font: bold,
    color: color(PDF_COLORS.navy),
  });
  cursorY -= 14;
  page.drawText(signatureRole, {
    x: (pageSize[0] - regular.widthOfTextAtSize(signatureRole, 8)) / 2,
    y: cursorY,
    size: 8,
    font: regular,
    color: color(PDF_COLORS.muted),
  });

  document.getPages().forEach((item, index) => {
    item.drawLine({
      start: { x: margin, y: 38 },
      end: { x: pageSize[0] - margin, y: 38 },
      thickness: 0.4,
      color: color(PDF_COLORS.line),
    });
    const footerLeft = `Defesa Civil - Relatório Técnico de Vistoria - ${PDF_DESIGN_LABEL}`;
    const footerRight = `Página ${index + 1}/${document.getPageCount()} - Protocolo ${protocol}`;
    item.drawText(footerLeft, {
      x: margin,
      y: 23,
      size: 7,
      font: regular,
      color: color(PDF_COLORS.muted),
    });
    item.drawText(footerRight, {
      x: pageSize[0] - margin - regular.widthOfTextAtSize(footerRight, 7),
      y: 23,
      size: 7,
      font: regular,
      color: color(PDF_COLORS.muted),
    });
  });

  document.setTitle(`Relatório Técnico de Vistoria ${protocol}`);
  document.setCreator('Defesa Civil');
  document.setProducer(`Defesa Civil ${PDF_DESIGN_VERSION}`);
  document.setSubject('Relatório técnico de vistoria e classificação de risco');
  return document.save();
}

async function issuePreservedDocument(caller: typeof admin, actorId: string, body: GenerationRequest): Promise<Response> {
  if (!isUuid(body.document_id) || !isUuid(body.inspection_id)) return json({ ok: false, error: 'invalid_document_id' }, 400);
  const { data: media, error: denied } = await caller.rpc('get_inspection_media_status', { p_inspection_id: body.inspection_id });
  if (denied || !media) return json({ ok: false, error: 'generation_not_allowed' }, 403);
  const { data: existing } = await admin.from('generated_documents').select('id,vistoria_id,created_by,storage_path,document_version,issuance_status').eq('id', body.document_id).maybeSingle();
  if (existing) {
    if (existing.vistoria_id !== body.inspection_id || existing.created_by !== actorId) return json({ ok: false, error: 'document_identity_conflict' }, 409);
    const { data: signed } = await admin.storage.from('document-evidence').createSignedUrl(existing.storage_path, 60);
    return signed?.signedUrl ? json({ ok: true, reused: true, document_id: existing.id, document_version: existing.document_version, issuance_status: existing.issuance_status, signed_url: signed.signedUrl }) : json({ ok: false, error: 'document_signing_failed' }, 502);
  }
  const { data: allowed, error: limitError } = await caller.rpc('enforce_my_operational_rate_limit', { p_action: 'gerar_pdf' });
  if (limitError) return json({ ok:false,error:'rate_limit_unavailable' },503);
  if (allowed !== true) return json({ ok:false,error:'generation_rate_limit' },429);
  const { data: inspection, error: missing } = await admin.from('vistorias').select('*').eq('id', body.inspection_id).maybeSingle();
  if (missing || !inspection || !['concluida','concluída'].includes(inspection.status)) return json({ ok: false, error: 'inspection_not_completed' }, 409);
  let issuance: 'preliminary' | 'final';
  try {
    issuance = resolveInspectionIssuance({ requested: body.issuance_status, actorId, agentId: inspection.agenteUid, media,
      signature: body.technical_signature_strokes, waiverReason: typeof body.media_waiver_reason === 'string' ? body.media_waiver_reason : null });
  } catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : 'invalid_issuance' }, 422); }
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 20000) : '';
  const payload = { ...inspection, documentStatus: issuance, mediaRevision: media.revision, mediaCompleteness: { expected_count: media.expected_count, available_count: media.available_count, pending_count: media.pending_count },
    baseLegal: typeof body.base_legal === 'string' ? body.base_legal.trim().slice(0,20000) : undefined, cargo: typeof body.technical_role === 'string' ? body.technical_role.trim().slice(0,200) : undefined,
    observacoesTecnicas: notes, responsavelNome: typeof body.requester_name === 'string' ? body.requester_name.trim().slice(0, 200) : inspection.responsavelNome,
    agentSignatureStrokes: issuance === 'final' ? body.technical_signature_strokes : null,
    mediaWaiverReason: typeof body.media_waiver_reason === 'string' ? body.media_waiver_reason.trim().slice(0, 1000) : undefined };
  const snapshot = { schemaVersion: 1, documentType: 'report', templateVersion: `web-${PDF_DESIGN_VERSION}`, vistoriaId: body.inspection_id, trainingMode: false, payload };
  const snapshotJson = canonicalInspectionSnapshot(snapshot);
  const sha256 = async (bytes: Uint8Array) => {
    const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const bytes = await buildPdf(payload);
  const [contentHash,pdfHash] = await Promise.all([sha256(new TextEncoder().encode(snapshotJson)),sha256(bytes)]);
  const { data: latest } = await admin.from('generated_documents').select('document_version,id').eq('vistoria_id', body.inspection_id).eq('document_type','report').order('document_version',{ ascending: false }).limit(1).maybeSingle();
  const version = (latest?.document_version ?? 0)+1;
  const path = `${actorId}/${body.inspection_id}/${body.document_id}/${pdfHash}.pdf`;
  const sent = await admin.storage.from('document-evidence').upload(path,bytes,{ contentType:'application/pdf',upsert:false });
  if (sent.error && String(sent.error.statusCode) !== '409') return json({ ok:false,error:'document_upload_failed' },502);
  const { error: registrationError } = await caller.rpc('register_generated_document',{ p_payload: { document_id:body.document_id,vistoria_id:body.inspection_id,document_type:'report',document_version:version,
    template_version:`web-${PDF_DESIGN_VERSION}`,content_snapshot:JSON.parse(snapshotJson),content_hash:contentHash,pdf_hash:pdfHash,storage_path:path,byte_size:bytes.byteLength,
    supersedes_id:latest?.id ?? null,training_mode:false,document_created_at_device:new Date().toISOString() } });
  if (registrationError) return json({ ok:false,error:registrationError.message || 'document_registration_failed' },registrationError.code==='23505' ? 409 : 422);
  const { data: signed } = await admin.storage.from('document-evidence').createSignedUrl(path,60);
  return signed?.signedUrl ? json({ ok:true,document_id:body.document_id,document_version:version,issuance_status:issuance,signed_url:signed.signedUrl }) : json({ ok:false,error:'document_signing_failed' },502);
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
  if (body.document_id !== undefined) {
    try { return await issuePreservedDocument(caller,user.id,body); }
    catch (e) { console.error('[generate-inspection-laudo:preserved]',e instanceof Error ? e.message : String(e)); return json({ ok:false,error:'document_generation_failed' },502); }
  }
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

  // A web nunca monta uma primeira versão nem substitui o PDF oficial.
  // Ela apenas assina a cópia completa criada e sincronizada pelo aplicativo.
  if (authorization.already_available) {
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

  return json({
    ok: false,
    error: 'app_generation_required',
    document_status: authorization.document_status,
  }, 409);
});
