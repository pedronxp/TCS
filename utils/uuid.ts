/**
 * Gera um UUID v4 usando a Web Crypto API nativa do Hermes (React Native 0.71+).
 * Fallback para Math.random em ambientes sem crypto global.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback puro (sem dependências nativas)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gera um protocolo legível e rastreável no formato TCS-YYYYMMDD-XXXX.
 *
 * Formato: TCS-20260402-K7MP
 *   TCS       = prefixo do sistema
 *   20260402  = data da vistoria (AAAAMMDD, ordenável)
 *   K7MP      = 4 caracteres únicos derivados do UUID
 *              (sem I, O, 0, 1 — chars que confundem ao ler/ditár)
 *
 * @param uuid  - ID da vistoria (UUID v4)
 * @param date  - Data ISO da vistoria (opcional; usa data atual se ausente)
 */
export function generateProtocolo(uuid: string, date?: string | null): string {
  // Chars seguros para ditação (sem ambiguidade visual)
  const SAFE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const d = (date && !isNaN(Date.parse(date))) ? new Date(date) : new Date();
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');

  // Extrai 4 bytes dos primeiros 8 dígitos hex do UUID e mapeia para SAFE
  const hex = uuid.replace(/-/g, '').substring(0, 8);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    const byte = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    suffix += SAFE[byte % SAFE.length];
  }

  return `TCS-${year}${month}${day}-${suffix}`;
}

/**
 * Quebra o protocolo em partes para exibição formatada.
 * Exemplo: "TCS-20260402-K7MP" → { prefix: 'TCS', date: '02/04/2026', hash: 'K7MP' }
 */
export function parseProtocolo(protocolo: string): { prefix: string; date: string; hash: string } | null {
  const m = protocolo.match(/^([A-Z]+)-(\d{4})(\d{2})(\d{2})-([A-Z0-9]+)$/);
  if (!m) return null;
  return {
    prefix: m[1],
    date:   `${m[4]}/${m[3]}/${m[2]}`,
    hash:   m[5],
  };
}
