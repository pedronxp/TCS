/**
 * Versão web de photoUrlToBase64: usa fetch + FileReader para embutir a foto
 * como data URL no HTML do PDF. Resolvida automaticamente por bundlers web
 * (Vite/Metro web) no lugar de photoToBase64.ts.
 */
export async function photoUrlToBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[photoToBase64] Erro ao converter foto:', e);
    return null;
  }
}
