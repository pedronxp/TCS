import { supabase } from '../utils/supabase';
import { File } from 'expo-file-system';
import { logger } from '../utils/logger';
import { reportClientTechnicalEventSafely } from '../utils/technicalEvents';

const BUCKET_FOTOS = 'fotos';
const BUCKET_LAUDOS = 'laudos';
const BUCKET_DOCUMENT_EVIDENCE = 'document-evidence';

// ─── Prefixos para identificar o bucket a partir do path persistido ──────────
// Formato armazenado: "vistorias:<remotePath>" | "fotos:<remotePath>" | "laudos:<remotePath>"
// Isso permite assinar URLs sem ambiguidade de bucket na leitura.
const PATH_PREFIX = {
  vistorias: 'vistorias:',
  fotos: 'fotos:',
  laudos: 'laudos:',
  documentEvidence: 'document-evidence:',
} as const;

type BucketKey = keyof typeof PATH_PREFIX;

/**
 * Codifica bucket + remotePath em uma string persistível.
 * Exemplo: encodePath('vistorias', '2026/SP/abc.jpg') → 'vistorias:2026/SP/abc.jpg'
 */
export function encodePath(bucket: BucketKey, remotePath: string): string {
  return `${PATH_PREFIX[bucket]}${remotePath}`;
}

function evidencePath(ownerUserId: string, vistoriaId: string, documentId: string, filename: string): string {
  const safe = [ownerUserId, vistoriaId, documentId, filename].map(segment =>
    segment.replace(/[^a-zA-Z0-9._-]/g, '_')
  );
  return safe.join('/');
}

async function readLocalFileBytes(localUri: string): Promise<Uint8Array> {
  const file = new File(localUri);
  if (!file.exists) throw new Error(`Arquivo local não encontrado: ${localUri}`);
  const bytes = await file.bytes();
  if (bytes.byteLength === 0) throw new Error(`Arquivo local vazio: ${localUri}`);
  return bytes;
}

export async function scopeCustomerStoragePath(remotePath: string): Promise<string> {
  const clean = remotePath.replace(/^\/+/, '');
  const segments = clean.split('/');
  if (!clean || segments.includes('..')) throw new Error('Caminho de Storage inválido.');
  const { data, error } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (error || !userId) throw new Error('Sessão autenticada obrigatória para enviar arquivos.');
  if (segments[0] === 'users') {
    if (segments[1] !== userId) throw new Error('Escopo de Storage inválido.');
    return clean;
  }
  return `users/${userId}/${clean}`;
}

/** Upload idempotente para o bucket privado de documentos e evidências. */
export async function uploadDocumentEvidenceFile(
  localUri: string,
  ownerUserId: string,
  vistoriaId: string,
  documentId: string
): Promise<string> {
  const bytes = await readLocalFileBytes(localUri);
  const remotePath = evidencePath(ownerUserId, vistoriaId, documentId, 'document.pdf');
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENT_EVIDENCE)
    .upload(remotePath, bytes, { contentType: 'application/pdf', upsert: false });
  if (error && !/duplicate|already exists|resource already exists/i.test(error.message)) {
    throw error;
  }
  return remotePath;
}

/** Armazena traços validados como JSON; SVG arbitrário nunca é aceito. */
export async function uploadDocumentSignatureEvidence(
  json: string,
  ownerUserId: string,
  vistoriaId: string,
  documentId: string
): Promise<string> {
  const remotePath = evidencePath(ownerUserId, vistoriaId, documentId, 'signature.json');
  const bytes = new TextEncoder().encode(json);
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENT_EVIDENCE)
    .upload(remotePath, bytes, { contentType: 'application/json', upsert: false });
  if (error && !/duplicate|already exists|resource already exists/i.test(error.message)) {
    throw error;
  }
  return remotePath;
}

export function encodeDocumentEvidencePath(remotePath: string): string {
  return encodePath('documentEvidence', remotePath);
}

/**
 * Decodifica string persistida de volta para { bucket, remotePath }.
 * Retorna null se a string não tiver prefixo reconhecido (ex: URL http antiga).
 */
export function decodePath(stored: string): { bucket: string; remotePath: string } | null {
  for (const [bucket, prefix] of Object.entries(PATH_PREFIX)) {
    if (stored.startsWith(prefix)) {
      return { bucket, remotePath: stored.slice(prefix.length) };
    }
  }
  return null;
}

/**
 * Gera uma URL assinada a partir de um valor persistido (encodePath) ou de
 * uma URL http já assinada (retorna diretamente, sem nova assinatura).
 * Expiração padrão: 3600 s (1 h).
 */
export async function getSignedUrl(
  stored: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!stored) return null;

  // URL já assinada ou pública — retorna como está
  if (stored.startsWith('http')) return stored;

  // Arquivos ainda locais precisam continuar visíveis no modo offline e no PDF.
  if (stored.startsWith('file://') || stored.startsWith('content://') || stored.startsWith('data:')) {
    return stored;
  }

  const decoded = decodePath(stored);
  if (!decoded) {
    logger.warn('storage', 'getSignedUrl: path sem prefixo reconhecido', { stored });
    return null;
  }

  const { data, error } = await supabase.storage
    .from(decoded.bucket)
    .createSignedUrl(decoded.remotePath, expiresIn);

  if (error || !data?.signedUrl) {
    logger.warn('storage', `Falha ao assinar URL: ${error?.message}`, decoded);
    return null;
  }

  return data.signedUrl;
}

/**
 * Faz upload de um arquivo local (file:///) para o bucket `fotos`.
 * Retorna o path codificado (ex: "fotos:2026/SP/id/thumb.jpg") para
 * persistência — NÃO retorna URL assinada para evitar expiração em dados salvos.
 *
 * @note Para exibir a imagem, chame getSignedUrl(storedPath).
 */
export async function uploadImageFromLocalUri(localUri: string, remotePath: string): Promise<string> {
  try {
    const bytes = await readLocalFileBytes(localUri);
    const scopedPath = await scopeCustomerStoragePath(remotePath);

    const fileExt = localUri.split('.').pop() || 'jpg';
    const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    logger.info('sync', `Iniciando upload de imagem: ${scopedPath}`, { size: bytes.byteLength });

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(scopedPath, bytes, { contentType: mimeType, cacheControl: '36000', upsert: false });

    if (error && !/duplicate|already exists|resource already exists/i.test(error.message)) {
      logger.error('sync', `Falha no upload supabase: ${error.message}`, { path: scopedPath });
      throw error;
    }

    logger.info('sync', `Upload concluído`, { path: scopedPath });
    return encodePath('fotos', scopedPath);

  } catch (error: any) {
    reportClientTechnicalEventSafely({ category: 'storage', severity: 'error', summary: 'Falha no upload de imagem', metadata: { operation: 'upload_image', bucket: BUCKET_FOTOS } });
    logger.error('sync', `Erro em uploadImageFromLocalUri: ${error?.message || error}`, { localUri, remotePath });
    throw error;
  }
}

/**
 * Faz upload da foto de uma vistoria para o bucket `fotos`.
 * Retorna o path codificado para persistência, ou null em caso de falha.
 *
 * @note Para exibir a imagem, chame getSignedUrl(storedPath).
 */
export async function uploadFotoVistoria(
  localUri: string,
  vistoriaId: string,
  municipio: string
): Promise<string | null> {
  try {
    const bytes = await readLocalFileBytes(localUri);
    const remotePath = await scopeCustomerStoragePath(`${municipio}/${vistoriaId}.jpg`);

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(remotePath, bytes, { contentType: 'image/jpeg', cacheControl: '86400', upsert: true });

    if (error) {
      logger.warn('sync', `Falha upload foto: ${error.message}`, { remotePath });
      return null;
    }

    return encodePath('fotos', remotePath);
  } catch (e: any) {
    reportClientTechnicalEventSafely({ category: 'storage', severity: 'warning', summary: 'Falha no upload de foto da vistoria', metadata: { operation: 'upload_inspection_photo', bucket: BUCKET_FOTOS } });
    logger.warn('sync', `Erro upload foto vistoria: ${e?.message}`, { vistoriaId });
    return null;
  }
}

/**
 * Faz upload do PDF de laudo para o bucket `laudos`.
 * Retorna URL assinada de 7 dias (laudos são exibidos diretamente via link,
 * não persistidos como imagens — expiração longa é aceitável para esse caso).
 */
export async function uploadLaudoPdf(
  localUri: string,
  vistoriaId: string,
  municipio: string
): Promise<string | null> {
  try {
    const remotePath = await scopeCustomerStoragePath(`${municipio}/${vistoriaId}.pdf`);
    const bytes = await readLocalFileBytes(localUri);

    const { error } = await supabase.storage
      .from(BUCKET_LAUDOS)
      .upload(remotePath, bytes, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });

    if (error) {
      logger.warn('sync', `Falha upload laudo: ${error.message}`, { remotePath });
      return null;
    }

    const { data } = await supabase.storage
      .from(BUCKET_LAUDOS)
      .createSignedUrl(remotePath, 60 * 60 * 24 * 7);

    return data?.signedUrl ?? null;
  } catch (e: any) {
    reportClientTechnicalEventSafely({ category: 'storage', severity: 'warning', summary: 'Falha no upload do laudo', metadata: { operation: 'upload_report', bucket: BUCKET_LAUDOS } });
    logger.warn('sync', `Erro upload laudo PDF: ${e?.message}`, { vistoriaId });
    return null;
  }
}
