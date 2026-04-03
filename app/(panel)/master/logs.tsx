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
import { getLogs, countLogsByLevel, logger } from '../../../utils/logger';
import type { LogEntry, LogLevel, LogCategory } from '../../../utils/logger';
import { tempoRelativo, formatarDataHora } from '../../../utils/htmlUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NivelFiltro = 'todos' | 'info' | 'warn' | 'error';
type FiltroPeriodo = 'todos' | 'hoje' | '7d' | '30d';

export default function MasterLogsScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filtro, setFiltro] = useState<NivelFiltro>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('todos');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [counts, setCounts] = useState({ info: 0, warn: 0, error: 0 });

  const carregar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = getLogs({ limit: 500 });
      setLogs(data);
      setCounts(countLogsByLevel());
    } catch (e) {
      logger.error('system', 'Erro ao carregar logs', { erro: String(e) });
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const filterByPeriodo = (log: LogEntry) => {
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
    if (filtro !== 'todos' && l.level !== filtro) return false;
    return true;
  });

  const toggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  };

  const getLogConfig = (level: LogLevel, category?: LogCategory) => {
    if (level === 'error') return { icon: 'x-circle', color: '#EF4444', label: 'ERRO' };
    if (level === 'warn')  return { icon: 'alert-triangle', color: '#F59E0B', label: 'AVISO' };

    const cat = String(category || '').toLowerCase();
    let icon = 'info';
    let label = 'INFO';
    if (cat === 'auth')          { icon = 'shield';    label = 'AUTH'; }
    else if (cat === 'sync')     { icon = 'refresh-cw'; label = 'SYNC'; }
    else if (cat === 'form')     { icon = 'edit';       label = 'FORM'; }
    else if (cat === 'token')    { icon = 'key';        label = 'TOKEN'; }
    else if (cat === 'network')  { icon = 'wifi';       label = 'REDE'; }
    else if (cat === 'vistoria') { icon = 'clipboard';  label = 'VISTORIA'; }
    else if (cat === 'notifications') { icon = 'bell'; label = 'NOTIF'; }

    return { icon, color: '#3B82F6', label };
  };

  const exportarCSV = async () => {
    if (filtrados.length === 0) {
      Alert.alert('Sem dados', 'Não há logs para exportar.');
      return;
    }
    try {
      const cabecalho = 'id,level,category,message,data,criado_em';
      const linhas = filtrados.map(l => [
        l.id ?? '',
        l.level ?? '',
        l.category ?? '',
        (l.message || '').replace(/,/g, ';').replace(/\n/g, ' '),
        (l.data || '').replace(/,/g, ';').replace(/\n/g, ' '),
        l.criado_em ?? '',
      ].join(','));
      const csvContent = [cabecalho, ...linhas].join('\n');
      const fileName = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Exportar Logs' });
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
        <Text style={[{ color: theme.textSecondary, marginTop: 12, fontSize: 13 }]}>Carregando logs do sistema...</Text>
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
          <Text style={[styles.title, { color: theme.text }]}>Logs do Sistema</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Master Admin · {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
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
          { lv: 'total', label: 'Total',  count: logs.length,  cor: theme.primary, icon: 'database' },
          { lv: 'info',  label: 'Info',   count: counts.info,  cor: '#3B82F6',    icon: 'info' },
          { lv: 'warn',  label: 'Avisos', count: counts.warn,  cor: '#F59E0B',    icon: 'alert-triangle' },
          { lv: 'error', label: 'Erros',  count: counts.error, cor: '#EF4444',    icon: 'x-circle' },
        ] as const).map(kpi => (
          <TouchableOpacity
            key={kpi.lv}
            style={styles.kpiItem}
            onPress={() => {
              if (kpi.lv === 'total') return;
              setFiltro(filtro === kpi.lv as NivelFiltro ? 'todos' : kpi.lv as NivelFiltro);
            }}
          >
            <View style={[styles.kpiIconWrap, { backgroundColor: `${kpi.cor}12` }]}>
              <Feather name={kpi.icon as any} size={16} color={kpi.cor} />
            </View>
            <Text style={[styles.kpiValue, { color: kpi.cor }]}>{kpi.count}</Text>
            <Text style={[styles.kpiLabel, {
              color: (filtro === kpi.lv) ? kpi.cor : theme.textSecondary,
            }]}>
              {kpi.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtros */}
      <View style={[styles.filterSection, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {/* Período */}
          {([
            { key: 'todos' as FiltroPeriodo, label: 'Tudo' },
            { key: 'hoje' as FiltroPeriodo,  label: 'Hoje' },
            { key: '7d'   as FiltroPeriodo,  label: '7 dias' },
            { key: '30d'  as FiltroPeriodo,  label: '30 dias' },
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

          <View style={[styles.filterSep, { backgroundColor: theme.border }]} />

          {/* Nível */}
          {([
            { key: 'todos' as NivelFiltro, label: 'Todos', color: theme.primary },
            { key: 'info'  as NivelFiltro, label: 'Info',  color: '#3B82F6' },
            { key: 'warn'  as NivelFiltro, label: 'Avisos', color: '#F59E0B' },
            { key: 'error' as NivelFiltro, label: 'Erros', color: '#EF4444' },
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
        </ScrollView>
      </View>

      {/* Lista */}
      <FlatList
        data={filtrados}
        keyExtractor={(item, i) => String(item.id ?? i)}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${theme.primary}10` }]}>
              <Feather name="file-text" size={40} color={theme.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem logs</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Nenhum log encontrado para os filtros selecionados.
            </Text>
          </View>
        }
        renderItem={({ item: log, index: i }) => {
          const isExpanded = expandedId === log.id;
          const config = getLogConfig(log.level, log.category);

          let parsedData: any = null;
          if (log.data) {
            try { parsedData = JSON.parse(log.data); } catch { parsedData = log.data; }
          }

          return (
            <TouchableOpacity
              style={[styles.logCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              activeOpacity={0.8}
              onPress={() => toggleExpand(log.id)}
            >
              {/* Stripe */}
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
                    size={16}
                    color={theme.textSecondary}
                    style={{ marginLeft: 4 }}
                  />
                </View>

                {/* Description */}
                <Text style={[styles.logDesc, { color: theme.text }]}>
                  {log.message || 'Sem descrição'}
                </Text>

                {/* Category badge */}
                {log.category && (
                  <View style={styles.logMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="tag" size={12} color={theme.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                        {log.category}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Expanded */}
                {isExpanded && (
                  <View style={[styles.expandedSection, { borderTopColor: theme.border }]}>
                    <Text style={[styles.expandedTitle, { color: theme.textSecondary }]}>DETALHES TÉCNICOS</Text>

                    {log.criado_em && (
                      <DetailRow icon="calendar" label="Data/Hora" value={formatarDataHora(log.criado_em)} theme={theme} />
                    )}
                    {log.id != null && (
                      <DetailRow icon="hash" label="ID" value={String(log.id)} theme={theme} />
                    )}

                    {parsedData != null && (
                      <View style={[styles.jsonBlock, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                        <Text style={[styles.jsonLabel, { color: theme.textSecondary }]}>DADOS / PAYLOAD JSON</Text>
                        <Text style={[styles.jsonContent, { color: theme.text }]}>
                          {typeof parsedData === 'string'
                            ? parsedData
                            : JSON.stringify(parsedData, null, 2)
                          }
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
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
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

  // KPIs
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

  // Filtros
  filterSection: { borderBottomWidth: 1 },
  filterBar: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterSep: { width: 1, height: 24, alignSelf: 'center', marginHorizontal: 4 },

  scrollContent: { padding: 16, paddingBottom: 60 },

  // Log Cards
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
  logDesc: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 8 },
  logMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '500' },

  // Expanded
  expandedSection: {
    borderTopWidth: 1, marginTop: 12, paddingTop: 12,
  },
  expandedTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8,
  },
  detailLabel: { fontSize: 11, fontWeight: '600' },
  detailValue: { fontSize: 12, fontWeight: '500', flex: 1, flexWrap: 'wrap' },
  jsonBlock: {
    borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8,
  },
  jsonLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6,
  },
  jsonContent: {
    fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    lineHeight: 16,
  },

  // Empty
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
