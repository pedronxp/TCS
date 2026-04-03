import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { tempoRelativo } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MasterDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(false);
  const [stats, setStats] = useState({
    totalVistorias: 0, altoRisco: 0,
    totalUsuarios: 0, totalMunicipios: 0,
  });
  const [municipios, setMunicipios] = useState<{ nome: string; count: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const carregar = async (showRefresh = false) => {
    setErro(false);
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [kpisRes, municipiosRes, logsRes] = await Promise.all([
        supabase.rpc('get_dashboard_kpis_master'),
        supabase.rpc('get_top_municipios', { p_limit: 10 }),
        supabase.from('system_logs')
          .select('id, acao, municipio, created_at')
          .not('acao', 'eq', 'LOGIN') // Evitar flood de logins comuns
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (kpisRes.data) {
        const k = kpisRes.data as any;
        setStats({
          totalVistorias: k.totalVistorias || 0,
          altoRisco: k.altoRisco || 0,
          totalUsuarios: k.totalUsuarios || 0,
          totalMunicipios: k.totalMunicipios || 0,
        });
      }
      if (municipiosRes.data) {
        setMunicipios((municipiosRes.data as any[]) || []);
      }
      if (logsRes.data) {
        setRecentLogs(logsRes.data || []);
      }
    } catch (e) {
      logger.error('system', 'Erro master dashboard', { erro: String(e) });
      setErro(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  if (loading) {
    return <LoadingState message="Carregando painel principal..." />;
  }


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Olá, {profile?.name?.split(' ')[0]}
          </Text>
          <View style={[styles.masterBadge, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="shield" size={12} color={theme.primary} />
            <Text style={[styles.masterBadgeText, { color: theme.primary }]}>MASTER ADMIN</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.push('/(panel)/perfil')}
        >
          <Feather name="user" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {erro && !loading && stats.totalVistorias === 0 && (
          <ErrorState
            title="Erro ao carregar dados"
            message="Não foi possível buscar as estatísticas globais. Puxe para atualizar."
            onRetry={() => carregar()}
          />
        )}
        {/* KPIs globais */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Visão Global</Text>
        <View style={styles.kpiGrid}>
          {[
            { label: 'Vistorias', value: stats.totalVistorias, color: theme.primary, icon: 'clipboard', route: '/(panel)/inspecoes' },
            { label: 'Alto Risco', value: stats.altoRisco, color: '#EF4444', icon: 'alert-triangle', route: '/(panel)/inspecoes' },
            { label: 'Usuários', value: stats.totalUsuarios, color: '#10B981', icon: 'users', route: '/(panel)/admin/usuarios' },
            { label: 'Municípios', value: stats.totalMunicipios, color: '#8B5CF6', icon: 'map', route: '/(panel)/master/municipios' },
          ].map(k => (
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

        {/* Barra de Risco Global */}
        {(stats.totalVistorias > 0) && (
          <View style={[styles.riskDistributionCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.riskCardTitle, { color: theme.text }]}>Severidade Global</Text>
              <Text style={[styles.riskCardSubtitle, { color: theme.textSecondary }]}>{stats.totalVistorias} laudos</Text>
            </View>
            <View style={styles.riskBarContainer}>
              {stats.altoRisco > 0 && (
                <View style={[styles.riskSegment, { width: `${(stats.altoRisco / stats.totalVistorias) * 100}%`, backgroundColor: '#EF4444' }]} />
              )}
              {stats.totalVistorias - stats.altoRisco > 0 && (
                <View style={[styles.riskSegment, { width: `${((stats.totalVistorias - stats.altoRisco) / stats.totalVistorias) * 100}%`, backgroundColor: theme.border }]} />
              )}
            </View>
            <View style={styles.riskLegend}>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>Alto ({stats.altoRisco})</Text>
              </View>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: theme.border }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>Moderado/Baixo ({stats.totalVistorias - stats.altoRisco})</Text>
              </View>
            </View>
          </View>
        )}

        {/* Top municípios */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Top Municípios</Text>
        {municipios.map((m, i) => {
          const maxCount = municipios[0]?.count || 1;
          return (
            <View key={m.nome} style={[styles.munCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <Text style={[styles.munPos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.munRow}>
                  <Text style={[styles.munNome, { color: theme.text }]}>{m.nome}</Text>
                  <Text style={[styles.munCount, { color: theme.primary }]}>{m.count}</Text>
                </View>
                <View style={[styles.munBarBg, { backgroundColor: theme.iconBackground }]}>
                  <View style={[styles.munBarFill, { width: `${(m.count / maxCount) * 100}%`, backgroundColor: theme.primary }]} />
                </View>
              </View>
            </View>
          );
        })}

        {/* Recentes do Sistema */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 12 }]}>Eventos Recentes do Sistema</Text>
        {recentLogs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sem logs recentes.</Text>
          </View>
        ) : (
          recentLogs.map((lg) => (
            <View key={lg.id} style={[styles.logCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <View style={[styles.logIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="activity" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.logAcao, { color: theme.text }]}>{lg.acao}</Text>
                <Text style={[styles.logMeta, { color: theme.textSecondary }]}>
                  {lg.municipio === '*' ? 'Sistema Global' : lg.municipio} • {tempoRelativo(lg.created_at)}
                </Text>
              </View>
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
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  greeting: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  masterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  masterBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { padding: 20, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 14, marginTop: 4,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  kpiCard: {
    width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'flex-start', justifyContent: 'space-between',
  },
  kpiIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  kpiValue: { fontSize: 26, fontWeight: '900' },
  kpiLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  menuCard: {
    width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1,
    padding: 18, alignItems: 'center', gap: 8,
  },
  menuIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { fontSize: 14, fontWeight: '700' },
  menuDesc: { fontSize: 11, textAlign: 'center' },
  munCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  munPos: { fontSize: 14, fontWeight: '900', width: 28 },
  munRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  munNome: { fontSize: 15, fontWeight: '700' },
  munCount: { fontSize: 15, fontWeight: '900' },
  munBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  munBarFill: { height: '100%', borderRadius: 3 },

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
  riskLegend: { flexDirection: 'row', gap: 16 },
  riskLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskLegendText: { fontSize: 12, fontWeight: '600' },

  // Nova Seção: Logs Restritos
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  logCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  logIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  logAcao: { fontSize: 13, fontWeight: '700' },
  logMeta: { fontSize: 11, marginTop: 2, fontWeight: '500' },


});
