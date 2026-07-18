import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { countAgendamentosPendentesAgente, getTrainingVistoriasByAgente } from '../../utils/database';
import { verificarLaudosExpirando } from '../../utils/laudoExpiracaoNotif';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTraining } from '../../context/TrainingContext';
import { logger } from '../../utils/logger';
import { ErrorState } from '../../components/ui';
import { DashboardGuide } from '../../components/DashboardGuide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { useSubscription } from '../../context/SubscriptionContext';
import { resolveInstitutionalIdentity } from '../../utils/institutionalIdentity';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function DashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile, loading: authLoading, localTestMode } = useAuth();
  const { isTrainingActive } = useTraining();
  const { isConnected, isOnlineReal } = useConnectivity();
  const { context: subscriptionContext } = useSubscription();

  const [metrics, setMetrics] = useState({ atividadesHoje: 0, requerAtencao: 0, minhasTotal: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAgendamentos, setPendingAgendamentos] = useState(0);
  const cacheTs = useRef<number>(0);
  const CACHE_TTL = 60_000;

  const { diaSemana, dataFormatada } = useMemo(() => {
    const hoje = new Date();
    return {
      diaSemana: DIAS_SEMANA[hoje.getDay()],
      dataFormatada: `${hoje.getDate()} de ${MESES[hoje.getMonth()]}`,
    };
  }, []);

  useEffect(() => {
    if (isTrainingActive) {
      router.replace('/(panel)/treinamento');
      return;
    }
    if (!profile) return;
    if (profile.role === 'master_admin') { router.replace('/(panel)/master'); return; }
    if (profile.role === 'admin') { router.replace('/(panel)/admin'); return; }
    if (profile.role === 'supervisor') { router.replace('/(panel)/supervisor'); return; }
    if (localTestMode) {
      const locais = getTrainingVistoriasByAgente(profile.uid);
      const today = new Date().toISOString().slice(0, 10);
      setMetrics({
        atividadesHoje: locais.filter(item => item.data_vistoria?.startsWith(today)).length,
        requerAtencao: locais.filter(item => ['r3', 'r4'].includes(item.nivel_risco)).length,
        minhasTotal: locais.length,
      });
      setMetricsLoading(false);
      setPendingAgendamentos(0);
      return;
    }
    setPendingAgendamentos(countAgendamentosPendentesAgente(profile.uid));
    verificarLaudosExpirando().catch(() => null);
    const now = Date.now();
    if (now - cacheTs.current < CACHE_TTL) return;
    if (isOnlineReal) fetchMetrics(profile.uid, profile.municipio);
  }, [profile, isOnlineReal, isTrainingActive, localTestMode]);

  const fetchMetrics = async (uid: string, municipio: string) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const today = new Date().toISOString().split('T')[0];

      const [{ count: countHoje }, { count: countAtencao }, { count: countTotal }] = await Promise.all([
        supabase.from('vistorias').select('*', { count: 'exact', head: true })
          .eq('agenteUid', uid).gte('dataVistoria', `${today}T00:00:00.000Z`),
        supabase.from('vistorias').select('*', { count: 'exact', head: true })
          .eq('agenteUid', uid).in('nivelRisco', ['r3', 'r4']),
        supabase.from('vistorias').select('*', { count: 'exact', head: true })
          .eq('agenteUid', uid),
      ]);

      setMetrics({ atividadesHoje: countHoje || 0, requerAtencao: countAtencao || 0, minhasTotal: countTotal || 0 });
      cacheTs.current = Date.now();
    } catch (e) {
      logger.error('system', 'Erro ao carregar métricas', { erro: String(e) });
      setMetricsError('Erro ao carregar métricas');
    } finally {
      setMetricsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    if (!profile) return;
    if (localTestMode) {
      const locais = getTrainingVistoriasByAgente(profile.uid);
      const today = new Date().toISOString().slice(0, 10);
      setMetrics({
        atividadesHoje: locais.filter(item => item.data_vistoria?.startsWith(today)).length,
        requerAtencao: locais.filter(item => ['r3', 'r4'].includes(item.nivel_risco)).length,
        minhasTotal: locais.length,
      });
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    cacheTs.current = 0;
    fetchMetrics(profile.uid, profile.municipio);
  }, [profile, localTestMode]);

  if (authLoading || isTrainingActive) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const firstName = profile?.name?.split(' ')[0] ?? '—';
  const initial = firstName[0]?.toUpperCase() ?? '?';
  const roleLabel = profile?.role === 'agent' ? 'Agente' : profile?.role ?? '—';
  const institutionalIdentity = resolveInstitutionalIdentity(subscriptionContext);
  const organizationLabel = institutionalIdentity?.organizationName || null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 14 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>{diaSemana}, {dataFormatada}</Text>
          <Text style={[styles.greeting, { color: theme.text }]}>Olá, {firstName}</Text>
          <View style={styles.badgeRow}>
            {organizationLabel && (
              <View style={[styles.chipBadge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}25` }]}>
                <Feather name="briefcase" size={10} color={theme.primary} />
                <Text style={[styles.chipText, { color: theme.primary }]}>{organizationLabel}</Text>
              </View>
            )}
            <View style={[styles.chipBadge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}25` }]}>
              <Feather name="shield" size={10} color={theme.primary} />
              <Text style={[styles.chipText, { color: theme.primary }]}>{roleLabel}</Text>
            </View>
            {!isConnected && (
              <View style={[styles.chipBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' }]}>
                <Feather name="wifi-off" size={10} color="#F59E0B" />
                <Text style={[styles.chipText, { color: '#F59E0B' }]}>Offline</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <DashboardGuide role={profile?.role ?? 'agent'} />
          <View>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.push('/(panel)/agendamentos')}
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            {pendingAgendamentos > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{pendingAgendamentos > 9 ? '9+' : pendingAgendamentos}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.avatarBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/(panel)/perfil')}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {localTestMode && (
          <View style={[styles.offlineBanner, { borderColor: 'rgba(124,58,237,0.35)', backgroundColor: 'rgba(124,58,237,0.10)' }]}>
            <Feather name="tool" size={15} color="#8B5CF6" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.offlineBannerTitle, { color: '#8B5CF6' }]}>Ambiente local para testes</Text>
              <Text style={[styles.offlineBannerDesc, { color: theme.textSecondary }]}>Vistorias, fotos, documentos e ciências desta conta ficam somente neste aparelho e não consomem a numeração oficial.</Text>
            </View>
          </View>
        )}
        {/* Banner offline */}
        {!isConnected && !localTestMode && (
          <View style={[styles.offlineBanner, { borderColor: 'rgba(245,158,11,0.3)' }]}>
            <Feather name="wifi-off" size={15} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitle}>Modo offline ativo</Text>
              <Text style={styles.offlineBannerDesc}>
                Você pode criar vistorias normalmente. Tudo será sincronizado quando a conexão voltar.
              </Text>
            </View>
          </View>
        )}

        {/* KPIs */}
        {metricsError ? (
          <ErrorState message={metricsError} onRetry={onRefresh} />
        ) : (
          <View style={styles.kpiRow}>
            {[
              { label: 'Hoje', value: metrics.atividadesHoje, color: theme.primary, icon: 'clipboard', route: '/(panel)/inspecoes' },
              { label: 'Alto Risco', value: metrics.requerAtencao, color: '#EF4444', icon: 'alert-triangle', route: '/(panel)/inspecoes' },
              { label: 'Total', value: metrics.minhasTotal, color: '#10B981', icon: 'check-circle', route: '/(panel)/inspecoes' },
            ].map(k => (
              <TouchableOpacity
                key={k.label}
                style={[styles.kpiCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
                onPress={() => router.push(k.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.kpiIcon, { backgroundColor: `${k.color}15` }]}>
                  <Feather name={k.icon as any} size={18} color={k.color} />
                </View>
                {metricsLoading
                  ? <ActivityIndicator size="small" color={k.color} />
                  : <Text style={[styles.kpiValue, { color: theme.text }]}>{k.value}</Text>}
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Ação Principal */}
        <TouchableOpacity
          style={[styles.heroAction, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(panel)/inspecoes/dados-iniciais')}
          activeOpacity={0.88}
        >
          <View style={styles.heroLeft}>
            <View style={styles.heroIconWrap}>
              <Feather name="plus-circle" size={30} color="rgba(255,255,255,0.95)" />
            </View>
            <View>
              <Text style={styles.heroTitle}>Nova Vistoria</Text>
              <Text style={styles.heroSub}>
                {isOnlineReal ? 'Iniciar inspeção técnica agora' : 'Disponível offline · salva localmente'}
              </Text>
            </View>
          </View>
          <View style={styles.heroArrow}>
            <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>

        {/* Acesso Rápido */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Acesso Rápido</Text>
        <View style={styles.grid}>
          {[
            { label: 'Vistorias', desc: 'Histórico de laudos', icon: 'list', color: '#F59E0B', route: '/(panel)/inspecoes' },
            { label: 'Mapa Tático', desc: 'Georeferenciado', icon: 'map', color: theme.primary, route: '/(panel)/mapas' },
            { label: 'Agendamentos', desc: 'Tarefas atribuídas', icon: 'calendar', color: '#8B5CF6', route: '/(panel)/agendamentos' },
            { label: 'Meu Perfil', desc: 'Dados e configurações', icon: 'user', color: '#10B981', route: '/(panel)/perfil' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[styles.gridCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIcon, { backgroundColor: `${item.color}15` }]}>
                <Feather name={item.icon as any} size={24} color={item.color} />
              </View>
              <Text style={[styles.gridLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[styles.gridDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  dateText: { fontSize: 11, fontWeight: '500', marginBottom: 3, letterSpacing: 0.2 },
  greeting: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  scrollContent: { padding: 20 },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 16,
  },
  offlineBannerTitle: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },
  offlineBannerDesc: { color: '#F59E0B', fontSize: 12, marginTop: 2, opacity: 0.85, lineHeight: 17 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  kpiCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 6,
  },
  kpiIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  kpiLabel: { fontSize: 11, fontWeight: '600' },
  heroAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 20, paddingVertical: 20, paddingHorizontal: 22, marginBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16, shadowRadius: 12, elevation: 5,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIconWrap: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 },
  heroArrow: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 1.2, marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  gridIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  gridLabel: { fontSize: 14, fontWeight: '700' },
  gridDesc: { fontSize: 11, lineHeight: 16 },
});
