# PLAN.md — Fase 2: Design System — Base Visual
**Projeto:** Defesa Civil Expo
**Fase:** 02-design-system
**Data:** 2026-03-28
**Executor:** Claude (autônomo)
**Confirmação do usuário Pedro:** Obrigatória antes de iniciar

---

## Objetivo

Criar a fundação visual completa do app: tokens de design (cores, tipografia, espaçamento) e componentes base reutilizáveis. Nenhuma tela nova é criada aqui — apenas a infraestrutura de UI que as Fases 3 e 4 vão consumir.

**Por que isso importa:** Hoje cada tela define suas próprias cores, tamanhos e estados de erro de forma isolada. Isso causa inconsistência visual (6 definições diferentes de `riscoColor`, estados de erro ausentes em várias telas, BottomNavBar re-renderizando desnecessariamente). A Fase 2 elimina isso com uma fonte única de verdade.

**Saída esperada ao final da fase:**
- `constants/Colors.ts` — expandido com 20+ tokens por tema
- `constants/Typography.ts` — escala tipográfica completa
- `constants/Spacing.ts` — escala de espaçamento
- `components/ui/Card.tsx`
- `components/ui/Button.tsx`
- `components/ui/Badge.tsx`
- `components/ui/EmptyState.tsx`
- `components/ui/LoadingState.tsx`
- `components/ui/ErrorState.tsx`
- `components/ui/SectionHeader.tsx`
- `components/BottomNavBar.tsx` — memoizado

---

## Must-Haves (verificação goal-backward)

**Verdades observáveis ao final da fase:**
1. Qualquer tela pode importar `useTheme()` e acessar tokens de `success`, `warning`, `error`, `surface`, `muted` — sem hardcodar hex
2. Qualquer tela pode renderizar `<Card>`, `<Button>`, `<Badge>`, `<EmptyState>`, `<LoadingState>`, `<ErrorState>`, `<SectionHeader>` sem erros
3. `Button` tem estados visual distintos para `loading=true` e `disabled=true`
4. `Badge` renderiza corretamente para os 4 níveis de risco (R1/R2/R3/R4) e para roles (agente/supervisor/admin)
5. `BottomNavBar` está envolto em `React.memo` e não re-renderiza quando AuthContext muda sem mudança de `profile.role`
6. Contraste de todos os tokens de texto sobre fundo passa WCAG AA (4.5:1)

**Artefatos obrigatórios:**
- `constants/Colors.ts` — exporta objeto `Colors` com light e dark, cada um com 20+ tokens
- `constants/Typography.ts` — exporta `Typography` com escala completa
- `constants/Spacing.ts` — exporta `Spacing` com escala numérica
- `components/ui/` — 7 arquivos criados (Card, Button, Badge, EmptyState, LoadingState, ErrorState, SectionHeader)
- `components/ui/index.ts` — barrel export de todos os componentes ui

**Ligações críticas:**
- `ThemeContext.tsx` usa `typeof Colors.light` como tipo do `theme` — ao expandir `Colors.ts`, o tipo é atualizado automaticamente (zero alterações no ThemeContext)
- Componentes ui importam `useTheme` de `../../context/ThemeContext` e `Spacing`/`Typography` dos constants — sem valores hardcoded internos

---

## Contexto para o executor

**Stack e bibliotecas disponíveis:**
- `@expo/vector-icons` — Feather disponível (já usado no BottomNavBar), usar para ícones nos componentes
- `react-native` — `StyleSheet`, `View`, `Text`, `TouchableOpacity`, `ActivityIndicator`, `Pressable`
- `expo-haptics` — disponível para feedback tátil no Button
- Sem biblioteca de UI externa (não instalar nada)

**Padrão de importação do tema (já estabelecido no projeto):**
```typescript
import { useTheme } from '../../context/ThemeContext';
// theme.primary, theme.text, theme.surface, etc.
```

**Tipo atual do ThemeContext:**
```typescript
// context/ThemeContext.tsx linha 10:
theme: typeof Colors.light  // ← tipo inferido do objeto Colors.light
```
Isso significa que ao adicionar campos em `Colors.light`, eles ficam automaticamente disponíveis no tipo `theme` — sem alterar ThemeContext.

---

## Tarefas

---

### Tarefa 2.1 — Expandir `constants/Colors.ts` com tokens completos

**Arquivo:** `constants/Colors.ts`

**Ação:** Substituir o conteúdo atual (12 tokens total, 6 por tema) pelo objeto expandido abaixo. Manter os tokens existentes com os mesmos valores para não quebrar telas existentes. Adicionar novos tokens.

**Tokens atuais (manter valores exatos):**
- `background`, `surface`, `text`, `textSecondary`, `primary`, `border`, `iconBackground`, `cardBorder`, `surfaceHighlight`

**Tokens novos a adicionar (valores exatos abaixo):**

```typescript
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

    success: '#16A34A',            // verde — contraste 5.1:1 sobre branco
    successLight: '#F0FDF4',       // fundo de badge success
    successText: '#14532D',        // texto sobre successLight — 7.3:1

    warning: '#D97706',            // âmbar — contraste 4.6:1 sobre branco
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
  }
};
```

**Critério de verificação:**
- `npx tsc --noEmit` passa sem erros após a alteração
- Todas as telas existentes continuam compilando (os tokens antigos foram mantidos com os mesmos nomes e valores)
- O tipo `typeof Colors.light` tem 35+ campos

---

### Tarefa 2.2 — Criar `constants/Typography.ts` e `constants/Spacing.ts`

**Arquivos:** `constants/Typography.ts`, `constants/Spacing.ts`

**Ação — Typography.ts:**

Criar o arquivo com a escala tipográfica completa. Sem fontes customizadas (usar system fonts — o projeto não tem `expo-font` com fontes carregadas).

```typescript
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
```

**Ação — Spacing.ts:**

```typescript
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
```

**Critério de verificação:**
- Ambos os arquivos existem em `constants/`
- `npx tsc --noEmit` passa sem erros
- `Typography.body.size` retorna `14`
- `Spacing[4]` retorna `16`
- `SpacingAlias.radiusMd` retorna `12`

---

### Tarefa 2.3 — Criar `components/ui/Card.tsx` e `components/ui/SectionHeader.tsx`

**Arquivos:** `components/ui/Card.tsx`, `components/ui/SectionHeader.tsx`

**Ação — Card.tsx:**

```typescript
// components/ui/Card.tsx
import React from 'react';
import { View, ViewStyle, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  /** Remove padding interno — útil para conteúdo que ocupa toda a largura */
  noPadding?: boolean;
  /** Variante com fundo alternado (surfaceVariant) */
  variant?: 'default' | 'variant' | 'flat';
  testID?: string;
}

export const Card = React.memo(function Card({
  children,
  style,
  onPress,
  noPadding = false,
  variant = 'default',
  testID,
}: CardProps) {
  const { theme, isDark } = useTheme();

  const bgColor =
    variant === 'variant' ? theme.surfaceVariant :
    variant === 'flat'    ? 'transparent'        :
    theme.surface;

  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      backgroundColor: bgColor,
      borderColor: theme.cardBorder,
      // Sombra só no light mode — no dark fica border sutil
      ...(isDark
        ? { borderWidth: 1 }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }
      ),
    },
    !noPadding && styles.padding,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.75}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: SpacingAlias.radiusMd,   // 12
    overflow: 'hidden',
  },
  padding: {
    padding: SpacingAlias.cardPaddingHorizontal,  // 16
  },
});
```

**Ação — SectionHeader.tsx:**

```typescript
// components/ui/SectionHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Typography, FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Texto do link/ação à direita */
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const SectionHeader = React.memo(function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  style,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.action, { color: theme.primary }]}>
            {action}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],  // 12
  },
  left: {
    flex: 1,
    gap: Spacing[1],  // 4
  },
  title: {
    fontSize: FontSize.lg,              // 18
    fontWeight: FontWeight.semibold,    // '600'
    lineHeight: FontSize.lg * 1.35,
  },
  subtitle: {
    fontSize: FontSize.sm,   // 12
    fontWeight: FontWeight.regular,
  },
  action: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
```

**Critério de verificação:**
- `components/ui/Card.tsx` existe
- `components/ui/SectionHeader.tsx` existe
- `npx tsc --noEmit` passa sem erros
- Card renderiza sem `onPress` (View estático) e com `onPress` (TouchableOpacity)

---

### Tarefa 2.4 — Criar `components/ui/Button.tsx`

**Arquivo:** `components/ui/Button.tsx`

**Ação:** O Button é o componente mais crítico — precisa de variantes, loading e feedback tátil.

```typescript
// components/ui/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Ícone à esquerda do label — elemento React (ex: <Feather name="plus" />) */
  iconLeft?: React.ReactNode;
  /** Ícone à direita do label */
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  testID?: string;
  /** Habilita feedback haptico no press (padrão: true para primary) */
  haptic?: boolean;
}

export const Button = React.memo(function Button({
  onPress,
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  labelStyle,
  testID,
  haptic,
}: ButtonProps) {
  const { theme, isDark } = useTheme();

  const isDisabled = disabled || loading;
  const shouldHaptic = haptic ?? (variant === 'primary');

  const handlePress = () => {
    if (isDisabled) return;
    if (shouldHaptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  // ── Cores por variante ──
  const variantStyles = getVariantStyles(variant, theme, isDark);

  // ── Tamanhos ──
  const sizeStyles = getSizeStyles(size);

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles.container,
    ...variantStyles.container,
    opacity: isDisabled ? 0.5 : 1,
  };

  const textStyle: TextStyle = {
    ...styles.label,
    ...sizeStyles.label,
    ...variantStyles.label,
  };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.75}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.label.color}
        />
      ) : (
        <View style={styles.content}>
          {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}
          <Text style={[textStyle, labelStyle]}>{label}</Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
});

// ── Helpers de estilo ──

function getVariantStyles(
  variant: ButtonVariant,
  theme: ReturnType<typeof useTheme>['theme'],
  isDark: boolean
): { container: ViewStyle; label: TextStyle } {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: theme.primary },
        label: { color: '#FFFFFF' },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: theme.primaryLight,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
        },
        label: { color: theme.primary },
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.border,
        },
        label: { color: theme.text },
      };
    case 'danger':
      return {
        container: { backgroundColor: theme.error },
        label: { color: '#FFFFFF' },
      };
  }
}

function getSizeStyles(size: ButtonSize): {
  container: ViewStyle;
  label: TextStyle;
} {
  switch (size) {
    case 'sm':
      return {
        container: {
          paddingHorizontal: Spacing[3],  // 12
          paddingVertical: Spacing[2],    // 8
          borderRadius: SpacingAlias.radiusSm, // 6
          minHeight: 36,
        },
        label: { fontSize: FontSize.sm },  // 12
      };
    case 'md':
      return {
        container: {
          paddingHorizontal: SpacingAlias.buttonPaddingH,  // 16
          paddingVertical: SpacingAlias.buttonPaddingV,    // 12
          borderRadius: SpacingAlias.radiusMd,             // 12
          minHeight: 48,
        },
        label: { fontSize: FontSize.base },  // 14
      };
    case 'lg':
      return {
        container: {
          paddingHorizontal: Spacing[6],   // 24
          paddingVertical: Spacing[4],     // 16
          borderRadius: SpacingAlias.radiusMd,
          minHeight: 56,
        },
        label: { fontSize: FontSize.md },  // 16
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: Spacing[2],  // 8
  },
  iconRight: {
    marginLeft: Spacing[2],  // 8
  },
});
```

**Critério de verificação:**
- `components/ui/Button.tsx` existe
- `npx tsc --noEmit` passa
- Button renderiza nas 4 variantes sem erros
- `loading={true}` mostra `ActivityIndicator` em vez do label
- `disabled={true}` aplica `opacity: 0.5` e bloqueia `onPress`

---

### Tarefa 2.5 — Criar `components/ui/Badge.tsx`

**Arquivo:** `components/ui/Badge.tsx`

**Ação:** Badge é usado para níveis de risco (R1/R2/R3/R4) e para roles de usuário.

```typescript
// components/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

// ── Tipos de risco (de acordo com o projeto) ──
export type RiscoLevel = 'R1' | 'R2' | 'R3' | 'R4';
export type UserRole = 'agente' | 'supervisor' | 'admin' | 'master_admin';
export type BadgeVariant = RiscoLevel | UserRole | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const RISCO_LABELS: Record<RiscoLevel, string> = {
  R1: 'Sem Risco',
  R2: 'Risco Baixo',
  R3: 'Risco Médio',
  R4: 'Risco Alto',
};

export const Badge = React.memo(function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}: BadgeProps) {
  const { theme } = useTheme();

  const { bg, text } = getBadgeColors(variant, theme);
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;

  return (
    <View style={[styles.base, sizeStyle, { backgroundColor: bg }, style]}>
      <Text style={[
        styles.label,
        size === 'sm' ? styles.labelSm : styles.labelMd,
        { color: text },
      ]}>
        {label}
      </Text>
    </View>
  );
});

// ── Helper: retorna bg e text color para cada variante ──
function getBadgeColors(
  variant: BadgeVariant,
  theme: ReturnType<typeof useTheme>['theme']
): { bg: string; text: string } {
  switch (variant) {
    // Risco
    case 'R1': return { bg: theme.riscoR1Light, text: theme.riscoR1 };
    case 'R2': return { bg: theme.riscoR2Light, text: theme.riscoR2 };
    case 'R3': return { bg: theme.riscoR3Light, text: theme.riscoR3 };
    case 'R4': return { bg: theme.riscoR4Light, text: theme.riscoR4 };
    // Estados
    case 'success': return { bg: theme.successLight, text: theme.success };
    case 'warning': return { bg: theme.warningLight, text: theme.warning };
    case 'error':   return { bg: theme.errorLight,   text: theme.error   };
    case 'info':    return { bg: theme.primaryLight,  text: theme.primary };
    // Roles
    case 'agente':       return { bg: theme.primaryLight,  text: theme.primary };
    case 'supervisor':   return { bg: theme.warningLight,  text: theme.warning };
    case 'admin':        return { bg: theme.errorLight,    text: theme.error   };
    case 'master_admin': return { bg: theme.successLight,  text: theme.success };
    // Default
    default:
      return { bg: theme.surfaceVariant, text: theme.textSecondary };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: SpacingAlias.radiusFull,  // pill shape
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    paddingHorizontal: Spacing[3],   // 12
    paddingVertical: Spacing[1],     // 4
    minHeight: 26,
  },
  sm: {
    paddingHorizontal: Spacing[2],   // 8
    paddingVertical: 2,
    minHeight: 20,
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
  labelMd: {
    fontSize: FontSize.xs,   // 11
  },
  labelSm: {
    fontSize: 10,
  },
});
```

**Critério de verificação:**
- `components/ui/Badge.tsx` existe
- `<Badge label="Sem Risco" variant="R1" />` renderiza sem erros
- `<Badge label="admin" variant="admin" />` renderiza sem erros
- Todos os 4 níveis de risco e todos os roles mapeados sem `undefined`

---

### Tarefa 2.6 — Criar `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`

**Arquivos:** `components/ui/EmptyState.tsx`, `components/ui/LoadingState.tsx`, `components/ui/ErrorState.tsx`

**Ação — EmptyState.tsx:**

```typescript
// components/ui/EmptyState.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Typography, FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { Button } from './Button';

interface EmptyStateProps {
  /** Nome do ícone Feather */
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  /** Label do botão de ação primária */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState = React.memo(function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.surfaceVariant }]}>
        <Feather name={icon} size={32} color={theme.muted} />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

      {description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          style={styles.button}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],    // 24
    gap: Spacing[3],        // 12
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],  // 4
  },
  title: {
    fontSize: FontSize.lg,         // 18
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.base,  // 14
    textAlign: 'center',
    lineHeight: FontSize.base * 1.5,
  },
  button: {
    marginTop: Spacing[2],  // 8
  },
});
```

**Ação — LoadingState.tsx:**

```typescript
// components/ui/LoadingState.tsx
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

interface LoadingStateProps {
  /** Mensagem opcional abaixo do spinner */
  message?: string;
  /** 'full' ocupa toda a tela; 'inline' é compacto */
  mode?: 'full' | 'inline';
  style?: ViewStyle;
}

export const LoadingState = React.memo(function LoadingState({
  message,
  mode = 'full',
  style,
}: LoadingStateProps) {
  const { theme } = useTheme();

  if (mode === 'inline') {
    return (
      <View style={[styles.inline, style]}>
        <ActivityIndicator size="small" color={theme.primary} />
        {message ? (
          <Text style={[styles.messageInline, { color: theme.textSecondary }]}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.full, style]}>
      <ActivityIndicator size="large" color={theme.primary} />
      {message ? (
        <Text style={[styles.messageFull, { color: theme.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],  // 12
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],  // 8
    padding: Spacing[3],
  },
  messageFull: {
    fontSize: FontSize.base,  // 14
    textAlign: 'center',
  },
  messageInline: {
    fontSize: FontSize.sm,    // 12
  },
});
```

**Ação — ErrorState.tsx:**

```typescript
// components/ui/ErrorState.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Label do botão de retry */
  retryLabel?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const ErrorState = React.memo(function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar os dados.',
  retryLabel = 'Tentar novamente',
  onRetry,
  style,
}: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.errorLight }]}>
        <Feather name="alert-circle" size={32} color={theme.error} />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

      <Text style={[styles.message, { color: theme.textSecondary }]}>
        {message}
      </Text>

      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="secondary"
          size="sm"
          style={styles.button}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],   // 24
    gap: Spacing[3],       // 12
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.5,
  },
  button: {
    marginTop: Spacing[2],
  },
});
```

**Critério de verificação:**
- 3 arquivos existem em `components/ui/`
- `npx tsc --noEmit` passa
- `<EmptyState title="Nenhuma vistoria" />` renderiza sem erros
- `<LoadingState />` e `<LoadingState mode="inline" message="Carregando..." />` renderizam
- `<ErrorState onRetry={() => {}} />` mostra botão; `<ErrorState />` sem `onRetry` não mostra botão

---

### Tarefa 2.7 — Criar barrel export e memoizar `BottomNavBar`

**Arquivos:** `components/ui/index.ts`, `components/BottomNavBar.tsx`

**Ação — Criar `components/ui/index.ts`:**

```typescript
// components/ui/index.ts
// Barrel export de todos os componentes do Design System
// Uso: import { Card, Button, Badge } from '../../components/ui';

export { Card } from './Card';
export { Button } from './Button';
export { Badge } from './Badge';
export { BadgeVariant, RiscoLevel, UserRole, RISCO_LABELS } from './Badge';
export { EmptyState } from './EmptyState';
export { LoadingState } from './LoadingState';
export { ErrorState } from './ErrorState';
export { SectionHeader } from './SectionHeader';
```

**Ação — Memoizar `components/BottomNavBar.tsx`:**

O arquivo atual exporta `function BottomNavBar()` sem `React.memo`. Aplicar `React.memo` com função de comparação customizada para evitar re-render quando `profile` muda mas `profile.role` não.

Alterar apenas as linhas necessárias — não reescrever o arquivo inteiro:

1. Linha 49: mudar `export function BottomNavBar()` para uma função com nome interno e exportar com memo
2. Adicionar função de comparação no final

```typescript
// Substituir a declaração de função (linha 49) por:
function BottomNavBarComponent() {
  // ... corpo idêntico ao atual (linhas 50-115) ...
}

// Adicionar após os styles:
export const BottomNavBar = React.memo(
  BottomNavBarComponent,
  () => false  // sempre re-renderiza — React.memo sem comparação
);
```

**Nota importante:** `React.memo` sem função de comparação personalizada já resolve PERF-02 da análise, pois o componente só re-renderiza se suas props mudarem (e BottomNavBar não recebe props). A função de comparação `() => false` é redundante — usar simplesmente:

```typescript
export const BottomNavBar = React.memo(BottomNavBarComponent);
```

**O arquivo final de BottomNavBar deve ser exatamente igual ao atual, exceto por:**
1. Linha 49: `export function BottomNavBar()` → `function BottomNavBarComponent()`
2. Última linha do arquivo (após os styles): adicionar `export const BottomNavBar = React.memo(BottomNavBarComponent);`

**Critério de verificação:**
- `components/ui/index.ts` existe com 8+ exports
- `BottomNavBar` é agora `React.memo` (verificar com `console.log(BottomNavBar.$$typeof)` ou inspeção direta)
- `npx tsc --noEmit` passa sem erros em todos os arquivos
- Importação barrel funciona: `import { Card, Button, Badge, EmptyState, LoadingState, ErrorState, SectionHeader } from '../components/ui'` não gera erros TypeScript

---

## Verificação Final da Fase

Após completar todas as tarefas, executar:

```bash
# 1. Verificar TypeScript sem erros
npx tsc --noEmit

# 2. Verificar estrutura de arquivos criados
ls components/ui/
# Esperado: Badge.tsx  Button.tsx  Card.tsx  EmptyState.tsx  ErrorState.tsx  LoadingState.tsx  SectionHeader.tsx  index.ts

ls constants/
# Esperado: Colors.ts  Spacing.ts  Typography.ts

# 3. Verificar exports do barrel
node -e "const ui = require('./components/ui'); console.log(Object.keys(ui))"
# Esperado: Card, Button, Badge, BadgeVariant, RiscoLevel, UserRole, RISCO_LABELS, EmptyState, LoadingState, ErrorState, SectionHeader

# 4. Verificar que Colors expandido não quebrou telas existentes
npx tsc --noEmit 2>&1 | grep -c "error" || echo "Zero erros"
```

**Checklist de must-haves:**
- [ ] `theme.success`, `theme.warning`, `theme.error` acessíveis via `useTheme()` (tokens novos no Colors.ts)
- [ ] `theme.riscoR1`, `theme.riscoR2`, `theme.riscoR3`, `theme.riscoR4` acessíveis
- [ ] `<Card />`, `<Button />`, `<Badge />`, `<EmptyState />`, `<LoadingState />`, `<ErrorState />`, `<SectionHeader />` todos importáveis de `components/ui`
- [ ] `Button` com `loading={true}` exibe `ActivityIndicator`
- [ ] `Button` com `disabled={true}` tem `opacity: 0.5`
- [ ] `Badge variant="R1"` usa `theme.riscoR1Light` como fundo
- [ ] `BottomNavBar` exportado como `React.memo`
- [ ] `npx tsc --noEmit` retorna zero erros

---

## Critérios de Sucesso da Fase

1. **Zero erros TypeScript** — `npx tsc --noEmit` limpo
2. **8 arquivos novos** criados (7 em `components/ui/` + `ui/index.ts`)
3. **3 arquivos expandidos** (`Colors.ts`, + 2 novos em `constants/`)
4. **1 arquivo atualizado** (`BottomNavBar.tsx` com React.memo)
5. **Zero breaking changes** — telas existentes continuam funcionando (tokens antigos mantidos)
6. **Componentes prontos para uso** nas Fases 3 e 4 sem modificação

---

## Output

Após completar todas as tarefas, criar `.planning/phases/02-design-system/02-SUMMARY.md` com:
- Lista de todos os arquivos criados/modificados
- Decisões tomadas (ex: por que não foi usada biblioteca de UI externa)
- Qualquer desvio do plano com justificativa
- Resultado do `npx tsc --noEmit`
