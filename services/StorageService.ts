import { supabase } from '../utils/supabase';
import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/logger';

const BUCKET_NAME = 'vistorias';

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

    logger.info('storage', `Iniciando upload de imagem: ${remotePath}`, { size: fileInfo.size });

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(remotePath, formData, {
        cacheControl: '36000',
        upsert: false,
      });

    if (error) {
      logger.error('storage', `Falha no upload supabase: ${error.message}`, { path: remotePath });
      throw error;
    }

    // Obter URL pública
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(remotePath);

    logger.info('storage', `Upload concluído com sucesso`, { url: publicData.publicUrl });
    
    return publicData.publicUrl;

  } catch (error: any) {
    logger.error('storage', `Erro completo no uploadImageFromLocalUri: ${error?.message || error}`, { localUri, remotePath });
    throw error;
  }
}
