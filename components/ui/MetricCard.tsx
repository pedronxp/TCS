import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export interface MetricCardProps {
  value: string | number;
  label: string;
  detail?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  style?: ViewStyle;
}

export function MetricCard({ value, label, detail, tone = 'primary', style }: MetricCardProps) {
  const { theme } = useTheme();
  const color = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : tone === 'danger' ? theme.error : theme.primary;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      {detail ? <Text style={[styles.detail, { color }]}>{detail}</Text> : <View style={[styles.rule, { backgroundColor: color }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 104, borderWidth: 1, borderRadius: SpacingAlias.radiusMd, padding: Spacing[3] },
  value: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold },
  label: { marginTop: Spacing[1], fontSize: FontSize.xs },
  detail: { marginTop: Spacing[2], fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  rule: { width: 36, height: 3, borderRadius: 2, marginTop: Spacing[2] },
});
