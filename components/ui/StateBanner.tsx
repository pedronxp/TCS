import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export type StateBannerVariant = 'info' | 'success' | 'warning' | 'danger';

export interface StateBannerProps {
  title: string;
  description?: string;
  variant?: StateBannerVariant;
  actionLabel?: string;
  onAction?: () => void;
}

export function StateBanner({ title, description, variant = 'info', actionLabel, onAction }: StateBannerProps) {
  const { theme } = useTheme();
  const config = {
    info: { icon: 'info' as const, color: theme.primary, background: theme.secondary },
    success: { icon: 'check-circle' as const, color: theme.success, background: theme.successLight },
    warning: { icon: 'alert-triangle' as const, color: theme.warning, background: theme.warningLight },
    danger: { icon: 'alert-circle' as const, color: theme.error, background: theme.errorLight },
  }[variant];

  return (
    <View style={[styles.container, { backgroundColor: config.background }]} accessibilityRole="alert">
      <Feather name={config.icon} size={20} color={config.color} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.action, { color: config.color }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], borderRadius: SpacingAlias.radiusMd, padding: Spacing[3] },
  copy: { flex: 1 },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  description: { marginTop: 3, fontSize: FontSize.xs, lineHeight: 16 },
  action: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
