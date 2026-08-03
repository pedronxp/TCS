import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

export interface FlowProgressProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
}

export function FlowProgress({ currentStep, totalSteps, label }: FlowProgressProps) {
  const { theme } = useTheme();
  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = Math.min(Math.max(1, currentStep), safeTotal);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Etapa ${safeCurrent} de ${safeTotal}${label ? `, ${label}` : ''}`}
      accessibilityValue={{ min: 1, max: safeTotal, now: safeCurrent }}
    >
      <View style={styles.copy}>
        <Text style={[styles.step, { color: theme.primary }]}>Etapa {safeCurrent} de {safeTotal}</Text>
        {label ? <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text> : null}
      </View>
      <View style={styles.trackRow}>
        {Array.from({ length: safeTotal }).map((_, index) => (
          <View
            key={index}
            style={[styles.track, { backgroundColor: index < safeCurrent ? theme.primary : theme.border }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing[2] },
  copy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[3] },
  step: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  label: { flex: 1, fontSize: FontSize.xs, textAlign: 'right' },
  trackRow: { flexDirection: 'row', gap: Spacing[1] },
  track: { flex: 1, height: 4, borderRadius: 2 },
});
