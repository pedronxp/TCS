/**
 * TCS Mobile V5 design tokens.
 *
 * Light keeps the approved Penpot palette. Dark is a dedicated neutral-green
 * system designed for native surfaces; risk colors remain semantic only.
 */

export const TCSLightPalette = {
  background: '#F7F8F7',
  surface: '#FFFFFF',
  foreground: '#171A18',
  muted: '#68716D',
  primary: '#2F6B5B',
  primaryDark: '#245447',
  secondary: '#EDF3F0',
  accent: '#B9D8CD',
  border: '#DCE4E0',
  success: '#2E7D5A',
  successLight: '#E8F3EE',
  warning: '#A66B22',
  warningLight: '#FBF3E7',
  danger: '#B24A4A',
  dangerLight: '#F9ECEC',
  riscoR3: '#C45F2A',
  riscoR3Light: '#FFF1E9',
  riscoR3Text: '#93441F',
} as const;

export const TCSDarkPalette = {
  background: '#0F1411',
  surface: '#171D19',
  foreground: '#F0F5F1',
  muted: '#A7B2AC',
  primary: '#7ABAA5',
  primaryDark: '#A2D1C1',
  secondary: '#203029',
  accent: '#5F9F8A',
  border: '#2C3A33',
  success: '#72C09B',
  successLight: '#173428',
  warning: '#E0B06F',
  warningLight: '#3A2D1D',
  danger: '#E38B8B',
  dangerLight: '#3B2222',
  riscoR3: '#E39A70',
  riscoR3Light: '#3D291F',
  riscoR3Text: '#F2B28D',
} as const;

// Compatibility alias for static light-brand assets and legacy imports.
export const TCSPalette = TCSLightPalette;

type ThemePalette = {
  [Key in keyof typeof TCSLightPalette]: string;
};

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
    surfaceHighlight: isDark ? '#1E2923' : palette.secondary,
    surfaceVariant: palette.secondary,
    onSurface: palette.foreground,
    onPrimary: isDark ? '#102019' : palette.surface,
    muted: palette.muted,
    mutedBackground: isDark ? '#121815' : palette.background,
    focusRing: palette.accent,
    pressedOverlay: isDark ? 'rgba(122,186,165,0.16)' : 'rgba(47,107,91,0.10)',
    overlay: isDark ? 'rgba(0,0,0,0.66)' : 'rgba(23,26,24,0.44)',
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
} as const;

export type TCSTheme = ReturnType<typeof createTheme>;
