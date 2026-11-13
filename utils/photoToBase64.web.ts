/**
 * Versão web de photoUrlToBase64 / photoUrlToEvidence: usa fetch + FileReader
 * para embutir a foto como data URL no HTML do PDF. Resolvida automaticamente
 * por bundlers web (Vite/Metro web) no lugar de photoToBase64.ts.
 */
import { readExifGeo, ExifGeo } from '../supabase/functions/_shared/exifGps';

export interface PhotoEvidence {
  dataUrl: string;
  geo: ExifGeo | null;
  hash: string;
}

/** SHA-256 em hexadecimal via WebCrypto. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Cópia com buffer próprio: o digest consome o ArrayBuffer inteiro, e um
  // Uint8Array pode ser uma visão sobre um buffer maior.
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Converte um Blob em data URL, sem re-encodar os bytes. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    if (url.startsWith('data:')) {
      const response = await fetch(url);
      return response.ok ? await response.blob() : null;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch (e) {
    console.warn('[photoToBase64] Erro ao converter foto:', e);
    return null;
  }
}

export async function photoUrlToBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const blob = await fetchBlob(url);
    if (!blob) return null;
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl || null;
  } catch (e) {
    console.warn('[photoToBase64] Erro ao converter foto:', e);
    return null;
  }
}

export async function photoUrlToEvidence(url: string): Promise<PhotoEvidence | null> {
  try {
    const blob = await fetchBlob(url);
    if (!blob || blob.size === 0) return null;
    const [dataUrl, bytes] = await Promise.all([
      blobToDataUrl(blob),
      blob.arrayBuffer().then(buffer => new Uint8Array(buffer)),
    ]);
    if (!dataUrl || bytes.byteLength === 0) return null;
    return {
      dataUrl,
      geo: readExifGeo(bytes),
      hash: await sha256Hex(bytes),
    };
  } catch (e) {
    console.warn('[photoToBase64] Erro ao ler proveniência da foto:', e);
    return null;
  }
}
