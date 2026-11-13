import { File, Paths } from 'expo-file-system';
import { readExifGeo, ExifGeo } from '../supabase/functions/_shared/exifGps';
import { sha256Bytes } from './documentIntegrity';

/**
 * Evidência fotográfica com seus metadados de proveniência.
 *
 * A georreferência e o hash são lidos do próprio arquivo — é isso que torna a
 * prova verificável fora do TCS: quem recebe o PDF pode baixar a foto e
 * conferir, com `exiftool`, exatamente as mesmas coordenadas e o mesmo hash
 * impressos no documento.
 */
export interface PhotoEvidence {
  /** Data URL pronta para embutir no HTML do PDF. */
  dataUrl: string;
  /** Metadados EXIF GPS lidos do arquivo (null quando a foto não tem). */
  geo: ExifGeo | null;
  /** SHA-256 dos bytes exatos do arquivo embutido no PDF. */
  hash: string;
}

/**
 * Resolve uma URL/URI para um arquivo local temporário, copiando o remoto
 * quando necessário. Devolve null quando a fonte não pode ser lida.
 *
 * O tipo do arquivo é inferido de `new File(...)` — a classe `File` do DOM
 * (declarada pela lib "DOM") colide com a do Expo quando usada em posição
 * de tipo.
 */
async function resolveLocalFile(url: string) {
  try {
    if (url.startsWith('file://')) {
      const file = new File(url);
      if (!file.exists) return null;
      return { file, cleanup: false };
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const temporaryFile = new File(
        Paths.cache,
        `foto_evidencia_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`,
      );
      const downloaded = await File.downloadFileAsync(url, temporaryFile, { idempotent: true });
      return { file: downloaded, cleanup: true };
    }
  } catch (e) {
    console.warn('[photoToBase64] Erro ao converter foto:', e);
  }
  return null;
}

/**
 * Converte a URL/URI de uma foto em data URL para embutir no PDF.
 * Implementação nativa (Expo). A versão web fica em photoToBase64.web.ts
 * e é resolvida automaticamente pelo bundler web.
 */
export async function photoUrlToBase64(url: string): Promise<string | null> {
  const resolved = await resolveLocalFile(url);
  if (!resolved) return null;
  try {
    const b64 = await resolved.file.base64();
    return `data:image/jpeg;base64,${b64}`;
  } catch (e) {
    console.warn('[photoToBase64] Erro ao converter foto:', e);
    return null;
  } finally {
    if (resolved.cleanup && resolved.file.exists) {
      try { resolved.file.delete(); } catch { /* arquivo temporário já removido */ }
    }
  }
}

/**
 * Lê a foto com seus metadados de proveniência (georreferência e hash).
 * Retorna null quando o arquivo não pode ser lido.
 */
export async function photoUrlToEvidence(url: string): Promise<PhotoEvidence | null> {
  const resolved = await resolveLocalFile(url);
  if (!resolved) return null;
  try {
    const [b64, bytes] = await Promise.all([
      resolved.file.base64(),
      resolved.file.bytes(),
    ]);
    if (!bytes || bytes.byteLength === 0) return null;
    return {
      dataUrl: `data:image/jpeg;base64,${b64}`,
      geo: readExifGeo(bytes),
      hash: await sha256Bytes(bytes),
    };
  } catch (e) {
    console.warn('[photoToBase64] Erro ao ler proveniência da foto:', e);
    return null;
  } finally {
    if (resolved.cleanup && resolved.file.exists) {
      try { resolved.file.delete(); } catch { /* arquivo temporário já removido */ }
    }
  }
}
