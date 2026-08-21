/**
 * TCS Mobile V5 design tokens.
 *
 * Light keeps the approved Penpot palette. Dark is a dedicated neutral-green
 * system designed for native surfaces; risk colors remain semantic only.
 */

export const TCSLightPalette = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  foreground: '#171717',
  muted: '#666666',
  primary: '#171717',
  primaryDark: '#3D3D3D',
  secondary: '#F5F5F5',
  accent: '#EDEDED',
  border: '#E0E0E0',
  success: '#22C55E',
  successLight: '#E7F6EE',
  warning: '#C77A00',
  warningLight: '#FEF3E2',
  danger: '#C0291D',
  dangerLight: '#FEF2F2',
  riscoR3: '#D9531F',
  riscoR3Light: '#FFF1E9',
  riscoR3Text: '#93441F',
} as const;

export const TCSDarkPalette = {
  background: '#171717',
  surface: '#1F1F1F',
  foreground: '#FAFAFA',
  muted: '#A6A6A6',
  primary: '#FAFAFA',
  primaryDark: '#E0E0E0',
  secondary: '#262626',
  accent: '#303030',
  border: '#333333',
  success: '#22C55E',
  successLight: '#1A3B2A',
  warning: '#F59E0B',
  warningLight: '#3A2D1D',
  danger: '#DC2626',
  dangerLight: '#3B2222',
  riscoR3: '#D9531F',
  riscoR3Light: '#3D291F',
  riscoR3Text: '#F2B28D',
} as const;

export const TCSOrcaPalette = {
  background: '#0F1411',
  surface: '#171D19',
  foreground: '#FAFAFA',
  muted: '#9CA69F',
  primary: '#22C55E',
  primaryDark: '#16A34A',
  secondary: '#273229',
  accent: '#2E3A32',
  border: '#2E3A32',
  success: '#22C55E',
  successLight: '#1A2E21',
  warning: '#F59E0B',
  warningLight: '#3A2D1D',
  danger: '#EF4444',
  dangerLight: '#3B2222',
  riscoR3: '#FB923C',
  riscoR3Light: '#3D291F',
  riscoR3Text: '#FDBA74',
} as const;

export const TCSDrawculaPalette = {
  background: '#282A36',
  surface: '#343746',
  foreground: '#F8F8F2',
  muted: '#9BA0C7',
  primary: '#BD93F9',
  primaryDark: '#9E7DCE',
  secondary: '#44475A',
  accent: '#4C4F66',
  border: '#4C4F66',
  success: '#50FA7B',
  successLight: '#1F3428',
  warning: '#F1FA8C',
  warningLight: '#3A3A1D',
  danger: '#FF5555',
  dangerLight: '#3B2222',
  riscoR3: '#FFB86C',
  riscoR3Light: '#3D291F',
  riscoR3Text: '#FFCC95',
} as const;

export const TCSNordPalette = {
  background: '#2E3440',
  surface: '#3B4252',
  foreground: '#ECEFF4',
  muted: '#9BA3B3',
  primary: '#88C0D0',
  primaryDark: '#6FA8B7',
  secondary: '#434C5E',
  accent: '#4C566A',
  border: '#4C566A',
  success: '#A3BE8C',
  successLight: '#243428',
  warning: '#EBCB8B',
  warningLight: '#3A351D',
  danger: '#BF616A',
  dangerLight: '#3B2828',
  riscoR3: '#D08770',
  riscoR3Light: '#3D2D1F',
  riscoR3Text: '#E5A48A',
} as const;

export const TCSGruvboxPalette = {
  background: '#282828',
  surface: '#3C3836',
  foreground: '#FBF1C7',
  muted: '#BDAE93',
  primary: '#FABD2F',
  primaryDark: '#D79921',
  secondary: '#504945',
  accent: '#665C54',
  border: '#665C54',
  success: '#B8BB26',
  successLight: '#2A3320',
  warning: '#FE8019',
  warningLight: '#3D2A1D',
  danger: '#FB4934',
  dangerLight: '#3B2222',
  riscoR3: '#D65D0E',
  riscoR3Light: '#3D291F',
  riscoR3Text: '#FE8019',
} as const;

// Compatibility alias for static light-brand assets and legacy imports.
export const TCSPalette = TCSLightPalette;

type ThemePalette = {
  [Key in keyof typeof TCSLightPalette]: string;
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function createTheme(palette: ThemePalette, isDark: boolean) {
  return {
    background: palette.background,
    surface: palette.surface,
    text: palette.foreground,
    foreground: palette.foreground,
    textSecondary: palette.muted,
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryLight: palette.secondary,
    primaryText: palette.primaryDark,
    secondary: palette.secondary,
    accent: palette.accent,
    border: palette.border,
    divider: palette.border,
    iconBackground: palette.secondary,
    cardBorder: palette.border,
    surfaceHighlight: palette.secondary,
    surfaceVariant: palette.secondary,
    onSurface: palette.foreground,
    onPrimary: palette.background,
    muted: palette.muted,
    mutedBackground: palette.background,
    focusRing: palette.accent,
    pressedOverlay: hexToRgba(palette.primary, isDark ? 0.16 : 0.10),
    overlay: isDark ? 'rgba(0,0,0,0.66)' : 'rgba(23,23,23,0.44)',
    disabledOpacity: isDark ? 0.5 : 0.48,

    success: palette.success,
    successLight: palette.successLight,
    successText: palette.success,
    warning: palette.warning,
    warningLight: palette.warningLight,
    warningText: palette.warning,
    error: palette.danger,
    errorLight: palette.dangerLight,
    errorText: palette.danger,

    riscoR1: palette.success,
    riscoR1Light: palette.successLight,
    riscoR1Text: palette.success,
    riscoR2: palette.warning,
    riscoR2Light: palette.warningLight,
    riscoR2Text: palette.warning,
    riscoR3: palette.riscoR3,
    riscoR3Light: palette.riscoR3Light,
    riscoR3Text: palette.riscoR3Text,
    riscoR4: palette.danger,
    riscoR4Light: palette.dangerLight,
    riscoR4Text: palette.danger,
  };
}

export const Colors = {
  light: createTheme(TCSLightPalette, false),
  dark: createTheme(TCSDarkPalette, true),
  orca: createTheme(TCSOrcaPalette, true),
  dracula: createTheme(TCSDrawculaPalette, true),
  nord: createTheme(TCSNordPalette, true),
  gruvbox: createTheme(TCSGruvboxPalette, true),
} as const;

export type TCSTheme = ReturnType<typeof createTheme>;
