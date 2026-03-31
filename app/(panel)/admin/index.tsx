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
import { riscoColor } from '../../../utils/riscoUtils';
import { tempoRelativo } from '../../../utils/htmlUtils';
import { AtividadeItem } from '../../../types/vistoria';

interface KPI {
  label: string;
  value: number;
  icon: string;
  color: string;
}


export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [atividade, setAtividade] = useState<AtividadeItem[]>([]);

  const carregar = async (showRefresh = false) => {
    if (!profile) return;
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
      setAtividade(vistoriasRes.data || []);
    } catch (e) {
      logger.error('system', 'Erro admin dashboard', { erro: String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [profile]));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const MENU = [
    { label: 'Usuários', icon: 'users', route: '/(panel)/admin/usuarios', color: '#3B82F6' },
    { label: 'Tokens', icon: 'key', route: '/(panel)/admin/tokens', color: '#F59E0B' },
    { label: 'Relatórios', icon: 'file-text', route: '/(panel)/admin/relatorios', color: '#EF4444' },
    { label: 'Formulários', icon: 'edit', route: '/(panel)/admin/form-editor', color: '#10B981' },
    { label: 'Config. Risco', icon: 'sliders', route: '/(panel)/admin/risco-config', color: '#EC4899' },
    { label: 'Estatísticas', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas', color: '#8B5CF6' },
    { label: 'Inspeções', icon: 'clipboard', route: '/(panel)/inspecoes', color: '#06B6D4' },
    { label: 'Mapa', icon: 'map', route: '/(panel)/mapas', color: '#6366F1' },
    { label: 'Logs', icon: 'terminal', route: '/(panel)/admin/logs', color: '#64748B' },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Olá, {profile?.name?.split(' ')[0]}
          </Text>
          <Text style={[styles.role, { color: theme.textSecondary }]}>
            {profile?.municipio} · ADMINISTRADOR
          </Text>
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
        {/* KPI Grid */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Métricas do Município</Text>
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <View style={[styles.kpiIcon, { backgroundColor: `${k.color}15` }]}>
                <Feather name={k.icon as any} size={20} color={k.color} />
              </View>
              <Text style={[styles.kpiValue, { color: theme.text }]}>{k.value}</Text>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu de módulos */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Módulos de Gestão</Text>
        <View style={styles.menuGrid}>
          {MENU.map(m => (
            <TouchableOpacity
              key={m.label}
              style={[styles.menuCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(m.route)}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${m.color}15` }]}>
                <Feather name={m.icon as any} size={26} color={m.color} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Atividade recente */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Atividade Recente</Text>
        {atividade.length === 0 ? (
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
  greeting: { fontSize: 22, fontWeight: '700' },
  role: { fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
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
    width: '30%', flexGrow: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center',
  },
  kpiIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  kpiValue: { fontSize: 26, fontWeight: '900' },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
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
});
