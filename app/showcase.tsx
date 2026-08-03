import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductIdentity, RiskBar } from '../components/brand';
import { Button, Card } from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import { FontSize, FontWeight } from '../constants/Typography';
import { Spacing, SpacingAlias } from '../constants/Spacing';

const FLOW = [
  { step: '01', icon: 'map-pin' as const, title: 'Contexto do local', caption: 'GPS, endereço e identificação da vistoria.' },
  { step: '02', icon: 'clipboard' as const, title: 'Coleta técnica', caption: 'Formulários, fotos e observações guiadas.' },
  { step: '03', icon: 'activity' as const, title: 'Classificação', caption: 'Resultado R1 a R4 com leitura operacional.' },
  { step: '04', icon: 'file-text' as const, title: 'Laudo e histórico', caption: 'Documento pronto e rastreabilidade da equipe.' },
];

const MODULES = [
  { icon: 'wifi-off' as const, title: 'Offline-first', caption: 'Trabalhe mesmo sem conexão' },
  { icon: 'users' as const, title: 'Perfis e equipes', caption: 'Acesso adaptado por função' },
  { icon: 'calendar' as const, title: 'Agenda', caption: 'Distribuição de atividades' },
  { icon: 'shield' as const, title: 'Auditoria', caption: 'Histórico de ações sensíveis' },
];

export default function ShowcaseScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>

        <View style={styles.hero}>
          <ProductIdentity variant="hero" />
          <RiskBar labelled width={248} />
          <Text style={[styles.heroTitle, { color: theme.text }]}>Da rua à decisão técnica.</Text>
          <Text style={[styles.heroText, { color: theme.textSecondary }]}>Uma experiência mobile preparada para vistoria, coordenação e resposta rápida.</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, { color: theme.primary }]}>FLUXO PRINCIPAL</Text>
          <View style={styles.flowList}>
            {FLOW.map(item => (
              <Card key={item.step} variant="outlined" style={styles.flowCard}>
                <Text style={[styles.step, { color: theme.primary }]}>{item.step}</Text>
                <View style={[styles.flowIcon, { backgroundColor: theme.secondary }]}>
                  <Feather name={item.icon} size={21} color={theme.primary} />
                </View>
                <View style={styles.flowCopy}>
                  <Text style={[styles.flowTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.flowCaption, { color: theme.textSecondary }]}>{item.caption}</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, { color: theme.primary }]}>OPERAÇÃO COMPLETA</Text>
          <View style={styles.moduleGrid}>
            {MODULES.map(item => (
              <Card key={item.title} variant="variant" style={styles.moduleCard}>
                <Feather name={item.icon} size={22} color={theme.primary} />
                <Text style={[styles.moduleTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.moduleCaption, { color: theme.textSecondary }]}>{item.caption}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={[styles.cta, { borderTopColor: theme.border }]}>
          <Text style={[styles.ctaTitle, { color: theme.text }]}>Pronto para acessar?</Text>
          <Text style={[styles.ctaText, { color: theme.textSecondary }]}>Entre com a credencial vinculada à sua operação.</Text>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.replace('/(auth)/login')}
            iconRight={<Feather name="arrow-right" size={19} color={theme.onPrimary} />}
          >
            Entrar no sistema
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[8], gap: Spacing[8] },
  backButton: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing[4] },
  heroTitle: { fontSize: 28, lineHeight: 34, fontWeight: FontWeight.extrabold, letterSpacing: -0.8, textAlign: 'center' },
  heroText: { fontSize: FontSize.base, lineHeight: 21, textAlign: 'center', maxWidth: 340 },
  section: { gap: Spacing[4] },
  sectionEyebrow: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.3 },
  flowList: { gap: Spacing[3] },
  flowCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[3] },
  step: { width: 24, fontSize: FontSize.xs, fontWeight: FontWeight.extrabold },
  flowIcon: { width: 42, height: 42, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  flowCopy: { flex: 1 },
  flowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  flowCaption: { fontSize: FontSize.xs, lineHeight: 16, marginTop: 3 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  moduleCard: { width: '48%', flexGrow: 1, minWidth: 140, minHeight: 128, padding: Spacing[4] },
  moduleTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, marginTop: Spacing[3] },
  moduleCaption: { fontSize: FontSize.xs, lineHeight: 16, marginTop: 3 },
  cta: { borderTopWidth: 1, paddingTop: Spacing[6], gap: Spacing[3] },
  ctaTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, textAlign: 'center' },
  ctaText: { fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing[2] },
});
