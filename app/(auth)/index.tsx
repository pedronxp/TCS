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

const CAPABILITIES = [
  { icon: 'clipboard' as const, title: 'Vistoria', caption: 'Coleta guiada', tone: 'primary' as const },
  { icon: 'map-pin' as const, title: 'Território', caption: 'GPS e ocorrências', tone: 'warning' as const },
  { icon: 'file-text' as const, title: 'Laudos', caption: 'Documento técnico', tone: 'primary' as const },
  { icon: 'wifi-off' as const, title: 'Offline', caption: 'Operação em campo', tone: 'success' as const },
];

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const { isConnected, isOnlineReal } = useConnectivity();
  const insets = useSafeAreaInsets();
  const connection = !isConnected
    ? { label: 'MODO OFFLINE', color: theme.warning, icon: 'wifi-off' as const }
    : isOnlineReal
      ? { label: 'CONEXÃO DISPONÍVEL', color: theme.success, icon: 'wifi' as const }
      : { label: 'CONEXÃO LIMITADA', color: theme.warning, icon: 'alert-circle' as const };

  const toneColor = (tone: 'primary' | 'warning' | 'success') => (
    tone === 'warning' ? theme.warning : tone === 'success' ? theme.success : theme.primary
  );

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
        </View>

        <View style={styles.capabilityGrid}>
          {CAPABILITIES.map(item => {
            const color = toneColor(item.tone);
            return (
              <Card key={item.title} variant="outlined" style={styles.capabilityCard}>
                <View style={[styles.capabilityIcon, { backgroundColor: `${color}14` }]}>
                  <Feather name={item.icon} size={20} color={color} />
                </View>
                <Text style={[styles.capabilityTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.capabilityCaption, { color: theme.textSecondary }]}>{item.caption}</Text>
              </Card>
            );
          })}
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
              Ativar acesso
            </Button>
            <Button variant="ghost" onPress={() => router.push('/onboarding')} style={styles.secondaryAction}>
              Conhecer o TCS
            </Button>
          </View>

          <Card
            variant="variant"
            style={styles.trainingCard}
            onPress={() => router.push('/(auth)/treinamento')}
            accessibilityLabel="Abrir modo treinamento"
          >
            <View style={[styles.trainingIcon, { backgroundColor: theme.surface }]}>
              <Feather name="book-open" size={20} color={theme.primary} />
            </View>
            <View style={styles.trainingCopy}>
              <Text style={[styles.trainingTitle, { color: theme.text }]}>MODO TREINAMENTO</Text>
              <Text style={[styles.trainingCaption, { color: theme.textSecondary }]}>Explore o fluxo sem afetar dados reais</Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.primary} />
          </Card>

          <Button variant="ghost" onPress={() => router.push('/(auth)/planos')} fullWidth>
              CONHECER PLANOS
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
  content: { flexGrow: 1, paddingHorizontal: Spacing[5], gap: Spacing[6] },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  connectionChip: { minHeight: 34, borderRadius: SpacingAlias.radiusFull, borderWidth: 1, paddingHorizontal: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  connectionText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  version: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  hero: { alignItems: 'center', gap: Spacing[5], paddingTop: Spacing[2] },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  capabilityCard: { width: '48%', flexGrow: 1, minWidth: 142, padding: Spacing[3] },
  capabilityIcon: { width: 40, height: 40, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[3] },
  capabilityTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  capabilityCaption: { fontSize: FontSize.xs, marginTop: 3 },
  actions: { gap: Spacing[3], width: '100%', maxWidth: 520, alignSelf: 'center' },
  secondaryGrid: { flexDirection: 'row', gap: Spacing[3] },
  secondaryAction: { flex: 1 },
  trainingCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[3] },
  trainingIcon: { width: 42, height: 42, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  trainingCopy: { flex: 1 },
  trainingTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  trainingCaption: { fontSize: FontSize.xs, marginTop: 2 },
  footer: { borderTopWidth: 1, paddingTop: Spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2] },
  footerText: { fontSize: FontSize.xs },
});
