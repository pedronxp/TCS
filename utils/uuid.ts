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
 * Sanitiza nome de município para uso no protocolo.
 * Remove acentos, espaços e caracteres especiais. Limita a 10 chars.
 * Ex: "São Paulo" → "SAOPAULO" | "Rio de Janeiro" → "RIOJANEIRO"
 */
function sanitizeMunicipio(municipio: string): string {
  return municipio
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')         // só letras e números
    .substring(0, 10)                  // máx 10 chars
    || 'SEMCIDADE';
}

/**
 * Gera um protocolo legível e rastreável por cidade.
 *
 * Formato: TCS-CAMPINAS-20260402-K7MP
 *   TCS         = prefixo do sistema
 *   CAMPINAS    = município DA VISTORIA (não do usuário logado)
 *   20260402    = data da vistoria (AAAAMMDD, ordenável)
 *   K7MP        = 4 chars únicos derivados do UUID
 *                 (sem I, O, 0, 1 — sem ambiguidade visual)
 *
 * @param uuid       - ID da vistoria (UUID v4)
 * @param date       - Data ISO da vistoria (usa data atual se ausente)
 * @param municipio  - Município onde ocorreu a vistoria (não o do usuário)
 */
export function generateProtocolo(uuid: string, date?: string | null, municipio?: string | null): string {
  const SAFE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const d = (date && !isNaN(Date.parse(date))) ? new Date(date) : new Date();
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');

  const cidade = municipio ? sanitizeMunicipio(municipio) : 'SEMCIDADE';

  const hex = uuid.replace(/-/g, '').substring(0, 8);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    const byte = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    suffix += SAFE[byte % SAFE.length];
  }

  return `TCS-${cidade}-${year}${month}${day}-${suffix}`;
}

/**
 * Quebra o protocolo em partes para exibição formatada.
 * Ex: "TCS-CAMPINAS-20260402-K7MP" → { prefix:'TCS', cidade:'CAMPINAS', date:'02/04/2026', hash:'K7MP' }
 */
export function parseProtocolo(protocolo: string): { prefix: string; cidade: string; date: string; hash: string } | null {
  const m = protocolo.match(/^([A-Z]+)-([A-Z0-9]+)-(\d{4})(\d{2})(\d{2})-([A-Z0-9]+)$/);
  if (!m) return null;
  return {
    prefix: m[1],
    cidade: m[2],
    date:   `${m[5]}/${m[4]}/${m[3]}`,
    hash:   m[6],
  };
}
