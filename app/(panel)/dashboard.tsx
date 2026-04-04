import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { countAgendamentosPendentesAgente } from '../../utils/database';
import { verificarLaudosExpirando } from '../../utils/laudoExpiracaoNotif';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';
import { Card, ErrorState } from '../../components/ui';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function DashboardScreen() {
  const { theme } = useTheme();
  const { profile, loading: authLoading } = useAuth();

  const [metrics, setMetrics] = useState({ atividadesHoje: 0, requerAtencao: 0, equipeAtiva: 0 });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAgendamentos, setPendingAgendamentos] = useState(0);
  const cacheTs = useRef<number>(0);
  const CACHE_TTL = 60_000;

  const { diaSemana, dataFormatada } = useMemo(() => {
    const hoje = new Date();
    const diaSemana = DIAS_SEMANA[hoje.getDay()];
    const dataFormatada = `${hoje.getDate()} de ${MESES[hoje.getMonth()]}`;
    return { diaSemana, dataFormatada };
  }, []); // dependência vazia: recalcular só na montagem

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'master_admin') { router.replace('/(panel)/master'); return; }
    if (profile.role === 'admin') { router.replace('/(panel)/admin'); return; }
    if (profile.role === 'supervisor') { router.replace('/(panel)/supervisor'); return; }
    // For agents: load pending agendamentos badge
    setPendingAgendamentos(countAgendamentosPendentesAgente(profile.uid));
    // Verificar laudos expirando (digest diário)
    verificarLaudosExpirando().catch(() => null);
    const now = Date.now();
    if (now - cacheTs.current < CACHE_TTL) return;
    fetchMetrics(profile.uid, profile.role, profile.municipio);
  }, [profile]);

  const fetchMetrics = async (uid: string, role: string, municipio: string) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const isAdmin = role === 'admin' || role === 'master_admin';

      let qAtividades = supabase
        .from('vistorias')
        .select('*', { count: 'exact', head: true })
        .gte('dataVistoria', `${today}T00:00:00.000Z`);
      if (!isAdmin) qAtividades = qAtividades.eq('agenteUid', uid);
      else if (municipio) qAtividades = qAtividades.eq('municipio', municipio);

      let qAtencao = supabase
        .from('vistorias')
        .select('*', { count: 'exact', head: true })
        .in('nivelRisco', ['r3', 'r4']);
      if (!isAdmin) qAtencao = qAtencao.eq('agenteUid', uid);
      else if (municipio) qAtencao = qAtencao.eq('municipio', municipio);

      const [{ count: countAtividades }, { count: countAtencao }] = await Promise.all([qAtividades, qAtencao]);

      let equipeCount = 0;
      if (isAdmin && municipio) {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('municipio', municipio)
          .eq('isApproved', true);
        equipeCount = count || 0;
      }

      setMetrics({ atividadesHoje: countAtividades || 0, requerAtencao: countAtencao || 0, equipeAtiva: equipeCount });
      cacheTs.current = Date.now();
    } catch (e) {
      logger.error('system', 'Erro ao carregar métricas', { erro: String(e) });
      setMetricsError('Não foi possível carregar as métricas');
    } finally {
      setMetricsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (!profile) return;
    setRefreshing(true);
    cacheTs.current = 0;
    fetchMetrics(profile.uid, profile.role, profile.municipio);
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'master_admin';
  const firstName = profile?.name?.split(' ')[0] ?? '—';
  const initial = firstName[0]?.toUpperCase() ?? '?';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>{diaSemana}, {dataFormatada}</Text>
          <Text style={[styles.greeting, { color: theme.text }]}>Olá, {firstName}</Text>
          <View style={[styles.municipioBadge, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}30` }]}>
            <Feather name="map-pin" size={11} color={theme.primary} />
            <Text style={[styles.municipioText, { color: theme.primary }]}>
              {profile?.municipio ?? '—'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View>
            <TouchableOpacity
              style={[styles.calendarBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.push('/(panel)/agendamentos')}
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            {pendingAgendamentos > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingAgendamentos > 9 ? '9+' : pendingAgendamentos}</Text>
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs */}
        {metricsError !== null ? (
          <ErrorState message={metricsError} onRetry={onRefresh} />
        ) : (
          <View style={styles.kpiRow}>
            <Card style={styles.kpiCardBase} onPress={() => router.push('/(panel)/inspecoes')}>
              <View style={styles.kpiInner}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }}>
                  <View style={[styles.kpiIcon, { backgroundColor: `${theme.primary}15`, marginBottom: 0 }]}>
                    <Feather name="clipboard" size={20} color={theme.primary} />
                  </View>
                  <Feather name="arrow-up-right" size={14} color={theme.primary} style={{ position: 'absolute', right: 0, top: 0, opacity: 0.4 }} />
                </View>
                {metricsLoading
                  ? <ActivityIndicator size="small" color={theme.primary} style={styles.kpiLoader} />
                  : <Text style={[styles.kpiValue, { color: theme.text }]}>{metrics.atividadesHoje}</Text>}
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Hoje</Text>
              </View>
            </Card>

            <Card style={styles.kpiCardBase} onPress={() => router.push('/(panel)/inspecoes')}>
              <View style={styles.kpiInner}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }}>
                  <View style={[styles.kpiIcon, { backgroundColor: 'rgba(239,68,68,0.1)', marginBottom: 0 }]}>
                    <Feather name="alert-triangle" size={20} color="#EF4444" />
                  </View>
                  <Feather name="arrow-up-right" size={14} color="#EF4444" style={{ position: 'absolute', right: 0, top: 0, opacity: 0.4 }} />
                </View>
                {metricsLoading
                  ? <ActivityIndicator size="small" color="#EF4444" style={styles.kpiLoader} />
                  : <Text style={[styles.kpiValue, { color: theme.text }]}>{metrics.requerAtencao}</Text>}
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Alto Risco</Text>
              </View>
            </Card>

            {isAdmin && (
              <Card style={styles.kpiCardBase} onPress={() => router.push('/(panel)/admin/usuarios')}>
                <View style={styles.kpiInner}>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' }}>
                    <View style={[styles.kpiIcon, { backgroundColor: 'rgba(16,185,129,0.1)', marginBottom: 0 }]}>
                      <Feather name="users" size={20} color="#10B981" />
                    </View>
                    <Feather name="arrow-up-right" size={14} color="#10B981" style={{ position: 'absolute', right: 0, top: 0, opacity: 0.4 }} />
                  </View>
                  {metricsLoading
                    ? <ActivityIndicator size="small" color="#10B981" style={styles.kpiLoader} />
                    : <Text style={[styles.kpiValue, { color: theme.text }]}>{metrics.equipeAtiva}</Text>}
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Equipe</Text>
                </View>
              </Card>
            )}
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
              <Feather name="plus-circle" size={32} color="rgba(255,255,255,0.95)" />
            </View>
            <View>
              <Text style={styles.heroTitle}>Nova Vistoria</Text>
              <Text style={styles.heroSub}>Iniciar inspeção técnica agora</Text>
            </View>
          </View>
          <View style={styles.heroArrow}>
            <Feather name="arrow-right" size={20} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>

        {/* Atalhos */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Acesso Rápido</Text>
        <View style={styles.grid}>
          <Card style={styles.gridCardBase} onPress={() => router.push('/(panel)/inspecoes')}>
            <View style={[styles.gridIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Feather name="list" size={26} color="#F59E0B" />
            </View>
            <Text style={[styles.gridLabel, { color: theme.text }]}>Vistorias</Text>
            <Text style={[styles.gridDesc, { color: theme.textSecondary }]}>Histórico de laudos</Text>
          </Card>

          <Card style={styles.gridCardBase} onPress={() => router.push('/(panel)/mapas')}>
            <View style={[styles.gridIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="map" size={26} color={theme.primary} />
            </View>
            <Text style={[styles.gridLabel, { color: theme.text }]}>Mapa Tático</Text>
            <Text style={[styles.gridDesc, { color: theme.textSecondary }]}>Geo­rre­fe­ren­cia­do</Text>
          </Card>

          <Card style={styles.gridCardBase} onPress={() => router.push('/(panel)/perfil')}>
            <View style={[styles.gridIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <Feather name="user" size={26} color="#8B5CF6" />
            </View>
            <Text style={[styles.gridLabel, { color: theme.text }]}>Meu Perfil</Text>
            <Text style={[styles.gridDesc, { color: theme.textSecondary }]}>Dados e configurações</Text>
          </Card>

          {isAdmin && (
            <Card style={styles.gridCardBase} onPress={() => router.push('/(panel)/admin')}>
              <View style={[styles.gridIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Feather name="shield" size={26} color="#10B981" />
              </View>
              <Text style={[styles.gridLabel, { color: theme.text }]}>Painel Admin</Text>
              <Text style={[styles.gridDesc, { color: theme.textSecondary }]}>Gestão e relatórios</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, marginRight: 16 },
  dateText: { fontSize: 12, fontWeight: '500', marginBottom: 4, letterSpacing: 0.2 },
  greeting: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  municipioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  municipioText: { fontSize: 12, fontWeight: '700' },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calendarBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  // Scroll
  scrollContent: { padding: 20, paddingBottom: 110 },

  // KPIs
  kpiRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  kpiCardBase: {
    flex: 1,
    padding: 0,
  },
  kpiInner: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  kpiIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiLoader: { marginVertical: 4 },
  kpiValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  kpiLabel: { fontSize: 11, fontWeight: '600' },

  // Hero Action
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 24,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 3 },
  heroArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCardBase: {
    width: '47%',
    flexGrow: 1,
    gap: 10,
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLabel: { fontSize: 15, fontWeight: '700' },
  gridDesc: { fontSize: 12, lineHeight: 17 },
});
