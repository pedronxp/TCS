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

export default function MasterDashboardScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalVistorias: 0, altoRisco: 0,
    totalUsuarios: 0, totalMunicipios: 0,
  });
  const [municipios, setMunicipios] = useState<{ nome: string; count: number }[]>([]);

  const carregar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [kpisRes, municipiosRes] = await Promise.all([
        supabase.rpc('get_dashboard_kpis_master'),
        supabase.rpc('get_top_municipios', { p_limit: 10 }),
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
    } catch (e) {
      logger.error('system', 'Erro master dashboard', { erro: String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const MENU = [
    { label: 'Municípios', icon: 'map', route: '/(panel)/master/municipios', color: '#3B82F6', desc: 'Gerenciar municípios' },
    { label: 'Inspeções', icon: 'clipboard', route: '/(panel)/inspecoes', color: '#F59E0B', desc: 'Vistorias e formulários' },
    { label: 'Relatórios', icon: 'file-text', route: '/(panel)/admin/relatorios', color: '#EF4444', desc: 'Laudos e exportação' },
    { label: 'Formulários', icon: 'edit', route: '/(panel)/admin/form-editor', color: '#10B981', desc: 'Editor de formulários' },
    { label: 'Config. Risco', icon: 'sliders', route: '/(panel)/admin/risco-config', color: '#EC4899', desc: 'Limiares de risco' },
    { label: 'Usuários', icon: 'users', route: '/(panel)/admin/usuarios', color: '#06B6D4', desc: 'Todos os usuários' },
    { label: 'Tokens', icon: 'key', route: '/(panel)/admin/tokens', color: '#8B5CF6', desc: 'Tokens de acesso' },
    { label: 'Mapa Global', icon: 'map-pin', route: '/(panel)/mapas', color: '#6366F1', desc: 'Mapa de vistorias' },
    { label: 'Logs', icon: 'terminal', route: '/(panel)/master/logs', color: '#F97316', desc: 'Logs do sistema' },
    { label: 'Estatísticas', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas', color: '#14B8A6', desc: 'Analytics globais' },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
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
        {/* KPIs globais */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Visão Global</Text>
        <View style={styles.kpiGrid}>
          {[
            { label: 'Vistorias', value: stats.totalVistorias, color: theme.primary, icon: 'clipboard' },
            { label: 'Alto Risco', value: stats.altoRisco, color: '#EF4444', icon: 'alert-triangle' },
            { label: 'Usuários', value: stats.totalUsuarios, color: '#10B981', icon: 'users' },
            { label: 'Municípios', value: stats.totalMunicipios, color: '#8B5CF6', icon: 'map' },
          ].map(k => (
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
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Módulos</Text>
        <View style={styles.menuGrid}>
          {MENU.map(m => (
            <TouchableOpacity
              key={m.label}
              style={[styles.menuCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(m.route)}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${m.color}15` }]}>
                <Feather name={m.icon as any} size={24} color={m.color} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text }]}>{m.label}</Text>
              <Text style={[styles.menuDesc, { color: theme.textSecondary }]}>{m.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
});
