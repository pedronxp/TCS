import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useTheme } from '../../../context/ThemeContext';
import { MetricCard, ModuleCard, SectionHeader, StateBanner } from '../../../components/ui';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

interface InternalMetric {
  key: string;
  label: string;
  value: number;
}

interface InternalAttention {
  label: string;
  detail: string | null;
}

const ROLE_PRESENTATION = {
  owner: { label: 'Proprietário TCS', title: 'Visão executiva', description: 'Acompanhe a operação sem misturar sua conta com uma prefeitura.' },
  developer: { label: 'Desenvolvimento', title: 'Saúde técnica', description: 'Indicadores técnicos e situações que exigem acompanhamento.' },
  support: { label: 'Suporte TCS', title: 'Atendimento e operação', description: 'Acompanhe as demandas permitidas para a sua conta.' },
  auditor: { label: 'Auditoria TCS', title: 'Acompanhamento', description: 'Consulte apenas os indicadores liberados para seu perfil.' },
} as const;

function parseMetrics(value: unknown): InternalMetric[] {
  if (!value || typeof value !== 'object') return [];
  const metrics = (value as { metrics?: unknown }).metrics;
  if (!Array.isArray(metrics)) return [];
  return metrics
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      key: typeof item.key === 'string' ? item.key : 'indicator',
      label: typeof item.label === 'string' ? item.label : 'Indicador',
      value: typeof item.value === 'number' ? item.value : 0,
    }))
    .slice(0, 6);
}

function parseAttention(value: unknown): InternalAttention[] {
  if (!value || typeof value !== 'object') return [];
  const attention = (value as { attention?: unknown }).attention;
  if (!Array.isArray(attention)) return [];
  return attention
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label : 'Acompanhamento necessário',
      detail: typeof item.detail === 'string' ? item.detail : null,
    }))
    .slice(0, 4);
}

export default function InternalDashboardScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { isOnlineReal } = useConnectivity();
  const bottomPadding = useBottomTabPadding();
  const [metrics, setMetrics] = useState<InternalMetric[]>([]);
  const [attention, setAttention] = useState<InternalAttention[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissions = useMemo(() => new Set(profile?.permissions ?? []), [profile?.permissions]);
  const presentation = profile?.role === 'support'
    && (permissions.has('commercial.read') || permissions.has('commercial.write'))
    ? {
        label: 'Comercial TCS',
        title: 'Carteira e assinaturas',
        description: 'Acompanhe os indicadores comerciais autorizados para a sua conta.',
      }
    : profile && profile.role in ROLE_PRESENTATION
      ? ROLE_PRESENTATION[profile.role as keyof typeof ROLE_PRESENTATION]
      : ROLE_PRESENTATION.support;
  const canLoadDashboard = permissions.has('dashboard.executive.read')
    || permissions.has('dashboard.technical.read');

  const load = useCallback(async (refresh = false) => {
    if (!profile) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    if (!isOnlineReal) {
      setError('Conecte-se à internet para atualizar os indicadores internos.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!canLoadDashboard) {
      setMetrics([]);
      setAttention([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error: dashboardError } = await supabase.rpc('get_internal_dashboard');
      if (dashboardError) throw dashboardError;
      setMetrics(parseMetrics(data));
      setAttention(parseAttention(data));
    } catch (cause) {
      logger.warn('system', 'Não foi possível carregar o painel interno mobile', { erro: String(cause) });
      setError('Os indicadores internos não puderam ser atualizados agora.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canLoadDashboard, isOnlineReal, profile]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const firstName = profile?.name?.split(' ')[0] || 'equipe';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>{presentation.label.toUpperCase()}</Text>
          <Text style={[styles.greeting, { color: theme.text }]}>Olá, {firstName}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{presentation.description}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
          onPress={() => router.push('/(panel)/perfil')}
          style={[styles.profileButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Feather name="user" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + Spacing[4] }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {!isOnlineReal ? (
          <StateBanner variant="warning" title="Sem conexão" description="O painel interno será atualizado quando a internet retornar." />
        ) : null}

        {error && isOnlineReal ? (
          <StateBanner variant="warning" title="Atualização indisponível" description={error} actionLabel="Tentar" onAction={() => void load(true)} />
        ) : null}

        <View>
          <SectionHeader title={presentation.title} subtitle="Informações reais liberadas pelo seu perfil" />
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.loading} />
          ) : metrics.length ? (
            <View style={styles.metricGrid}>
              {metrics.map((metric, index) => (
                <MetricCard
                  key={`${metric.key}-${index}`}
                  value={metric.value}
                  label={metric.label}
                  tone={index === 0 ? 'primary' : index % 3 === 0 ? 'warning' : 'success'}
                  style={styles.metricCard}
                />
              ))}
            </View>
          ) : !error ? (
            <StateBanner
              variant="info"
              title="Acesso delimitado"
              description="Sua conta não possui indicadores globais. A gestão completa permanece disponível no painel web, conforme suas permissões."
            />
          ) : null}
        </View>

        {attention.length ? (
          <View>
            <SectionHeader title="Exige atenção" subtitle="Acompanhamentos informados pelo backend" />
            <View style={styles.attentionList}>
              {attention.map((item, index) => (
                <View key={`${item.label}-${index}`} style={[styles.attentionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Feather name="alert-circle" size={18} color={theme.warning} />
                  <View style={styles.attentionCopy}>
                    <Text style={[styles.attentionTitle, { color: theme.text }]}>{item.label}</Text>
                    {item.detail ? <Text style={[styles.attentionDetail, { color: theme.textSecondary }]}>{item.detail}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Acesso rápido" subtitle="Ferramentas disponíveis no aplicativo" />
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <ModuleCard title="Minha conta" description="Acesso e segurança" icon="user" onPress={() => router.push('/(panel)/perfil')} />
            </View>
            <View style={styles.metricCard}>
              <ModuleCard title="Ferramentas" description="Recursos autorizados" icon="grid" onPress={() => router.push('/(panel)/modulos')} />
            </View>
          </View>
        </View>

        <StateBanner
          variant="info"
          title="Administração disponível na web"
          description="Ativação de módulos, permissões, planos e ações administrativas são gerenciados somente pelo painel web."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[5], flexDirection: 'row', gap: Spacing[3] },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  greeting: { fontSize: 28, lineHeight: 34, fontWeight: FontWeight.extrabold, marginTop: Spacing[1] },
  subtitle: { fontSize: FontSize.sm, lineHeight: 19, marginTop: Spacing[2] },
  profileButton: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[6] },
  loading: { marginVertical: Spacing[5] },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  metricCard: { width: '47%', flexGrow: 1, minWidth: 140 },
  attentionList: { gap: Spacing[2] },
  attentionCard: { flexDirection: 'row', gap: Spacing[3], borderWidth: 1, borderRadius: SpacingAlias.radiusMd, padding: Spacing[3] },
  attentionCopy: { flex: 1 },
  attentionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  attentionDetail: { fontSize: FontSize.xs, lineHeight: 17, marginTop: 4 },
});
