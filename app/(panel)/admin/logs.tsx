import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { getLogs, clearLogs, countLogsByLevel, LogEntry, LogLevel } from '../../../utils/logger';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../context/AuthContext';
import { tempoRelativo } from '../../../utils/htmlUtils';

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; icon: string; label: string }> = {
  info:  { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  icon: 'info',           label: 'Info' },
  warn:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: 'alert-triangle',  label: 'Aviso' },
  error: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  icon: 'alert-circle',    label: 'Erro' },
};

const CATEGORY_ICONS: Record<string, string> = {
  auth:     'user',
  sync:     'upload-cloud',
  vistoria: 'clipboard',
  network:  'wifi',
  token:    'key',
  form:     'file-text',
  system:   'settings',
};

const CATEGORY_LABELS: Record<string, string> = {
  auth:     'Autenticação',
  sync:     'Sincronização',
  vistoria: 'Vistoria',
  network:  'Conexão',
  token:    'Token de Acesso',
  form:     'Formulário',
  system:   'Sistema',
};


const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  usuario_aprovado:      { label: 'Aprovação',  color: '#10B981', icon: 'user-check' },
  usuario_bloqueado:     { label: 'Bloqueio',   color: '#EF4444', icon: 'user-x' },
  token_gerado:          { label: 'Token',      color: '#8B5CF6', icon: 'key' },
  token_revogado:        { label: 'Revogação',  color: '#F59E0B', icon: 'x-circle' },
  formulario_publicado:  { label: 'Publicação', color: '#3B82F6', icon: 'upload' },
  formulario_despublicado:{ label: 'Rascunho',  color: '#94A3B8', icon: 'download' },
  formulario_excluido:   { label: 'Exclusão',   color: '#EF4444', icon: 'trash-2' },
  formulario_criado:     { label: 'Criação',    color: '#10B981', icon: 'plus-circle' },
  formulario_duplicado:  { label: 'Duplicação', color: '#06B6D4', icon: 'copy' },
};

const LEVELS: Array<LogLevel | 'all'> = ['all', 'error', 'warn', 'info'];
const LEVEL_LABELS: Record<string, string> = { all: 'Todos', error: 'Erros', warn: 'Avisos', info: 'Info' };

type TabKey = 'sistema' | 'auditoria';

export default function LogsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('sistema');

  // Sistema
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [counts, setCounts] = useState({ info: 0, warn: 0, error: 0 });

  // Auditoria
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadLogs = useCallback(() => {
    const entries = getLogs({ limit: 300, level: filter === 'all' ? undefined : filter });
    setLogs(entries);
    setCounts(countLogsByLevel());
  }, [filter]);

  const loadAuditLogs = useCallback(async () => {
    if (!profile?.municipio) return;
    setAuditLoading(true);
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(100);
      setAuditLogs(data || []);
    } catch { /* silencioso */ } finally {
      setAuditLoading(false);
    }
  }, [profile]);

  useFocusEffect(useCallback(() => {
    loadLogs();
    loadAuditLogs();
  }, [loadLogs, loadAuditLogs]));

  const handleClear = () => {
    Alert.alert('Limpar logs?', 'Todos os registros de log serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar', style: 'destructive', onPress: () => {
          clearLogs();
          setLogs([]);
          setCounts({ info: 0, warn: 0, error: 0 });
        }
      }
    ]);
  };

  const exportarCSV = async () => {
    if (auditLogs.length === 0) {
      Alert.alert('Sem dados', 'Não há logs de auditoria para exportar.');
      return;
    }
    try {
      const cabecalho = 'id,acao,ator_nome,alvo_tipo,criado_em,municipio';
      const linhas = auditLogs.map(l => [
        l.id ?? '',
        l.acao ?? '',
        (l.ator_nome ?? '').replace(/,/g, ';'),
        l.alvo_tipo ?? '',
        l.criado_em ?? '',
        l.detalhes?.municipio ?? '',
      ].join(','));
      const csvContent = [cabecalho, ...linhas].join('\n');
      const fileName = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Exportar Auditoria' });
      } else {
        Alert.alert('Exportado', `Arquivo salvo em:\n${filePath}`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível exportar o CSV.');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const renderSistema = ({ item }: { item: LogEntry }) => {
    const cfg = LEVEL_CONFIG[item.level];
    const catIcon = CATEGORY_ICONS[item.category] || 'circle';
    const catLabel = CATEGORY_LABELS[item.category] || item.category;
    return (
      <View style={[styles.logCard, { backgroundColor: theme.surfaceHighlight, borderLeftColor: cfg.color }]}>
        <View style={styles.logRow}>
          <View style={[styles.levelBadge, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.levelText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <View style={styles.catBadge}>
            <Feather name={catIcon as any} size={11} color={theme.textSecondary} />
            <Text style={[styles.catText, { color: theme.textSecondary }]}>{catLabel}</Text>
          </View>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>{tempoRelativo(item.criado_em)}</Text>
        </View>
        <Text style={[styles.message, { color: theme.text }]}>{item.message}</Text>
      </View>
    );
  };

  const renderAudit = ({ item }: { item: any }) => {
    const cfg = AUDIT_ACTION_LABELS[item.acao] ?? { label: item.acao, color: theme.primary, icon: 'activity' };
    return (
      <View style={[styles.auditCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder, borderLeftColor: cfg.color }]}>
        <View style={styles.auditHeader}>
          <View style={[styles.auditBadge, { backgroundColor: `${cfg.color}15` }]}>
            <Feather name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.auditBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>{formatDate(item.criado_em)}</Text>
        </View>
        <Text style={[styles.auditAtor, { color: theme.text }]}>{item.ator_nome || '—'}</Text>
        {item.alvo_tipo && (
          <Text style={[styles.auditAlvo, { color: theme.textSecondary }]} numberOfLines={1}>
            → {item.alvo_tipo}
          </Text>
        )}
        {item.detalhes && item.detalhes.municipio && (
          <Text style={[styles.auditMun, { color: theme.textSecondary }]}>
            <Feather name="map-pin" size={10} /> {item.detalhes.municipio}
          </Text>
        )}
      </View>
    );
  };

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
          <Text style={[styles.title, { color: theme.text }]}>Logs</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {activeTab === 'sistema'
              ? counts.error > 0
                ? `${counts.error} erro${counts.error !== 1 ? 's' : ''} encontrado${counts.error !== 1 ? 's' : ''}`
                : 'Nenhum erro registrado'
              : `${auditLogs.length} ação${auditLogs.length !== 1 ? 'ões' : ''} registrada${auditLogs.length !== 1 ? 's' : ''}`
            }
          </Text>
        </View>
        {activeTab === 'sistema' ? (
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.border }]}
            onPress={handleClear}
          >
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.border }]}
            onPress={exportarCSV}
          >
            <Feather name="download" size={18} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {([['sistema', 'Sistema', 'terminal'], ['auditoria', 'Auditoria', 'shield']] as const).map(([key, label, icon]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(key)}
          >
            <Feather name={icon} size={14} color={activeTab === key ? theme.primary : theme.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === key ? theme.primary : theme.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'sistema' ? (
        <>
          {/* KPIs */}
          <View style={[styles.kpiRow, { borderBottomColor: theme.border }]}>
            {([['error', '#EF4444', counts.error], ['warn', '#F59E0B', counts.warn], ['info', '#3B82F6', counts.info]] as any[]).map(([lv, cor, cnt]) => (
              <View key={lv} style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: cor }]}>{cnt}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{LEVEL_LABELS[lv]}</Text>
              </View>
            ))}
          </View>

          {/* Filtro por nível */}
          <View style={[styles.filterRow, { borderBottomColor: theme.border }]}>
            {LEVELS.map(lv => (
              <TouchableOpacity
                key={lv}
                style={[
                  styles.filterChip,
                  { borderColor: filter === lv ? theme.primary : theme.border,
                    backgroundColor: filter === lv ? `${theme.primary}15` : 'transparent' },
                ]}
                onPress={() => { setFilter(lv); }}
              >
                <Text style={[styles.filterText, { color: filter === lv ? theme.primary : theme.textSecondary }]}>
                  {LEVEL_LABELS[lv]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={logs}
            keyExtractor={item => String(item.id)}
            renderItem={renderSistema}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="check-circle" size={40} color="#10B981" />
                <Text style={[styles.emptyText, { color: theme.text }]}>Tudo certo por aqui!</Text>
                <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>Nenhum registro encontrado para o filtro selecionado.</Text>
              </View>
            }
          />
        </>
      ) : (
        auditLoading ? (
          <View style={[styles.empty, { flex: 1 }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={auditLogs}
            keyExtractor={item => String(item.id)}
            renderItem={renderAudit}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="shield" size={40} color={theme.border} />
                <Text style={[styles.emptyText, { color: theme.text }]}>Sem ações registradas</Text>
                <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>Ações administrativas como aprovações e tokens aparecerão aqui.</Text>
              </View>
            }
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  clearBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  kpiRow: {
    flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1,
  },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 100, gap: 8 },
  logCard: {
    borderRadius: 10, padding: 12, borderLeftWidth: 3,
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  levelText: { fontSize: 10, fontWeight: '800' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catText: { fontSize: 11, fontWeight: '600' },
  dateText: { fontSize: 10, marginLeft: 'auto' },
  message: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  dataText: { fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  auditCard: {
    borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 14,
  },
  auditHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  auditBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flex: 1,
  },
  auditBadgeText: { fontSize: 11, fontWeight: '800' },
  auditAtor: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  auditAlvo: { fontSize: 12, marginBottom: 2 },
  auditMun: { fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySubText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
