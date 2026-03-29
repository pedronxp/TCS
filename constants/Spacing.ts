// constants/Spacing.ts
// Escala de espaçamento do Design System — base 4px

export const Spacing = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// Aliases semânticos
export const SpacingAlias = {
  // Padding interno de componentes
  cardPaddingHorizontal: Spacing[4],  // 16
  cardPaddingVertical:   Spacing[4],  // 16
  screenPadding:         Spacing[4],  // 16
  inputPadding:          Spacing[3],  // 12
  buttonPaddingH:        Spacing[4],  // 16
  buttonPaddingV:        Spacing[3],  // 12

  // Border radius
  radiusSm:  6,
  radiusMd:  12,
  radiusLg:  16,
  radiusXl:  24,
  radiusFull: 999,

  // Gaps entre elementos
  gapXs:  Spacing[1],  // 4
  gapSm:  Spacing[2],  // 8
  gapMd:  Spacing[3],  // 12
  gapLg:  Spacing[4],  // 16
  gapXl:  Spacing[6],  // 24
} as const;

export type SpacingKey = keyof typeof Spacing;
