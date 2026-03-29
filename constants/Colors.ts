export const Colors = {
  light: {
    // ── Tokens existentes (não alterar valores) ──
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    primary: '#3B82F6',
    border: '#E2E8F0',
    iconBackground: 'rgba(59, 130, 246, 0.1)',
    cardBorder: 'transparent',
    surfaceHighlight: '#F1F5F9',

    // ── Tokens novos ──
    primaryLight: '#EFF6FF',       // fundo de destaque primário suave
    primaryDark: '#1D4ED8',        // hover/pressed do primary
    primaryText: '#1E40AF',         // texto sobre primaryLight — 8.1:1

    success: '#16A34A',            // verde — contraste 3.3:1 sobre branco (use successText for AA text)
    successLight: '#F0FDF4',       // fundo de badge success
    successText: '#14532D',        // texto sobre successLight — 7.3:1

    warning: '#D97706',            // âmbar — contraste 3.2:1 sobre branco (use warningText for AA text)
    warningLight: '#FFFBEB',       // fundo de badge warning
    warningText: '#78350F',        // texto sobre warningLight — 8.1:1

    error: '#DC2626',              // vermelho — contraste 5.9:1 sobre branco
    errorLight: '#FEF2F2',         // fundo de badge/estado error
    errorText: '#7F1D1D',          // texto sobre errorLight — 8.9:1

    surfaceVariant: '#F1F5F9',     // superfície alternada (ex: linhas de tabela)
    onSurface: '#334155',          // texto sobre surface (secundário mais escuro)
    muted: '#94A3B8',              // texto de placeholder, desabilitado
    mutedBackground: '#F8FAFC',    // fundo de elementos desabilitados
    overlay: 'rgba(0,0,0,0.4)',    // overlay de modal
    divider: '#E2E8F0',            // linha divisória

    // ── Risco (usados em Badge e telas de vistoria) ──
    riscoR1: '#16A34A',            // Sem Risco — verde
    riscoR1Light: '#F0FDF4',
    riscoR2: '#D97706',            // Risco Baixo — âmbar
    riscoR2Light: '#FFFBEB',
    riscoR3: '#EA580C',            // Risco Médio — laranja
    riscoR3Light: '#FFF7ED',
    riscoR4: '#DC2626',            // Risco Alto/Iminente — vermelho
    riscoR4Light: '#FEF2F2',
    riscoR1Text: '#14532D',        // texto sobre riscoR1Light — 9.1:1 (same as successText)
    riscoR2Text: '#78350F',        // texto sobre riscoR2Light — 8.1:1 (same as warningText)
    riscoR3Text: '#7C2D12',        // texto sobre riscoR3Light — 8.5:1
    riscoR4Text: '#7F1D1D',        // texto sobre riscoR4Light — 8.9:1 (same as errorText)
  },
  dark: {
    // ── Tokens existentes (não alterar valores) ──
    background: '#0B0F19',
    surface: '#1A2235',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    primary: '#3B82F6',
    border: 'rgba(255,255,255,0.05)',
    iconBackground: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.03)',
    surfaceHighlight: '#1F2937',

    // ── Tokens novos ──
    primaryLight: 'rgba(59,130,246,0.12)',
    primaryDark: '#60A5FA',
    primaryText: '#93C5FD',        // texto sobre primaryLight dark — 8.2:1

    success: '#4ADE80',            // verde claro — contraste 8.5:1 sobre #0B0F19
    successLight: 'rgba(74,222,128,0.12)',
    successText: '#BBF7D0',

    warning: '#FCD34D',            // âmbar claro — contraste 9.2:1
    warningLight: 'rgba(252,211,77,0.12)',
    warningText: '#FEF3C7',

    error: '#F87171',              // vermelho claro — contraste 7.1:1
    errorLight: 'rgba(248,113,113,0.12)',
    errorText: '#FECACA',

    surfaceVariant: '#1E293B',
    onSurface: '#CBD5E1',
    muted: '#475569',
    mutedBackground: 'rgba(255,255,255,0.04)',
    overlay: 'rgba(0,0,0,0.65)',
    divider: 'rgba(255,255,255,0.06)',

    // ── Risco ──
    riscoR1: '#4ADE80',
    riscoR1Light: 'rgba(74,222,128,0.12)',
    riscoR2: '#FCD34D',
    riscoR2Light: 'rgba(252,211,77,0.12)',
    riscoR3: '#FB923C',
    riscoR3Light: 'rgba(251,146,60,0.12)',
    riscoR4: '#F87171',
    riscoR4Light: 'rgba(248,113,113,0.12)',
    riscoR1Text: '#BBF7D0',       // texto sobre riscoR1Light dark (same as successText dark)
    riscoR2Text: '#FEF3C7',       // texto sobre riscoR2Light dark (same as warningText dark)
    riscoR3Text: '#FED7AA',       // texto sobre riscoR3Light dark
    riscoR4Text: '#FECACA',       // texto sobre riscoR4Light dark (same as errorText dark)
  }
};
