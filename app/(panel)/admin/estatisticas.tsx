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
        .select('id, nivelRisco, dataVistoria, agenteUid, agenteNome')
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
  const contagemAgentes: Record<string, { nome: string; count: number }> = {};
  vistorias.forEach(v => {
    const uid = v.agenteUid || 'desconhecido';
    const nome = v.agenteNome || 'Desconhecido';
    if (!contagemAgentes[uid]) contagemAgentes[uid] = { nome, count: 0 };
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Estatísticas</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{municipio}</Text>
        </View>
      </View>

      {/* Filtro de período */}
      <View style={[styles.filterBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
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
            <Text style={{ color: periodo === p.key ? '#FFF' : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {/* KPIs */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Resumo do Período</Text>
        <View style={styles.kpiRow}>
          {[
            { label: 'Total', value: total, color: theme.primary },
            { label: 'Alto', value: alto, color: '#EF4444' },
            { label: 'Médio', value: medio, color: '#F59E0B' },
            { label: 'Baixo', value: baixo, color: '#10B981' },
          ].map(k => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Distribuição de risco */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Distribuição por Risco</Text>
        <View style={[styles.barCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
          {[
            { label: 'Alto Risco', value: alto, color: '#EF4444' },
            { label: 'Médio Risco', value: medio, color: '#F59E0B' },
            { label: 'Baixo Risco', value: baixo, color: '#10B981' },
          ].map(item => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View key={item.label} style={styles.riskRow}>
                <Text style={[styles.riskLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                <View style={[styles.riskBarBg, { backgroundColor: theme.iconBackground }]}>
                  <View style={[styles.riskBarFill, { width: `${pct}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={[styles.riskCount, { color: item.color }]}>{item.value}</Text>
              </View>
            );
          })}
        </View>

        {/* Gráfico de barras: período selecionado */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Vistorias — {diasGrafico === 7 ? 'Últimos 7 Dias' : diasGrafico === 14 ? 'Últimas 2 Semanas' : `Últimos ${diasGrafico} Dias`}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
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

        {/* Ranking agentes */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Top Agentes</Text>
        {rankingAgentes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sem dados no período.</Text>
          </View>
        ) : (
          rankingAgentes.map((a, i) => (
            <View key={a.nome} style={[styles.rankCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <Text style={[styles.rankPos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
              <View style={[styles.rankAvatar, { backgroundColor: theme.iconBackground }]}>
                <Text style={[styles.rankAvatarText, { color: theme.primary }]}>{a.nome[0]?.toUpperCase()}</Text>
              </View>
              <Text style={[styles.rankName, { color: theme.text }]}>{a.nome}</Text>
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
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12, marginTop: 4,
  },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  kpiCard: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center',
  },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
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
  rankName: { flex: 1, fontSize: 15, fontWeight: '700' },
  rankCount: { fontSize: 13, fontWeight: '700' },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
