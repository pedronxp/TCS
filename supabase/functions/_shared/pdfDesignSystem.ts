/**
 * Contrato visual único dos documentos institucionais da Defesa Civil.
 *
 * Este módulo é propositalmente livre de dependências de React Native, Deno e
 * pdf-lib para poder ser consumido tanto pelo app quanto pelas Edge Functions.
 */
export const PDF_DESIGN_VERSION = 'defesa-civil-pdf-v2';
export const PDF_DESIGN_LABEL = 'Modelo v2';

export const PDF_PAGE = {
  widthPt: 595.28,
  heightPt: 841.89,
  marginPt: 45.35, // 16 mm
  footerHeightPt: 36,
} as const;

export const PDF_COLORS = {
  navy: '#153E75',
  navyDark: '#102A56',
  blue: '#2563EB',
  ink: '#172033',
  text: '#334155',
  muted: '#64748B',
  subtle: '#94A3B8',
  line: '#CBD5E1',
  lineSoft: '#E2E8F0',
  surface: '#F8FAFC',
  blueSoft: '#EFF6FF',
  white: '#FFFFFF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
} as const;

export const PDF_RISK_COLORS = {
  r1: '#15803D',
  r2: '#D97706',
  r3: '#EA580C',
  r4: '#B91C1C',
  nao_iminente: '#15803D',
  iminente: '#B91C1C',
} as const;

export function hexToPdfRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return [0, 0, 0];
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

export function humanizePdfFieldKey(key: string): string {
  const labels: Record<string, string> = {
    nivelRisco: 'Nível de risco',
    pontuacaoTotal: 'Pontuação total',
  };
  if (labels[key]) return labels[key];

  const value = key
    .replace(/^item[_-]?(\d+)$/i, 'Item $1')
    .replace(/([a-zá-ú])([A-ZÁ-Ú])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return value
    ? value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1)
    : 'Item avaliado';
}

/**
 * Base CSS usada por todos os PDFs HTML do app.
 * Regras específicas de cada documento devem complementar este contrato.
 */
export function buildPdfBaseCss(): string {
  return `
    @page { size: A4 portrait; margin: 16mm 16mm 20mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: ${PDF_COLORS.white};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: ${PDF_COLORS.ink};
      font-size: 10.5pt;
      line-height: 1.45;
    }
    table { break-inside: auto; page-break-inside: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; }
    tr, img, .pdf-avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-page-footer {
      margin-top: 12mm;
      border-top: 0.35mm solid ${PDF_COLORS.line};
      padding-top: 2.2mm;
      color: ${PDF_COLORS.muted};
      font-size: 7.5pt;
      letter-spacing: 0.1pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-page-footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8mm;
    }
    .pdf-muted { color: ${PDF_COLORS.muted}; }
    .pdf-preserve-lines { white-space: pre-wrap; overflow-wrap: anywhere; }
  `;
}
