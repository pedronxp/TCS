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
    // Risco — use *Text tokens for WCAG AA compliance
    case 'R1': return { bg: theme.riscoR1Light, text: theme.riscoR1Text };
    case 'R2': return { bg: theme.riscoR2Light, text: theme.riscoR2Text };
    case 'R3': return { bg: theme.riscoR3Light, text: theme.riscoR3Text };
    case 'R4': return { bg: theme.riscoR4Light, text: theme.riscoR4Text };
    // Estados
    case 'success': return { bg: theme.successLight, text: theme.successText };
    case 'warning': return { bg: theme.warningLight, text: theme.warningText };
    case 'error':   return { bg: theme.errorLight,   text: theme.errorText   };
    case 'info':    return { bg: theme.primaryLight,  text: theme.primaryText };
    // Roles
    case 'agente':       return { bg: theme.primaryLight,  text: theme.primaryText };
    case 'supervisor':   return { bg: theme.warningLight,  text: theme.warningText };
    case 'admin':        return { bg: theme.errorLight,    text: theme.errorText   };
    case 'master_admin': return { bg: theme.successLight,  text: theme.successText };
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
