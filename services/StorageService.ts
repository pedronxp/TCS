import { supabase } from '../utils/supabase';
import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/logger';

const BUCKET_NAME = 'vistorias';
const BUCKET_FOTOS = 'fotos';
const BUCKET_LAUDOS = 'laudos';

/**
 * Faz upload de um arquivo local (file:///) para o Supabase Storage
 * @param localUri A URI local do arquivo gerada pela câmera ou galeria
 * @param remotePath O caminho destino no Storage (ex: '2026/03/vistoria_123_foto_1.jpg')
 * @returns A URL pública da imagem recém-salva
 *
 * @note COMPORTAMENTO DE RETRY: O remotePath inclui Date.now(), então cada
 * tentativa de upload usa um caminho único. Se o upload for bem-sucedido mas
 * o app morrer antes de persistir a URL pública no SQLite (em processarImagensVistoria),
 * o arquivo permanecerá no Storage sem referência (arquivo órfão). O retry
 * seguinte fará upload para um novo path sem conflito. Para limpeza de órfãos,
 * seria necessário um job periódico no Supabase (out of scope para SYNC-01).
 */
export async function uploadImageFromLocalUri(localUri: string, remotePath: string): Promise<string> {
  try {
    // Verificar se o arquivo existe localmente
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error(`Arquivo local não encontrado: ${localUri}`);
    }

    const fileExt = localUri.split('.').pop() || 'jpg';
    const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    // Ler base64 usando file-system (mais seguro no react-native/expo sem pollyfills complexos de Buffer para o supabase.storage)
    // O Supabase suporta Base64 upload se enviarmos com contentType correto e options.
    // Mas no SDK v2, a melhor abordagem no Expo é usar FileSystem.readAsStringAsync base64 e enviar Buffer, 
    // ou usar FormData que é suportado nativamente pelo fetch interno do Supabase.
    
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: remotePath.split('/').pop() || `foto.${fileExt}`,
      type: mimeType,
    } as any);

    logger.info('sync', `Iniciando upload de imagem: ${remotePath}`, { size: fileInfo.size });

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(remotePath, formData, {
        cacheControl: '36000',
        upsert: false,
      });

    if (error) {
      logger.error('sync', `Falha no upload supabase: ${error.message}`, { path: remotePath });
      throw error;
    }

    // Obter URL assinada (expira em 1 hora) — bucket sensível não é público
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(remotePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      logger.error('sync', `Falha ao gerar URL assinada: ${signedError?.message}`, { path: remotePath });
      throw signedError ?? new Error('URL assinada não gerada');
    }

    logger.info('sync', `Upload concluído com sucesso`, { path: remotePath });

    return signedData.signedUrl;

  } catch (error: any) {
    logger.error('sync', `Erro completo no uploadImageFromLocalUri: ${error?.message || error}`, { localUri, remotePath });
    throw error;
  }
}

/**
 * Faz upload da foto de uma vistoria para o bucket `fotos/`.
 * Retorna a URL pública ou null em caso de falha (não lança exceção).
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

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_FOTOS)
      .createSignedUrl(remotePath, 3600);
    if (signedError || !signedData?.signedUrl) return null;
    return signedData.signedUrl;
  } catch (e: any) {
    logger.warn('sync', `Erro upload foto vistoria: ${e?.message}`, { vistoriaId });
    return null;
  }
}

/**
 * Faz upload do PDF de laudo para o bucket `laudos/`.
 * Retorna URL signed de 7 dias ou null em caso de falha.
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
