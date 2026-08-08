import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OpeningBackground, ProductIdentity, RiskBar } from '../../components/brand';
import { Button, Card } from '../../components/ui';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const { isConnected, isOnlineReal } = useConnectivity();
  const insets = useSafeAreaInsets();
  const connection = !isConnected
    ? { label: 'MODO OFFLINE', color: theme.warning, icon: 'wifi-off' as const }
    : isOnlineReal
      ? { label: 'CONEXÃO DISPONÍVEL', color: theme.success, icon: 'wifi' as const }
      : { label: 'CONEXÃO LIMITADA', color: theme.warning, icon: 'alert-circle' as const };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="dark" />
      <OpeningBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing[4], paddingBottom: Math.max(insets.bottom, Spacing[5]) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={[styles.connectionChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Feather name={connection.icon} size={14} color={connection.color} />
            <Text style={[styles.connectionText, { color: theme.text }]}>{connection.label}</Text>
          </View>
          <Text style={[styles.version, { color: theme.textSecondary }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>

        <View style={styles.hero}>
          <ProductIdentity variant="hero" />
          <RiskBar labelled width={236} />
          <Text style={[styles.heroCopy, { color: theme.textSecondary }]}>Vistorias técnicas e gestão de risco em um só lugar.</Text>
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/login')}
            iconLeft={<Feather name="log-in" size={19} color={theme.onPrimary} />}
            iconRight={<Feather name="arrow-right" size={19} color={theme.onPrimary} />}
          >
            ACESSAR SISTEMA
          </Button>

          <View style={styles.secondaryGrid}>
            <Button variant="secondary" onPress={() => router.push('/(auth)/register')} style={styles.secondaryAction}>
              Criar conta
            </Button>
            <Button variant="ghost" onPress={() => router.push('/(auth)/planos')} style={styles.secondaryAction}>
              Conhecer planos
            </Button>
          </View>

          <Card
            variant="variant"
            style={styles.previewCard}
            onPress={() => router.push('/(auth)/preview')}
            accessibilityLabel="Experimentar o preview do TCS"
          >
            <View style={[styles.previewIcon, { backgroundColor: theme.surface }]}>
              <Feather name="play-circle" size={21} color={theme.primary} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={[styles.previewTitle, { color: theme.text }]}>EXPERIMENTAR O TCS</Text>
              <Text style={[styles.previewCaption, { color: theme.textSecondary }]}>Preview com até 2 vistorias, sem afetar dados reais</Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.primary} />
          </Card>

          <Button variant="ghost" onPress={() => router.push('/onboarding')} fullWidth>
            CONHECER A PLATAFORMA
          </Button>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Feather name="shield" size={13} color={theme.textSecondary} />
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>Acesso protegido por perfil e organização</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: Spacing[5], gap: Spacing[6] },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  connectionChip: { minHeight: 34, borderRadius: SpacingAlias.radiusFull, borderWidth: 1, paddingHorizontal: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  connectionText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  version: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  hero: { alignItems: 'center', gap: Spacing[4], paddingVertical: Spacing[2] },
  heroCopy: { maxWidth: 320, textAlign: 'center', fontSize: FontSize.sm, lineHeight: 21 },
  actions: { gap: Spacing[3], width: '100%', maxWidth: 520, alignSelf: 'center' },
  secondaryGrid: { flexDirection: 'row', gap: Spacing[3] },
  secondaryAction: { flex: 1 },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[3] },
  previewIcon: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1 },
  previewTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  previewCaption: { fontSize: FontSize.xs, lineHeight: 17, marginTop: 2 },
  footer: { borderTopWidth: 1, paddingTop: Spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2] },
  footerText: { fontSize: FontSize.xs },
});
