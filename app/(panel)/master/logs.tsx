import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator, RefreshControl, Alert, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { tempoRelativo, formatarDataHora } from '../../../utils/htmlUtils';
import type { AuditAction } from '../../../utils/auditLogger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AuditLogRow {
  id: string;
  acao: AuditAction;
  ator_uid: string;
  ator_nome: string;
  ator_role: string | null;
  alvo_id: string | null;
  alvo_tipo: string | null;
  detalhes: Record<string, any> | null;
  criado_em: string;
}

type RoleFiltro = 'todos' | 'admin' | 'agente' | 'supervisor' | 'master_admin';
type FiltroPeriodo = 'todos' | 'hoje' | '7d' | '30d';

const ACAO_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  usuario_aprovado:       { icon: 'user-check',   color: '#10B981', label: 'APROVAÇÃO' },
  usuario_bloqueado:      { icon: 'user-x',       color: '#EF4444', label: 'BLOQUEIO' },
  token_gerado:           { icon: 'key',           color: '#3B82F6', label: 'TOKEN' },
  token_revogado:         { icon: 'slash',         color: '#F59E0B', label: 'TOKEN' },
  formulario_publicado:   { icon: 'check-square',  color: '#10B981', label: 'FORMULÁRIO' },
  formulario_despublicado:{ icon: 'square',        color: '#6B7280', label: 'FORMULÁRIO' },
  formulario_excluido:    { icon: 'trash-2',       color: '#EF4444', label: 'FORMULÁRIO' },
  formulario_criado:      { icon: 'file-plus',     color: '#8B5CF6', label: 'FORMULÁRIO' },
  formulario_duplicado:   { icon: 'copy',          color: '#6366F1', label: 'FORMULÁRIO' },
};

function getAcaoConfig(acao: string) {
  return ACAO_CONFIG[acao] ?? { icon: 'activity', color: '#6B7280', label: 'AÇÃO' };
}

export default function MasterLogsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [filtroRole, setFiltroRole] = useState<RoleFiltro>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const carregar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(500);
      if (error) throw error;
      setLogs((data as AuditLogRow[]) ?? []);
    } catch (e) {
      logger.error('system', 'Erro ao carregar audit_logs', { erro: String(e) });
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const filterByPeriodo = (log: AuditLogRow) => {
    if (filtroPeriodo === 'todos') return true;
    if (!log.criado_em) return false;
    const now = new Date();
    const logDate = new Date(log.criado_em);
    if (filtroPeriodo === 'hoje') return logDate.toDateString() === now.toDateString();
    const dias = filtroPeriodo === '7d' ? 7 : 30;
    return logDate >= new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
  };

  const filtrados = logs.filter(l => {
    if (!filterByPeriodo(l)) return false;
    if (filtroRole !== 'todos' && l.ator_role !== filtroRole) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  };

  const countByRole = (role: string) => logs.filter(l => l.ator_role === role).length;

  const exportarCSV = async () => {
    if (filtrados.length === 0) {
      Alert.alert('Sem dados', 'Não há registros para exportar.');
      return;
    }
    try {
      const cabecalho = 'id,acao,ator_nome,ator_role,alvo_id,alvo_tipo,municipio,criado_em';
      const linhas = filtrados.map(l => [
        l.id ?? '',
        l.acao ?? '',
        (l.ator_nome || '').replace(/,/g, ';'),
        l.ator_role ?? '',
        l.alvo_id ?? '',
        (l.alvo_tipo || '').replace(/,/g, ';'),
        (l.detalhes?.municipio || '').replace(/,/g, ';'),
        l.criado_em ?? '',
      ].join(','));
      const csvContent = [cabecalho, ...linhas].join('\n');
      const fileName = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Exportar Auditoria' });
      } else {
        Alert.alert('Exportado', `Arquivo salvo em:\n${filePath}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o CSV.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 13 }}>Carregando auditoria global...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Auditoria Global</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Todos os municípios · {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={exportarCSV}
        >
          <Feather name="download" size={18} color={theme.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border, marginLeft: 8 }]}
          onPress={() => carregar(true)}
        >
          <Feather name="refresh-cw" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* KPIs */}
      <View style={[styles.kpiRow, { borderBottomColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
        {([
          { key: 'total',        label: 'Total',      count: logs.length,           cor: theme.primary, icon: 'database' },
          { key: 'admin',        label: 'Admins',     count: countByRole('admin'),  cor: '#8B5CF6',    icon: 'shield' },
          { key: 'agente',       label: 'Agentes',    count: countByRole('agente'), cor: '#3B82F6',    icon: 'user' },
          { key: 'supervisor',   label: 'Superv.',    count: countByRole('supervisor'), cor: '#10B981', icon: 'users' },
        ] as const).map(kpi => (
          <TouchableOpacity
            key={kpi.key}
            style={styles.kpiItem}
            onPress={() => {
              if (kpi.key === 'total') { setFiltroRole('todos'); return; }
              setFiltroRole(filtroRole === kpi.key as RoleFiltro ? 'todos' : kpi.key as RoleFiltro);
            }}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: `${kpi.cor}12` }]}>
              <Feather name={kpi.icon as any} size={16} color={kpi.cor} />
            </View>
            <Text style={[styles.kpiValue, { color: kpi.cor }]}>{kpi.count}</Text>
            <Text style={[styles.kpiLabel, { color: (filtroRole === kpi.key) ? kpi.cor : theme.textSecondary }]}>
              {kpi.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtros */}
      <View style={[styles.filterSection, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
          {([
            { key: 'todos' as FiltroPeriodo, label: 'Tudo' },
            { key: 'hoje'  as FiltroPeriodo, label: 'Hoje' },
            { key: '7d'    as FiltroPeriodo, label: '7 dias' },
            { key: '30d'   as FiltroPeriodo, label: '30 dias' },
          ] as const).map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                filtroPeriodo === f.key
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => setFiltroPeriodo(f.key)}
            >
              <Text style={{ color: filtroPeriodo === f.key ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista */}
      <FlatList
        data={filtrados}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${theme.primary}10` }]}>
              <Feather name="shield" size={40} color={theme.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem registros</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Nenhuma ação auditável encontrada para os filtros selecionados.
            </Text>
          </View>
        }
        renderItem={({ item: log }) => {
          const isExpanded = expandedId === log.id;
          const config = getAcaoConfig(log.acao);

          return (
            <TouchableOpacity
              style={[styles.logCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              activeOpacity={0.8}
              onPress={() => toggleExpand(log.id)}
            >
              <View style={[styles.logStripe, { backgroundColor: config.color }]} />
              <View style={styles.logContent}>
                {/* Header */}
                <View style={styles.logHeader}>
                  <View style={[styles.logIcon, { backgroundColor: `${config.color}15` }]}>
                    <Feather name={config.icon as any} size={16} color={config.color} />
                  </View>
                  <View style={[styles.nivelBadge, { backgroundColor: `${config.color}15` }]}>
                    <Text style={[styles.nivelText, { color: config.color }]}>{config.label}</Text>
                  </View>
                  <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                    {tempoRelativo(log.criado_em)}
                  </Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16} color={theme.textSecondary} style={{ marginLeft: 4 }}
                  />
                </View>

                {/* Ação */}
                <Text style={[styles.logDesc, { color: theme.text }]}>
                  {log.acao.replace(/_/g, ' ')}
                </Text>

                {/* Meta */}
                <View style={styles.logMeta}>
                  {log.ator_nome && (
                    <View style={styles.metaItem}>
                      <Feather name="user" size={12} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>{log.ator_nome}</Text>
                    </View>
                  )}
                  {log.detalhes?.municipio && (
                    <View style={styles.metaItem}>
                      <Feather name="map-pin" size={12} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>{log.detalhes.municipio}</Text>
                    </View>
                  )}
                </View>

                {/* Expanded */}
                {isExpanded && (
                  <View style={[styles.expandedSection, { borderTopColor: theme.border }]}>
                    <Text style={[styles.expandedTitle, { color: theme.textSecondary }]}>DETALHES</Text>
                    {log.criado_em && (
                      <DetailRow icon="calendar" label="Data/Hora" value={formatarDataHora(log.criado_em)} theme={theme} />
                    )}
                    {log.ator_role && (
                      <DetailRow icon="shield" label="Papel" value={log.ator_role} theme={theme} />
                    )}
                    {log.alvo_id && (
                      <DetailRow icon="hash" label="Alvo ID" value={log.alvo_id} theme={theme} />
                    )}
                    {log.alvo_tipo && (
                      <DetailRow icon="tag" label="Alvo" value={log.alvo_tipo} theme={theme} />
                    )}
                    {log.detalhes && Object.keys(log.detalhes).length > 0 && (
                      <View style={[styles.jsonBlock, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                        <Text style={[styles.jsonLabel, { color: theme.textSecondary }]}>DADOS</Text>
                        <Text style={[styles.jsonContent, { color: theme.text }]}>
                          {JSON.stringify(log.detalhes, null, 2)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function DetailRow({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon as any} size={12} color={theme.textSecondary} />
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}:</Text>
      <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1,
  },
  kpiItem: { flex: 1, alignItems: 'center', gap: 4 },
  kpiIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterSection: { borderBottomWidth: 1 },
  filterBar: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  logCard: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    flexDirection: 'row', marginBottom: 10,
  },
  logStripe: { width: 4 },
  logContent: { flex: 1, padding: 16 },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  logIcon: {
    width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  nivelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  logTime: { marginLeft: 'auto', fontSize: 11, fontWeight: '500' },
  logDesc: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 8, textTransform: 'capitalize' },
  logMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '500' },
  expandedSection: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  expandedTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  detailLabel: { fontSize: 11, fontWeight: '600' },
  detailValue: { fontSize: 12, fontWeight: '500', flex: 1, flexWrap: 'wrap' },
  jsonBlock: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
  jsonLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6,
  },
  jsonContent: {
    fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    lineHeight: 16,
  },
  emptyCard: {
    borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
