import { supabase } from '../utils/supabase';
import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/logger';

const BUCKET_NAME = 'vistorias';
const BUCKET_FOTOS = 'fotos';
const BUCKET_LAUDOS = 'laudos';

// ─── Prefixos para identificar o bucket a partir do path persistido ──────────
// Formato armazenado: "vistorias:<remotePath>" | "fotos:<remotePath>" | "laudos:<remotePath>"
// Isso permite assinar URLs sem ambiguidade de bucket na leitura.
const PATH_PREFIX = {
  vistorias: 'vistorias:',
  fotos: 'fotos:',
  laudos: 'laudos:',
} as const;

type BucketKey = keyof typeof PATH_PREFIX;

/**
 * Codifica bucket + remotePath em uma string persistível.
 * Exemplo: encodePath('vistorias', '2026/SP/abc.jpg') → 'vistorias:2026/SP/abc.jpg'
 */
export function encodePath(bucket: BucketKey, remotePath: string): string {
  return `${PATH_PREFIX[bucket]}${remotePath}`;
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

  // URL já assinada, pública ou local (file://) — retorna como está
  if (stored.startsWith('http') || stored.startsWith('file://')) return stored;

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
 * Faz upload de um arquivo local (file:///) para o bucket `vistorias`.
 * Retorna o path codificado (ex: "vistorias:2026/SP/id/thumb.jpg") para
 * persistência — NÃO retorna URL assinada para evitar expiração em dados salvos.
 *
 * @note Para exibir a imagem, chame getSignedUrl(storedPath).
 */
export async function uploadImageFromLocalUri(localUri: string, remotePath: string): Promise<string> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error(`Arquivo local não encontrado: ${localUri}`);
    }

    const fileExt = localUri.split('.').pop() || 'jpg';
    const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: remotePath.split('/').pop() || `foto.${fileExt}`,
      type: mimeType,
    } as any);

    logger.info('sync', `Iniciando upload de imagem: ${remotePath}`, { size: (fileInfo as any).size });

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(remotePath, formData, { cacheControl: '36000', upsert: false });

    if (error) {
      logger.error('sync', `Falha no upload supabase: ${error.message}`, { path: remotePath });
      throw error;
    }

    logger.info('sync', `Upload concluído`, { path: remotePath });
    return encodePath('vistorias', remotePath);

  } catch (error: any) {
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
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) return null;

    const remotePath = `${municipio}/${vistoriaId}.jpg`;
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: `${vistoriaId}.jpg`,
      type: 'image/jpeg',
    } as any);

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(remotePath, formData, { cacheControl: '86400', upsert: true });

    if (error) {
      logger.warn('sync', `Falha upload foto: ${error.message}`, { remotePath });
      return null;
    }

    return encodePath('fotos', remotePath);
  } catch (e: any) {
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
    const remotePath = `${municipio}/${vistoriaId}.pdf`;
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: `${vistoriaId}.pdf`,
      type: 'application/pdf',
    } as any);

    const { error } = await supabase.storage
      .from(BUCKET_LAUDOS)
      .upload(remotePath, formData, { cacheControl: '3600', upsert: true });

    if (error) {
      logger.warn('sync', `Falha upload laudo: ${error.message}`, { remotePath });
      return null;
    }

    const { data } = await supabase.storage
      .from(BUCKET_LAUDOS)
      .createSignedUrl(remotePath, 60 * 60 * 24 * 7);

    return data?.signedUrl ?? null;
  } catch (e: any) {
    logger.warn('sync', `Erro upload laudo PDF: ${e?.message}`, { vistoriaId });
    return null;
  }
}
