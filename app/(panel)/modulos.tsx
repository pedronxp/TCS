import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ModulosScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const getMenu = () => {
    if (profile?.role === 'master_admin') {
      return [
        { label: 'Municípios', icon: 'map', route: '/(panel)/master/municipios', color: '#3B82F6', desc: 'Gerenciar municípios' },
        { label: 'Inspeções', icon: 'clipboard', route: '/(panel)/inspecoes', color: '#F59E0B', desc: 'Vistorias e formulários' },
        { label: 'Relatórios', icon: 'file-text', route: '/(panel)/admin/relatorios', color: '#EF4444', desc: 'Laudos e exportação' },
        { label: 'Usuários', icon: 'users', route: '/(panel)/admin/usuarios', color: '#06B6D4', desc: 'Todos os usuários' },
        { label: 'Tokens', icon: 'key', route: '/(panel)/admin/tokens', color: '#8B5CF6', desc: 'Tokens de acesso' },
        { label: 'Mapa Global', icon: 'map-pin', route: '/(panel)/mapas', color: '#6366F1', desc: 'Mapa de vistorias' },
        { label: 'Logs', icon: 'terminal', route: '/(panel)/master/logs', color: '#F97316', desc: 'Logs do sistema' },
        { label: 'Estatísticas', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas', color: '#14B8A6', desc: 'Analytics globais' },
      ];
    }
    if (profile?.role === 'admin') {
      return [
        { label: 'Usuários', icon: 'users', route: '/(panel)/admin/usuarios', color: '#3B82F6', desc: 'Gestão da equipe' },
        { label: 'Grupos', icon: 'grid', route: '/(panel)/grupos', color: '#0EA5E9', desc: 'Grupos de agentes' },
        { label: 'Tokens', icon: 'key', route: '/(panel)/admin/tokens', color: '#F59E0B', desc: 'Acesso de agentes' },
        { label: 'Relatórios', icon: 'file-text', route: '/(panel)/admin/relatorios', color: '#EF4444', desc: 'Exportar laudos' },
        { label: 'Estatísticas', icon: 'bar-chart-2', route: '/(panel)/admin/estatisticas', color: '#8B5CF6', desc: 'Métricas locais' },
        { label: 'Inspeções', icon: 'clipboard', route: '/(panel)/inspecoes', color: '#06B6D4', desc: 'Histórico de vistorias' },
        { label: 'Mapa', icon: 'map', route: '/(panel)/mapas', color: '#6366F1', desc: 'Geolocalização' },
        { label: 'Logs', icon: 'terminal', route: '/(panel)/admin/logs', color: '#64748B', desc: 'Atividades recentes' },
      ];
    }
    if (profile?.role === 'supervisor') {
      return [
        { label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', color: '#F59E0B', desc: 'Histórico de laudos' },
        { label: 'Grupos', icon: 'grid', route: '/(panel)/grupos', color: '#0EA5E9', desc: 'Grupos de agentes' },
        { label: 'Mapa Tático', icon: 'map', route: '/(panel)/mapas', color: '#6366F1', desc: 'Georreferenciado' },
        { label: 'Meu Perfil', icon: 'user', route: '/(panel)/perfil', color: '#8B5CF6', desc: 'Dados e configurações' },
      ];
    }
    // agente
    return [
        { label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', color: '#F59E0B', desc: 'Histórico de laudos' },
        { label: 'Mapa Tático', icon: 'map', route: '/(panel)/mapas', color: '#6366F1', desc: 'Georreferenciado' },
        { label: 'Meu Perfil', icon: 'user', route: '/(panel)/perfil', color: '#8B5CF6', desc: 'Dados e configurações' },
    ];
  };

  const menu = getMenu();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: Math.max(insets.top, 30) }]}>
        <Text style={[styles.title, { color: theme.text }]}>Módulos do Sistema</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Acesso rápido a todas as funções</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {menu.map(m => (
            <TouchableOpacity
              key={m.label}
              style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(m.route as any)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${m.color}15` }]}>
                <Feather name={m.icon as any} size={24} color={m.color} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.label, { color: theme.text }]}>{m.label}</Text>
                {m.desc && <Text style={[styles.desc, { color: theme.textSecondary }]}>{m.desc}</Text>}
              </View>
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
    paddingBottom: 20, paddingHorizontal: 24, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  grid: { flexDirection: 'column', gap: 12 },
  card: {
    width: '100%', borderRadius: 18, borderWidth: 1,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  label: { fontSize: 16, fontWeight: '700' },
  desc: { fontSize: 12, marginTop: 4 },
});
