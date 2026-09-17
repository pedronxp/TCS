import { File, Paths } from 'expo-file-system';

/**
 * Converte a URL/URI de uma foto em data URL base64 para embutir no PDF.
 * Implementação nativa (Expo). A versão web fica em photoToBase64.web.ts
 * e é resolvida automaticamente pelo bundler web.
 */
export async function photoUrlToBase64(url: string): Promise<string | null> {
  let temporaryFile: File | null = null;
  try {
    if (url.startsWith('file://')) {
      const file = new File(url);
      if (!file.exists) return null;
      const b64 = await file.base64();
      return `data:image/jpeg;base64,${b64}`;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      temporaryFile = new File(
        Paths.cache,
        `foto_laudo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`,
      );
      const downloaded = await File.downloadFileAsync(url, temporaryFile, { idempotent: true });
      const b64 = await downloaded.base64();
      return `data:image/jpeg;base64,${b64}`;
    }
  } catch (e) {
    console.warn('[photoToBase64] Erro ao converter foto:', e);
  } finally {
    if (temporaryFile?.exists) {
      try { temporaryFile.delete(); } catch { /* arquivo temporário já removido */ }
    }
  }
  return null;
}
