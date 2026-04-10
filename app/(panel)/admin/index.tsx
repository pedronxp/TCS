import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { countAgendamentosPendentes } from '../../../utils/database';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { DashboardGuide } from '../../../components/DashboardGuide';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { ErrorState } from '../../../components/ui/ErrorState';
import { riscoColor } from '../../../utils/riscoUtils';
import { tempoRelativo } from '../../../utils/htmlUtils';
import { AtividadeItem } from '../../../types/vistoria';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

interface KPI {
  label: string;
  value: number;
  icon: string;
  color: string;
}


export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const { isConnected } = useConnectivity();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [atividade, setAtividade] = useState<AtividadeItem[]>([]);
  const [pendingAgendamentos, setPendingAgendamentos] = useState(0);
  const [ranking, setRanking] = useState<{ nome: string; count: number }[]>([]);

  const carregar = async (showRefresh = false) => {
    if (!profile) return;
    setErro(false);
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [kpisRes, vistoriasRes] = await Promise.all([
        supabase.rpc('get_dashboard_kpis_admin', { p_municipio: profile.municipio }),
        supabase.from('vistorias')
          .select('id, nivelRisco, endereco, dataVistoria, agenteNome')
          .eq('municipio', profile.municipio)
          .order('dataVistoria', { ascending: false })
          .limit(10),
      ]);

      if (kpisRes.data) {
        const k = kpisRes.data as any;
        setKpis([
          { label: 'Total', value: k.total || 0, icon: 'clipboard', color: theme.primary },
          { label: 'Hoje', value: k.hoje || 0, icon: 'calendar', color: '#10B981' },
          { label: 'Alto Risco', value: k.altoRisco || 0, icon: 'alert-triangle', color: '#EF4444' },
          { label: 'Médio', value: k.medio || 0, icon: 'alert-circle', color: '#F59E0B' },
          { label: 'Agentes', value: k.agentes || 0, icon: 'users', color: '#8B5CF6' },
        ]);
      }
      if (vistoriasRes.error) {
        logger.error('system', 'Erro ao carregar atividades recentes', { erro: vistoriasRes.error.message });
        setErro(true);
      } else {
        setAtividade(vistoriasRes.data || []);
      }

      // Ranking de agentes do mês
      const inicioMes = new Date();
      inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
      const { data: rankData } = await supabase
        .from('vistorias')
        .select('agenteNome')
        .eq('municipio', profile.municipio)
        .gte('dataVistoria', inicioMes.toISOString());
      if (rankData) {
        const contagem: Record<string, number> = {};
        rankData.forEach((v: any) => { const n = v.agenteNome || '?'; contagem[n] = (contagem[n] || 0) + 1; });
        setRanking(Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, count]) => ({ nome, count })));
      }
    } catch (e) {
      logger.error('system', 'Erro admin dashboard', { erro: String(e) });
      setErro(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    carregar();
    if (profile?.municipio) {
      setPendingAgendamentos(countAgendamentosPendentes(profile.municipio));
    }
  }, [profile]));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Olá, {profile?.name?.split(' ')[0]}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.chipBadge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}25` }]}>
              <Feather name="map-pin" size={10} color={theme.primary} />
              <Text style={[styles.chipText, { color: theme.primary }]}>{profile?.municipio ?? '—'}</Text>
            </View>
            <View style={[styles.chipBadge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}25` }]}>
              <Feather name="shield" size={10} color={theme.primary} />
              <Text style={[styles.chipText, { color: theme.primary }]}>Admin</Text>
            </View>
            {isConnected ? (
              <View style={[styles.chipBadge, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={[styles.chipText, { color: '#10B981' }]}>Conectado</Text>
              </View>
            ) : (
              <View style={[styles.chipBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' }]}>
                <Feather name="wifi-off" size={10} color="#F59E0B" />
                <Text style={[styles.chipText, { color: '#F59E0B' }]}>Offline</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          <View>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.push('/(panel)/agendamentos')}
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
            style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            onPress={() => router.push('/(panel)/perfil')}
          >
            <Feather name="user" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        <DashboardGuide role="admin" inline />
        {!isConnected && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <Feather name="wifi-off" size={15} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700' }}>Modo offline ativo</Text>
              <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 2, opacity: 0.85 }}>Dados do painel indisponíveis. Conecte para atualizar estatísticas.</Text>
            </View>
          </View>
        )}

        {/* Alerta alto risco */}
        {(kpis[2]?.value || 0) > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(panel)/inspecoes')}
          >
            <Feather name="alert-triangle" size={20} color="#EF4444" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.alertTitle}>{kpis[2].value} ALERTA{kpis[2].value > 1 ? 'S' : ''} CRÍTICO{kpis[2].value > 1 ? 'S' : ''}</Text>
              <Text style={styles.alertDesc}>Vistorias de alto risco requerem atenção imediata.</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}

        {/* KPI Grid */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Métricas do Município</Text>
        {erro && kpis.length === 0 ? (
          <ErrorState
            title="Erro ao carregar métricas"
            message="Não foi possível buscar os dados do município. Puxe para atualizar."
            onRetry={() => carregar()}
          />
        ) : (
        <View style={styles.kpiGrid}>
          {[
            { label: 'Total', value: kpis[0]?.value || 0, icon: 'clipboard', color: theme.primary, route: '/(panel)/inspecoes' },
            { label: 'Hoje', value: kpis[1]?.value || 0, icon: 'calendar', color: '#10B981', route: '/(panel)/inspecoes' },
            { label: 'Alto Risco', value: kpis[2]?.value || 0, icon: 'alert-triangle', color: '#EF4444', route: '/(panel)/inspecoes' },
            { label: 'Médio', value: kpis[3]?.value || 0, icon: 'alert-circle', color: '#F59E0B', route: '/(panel)/inspecoes' },
            { label: 'Agentes', value: kpis[4]?.value || 0, icon: 'users', color: '#8B5CF6', route: '/(panel)/admin/usuarios' },
          ].map((k) => (
            <TouchableOpacity 
              key={k.label} 
              style={[styles.kpiCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(k.route as any)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                <View style={[styles.kpiIcon, { backgroundColor: `${k.color}15` }]}>
                  <Feather name={k.icon as any} size={20} color={k.color} />
                </View>
                <Feather name="arrow-up-right" size={14} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              </View>
              <View style={{ width: '100%' }}>
                <Text style={[styles.kpiValue, { color: theme.text }]}>{k.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{k.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        )}

        {/* Barra de Distribuição de Risco (Admin) */}
        {kpis.length > 0 && kpis[0].value > 0 && (
          <View style={[styles.riskDistributionCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.riskCardTitle, { color: theme.text }]}>Severidade Municipal</Text>
              <Text style={[styles.riskCardSubtitle, { color: theme.textSecondary }]}>{kpis[0].value} laudos</Text>
            </View>
            <View style={styles.riskBarContainer}>
              {kpis[2].value > 0 && (
                <View style={[styles.riskSegment, { width: `${(kpis[2].value / kpis[0].value) * 100}%`, backgroundColor: '#EF4444' }]} />
              )}
              {kpis[3].value > 0 && (
                <View style={[styles.riskSegment, { width: `${(kpis[3].value / kpis[0].value) * 100}%`, backgroundColor: '#F59E0B' }]} />
              )}
              {kpis[0].value - kpis[2].value - kpis[3].value > 0 && (
                <View style={[styles.riskSegment, { width: `${((kpis[0].value - kpis[2].value - kpis[3].value) / kpis[0].value) * 100}%`, backgroundColor: theme.border }]} />
              )}
            </View>
            <View style={styles.riskLegend}>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>Alto ({kpis[2].value})</Text>
              </View>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>Médio ({kpis[3].value})</Text>
              </View>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: theme.border }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>Baixo/Outros</Text>
              </View>
            </View>
          </View>
        )}

        {/* Ranking de agentes (mês atual) */}
        {ranking.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Desempenho da Equipe</Text>
              <TouchableOpacity onPress={() => router.push('/(panel)/equipe')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>Ver equipe completa</Text>
              </TouchableOpacity>
            </View>
            {ranking.map(({ nome, count }) => {
              const META = 10;
              const progresso = Math.min(count / META, 1);
              const cor = count >= META ? '#10B981' : count >= META / 2 ? theme.primary : '#F59E0B';
              return (
                <View key={nome} style={[styles.rankCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                  <View style={[styles.rankAvatar, { backgroundColor: theme.iconBackground }]}>
                    <Text style={[styles.rankAvatarText, { color: theme.primary }]}>{nome[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.rankRow}>
                      <Text style={[styles.rankName, { color: theme.text }]} numberOfLines={1}>{nome}</Text>
                      <Text style={[styles.rankCount, { color: cor }]}>{count}/{META}</Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: theme.iconBackground }]}>
                      <View style={[styles.progressFill, { width: `${progresso * 100}%`, backgroundColor: cor }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Atividade recente */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Atividade Recente</Text>
        {erro && atividade.length === 0 ? (
          <ErrorState
            title="Erro ao carregar atividades"
            message="Não foi possível listar as atividades recentes. Puxe para atualizar."
            onRetry={() => carregar()}
          />
        ) : atividade.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nenhuma atividade registrada.</Text>
          </View>
        ) : (
          atividade.map(v => {
            const cor = riscoColor(v.nivelRisco);
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.atividadeCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
                onPress={() => router.push(`/(panel)/inspecoes/${v.id}`)}
              >
                <View style={[styles.atividadeIcon, { backgroundColor: `${cor}15`, borderColor: `${cor}30` }]}>
                  <Feather name="clipboard" size={20} color={cor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.atividadeEnd, { color: theme.text }]} numberOfLines={1}>
                    {v.endereco || 'Sem endereço'}
                  </Text>
                  <Text style={[styles.atividadeInfo, { color: theme.textSecondary }]}>
                    {v.agenteNome || '—'} · {tempoRelativo(v.dataVistoria)}
                  </Text>
                </View>
                <View style={[styles.nivelBadge, { backgroundColor: `${cor}20` }]}>
                  <Text style={[styles.nivelText, { color: cor }]}>
                    {v.nivelRisco?.toUpperCase() || '—'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Link para guia de protocolo */}
        <TouchableOpacity
          style={[styles.guiaBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => router.push('/(panel)/admin/protocolo-doc')}
        >
          <View style={[styles.guiaBtnIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="hash" size={18} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.guiaBtnTitle, { color: theme.text }]}>Guia de Protocolo</Text>
            <Text style={[styles.guiaBtnDesc, { color: theme.textSecondary }]}>Entenda os números dos laudos e vistorias</Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  greeting: { fontSize: 22, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 6, marginTop: 4 },
  chipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 14, marginTop: 4,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  kpiCard: {
    width: '30%', flexGrow: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'flex-start', justifyContent: 'space-between',
  },
  kpiIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  kpiValue: { fontSize: 26, fontWeight: '900' },
  kpiLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  menuCard: {
    width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1,
    padding: 20, alignItems: 'center', gap: 12,
  },
  menuIcon: {
    width: 54, height: 54, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { fontSize: 14, fontWeight: '700' },
  atividadeCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 10,
  },
  atividadeIcon: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  atividadeEnd: { fontSize: 15, fontWeight: '700' },
  atividadeInfo: { fontSize: 12, marginTop: 2 },
  nivelBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  nivelText: { fontSize: 10, fontWeight: '900' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },

  // Nova Seção: Risk Distribution
  riskDistributionCard: {
    borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 28,
  },
  riskCardTitle: { fontSize: 14, fontWeight: '800' },
  riskCardSubtitle: { fontSize: 13, fontWeight: '600' },
  riskBarContainer: {
    height: 8, flexDirection: 'row', borderRadius: 4, overflow: 'hidden',
    backgroundColor: '#333', marginBottom: 12, gap: 2,
  },
  riskSegment: { height: '100%' },
  riskLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  riskLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskLegendText: { fontSize: 12, fontWeight: '600' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    padding: 14, marginBottom: 20,
  },
  alertTitle: { color: '#EF4444', fontSize: 13, fontWeight: '800' },
  alertDesc: { color: '#EF4444', fontSize: 12, opacity: 0.8, marginTop: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  seeAll: { fontSize: 12, fontWeight: '700' },
  rankCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  rankAvatar: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rankAvatarText: { fontSize: 16, fontWeight: '800' },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rankName: { fontSize: 14, fontWeight: '700', flex: 1 },
  rankCount: { fontSize: 13, fontWeight: '800' },
  progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  guiaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 20,
  },
  guiaBtnIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  guiaBtnTitle: { fontSize: 14, fontWeight: '700' },
  guiaBtnDesc: { fontSize: 12, marginTop: 1 },
});
