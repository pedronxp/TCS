import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  RefreshControl, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { useAuth } from '../../../context/AuthContext';
import { tempoRelativo, formatarDataHora } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  usuario_aprovado:        { label: 'Aprovação',  color: '#10B981', icon: 'user-check',    desc: 'Usuário aprovado no sistema' },
  usuario_bloqueado:       { label: 'Bloqueio',   color: '#EF4444', icon: 'user-x',        desc: 'Usuário bloqueado' },
  token_gerado:            { label: 'Token',      color: '#8B5CF6', icon: 'key',           desc: 'Token de convite gerado' },
  token_revogado:          { label: 'Revogação',  color: '#F59E0B', icon: 'x-circle',      desc: 'Token revogado' },
  formulario_publicado:    { label: 'Publicação', color: '#3B82F6', icon: 'upload',        desc: 'Formulário publicado' },
  formulario_despublicado: { label: 'Rascunho',   color: '#94A3B8', icon: 'download',      desc: 'Formulário despublicado' },
  formulario_excluido:     { label: 'Exclusão',   color: '#EF4444', icon: 'trash-2',       desc: 'Formulário excluído' },
  formulario_criado:       { label: 'Criação',    color: '#10B981', icon: 'plus-circle',   desc: 'Formulário criado' },
  formulario_duplicado:    { label: 'Duplicação', color: '#06B6D4', icon: 'copy',          desc: 'Formulário duplicado' },
  sync_sucesso:            { label: 'Sync OK',    color: '#10B981', icon: 'upload-cloud',  desc: 'Dados sincronizados' },
  sync_falha:              { label: 'Sync Falha', color: '#EF4444', icon: 'cloud-off',     desc: 'Falha na sincronização' },
  vistoria_criada:         { label: 'Vistoria',   color: '#06B6D4', icon: 'clipboard',     desc: 'Vistoria registrada' },
  role_alterado:           { label: 'Cargo',      color: '#8B5CF6', icon: 'shield',        desc: 'Cargo/permissão alterado' },
  login:                   { label: 'Login',      color: '#3B82F6', icon: 'log-in',        desc: 'Login realizado' },
};

type FiltroAcao = 'todas' | string;
type FiltroPeriodo = 'todos' | 'hoje' | '7d' | '30d';

export default function AdminLogsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroAcao, setFiltroAcao] = useState<FiltroAcao>('todas');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAuditLogs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(300);

      if (profile?.municipio) {
        query = query.eq('detalhes->>municipio', profile.municipio);
      }

      const { data } = await query;
      setAuditLogs(data || []);
    } catch { /* silencioso */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useFocusEffect(useCallback(() => { loadAuditLogs(); }, [loadAuditLogs]));

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  };

  // Filtro por período
  const filterByPeriodo = (log: any) => {
    if (filtroPeriodo === 'todos') return true;
    if (!log.criado_em) return false;
    const now = new Date();
    const logDate = new Date(log.criado_em);
    if (filtroPeriodo === 'hoje') {
      return logDate.toDateString() === now.toDateString();
    }
    const dias = filtroPeriodo === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
    return logDate >= cutoff;
  };

  const filtrados = auditLogs.filter(l => {
    if (!filterByPeriodo(l)) return false;
    if (filtroAcao === 'todas') return true;
    return String(l.acao).toLowerCase() === filtroAcao.toLowerCase();
  });

  // KPIs dinâmicos
  const kpis = [
    { label: 'Total', value: filtrados.length, color: theme.primary, icon: 'activity' },
    { label: 'Hoje', value: auditLogs.filter(l => new Date(l.criado_em).toDateString() === new Date().toDateString()).length, color: '#3B82F6', icon: 'clock' },
    { label: 'Alertas', value: auditLogs.filter(l => ['usuario_bloqueado', 'sync_falha', 'formulario_excluido', 'token_revogado'].includes(l.acao)).length, color: '#EF4444', icon: 'alert-triangle' },
    { label: 'Agentes', value: new Set(auditLogs.map(l => l.ator_uid).filter(Boolean)).size, color: '#8B5CF6', icon: 'users' },
  ];

  // Ações únicas para filtro
  const acoesUnicas = ['todas', ...new Set(auditLogs.map(l => l.acao).filter(Boolean))];

  const renderAudit = ({ item }: { item: any }) => {
    const cfg = AUDIT_ACTION_LABELS[item.acao] ?? { label: item.acao, color: theme.primary, icon: 'activity', desc: '' };
    const isExpanded = expandedId === String(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleExpand(String(item.id))}
        style={[styles.auditCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
      >
        <View style={[styles.cardStripe, { backgroundColor: cfg.color }]} />

        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.auditHeader}>
            <View style={[styles.auditIconWrap, { backgroundColor: `${cfg.color}15` }]}>
              <Feather name={cfg.icon as any} size={18} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.auditBadgeRow}>
                <View style={[styles.auditBadge, { backgroundColor: `${cfg.color}15` }]}>
                  <Text style={[styles.auditBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                  {tempoRelativo(item.criado_em)}
                </Text>
              </View>
              {cfg.desc ? (
                <Text style={[styles.auditDesc, { color: theme.textSecondary }]}>{cfg.desc}</Text>
              ) : null}
            </View>
            <Feather
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textSecondary}
            />
          </View>

          {/* Actor Row */}
          <View style={[styles.actorRow, { borderTopColor: theme.border }]}>
            <View style={[styles.actorAvatar, { backgroundColor: `${cfg.color}15` }]}>
              <Text style={[styles.actorInitial, { color: cfg.color }]}>
                {(item.ator_nome || '?')[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actorName, { color: theme.text }]}>{item.ator_nome || '—'}</Text>
              {item.alvo_tipo && (
                <Text style={[styles.actorTarget, { color: theme.textSecondary }]} numberOfLines={1}>
                  → {item.alvo_tipo}
                </Text>
              )}
            </View>
            <Text style={[styles.dateDetail, { color: theme.textSecondary }]}>
              {formatarDataHora(item.criado_em)}
            </Text>
          </View>

          {/* Expanded Details */}
          {isExpanded && (
            <View style={[styles.expandedSection, { borderTopColor: theme.border }]}>
              <Text style={[styles.expandedTitle, { color: theme.textSecondary }]}>DETALHES DO EVENTO</Text>

              {item.ator_uid && (
                <View style={styles.detailRow}>
                  <Feather name="hash" size={12} color={theme.textSecondary} />
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>UID do Ator:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>{item.ator_uid}</Text>
                </View>
              )}
              {item.detalhes?.municipio && (
                <View style={styles.detailRow}>
                  <Feather name="map-pin" size={12} color={theme.textSecondary} />
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Município:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{item.detalhes.municipio}</Text>
                </View>
              )}
              {item.detalhes?.protocolo && (
                <View style={styles.detailRow}>
                  <Feather name="file-text" size={12} color={theme.textSecondary} />
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Protocolo:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{item.detalhes.protocolo}</Text>
                </View>
              )}
              {item.detalhes?.nivel_risco && (
                <View style={styles.detailRow}>
                  <Feather name="alert-triangle" size={12} color={theme.textSecondary} />
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Nível de Risco:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{String(item.detalhes.nivel_risco).toUpperCase()}</Text>
                </View>
              )}
              {item.detalhes?.ip && (
                <View style={styles.detailRow}>
                  <Feather name="wifi" size={12} color={theme.textSecondary} />
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>IP:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{item.detalhes.ip}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
          <Text style={[styles.title, { color: theme.text }]}>Auditoria</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            📍 {profile?.municipio || 'Geral'} · {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => loadAuditLogs(true)}
        >
          <Feather name="refresh-cw" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* KPIs */}
      <View style={[styles.kpiRow, { borderBottomColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
        {kpis.map(kpi => (
          <View key={kpi.label} style={styles.kpiItem}>
            <View style={[styles.kpiIconWrap, { backgroundColor: `${kpi.color}12` }]}>
              <Feather name={kpi.icon as any} size={16} color={kpi.color} />
            </View>
            <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      {/* Filtros: Período + Ação */}
      <View style={[styles.filterSection, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {/* Período */}
        <FlatList
          horizontal
          data={[
            { key: 'todos' as FiltroPeriodo, label: 'Tudo' },
            { key: 'hoje' as FiltroPeriodo, label: 'Hoje' },
            { key: '7d' as FiltroPeriodo, label: '7 dias' },
            { key: '30d' as FiltroPeriodo, label: '30 dias' },
          ]}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
          renderItem={({ item: f }) => (
            <TouchableOpacity
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
          )}
        />
        {/* Ações */}
        <FlatList
          horizontal
          data={acoesUnicas}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterBar}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: acao }) => {
            const cfg = AUDIT_ACTION_LABELS[acao];
            const label = acao === 'todas' ? 'Todas' : cfg?.label ?? acao;
            const active = filtroAcao === acao;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: cfg?.color ?? theme.primary }
                    : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
                ]}
                onPress={() => setFiltroAcao(acao)}
              >
                {cfg && <Feather name={cfg.icon as any} size={12} color={active ? '#FFF' : theme.textSecondary} style={{ marginRight: 4 }} />}
                <Text style={{ color: active ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[{ color: theme.textSecondary, marginTop: 12, fontSize: 13 }]}>Carregando auditoria...</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => String(item.id)}
          renderItem={renderAudit}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAuditLogs(true)}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
                <Feather name="shield" size={40} color={theme.border} />
              </View>
              <Text style={[styles.emptyText, { color: theme.text }]}>Sem registros</Text>
              <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
                Ações administrativas da sua cidade aparecerão aqui automaticamente.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 16, paddingHorizontal: 24,
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
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  kpiItem: { flex: 1, alignItems: 'center', gap: 4 },
  kpiIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Filtros
  filterSection: { borderBottomWidth: 1 },
  filterBar: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 100, gap: 10 },

  // Cards
  auditCard: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    flexDirection: 'row',
  },
  cardStripe: { width: 4 },
  cardContent: { flex: 1, padding: 16 },
  auditHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  auditIconWrap: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  auditBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  auditBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8,
  },
  auditBadgeText: { fontSize: 11, fontWeight: '800' },
  auditDesc: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  dateText: { fontSize: 10, marginLeft: 'auto', fontWeight: '500' },

  // Actor
  actorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, paddingTop: 12,
  },
  actorAvatar: {
    width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  actorInitial: { fontSize: 14, fontWeight: '800' },
  actorName: { fontSize: 14, fontWeight: '700' },
  actorTarget: { fontSize: 12, marginTop: 1 },
  dateDetail: { fontSize: 10, fontWeight: '500' },

  // Expanded
  expandedSection: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  expandedTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  detailLabel: { fontSize: 11, fontWeight: '600' },
  detailValue: { fontSize: 12, fontWeight: '500', flex: 1 },

  // Empty
  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700' },
  emptySubText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
