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
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { EmptyState } from '../../../components/ui/EmptyState';

type NivelFiltro = 'todos' | 'info' | 'aviso' | 'erro';

const NIVEL_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  info: { color: '#3B82F6', icon: 'info', label: 'INFO' },
  aviso: { color: '#F59E0B', icon: 'alert-triangle', label: 'AVISO' },
  erro: { color: '#EF4444', icon: 'x-circle', label: 'ERRO' },
  warning: { color: '#F59E0B', icon: 'alert-triangle', label: 'AVISO' },
  error: { color: '#EF4444', icon: 'x-circle', label: 'ERRO' },
};

function tempoRelativo(dt: string | null) {
  if (!dt) return '';
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function LogsScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erroLogs, setErroLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<NivelFiltro>('todos');

  const carregar = async (showRefresh = false) => {
    setErroLogs(false);
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .order('criadoEm', { ascending: false })
        .limit(100);

      setLogs(data || []);
    } catch (e) {
      logger.error('system', 'Erro ao carregar logs', { erro: String(e) });
      setErroLogs(true);
      // Se a tabela não existir, retornar vazio
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const filtrados = logs.filter(l => {
    if (filtro === 'todos') return true;
    const nivel = l.nivel || l.level || 'info';
    if (filtro === 'aviso') return nivel === 'aviso' || nivel === 'warning';
    if (filtro === 'erro') return nivel === 'erro' || nivel === 'error';
    return nivel === filtro;
  });

  if (loading) {
    return <LoadingState message="Buscando logs do sistema..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Logs do Sistema</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => carregar(true)}
        >
          <Feather name="refresh-cw" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={[styles.filterBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {([
          { key: 'todos', label: 'Todos', color: theme.primary },
          { key: 'info', label: 'Info', color: '#3B82F6' },
          { key: 'aviso', label: 'Avisos', color: '#F59E0B' },
          { key: 'erro', label: 'Erros', color: '#EF4444' },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip,
              filtro === f.key
                ? { backgroundColor: f.color }
                : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
            ]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={{ color: filtro === f.key ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {erroLogs && !loading && logs.length === 0 ? (
          <ErrorState
            title="Erro ao carregar logs"
            message="Não foi possível buscar os logs do sistema. Puxe para atualizar."
            onRetry={() => carregar()}
          />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="Sem logs"
            description="Nenhum log encontrado para o filtro selecionado."
          />
        ) : (
          filtrados.map((log, i) => {
            const nivel = log.nivel || log.level || 'info';
            const config = NIVEL_CONFIG[nivel] || NIVEL_CONFIG.info;
            return (
              <View key={log.id || i} style={[styles.logCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                <View style={styles.logHeader}>
                  <View style={[styles.logIcon, { backgroundColor: `${config.color}15` }]}>
                    <Feather name={config.icon as any} size={16} color={config.color} />
                  </View>
                  <View style={[styles.nivelBadge, { backgroundColor: `${config.color}15` }]}>
                    <Text style={[styles.nivelText, { color: config.color }]}>{config.label}</Text>
                  </View>
                  <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                    {tempoRelativo(log.criadoEm)}
                  </Text>
                </View>
                <Text style={[styles.logDesc, { color: theme.text }]}>
                  {log.descricao || log.mensagem || 'Sem descrição'}
                </Text>
                {(log.nomeUsuario || log.municipio) && (
                  <View style={styles.logMeta}>
                    {log.nomeUsuario && (
                      <View style={styles.metaItem}>
                        <Feather name="user" size={12} color={theme.textSecondary} />
                        <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                          {log.nomeUsuario}
                        </Text>
                      </View>
                    )}
                    {log.municipio && (
                      <View style={styles.metaItem}>
                        <Feather name="map-pin" size={12} color={theme.textSecondary} />
                        <Text style={[styles.metaText, { color: theme.textSecondary }]}>{log.municipio}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
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
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  logCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10 },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  logIcon: {
    width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  nivelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  logTime: { marginLeft: 'auto', fontSize: 11, fontWeight: '500' },
  logDesc: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 8 },
  logMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '500' },
  emptyCard: {
    borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
