import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OpeningBackground, ProductIdentity } from '../../components/brand';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export default function WelcomeScreen() {
  const { theme, isDark } = useTheme();
  const { isConnected, isOnlineReal } = useConnectivity();
  const insets = useSafeAreaInsets();

  const connection = !isConnected
    ? { label: 'MODO OFFLINE', color: theme.warning, icon: 'wifi-off' as const }
    : isOnlineReal
      ? { label: 'CONEXÃO DISPONÍVEL', color: theme.success, icon: 'wifi' as const }
      : { label: 'CONEXÃO LIMITADA', color: theme.warning, icon: 'alert-circle' as const };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OpeningBackground />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing[8], paddingBottom: Math.max(insets.bottom, Spacing[4]) },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <ProductIdentity variant="hero" />
        </View>

        <View style={styles.actions} accessibilityRole="menu">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Acessar sistema"
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.84}
          >
            <Feather name="log-in" size={19} color="#FFFFFF" />
            <Text style={styles.primaryText}>ACESSAR SISTEMA</Text>
            <Feather name="arrow-right" size={19} color="rgba(255,255,255,0.78)" />
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.secondaryButton, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
            >
              <Feather name="key" size={16} color={theme.primary} />
              <Text style={[styles.secondaryText, { color: theme.text }]}>Ativar acesso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.secondaryButton, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.8}
            >
              <Feather name="info" size={16} color={theme.primary} />
              <Text style={[styles.secondaryText, { color: theme.text }]}>Conhecer o TCS</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Conhecer planos do TCS"
            style={[styles.plansButton, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
            onPress={() => router.push('/(auth)/planos')}
            activeOpacity={0.8}
          >
            <Feather name="credit-card" size={17} color={theme.primary} />
            <Text style={[styles.plansText, { color: theme.primaryText }]}>CONHECER PLANOS</Text>
            <Feather name="chevron-right" size={17} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.trainingButton, { backgroundColor: theme.successLight, borderColor: theme.success }]}
            onPress={() => router.push('/(auth)/treinamento')}
            activeOpacity={0.8}
          >
            <Feather name="book-open" size={17} color={theme.success} />
            <Text style={[styles.trainingText, { color: theme.successText }]}>MODO TREINAMENTO</Text>
            <Feather name="chevron-right" size={17} color={theme.success} />
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.connectionRow}>
            <Feather name={connection.icon} size={13} color={connection.color} />
            <Text style={[styles.connectionText, { color: connection.color }]}>{connection.label}</Text>
          </View>
          <View style={styles.footerBottom}>
            <View style={styles.restrictedRow}>
              <Feather name="shield" size={12} color={theme.textSecondary} />
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>Acesso institucional · Credencial necessária</Text>
            </View>
            <Text style={[styles.version, { color: theme.textSecondary }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: Spacing[6], justifyContent: 'space-between' },
  hero: { alignItems: 'center', justifyContent: 'center', minHeight: 360, paddingVertical: Spacing[6] },
  actions: { gap: Spacing[3], width: '100%', maxWidth: 520, alignSelf: 'center' },
  primaryButton: {
    minHeight: 56, borderRadius: SpacingAlias.radiusLg, paddingHorizontal: Spacing[5],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  primaryText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.extrabold, letterSpacing: 1.3 },
  secondaryRow: { flexDirection: 'row', gap: Spacing[3] },
  secondaryButton: {
    flex: 1, minHeight: 50, borderRadius: SpacingAlias.radiusMd, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], paddingHorizontal: Spacing[2],
  },
  secondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textAlign: 'center' },
  plansButton: {
    minHeight: 50, borderRadius: SpacingAlias.radiusMd, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], paddingHorizontal: Spacing[4],
  },
  plansText: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  trainingButton: {
    minHeight: 50, borderRadius: SpacingAlias.radiusMd, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], paddingHorizontal: Spacing[4],
  },
  trainingText: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  footer: { borderTopWidth: 1, marginTop: Spacing[5], paddingTop: Spacing[3], gap: Spacing[2] },
  connectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], minHeight: 24 },
  connectionText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.2 },
  footerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[2], flexWrap: 'wrap' },
  restrictedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], flexShrink: 1 },
  footerText: { fontSize: FontSize.xs, flexShrink: 1 },
  version: { fontSize: FontSize.xs, opacity: 0.75 },
});
