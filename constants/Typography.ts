// constants/Typography.ts
// Escala tipográfica do Design System — Defesa Civil Expo
// Usa system fonts (San Francisco no iOS, Roboto no Android)

export const FontSize = {
  xs:   11,   // caption pequeno, badges
  sm:   12,   // caption, labels secundários
  base: 14,   // body padrão
  md:   16,   // body maior, inputs
  lg:   18,   // subtítulo, section headers
  xl:   20,   // título de tela (heading 3)
  '2xl': 24,  // heading 2
  '3xl': 28,  // heading 1
  '4xl': 32,  // display
} as const;

export const FontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
  extrabold:'800' as const,
} as const;

export const FontFamily = {
  /** San Francisco on iOS, Roboto on Android. */
  sans: undefined,
} as const;

export const LineHeight = {
  tight:   1.2,  // headings
  snug:    1.35, // subtítulos
  normal:  1.5,  // body text
  relaxed: 1.65, // texto corrido, descrições longas
} as const;

// Estilos pré-compostos (usar como referência, não como StyleSheet)
// Uso: { fontSize: Typography.display.size, fontWeight: Typography.display.weight }
export const Typography = {
  display: {
    size:       FontSize['4xl'],
    weight:     FontWeight.bold,
    lineHeight: LineHeight.tight,
  },
  h1: {
    size:       FontSize['3xl'],
    weight:     FontWeight.bold,
    lineHeight: LineHeight.tight,
  },
  h2: {
    size:       FontSize['2xl'],
    weight:     FontWeight.bold,
    lineHeight: LineHeight.snug,
  },
  h3: {
    size:       FontSize.xl,
    weight:     FontWeight.semibold,
    lineHeight: LineHeight.snug,
  },
  subtitle: {
    size:       FontSize.lg,
    weight:     FontWeight.semibold,
    lineHeight: LineHeight.snug,
  },
  bodyLarge: {
    size:       FontSize.md,
    weight:     FontWeight.regular,
    lineHeight: LineHeight.normal,
  },
  body: {
    size:       FontSize.base,
    weight:     FontWeight.regular,
    lineHeight: LineHeight.normal,
  },
  bodySmall: {
    size:       FontSize.sm,
    weight:     FontWeight.regular,
    lineHeight: LineHeight.normal,
  },
  label: {
    size:       FontSize.sm,
    weight:     FontWeight.semibold,
    lineHeight: LineHeight.snug,
  },
  caption: {
    size:       FontSize.xs,
    weight:     FontWeight.regular,
    lineHeight: LineHeight.normal,
  },
  captionBold: {
    size:       FontSize.xs,
    weight:     FontWeight.semibold,
    lineHeight: LineHeight.normal,
  },
} as const;

export const LetterSpacing = {
  tight: -0.2,
  normal: 0,
  label: 0.1,
  eyebrow: 0.6,
} as const;
