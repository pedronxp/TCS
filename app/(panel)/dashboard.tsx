import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { countAgendamentosPendentesAgente, getVistoriasNaoSincronizadas } from '../../utils/database';
import { verificarLaudosExpirando } from '../../utils/laudoExpiracaoNotif';
import { supabase } from '../../utils/supabase';
import { logger } from '../../utils/logger';
import { isInternalMobileRole } from '../../services/AppProfileService';
import { resolveMobileOrganizationAccess } from '../../services/MobileAccessService';
import { syncPendentes } from '../../services/SyncService';
import { resolveInstitutionalIdentity } from '../../utils/institutionalIdentity';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTraining } from '../../context/TrainingContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { DashboardGuide } from '../../components/DashboardGuide';
import { Button, ErrorState, MetricCard, ModuleCard, SectionHeader, StateBanner } from '../../components/ui';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function DashboardScreen() {
  const { theme } = useTheme();
  const bottomPadding = useBottomTabPadding();
  const { profile, loading: authLoading } = useAuth();
  const { isTrainingActive } = useTraining();
  const { isConnected, isOnlineReal } = useConnectivity();
  const { context: subscriptionContext } = useSubscription();
  const [metrics, setMetrics] = useState({ today: 0, attention: 0, total: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAppointments, setPendingAppointments] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const cacheTimestamp = useRef(0);

  const dateLabel = useMemo(() => {
    const today = new Date();
    return `${WEEKDAYS[today.getDay()]}, ${today.getDate()} de ${MONTHS[today.getMonth()]}`;
  }, []);

  const fetchMetrics = useCallback(async (uid: string) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [{ count: countToday }, { count: countAttention }, { count: countTotal }] = await Promise.all([
        supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).gte('dataVistoria', `${today}T00:00:00.000Z`),
        supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).in('nivelRisco', ['r3', 'r4']),
        supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid),
      ]);
      setMetrics({ today: countToday || 0, attention: countAttention || 0, total: countTotal || 0 });
      cacheTimestamp.current = Date.now();
    } catch (error) {
      logger.error('system', 'Erro ao carregar métricas', { erro: String(error) });
      setMetricsError('Não foi possível carregar os indicadores.');
    } finally {
      setMetricsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isTrainingActive) {
      router.replace('/(panel)/treinamento');
      return;
    }
    if (!profile) return;
    if (profile.role === 'master_admin') { router.replace('/(panel)/master'); return; }
    if (isInternalMobileRole(profile.role)) { router.replace('/(panel)/internal'); return; }
    if (profile.role === 'admin') { router.replace('/(panel)/admin'); return; }
    if (profile.role === 'supervisor') { router.replace('/(panel)/supervisor'); return; }
    setPendingAppointments(countAgendamentosPendentesAgente(profile.uid));
    verificarLaudosExpirando().catch(() => null);
    if (Date.now() - cacheTimestamp.current >= 60_000 && isOnlineReal) fetchMetrics(profile.uid);
  }, [fetchMetrics, isOnlineReal, isTrainingActive, profile]);

  const onRefresh = useCallback(() => {
    if (!profile) return;
    setRefreshing(true);
    cacheTimestamp.current = 0;
    fetchMetrics(profile.uid);
  }, [fetchMetrics, profile]);

  const updatePendingSync = useCallback(() => {
    if (!profile?.uid) return;
    try {
      setPendingSync(getVistoriasNaoSincronizadas()
        .filter((vistoria) => vistoria.agente_uid === profile.uid).length);
    } catch (error) {
      logger.warn('sync', 'Não foi possível verificar a fila local', { erro: String(error) });
    }
  }, [profile?.uid]);

  useFocusEffect(useCallback(() => {
    updatePendingSync();
  }, [updatePendingSync]));

  const syncNow = useCallback(async () => {
    if (!isOnlineReal || syncing) return;
    setSyncing(true);
    try {
      await syncPendentes();
      updatePendingSync();
      if (profile?.uid) await fetchMetrics(profile.uid);
    } finally {
      setSyncing(false);
    }
  }, [fetchMetrics, isOnlineReal, profile?.uid, syncing, updatePendingSync]);

  if (authLoading || isTrainingActive) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Agente';
  const initial = firstName[0]?.toUpperCase() ?? '?';
  const institutionalIdentity = resolveInstitutionalIdentity(subscriptionContext);
  const organizationLabel = institutionalIdentity?.organizationName || profile?.municipio || null;
  const access = resolveMobileOrganizationAccess(profile, subscriptionContext);
  const individualAccount = access.kind === 'individual';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.date, { color: theme.textSecondary }]}>{dateLabel}</Text>
          <Text style={[styles.greeting, { color: theme.text }]}>Olá, {firstName}</Text>
          <View style={styles.contextRow}>
            {organizationLabel ? (
              <View style={[styles.contextChip, { backgroundColor: theme.secondary }]}>
                <Feather name="briefcase" size={12} color={theme.primary} />
                <Text style={[styles.contextText, { color: theme.primary }]} numberOfLines={1}>{organizationLabel}</Text>
              </View>
            ) : null}
            <View style={[styles.contextChip, { backgroundColor: theme.secondary }]}>
              <Text style={[styles.contextText, { color: theme.primary }]}>
                {individualAccount ? 'Conta profissional' : 'Agente'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <DashboardGuide role="agent" />
          <Pressable
            onPress={() => router.push('/(panel)/agendamentos')}
            style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Abrir agenda"
          >
            <Feather name="calendar" size={19} color={theme.text} />
            {pendingAppointments > 0 ? (
              <View style={[styles.notification, { backgroundColor: theme.error }]}>
                <Text style={styles.notificationText}>{pendingAppointments > 9 ? '9+' : pendingAppointments}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(panel)/perfil')}
            style={[styles.avatar, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <Text style={[styles.avatarText, { color: theme.onPrimary }]}>{initial}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + Spacing[4] }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {!isConnected ? (
          <StateBanner title="Modo offline ativo" description="Você pode criar vistorias normalmente. A sincronização retorna com a conexão." variant="warning" />
        ) : null}

        {access.requiresOrganizationLink ? (
          <StateBanner
            variant="warning"
            title="Vínculo municipal pendente"
            description="Seu acesso precisa ser vinculado a uma organização pelo painel web para receber avisos e compartilhar informações municipais."
          />
        ) : null}

        {pendingSync > 0 ? (
          <StateBanner
            variant="warning"
            title={`${pendingSync} vistoria${pendingSync === 1 ? '' : 's'} aguardando envio`}
            description={isOnlineReal
              ? 'Os registros locais podem ser enviados agora para o painel web.'
              : 'Os registros permanecem protegidos no aparelho até a conexão retornar.'}
            actionLabel={isOnlineReal ? syncing ? 'Sincronizando…' : 'Sincronizar' : undefined}
            onAction={isOnlineReal && !syncing ? () => void syncNow() : undefined}
          />
        ) : null}

        <View>
          <SectionHeader
            title={individualAccount ? 'Sua atividade' : 'Seu turno'}
            subtitle={individualAccount ? 'Resumo das suas vistorias profissionais' : 'Resumo da atividade de hoje'}
          />
          {metricsError ? <ErrorState message={metricsError} onRetry={onRefresh} /> : (
            <View style={styles.metricGrid}>
              <MetricCard
                value={metricsLoading ? '—' : metrics.today}
                label="Vistorias hoje"
                detail="Atividade do turno"
                tone="primary"
                style={styles.metricWide}
              />
              <MetricCard value={metricsLoading ? '—' : metrics.attention} label="Requer atenção" tone="danger" style={styles.metricHalf} />
              <MetricCard value={metricsLoading ? '—' : metrics.total} label="Total realizado" tone="success" style={styles.metricHalf} />
            </View>
          )}
        </View>

        <View style={[styles.primaryPanel, { backgroundColor: theme.primary }]}>
          <View style={styles.primaryPanelTop}>
            <View style={styles.primaryIcon}>
              <Feather name="clipboard" size={24} color={theme.onPrimary} />
            </View>
            <View style={styles.primaryCopy}>
            <Text style={[styles.primaryEyebrow, { color: `${theme.onPrimary}B8` }]}>AÇÃO PRINCIPAL</Text>
            <Text style={[styles.primaryTitle, { color: theme.onPrimary }]}>Nova vistoria</Text>
            <Text style={[styles.primaryDescription, { color: `${theme.onPrimary}C7` }]}>{isOnlineReal ? 'Inicie uma coleta técnica completa.' : 'Disponível offline e salva localmente.'}</Text>
            </View>
          </View>
          <Button
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(panel)/inspecoes/dados-iniciais')}
            iconRight={<Feather name="arrow-right" size={18} color={theme.primaryDark} />}
          >
            Iniciar vistoria
          </Button>
        </View>

        <View>
          <SectionHeader title="Acesso rápido" subtitle="Módulos usados com mais frequência" />
          <View style={styles.moduleGrid}>
            {[
              { title: 'Vistorias', description: 'Histórico e laudos', icon: 'clipboard' as const, route: '/(panel)/inspecoes' },
              { title: 'Mapa tático', description: 'Ocorrências no território', icon: 'map-pin' as const, route: '/(panel)/mapas' },
              { title: 'Agenda', description: 'Tarefas atribuídas', icon: 'calendar' as const, route: '/(panel)/agendamentos' },
              ...(individualAccount || !access.hasOrganization
                ? [{ title: 'Minha conta', description: 'Plano e preferências', icon: 'user' as const, route: '/(panel)/perfil' }]
                : [{ title: 'Avisos', description: 'Comunicados da organização', icon: 'bell' as const, route: '/(panel)/avisos' }]),
            ].map(item => (
              <View key={item.title} style={styles.moduleCell}>
                <ModuleCard {...item} onPress={() => router.push(item.route as any)} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[4], flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  headerCopy: { flex: 1 },
  date: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  greeting: { fontSize: 28, lineHeight: 34, fontWeight: FontWeight.extrabold, letterSpacing: -0.8, marginTop: Spacing[1] },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginTop: Spacing[3] },
  contextChip: { maxWidth: 180, minHeight: 28, borderRadius: SpacingAlias.radiusFull, paddingHorizontal: Spacing[2], flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },
  contextText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  headerButton: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  notification: { position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notificationText: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.extrabold },
  content: { paddingHorizontal: Spacing[5], gap: Spacing[8] },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  metricWide: { width: '100%', minHeight: 102 },
  metricHalf: { width: '48%', flexGrow: 1, minHeight: 96 },
  primaryPanel: { borderRadius: SpacingAlias.radiusXl, padding: Spacing[5], gap: Spacing[5] },
  primaryPanelTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[4] },
  primaryIcon: { width: 48, height: 48, borderRadius: SpacingAlias.radiusMd, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  primaryCopy: { flex: 1 },
  primaryEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1 },
  primaryTitle: { color: '#FFFFFF', fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: Spacing[1] },
  primaryDescription: { color: 'rgba(255,255,255,0.78)', fontSize: FontSize.sm, lineHeight: 18, marginTop: Spacing[1] },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  moduleCell: { width: '48%', flexGrow: 1, minWidth: 150 },
});
