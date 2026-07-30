/**
 * Portal identity contract v1.0.0.
 *
 * React Native keeps platform-native composition and typography while sharing
 * the same semantic meanings used by the Web/Penpot customer portals.
 */
export const PortalSemanticTokens = {
  version: '1.0.0',
  light: {
    background: '#FAF8F5',
    surface: '#FFFFFF',
    foreground: '#1C1917',
    mutedForeground: '#756F6A',
    primary: '#6F503A',
    onPrimary: '#FFFFFF',
    secondary: '#F3EFE9',
    accent: '#D2BDAB',
    border: '#E4DDD5',
    focus: '#67A3C1',
    success: '#3E7B57',
    successSurface: '#EDF7F0',
    warning: '#925C16',
    warningSurface: '#FBF0DB',
    danger: '#A13B32',
    dangerSurface: '#FBE9E7',
    information: '#2F708E',
    informationSurface: '#EDF7FB',
  },
  dark: {
    background: '#181412',
    surface: '#211C19',
    foreground: '#FAF8F5',
    mutedForeground: '#B3A9A0',
    primary: '#72B9E0',
    onPrimary: '#1C1714',
    secondary: '#302925',
    accent: '#254958',
    border: '#3A322E',
    focus: '#67A3C1',
    success: '#72C08F',
    successSurface: '#173426',
    warning: '#E6B85D',
    warningSurface: '#3A2B15',
    danger: '#E47F75',
    dangerSurface: '#3C201D',
    information: '#72B9E0',
    informationSurface: '#193542',
  },
  stateTerms: {
    loading: 'Carregando',
    empty: 'Nenhum item encontrado',
    retry: 'Tentar novamente',
    permissionDenied: 'Sem permissão',
    planLocked: 'Recurso não incluído no plano',
    trial: 'Período de teste',
    active: 'Assinatura ativa',
    grace: 'Em carência',
    pastDue: 'Pagamento pendente',
    cancelAtPeriodEnd: 'Cancelamento agendado',
    canceled: 'Assinatura cancelada',
    expired: 'Assinatura expirada',
    none: 'Sem assinatura',
  },
  accessibility: {
    minimumTouchTarget: 44,
    minimumTextContrast: 4.5,
    reducedMotion: true,
    textScaling: true,
  },
} as const;

export type PortalSemanticTheme = typeof PortalSemanticTokens.light;
