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
import { TCSTheme } from '../../../constants/Colors';
import { AppHeader, EmptyState, MetricCard } from '../../../components/ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AuditTone = 'primary' | 'success' | 'warning' | 'danger' | 'muted';
const AUDIT_ACTION_LABELS: Record<string, { label: string; tone: AuditTone; icon: string; desc: string }> = {
  usuario_aprovado:        { label: 'Aprovação',  tone: 'success', icon: 'user-check',    desc: 'Usuário aprovado no sistema' },
  usuario_bloqueado:       { label: 'Bloqueio',   tone: 'danger', icon: 'user-x',        desc: 'Usuário bloqueado' },
  token_gerado:            { label: 'Token',      tone: 'primary', icon: 'key',           desc: 'Token de convite gerado' },
  token_revogado:          { label: 'Revogação',  tone: 'warning', icon: 'x-circle',      desc: 'Token revogado' },
  formulario_publicado:    { label: 'Publicação', tone: 'primary', icon: 'upload',        desc: 'Formulário publicado' },
  formulario_despublicado: { label: 'Rascunho',   tone: 'muted', icon: 'download',      desc: 'Formulário despublicado' },
  formulario_excluido:     { label: 'Exclusão',   tone: 'danger', icon: 'trash-2',       desc: 'Formulário excluído' },
  formulario_criado:       { label: 'Criação',    tone: 'success', icon: 'plus-circle',   desc: 'Formulário criado' },
  formulario_duplicado:    { label: 'Duplicação', tone: 'primary', icon: 'copy',          desc: 'Formulário duplicado' },
  sync_sucesso:            { label: 'Sync OK',    tone: 'success', icon: 'upload-cloud',  desc: 'Dados sincronizados' },
  sync_falha:              { label: 'Sync Falha', tone: 'danger', icon: 'cloud-off',     desc: 'Falha na sincronização' },
  vistoria_criada:         { label: 'Vistoria',   tone: 'primary', icon: 'clipboard',     desc: 'Vistoria registrada' },
  role_alterado:           { label: 'Cargo',      tone: 'primary', icon: 'shield',        desc: 'Cargo/permissão alterado' },
  login:                   { label: 'Login',      tone: 'primary', icon: 'log-in',        desc: 'Login realizado' },
};

const toneColor = (tone: AuditTone, theme: TCSTheme) => tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : tone === 'danger' ? theme.error : tone === 'muted' ? theme.muted : theme.primary;

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
    { label: 'Total', value: filtrados.length, tone: 'primary' as const, detail: 'registros filtrados' },
    { label: 'Hoje', value: auditLogs.filter(l => new Date(l.criado_em).toDateString() === new Date().toDateString()).length, tone: 'primary' as const, detail: 'eventos recentes' },
    { label: 'Alertas', value: auditLogs.filter(l => ['usuario_bloqueado', 'sync_falha', 'formulario_excluido', 'token_revogado'].includes(l.acao)).length, tone: 'danger' as const, detail: 'pedem atenção' },
    { label: 'Agentes', value: new Set(auditLogs.map(l => l.ator_uid).filter(Boolean)).size, tone: 'success' as const, detail: 'atores identificados' },
  ];

  // Ações únicas para filtro
  const acoesUnicas = ['todas', ...new Set(auditLogs.map(l => l.acao).filter(Boolean))];

  const renderAudit = ({ item }: { item: any }) => {
    const baseCfg = AUDIT_ACTION_LABELS[item.acao] ?? { label: item.acao, tone: 'primary' as const, icon: 'activity', desc: '' };
    const cfg = { ...baseCfg, color: toneColor(baseCfg.tone, theme) };
    const isExpanded = expandedId === String(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleExpand(String(item.id))}
        style={[styles.auditCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
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
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Auditoria municipal"
          subtitle={`${profile?.municipio || 'Geral'} · ${filtrados.length} registro${filtrados.length !== 1 ? 's' : ''}`}
          onBack={() => router.back()}
          actionIcon="refresh-cw"
          actionLabel="Atualizar auditoria"
          onAction={() => loadAuditLogs(true)}
        />
      </View>

      {/* KPIs */}
      <View style={styles.kpiGrid}>
        {kpis.map(kpi => (
          <MetricCard key={kpi.label} {...kpi} style={styles.kpiCard} />
        ))}
      </View>

      {/* Filtros: Período + Ação */}
      <View style={[styles.filterSection, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
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
              <Text style={{ color: filtroPeriodo === f.key ? theme.onPrimary : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
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
            const cfgColor = cfg ? toneColor(cfg.tone, theme) : theme.primary;
            const label = acao === 'todas' ? 'Todas' : cfg?.label ?? acao;
            const active = filtroAcao === acao;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: cfgColor }
                    : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
                ]}
                onPress={() => setFiltroAcao(acao)}
              >
                {cfg && <Feather name={cfg.icon as any} size={12} color={active ? theme.onPrimary : theme.textSecondary} style={{ marginRight: 4 }} />}
                <Text style={{ color: active ? theme.onPrimary : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
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
            <EmptyState
              icon="shield"
              title="Sem registros"
              description="Ações administrativas da sua cidade aparecerão aqui automaticamente."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // KPIs
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  kpiCard: { flexGrow: 1, flexBasis: '46%' },

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
