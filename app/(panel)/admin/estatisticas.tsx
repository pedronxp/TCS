import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { riscoColor } from '../../../utils/riscoUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, EmptyState, MetricCard, StateBanner } from '../../../components/ui';

type Periodo = '7d' | '30d' | '90d';

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

function getDias(periodo: Periodo): number {
  return periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
}


interface BarData {
  label: string;
  value: number;
  max: number;
  color: string;
}

export default function EstatisticasScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [municipio, setMunicipio] = useState('');
  const [vistorias, setVistorias] = useState<any[]>([]);

  const carregar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from('users').select('municipio, role').eq('uid', session.user.id).single();
      if (!user) return;
      setMunicipio(user.municipio || '');

      const dias = getDias(periodo);
      const desde = new Date(Date.now() - dias * 24 * 3600000).toISOString();

      let query = supabase
        .from('vistorias')
        .select('id, nivelRisco, dataVistoria, agenteUid, agenteNome, municipio')
        .gte('dataVistoria', desde);

      if (user.role !== 'master_admin') {
        query = query.eq('municipio', user.municipio);
      }

      const { data } = await query;
      setVistorias(data || []);
    } catch (e) {
      logger.error('system', 'Erro estatísticas', { erro: String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [periodo]));

  // Cálculos
  const total = vistorias.length;
  const alto = vistorias.filter(v => v.nivelRisco === 'r3' || v.nivelRisco === 'r4' || v.nivelRisco === 'alto').length;
  const medio = vistorias.filter(v => v.nivelRisco === 'r2' || v.nivelRisco === 'medio').length;
  const baixo = vistorias.filter(v => v.nivelRisco === 'r1' || v.nivelRisco === 'baixo').length;

  // Ranking de agentes
  const contagemAgentes: Record<string, { uid: string; nome: string; count: number; municipio: string }> = {};
  vistorias.forEach(v => {
    const uid = v.agenteUid || 'desconhecido';
    const nome = v.agenteNome || 'Desconhecido';
    const muni = v.municipio || '—';
    if (!contagemAgentes[uid]) contagemAgentes[uid] = { uid, nome, count: 0, municipio: muni };
    contagemAgentes[uid].count++;
  });
  const rankingAgentes = Object.values(contagemAgentes).sort((a, b) => b.count - a.count).slice(0, 5);

  // Vistorias por dia — agrupa no período selecionado (máx 14 barras)
  const diasGrafico = Math.min(getDias(periodo), 14);
  const barData: BarData[] = Array.from({ length: diasGrafico }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (diasGrafico - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    // Formato: dd/mm para 30d+, só o dia para 7d
    const label = diasGrafico <= 7
      ? d.getDate().toString()
      : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = vistorias.filter(v => v.dataVistoria?.startsWith(dateStr)).length;
    return { label, value, max: 0, color: theme.primary };
  });
  const maxBar = Math.max(...barData.map(b => b.value), 1);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader title="Indicadores operacionais" subtitle={municipio || 'Visão global'} onBack={() => router.back()} />
      </View>

      {/* Filtro de período */}
      <View style={[styles.filterBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {PERIODOS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.chip,
              periodo === p.key
                ? { backgroundColor: theme.primary }
                : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
            ]}
            onPress={() => setPeriodo(p.key)}
          >
            <Text style={{ color: periodo === p.key ? theme.onPrimary : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {total === 0 ? (
          <StateBanner title="Sem dados no período" description="Selecione outro intervalo ou atualize a consulta." variant="info" />
        ) : null}

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Resumo do Período</Text>
        <View style={styles.kpiRow}>
          {[
            { label: 'Total', value: total, tone: 'primary' as const },
            { label: 'Alto ou crítico', value: alto, tone: 'danger' as const },
            { label: 'Médio', value: medio, tone: 'warning' as const },
            { label: 'Baixo', value: baixo, tone: 'success' as const },
          ].map(k => (
            <MetricCard key={k.label} value={k.value} label={k.label} tone={k.tone} style={styles.kpiCard} />
          ))}
        </View>

        {/* Distribuição de risco */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Distribuição por Risco</Text>
        <View style={[styles.barCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          {[
            { label: 'Alto ou crítico', value: alto, color: theme.error },
            { label: 'Médio Risco', value: medio, color: theme.warning },
            { label: 'Baixo Risco', value: baixo, color: theme.success },
          ].map(item => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View key={item.label} style={styles.riskRow}>
                <Text style={[styles.riskLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                <View style={[styles.riskBarBg, { backgroundColor: theme.iconBackground }]}>
                  <View style={[styles.riskBarFill, { width: `${pct}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={[styles.riskCount, { color: item.color }]}>
                  {item.value}
                  <Text style={{ fontSize: 10, fontWeight: '600' }}> ({pct.toFixed(0)}%)</Text>
                </Text>
              </View>
            );
          })}
        </View>

        {/* Gráfico de barras: período selecionado */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Vistorias — {diasGrafico === 7 ? 'Últimos 7 Dias' : diasGrafico === 14 ? 'Últimas 2 Semanas' : `Últimos ${diasGrafico} Dias`}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.barsContainer}>
            {barData.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barCount, { color: theme.primary }]}>{b.value || ''}</Text>
                <View style={[styles.barBg, { backgroundColor: theme.iconBackground }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${(b.value / maxBar) * 100}%`,
                        backgroundColor: theme.primary,
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: theme.textSecondary }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Resumo de agentes */}
        {rankingAgentes.length > 0 && (
          <View style={[styles.mediaCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.mediaItem}>
              <Text style={[styles.mediaValue, { color: theme.primary }]}>
                {rankingAgentes.length}
              </Text>
              <Text style={[styles.mediaLabel, { color: theme.textSecondary }]}>Agentes ativos</Text>
            </View>
            <View style={[styles.mediaDivider, { backgroundColor: theme.border }]} />
            <View style={styles.mediaItem}>
              <Text style={[styles.mediaValue, { color: theme.primary }]}>
                {rankingAgentes.length > 0 ? (total / rankingAgentes.length).toFixed(1) : '0'}
              </Text>
              <Text style={[styles.mediaLabel, { color: theme.textSecondary }]}>Média por agente</Text>
            </View>
            <View style={[styles.mediaDivider, { backgroundColor: theme.border }]} />
            <View style={styles.mediaItem}>
              <Text style={[styles.mediaValue, { color: rankingAgentes[0] ? theme.primary : theme.textSecondary }]}>
                {rankingAgentes[0]?.count ?? 0}
              </Text>
              <Text style={[styles.mediaLabel, { color: theme.textSecondary }]}>Recorde do período</Text>
            </View>
          </View>
        )}

        {/* Ranking agentes */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Top Agentes</Text>
        {rankingAgentes.length === 0 ? (
          <EmptyState icon="users" title="Sem agentes no período" description="O ranking aparecerá depois que houver vistorias concluídas." />
        ) : (
          rankingAgentes.map((a, i) => (
            <View key={a.uid} style={[styles.rankCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
              <Text style={[styles.rankPos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
              <View style={[styles.rankAvatar, { backgroundColor: theme.iconBackground }]}>
                <Text style={[styles.rankAvatarText, { color: theme.primary }]}>{a.nome[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.rankName, { color: theme.text }]} numberOfLines={1}>{a.nome}</Text>
                <Text style={[styles.rankMunicipio, { color: theme.textSecondary }]} numberOfLines={1}>{a.municipio}</Text>
              </View>
              <Text style={[styles.rankCount, { color: theme.primary }]}>{a.count} vistoria{a.count !== 1 ? 's' : ''}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 4 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12, marginTop: 4,
  },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  kpiCard: {
    width: '48%', flexGrow: 1,
  },
  barCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24 },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  riskLabel: { fontSize: 13, fontWeight: '600', width: 85 },
  riskBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  riskBarFill: { height: '100%', borderRadius: 4 },
  riskCount: { fontSize: 13, fontWeight: '800', width: 30, textAlign: 'right' },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24 },
  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barCount: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  barBg: { width: '100%', flex: 1, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  rankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  rankPos: { fontSize: 14, fontWeight: '900', width: 28 },
  rankAvatar: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  rankAvatarText: { fontSize: 16, fontWeight: '800' },
  rankName: { fontSize: 15, fontWeight: '700' },
  rankMunicipio: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
  rankCount: { fontSize: 13, fontWeight: '700' },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  mediaCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24,
    flexDirection: 'row', alignItems: 'center',
  },
  mediaItem: { flex: 1, alignItems: 'center', gap: 4 },
  mediaValue: { fontSize: 22, fontWeight: '900' },
  mediaLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  mediaDivider: { width: 1, height: 40, marginHorizontal: 8 },
});
