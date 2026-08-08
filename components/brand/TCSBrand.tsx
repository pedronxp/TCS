import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export const RISK_COLORS = ['#2E7D5A', '#A66B22', '#C45F2A', '#B24A4A'] as const;

export type BrandVariant = 'mark' | 'compact' | 'hero' | 'boot';

export function RiskBar({ labelled = false, width = 112 }: { labelled?: boolean; width?: number }) {
  return (
    <View
      accessibilityLabel="Classificação de risco R1 a R4"
      style={[styles.riskBar, { width, height: labelled ? 28 : 5 }]}
    >
      {RISK_COLORS.map((color, index) => (
        <View key={color} style={[styles.riskSegment, { backgroundColor: color }]}>
          {labelled ? <Text style={styles.riskLabel}>R{index + 1}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function TCSMark({ size = 96 }: { size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="TCS Relatório de Risco"
      style={[
        styles.markFrame,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <Image
        source={require('../../assets/brand/tcs-mark-v5.png')}
        resizeMode="contain"
        style={{ width: size * 1.45, height: size * 1.45 }}
      />
    </View>
  );
}

export function ProductIdentity({ variant = 'hero' }: { variant?: BrandVariant }) {
  const { theme } = useTheme();
  const compact = variant === 'compact';
  const markOnly = variant === 'mark';
  const boot = variant === 'boot';
  const markSize = markOnly ? 72 : compact ? 52 : boot ? 116 : 104;

  if (markOnly) return <TCSMark size={markSize} />;

  return (
    <View style={[styles.identity, compact && styles.identityCompact]}>
      <TCSMark size={markSize} />
      <View style={[styles.copy, compact && styles.copyCompact]}>
        <Text
          allowFontScaling={false}
          style={[compact ? styles.wordmarkCompact : styles.wordmark, { color: theme.text }]}
        >
          TCS
        </Text>
        <Text style={[styles.productName, { color: theme.primary }]}>RELATÓRIO DE RISCO</Text>
        {!compact && !boot ? (
          <Text style={[styles.descriptor, { color: theme.textSecondary }]}>Plataforma de vistoria técnica para Defesa Civil</Text>
        ) : null}
      </View>
    </View>
  );
}

export function OpeningBackground() {
  const { theme } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      <View style={[styles.orbLarge, { backgroundColor: theme.secondary }]} />
      <View style={[styles.orbSmall, { borderColor: theme.accent }]} />
      <View style={[styles.gridLine, styles.gridLineOne, { backgroundColor: theme.border }]} />
      <View style={[styles.gridLine, styles.gridLineTwo, { backgroundColor: theme.border }]} />
    </View>
  );
}

export function OpeningBoot() {
  const { theme } = useTheme();
  return (
    <View accessibilityLabel="Inicializando TCS" style={[styles.boot, { backgroundColor: theme.background }]}>
      <OpeningBackground />
      <View style={styles.bootContent}>
        <ProductIdentity variant="boot" />
        <Text style={[styles.bootMessage, { color: theme.textSecondary }]}>Preparando sua operação</Text>
        <ActivityIndicator accessibilityLabel="Carregando" size="small" color={theme.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  markFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  riskBar: { flexDirection: 'row', gap: 3, overflow: 'hidden', borderRadius: SpacingAlias.radiusFull },
  riskSegment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  riskLabel: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.extrabold },
  identity: { alignItems: 'center', gap: Spacing[4] },
  identityCompact: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  copy: { alignItems: 'center', gap: Spacing[1], maxWidth: 320 },
  copyCompact: { alignItems: 'flex-start' },
  wordmark: { fontSize: 48, lineHeight: 52, fontWeight: FontWeight.extrabold, letterSpacing: -2.2 },
  wordmarkCompact: { fontSize: FontSize.xl, lineHeight: 24, fontWeight: FontWeight.extrabold, letterSpacing: -0.5 },
  productName: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.5, textAlign: 'center' },
  descriptor: { fontSize: FontSize.sm, lineHeight: 18, textAlign: 'center', maxWidth: 300, marginTop: Spacing[1] },
  orbLarge: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: -170, right: -170, opacity: 0.75 },
  orbSmall: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1, bottom: 48, left: -110, opacity: 0.8 },
  gridLine: { position: 'absolute', opacity: 0.55 },
  gridLineOne: { width: 1, top: 0, bottom: 0, left: '18%' },
  gridLineTwo: { height: 1, left: 0, right: 0, top: '34%' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[6], overflow: 'hidden' },
  bootContent: { alignItems: 'center', gap: Spacing[6] },
  bootMessage: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: -Spacing[3] },
});
