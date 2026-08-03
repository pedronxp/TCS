import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, TextInput, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { resolverApresentacaoRisco, riscoLabel, riscoColor } from '../../../utils/riscoUtils';
import { formatarData } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, EmptyState, MetricCard } from '../../../components/ui';

const PAGE_SIZE = 50;


type FiltroPeriodo = '7d' | '30d' | '90d' | 'todos';
type FiltroRisco = 'todos' | 'r1' | 'r2' | 'r3' | 'r4';


// ─── Card memoizado para evitar re-renders desnecessários ──────────────────

interface CardProps {
  item: any;
  theme: any;
}

const VistoriaCard = React.memo(({ item: v, theme }: CardProps) => {
  const apresentacao = resolverApresentacaoRisco({ formularioId: v.formularioId, pontuacao: v.pontuacaoTotal, nivelRisco: v.nivelRisco, calculoRisco: v.calculoRisco });
  const cor = v.nivelRisco === 'r1' ? theme.riscoR1 : v.nivelRisco === 'r2' ? theme.riscoR2 : v.nivelRisco === 'r3' ? theme.riscoR3 : theme.riscoR4;
  const fundoRisco = v.nivelRisco === 'r1' ? theme.riscoR1Light : v.nivelRisco === 'r2' ? theme.riscoR2Light : v.nivelRisco === 'r3' ? theme.riscoR3Light : theme.riscoR4Light;
  const addr = v.endereco || `${v.enderecoRua || ''}, ${v.enderecoNumero || ''} — ${v.enderecoBairro || ''}`;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
      onPress={() => router.push(`/(panel)/inspecoes/laudo?id=${v.id}`)}
    >
      <View style={[styles.riscoBadge, { backgroundColor: fundoRisco, borderColor: fundoRisco }]}>
        <Feather
          name={v.nivelRisco === 'r4' || v.nivelRisco === 'r3' ? 'alert-triangle' : v.nivelRisco === 'r2' ? 'alert-circle' : 'check-circle'}
          size={18} color={cor}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.cardAddr, { color: theme.text }]} numberOfLines={1}>{addr}</Text>
        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
          {v.agenteNome || '—'} · {formatarData(v.dataVistoria)}
          {v.pontuacaoTotal ? ` · ${v.pontuacaoTotal}pts` : ''}
        </Text>
        {v.municipio && (
          <View style={[styles.munBadge, { backgroundColor: theme.border, alignSelf: 'flex-start', marginTop: 4 }]}>
            <Feather name="map-pin" size={10} color={theme.textSecondary} />
            <Text style={[styles.munText, { color: theme.textSecondary }]}>{v.municipio}</Text>
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[styles.nivelBadge, { backgroundColor: fundoRisco }]}>
          <Text style={[styles.nivelText, { color: cor }]}>{apresentacao.label}</Text>
        </View>
        <Feather name="file-text" size={14} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );
});

export default function RelatoriosScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [vistorias, setVistorias] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroMun, setFiltroMun] = useState('');
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('30d');
  const [risco, setRisco] = useState<FiltroRisco>('todos');

  const carregar = async (refresh = false, append = false) => {
    if (append) setLoadingMore(true);
    else if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const offset = append ? vistorias.length : 0;
      let query = supabase
        .from('vistorias')
        .select('id, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, nivelRisco, pontuacaoTotal, dataVistoria, agenteNome, status, formularioId, calculoRisco')
        .order('dataVistoria', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (profile?.role !== 'master_admin' && profile?.municipio) {
        query = query.eq('municipio', profile.municipio);
      }

      if (periodo !== 'todos') {
        const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
        const desde = new Date(Date.now() - dias * 86400000).toISOString();
        query = query.gte('dataVistoria', desde);
      }

      if (risco !== 'todos') {
        query = query.eq('nivelRisco', risco);
      }

      const { data } = await query;
      const page = data || [];
      setVistorias(prev => append ? [...prev, ...page] : page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      logger.error('system', 'Erro relatorios', { erro: String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [periodo, risco]));

  const filtradas = useMemo(() => vistorias.filter(v => {
    let match = true;
    if (busca) {
      const q = busca.toLowerCase();
      const addr = (v.endereco || `${v.enderecoRua || ''} ${v.enderecoNumero || ''}`).toLowerCase();
      const agente = (v.agenteNome || '').toLowerCase();
      match = match && (addr.includes(q) || agente.includes(q));
    }
    if (filtroMun) {
      const m = filtroMun.toLowerCase();
      const mun = (v.municipio || '').toLowerCase();
      match = match && mun.includes(m);
    }
    return match;
  }), [vistorias, busca, filtroMun]);

  const stats = useMemo(() => ({
    total: filtradas.length,
    r4: filtradas.filter(v => v.nivelRisco === 'r4').length,
    r3: filtradas.filter(v => v.nivelRisco === 'r3').length,
    r2: filtradas.filter(v => v.nivelRisco === 'r2').length,
    r1: filtradas.filter(v => v.nivelRisco === 'r1').length,
  }), [filtradas]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader title="Relatórios técnicos" subtitle={`${filtradas.length} ${filtradas.length === 1 ? 'vistoria' : 'vistorias'}`} onBack={() => router.back()} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsBar}>
        {[
          { label: 'Total', value: stats.total, tone: 'primary' as const },
          { label: 'Crítico', value: stats.r4, tone: 'danger' as const },
          { label: 'Alto', value: stats.r3, tone: 'danger' as const },
          { label: 'Médio', value: stats.r2, tone: 'warning' as const },
          { label: 'Baixo', value: stats.r1, tone: 'success' as const },
        ].map(s => (
          <MetricCard key={s.label} value={s.value} label={s.label} tone={s.tone} style={styles.metricCard} />
        ))}
      </ScrollView>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border, marginBottom: 8 }]}>
          <Feather name="search" size={15} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar endereço, agente..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        {profile?.role === 'master_admin' && (
          <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Feather name="map" size={15} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={filtroMun}
              onChangeText={setFiltroMun}
              placeholder="Filtrar por município..."
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={[styles.filters, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['7d', '30d', '90d', 'todos'] as FiltroPeriodo[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, periodo === p ? { backgroundColor: theme.primary } : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 }]}
              onPress={() => setPeriodo(p)}
            >
              <Text style={{ color: periodo === p ? theme.onPrimary : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {p === 'todos' ? 'Todos' : p}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 1, height: 28, backgroundColor: theme.border, marginHorizontal: 8, alignSelf: 'center' }} />
          {(['todos', 'r4', 'r3', 'r2', 'r1'] as FiltroRisco[]).map(r => {
            const cor = r === 'todos' ? theme.primary : riscoColor(r);
            return (
              <TouchableOpacity
                key={r}
                style={[styles.chip, risco === r ? { backgroundColor: cor } : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setRisco(r)}
              >
                <Text style={{ color: risco === r ? theme.onPrimary : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {r === 'todos' ? 'Todos riscos' : riscoLabel(r)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
        renderItem={({ item }) => <VistoriaCard item={item} theme={theme} />}
        ListEmptyComponent={
          <EmptyState icon="file-text" title="Nenhuma vistoria" description="Ajuste período, risco ou busca para consultar outros relatórios." />
        }
        ListFooterComponent={hasMore ? (
          <TouchableOpacity
            style={[styles.loadMore, { borderColor: theme.border }]}
            onPress={() => carregar(false, true)}
            disabled={loadingMore}
          >
            {loadingMore
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Text style={[styles.loadMoreText, { color: theme.primary }]}>Carregar mais</Text>}
          </TouchableOpacity>
        ) : null}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={15}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsBar: { gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  metricCard: { width: 112 },
  searchRow: { padding: 12, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14 },
  filters: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 6 },
  scroll: { padding: 16, paddingBottom: 60 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  riscoBadge: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cardAddr: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardMeta: { fontSize: 12 },
  munBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  munText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  nivelText: { fontSize: 10, fontWeight: '900' },
  empty: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  loadMore: {
    borderRadius: 14, borderWidth: 1, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700' },
});
