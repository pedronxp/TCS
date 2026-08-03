import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export type RiscoLevel = 'R1' | 'R2' | 'R3' | 'R4';
export type UserRole =
  | 'individual'
  | 'agent'
  | 'agente'
  | 'owner'
  | 'coordinator'
  | 'supervisor'
  | 'admin'
  | 'master_admin'
  | 'developer';
export type BadgeVariant = RiscoLevel | UserRole | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  showDot?: boolean;
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
  showDot = false,
}: BadgeProps) {
  const { theme } = useTheme();
  const colors = getBadgeColors(variant, theme);

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colors.bg },
        style,
      ]}
      accessibilityLabel={`${label}, ${variant}`}
    >
      {showDot ? <View style={[styles.dot, { backgroundColor: colors.text }]} /> : null}
      <Text
        style={[
          styles.label,
          size === 'sm' ? styles.labelSm : styles.labelMd,
          { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
});

function getBadgeColors(
  variant: BadgeVariant,
  theme: ReturnType<typeof useTheme>['theme'],
): { bg: string; text: string } {
  switch (variant) {
    case 'R1': return { bg: theme.riscoR1Light, text: theme.riscoR1Text };
    case 'R2': return { bg: theme.riscoR2Light, text: theme.riscoR2Text };
    case 'R3': return { bg: theme.riscoR3Light, text: theme.riscoR3Text };
    case 'R4': return { bg: theme.riscoR4Light, text: theme.riscoR4Text };
    case 'success': return { bg: theme.successLight, text: theme.successText };
    case 'warning': return { bg: theme.warningLight, text: theme.warningText };
    case 'error': return { bg: theme.errorLight, text: theme.errorText };
    case 'info': return { bg: theme.primaryLight, text: theme.primaryText };
    case 'admin': return { bg: theme.warningLight, text: theme.warningText };
    case 'master_admin':
    case 'developer': return { bg: theme.errorLight, text: theme.errorText };
    case 'individual':
    case 'agent':
    case 'agente':
    case 'owner':
    case 'coordinator':
    case 'supervisor': return { bg: theme.primaryLight, text: theme.primaryText };
    default: return { bg: theme.surfaceVariant, text: theme.textSecondary };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: SpacingAlias.radiusFull,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing[1],
  },
  md: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    minHeight: 28,
  },
  sm: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    minHeight: 22,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
  labelMd: {
    fontSize: FontSize.xs,
  },
  labelSm: {
    fontSize: 10,
  },
});
