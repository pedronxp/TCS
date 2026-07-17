import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export const RISK_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'] as const;

export type BrandVariant = 'mark' | 'compact' | 'hero' | 'boot';

export function RiskBar({ labelled = false, width = 76 }: { labelled?: boolean; width?: number }) {
  return (
    <View accessibilityLabel="Classificação de risco R1 a R4" style={[styles.riskBar, { width, height: labelled ? 26 : 4 }]}>
      {RISK_COLORS.map((color, index) => (
        <View key={color} style={[styles.riskSegment, { backgroundColor: color }]}>
          {labelled && <Text style={styles.riskLabel}>R{index + 1}</Text>}
        </View>
      ))}
    </View>
  );
}

export function TCSMark({ size = 96 }: { size?: number }) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="TCS Relatório e Risco"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          borderWidth: Math.max(2, size * 0.032),
          borderColor: theme.primary,
          backgroundColor: theme.surfaceHighlight,
        },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.markText, { color: theme.text, fontSize: size * 0.25 }]}>TCS</Text>
      <RiskBar width={size * 0.60} />
    </View>
  );
}

export function ProductIdentity({ variant = 'hero' }: { variant?: BrandVariant }) {
  const { theme } = useTheme();
  const compact = variant === 'compact';
  const markOnly = variant === 'mark';
  const boot = variant === 'boot';
  const markSize = markOnly ? 76 : compact ? 56 : boot ? 112 : 104;

  return (
    <View style={[styles.identity, compact && styles.identityCompact]}>
      <TCSMark size={markSize} />
      {!markOnly && (
        <View style={[styles.copy, compact && styles.copyCompact]}>
          <Text allowFontScaling={false} style={[compact ? styles.wordmarkCompact : styles.wordmark, { color: theme.text }]}>TCS</Text>
          <RiskBar width={compact ? 52 : 72} />
          <Text style={[styles.productName, { color: theme.primary }]}>RELATÓRIO E RISCO</Text>
          {!compact && !boot && (
            <Text style={[styles.descriptor, { color: theme.textSecondary }]}>Plataforma de vistoria técnica para Defesa Civil</Text>
          )}
        </View>
      )}
    </View>
  );
}

export function OpeningBackground() {
  const { isDark } = useTheme();
  const width = Dimensions.get('window').width;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      {[0, 1, 2, 3, 4, 5].map(index => (
        <View
          key={index}
          style={[
            styles.backgroundLine,
            {
              top: width * 0.40 * index - 64,
              left: -width * 0.35,
              width: width * 2,
              borderColor: isDark ? 'rgba(59,130,246,0.045)' : 'rgba(59,130,246,0.08)',
            },
          ]}
        />
      ))}
    </View>
  );
}

export function OpeningBoot() {
  const { theme } = useTheme();
  return (
    <View accessibilityLabel="Inicializando TCS" style={[styles.boot, { backgroundColor: theme.background }]}>
      <OpeningBackground />
      <ProductIdentity variant="boot" />
      <ActivityIndicator accessibilityLabel="Carregando" size="small" color={theme.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', gap: Spacing[2] },
  markText: { fontWeight: FontWeight.extrabold, letterSpacing: -1 },
  riskBar: { flexDirection: 'row', gap: 3, overflow: 'hidden', borderRadius: SpacingAlias.radiusFull },
  riskSegment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 2 },
  riskLabel: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.extrabold },
  identity: { alignItems: 'center', gap: Spacing[4] },
  identityCompact: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  copy: { alignItems: 'center', gap: Spacing[2], maxWidth: 320 },
  copyCompact: { alignItems: 'flex-start', gap: 3 },
  wordmark: { fontSize: 52, lineHeight: 56, fontWeight: FontWeight.extrabold, letterSpacing: -2 },
  wordmarkCompact: { fontSize: FontSize.xl, lineHeight: 22, fontWeight: FontWeight.extrabold },
  productName: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 2.4, textAlign: 'center' },
  descriptor: { fontSize: FontSize.sm, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  backgroundLine: { position: 'absolute', height: 1, borderTopWidth: 1, transform: [{ rotate: '-20deg' }] },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[6] },
  loader: { marginTop: Spacing[8] },
});
