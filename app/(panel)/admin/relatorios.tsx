import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, TextInput, Share, Alert, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';
import { formatarData } from '../../../utils/htmlUtils';

const PAGE_SIZE = 50;

function gerarCsv(vistorias: any[]): string {
  const headers = 'ID,Endereço,Município,Nível Risco,Pontuação,Data,Agente';
  const rows = vistorias.map(v => {
    const addr = (v.endereco || `${v.enderecoRua || ''} ${v.enderecoNumero || ''}`).replace(/,/g, ' ');
    const mun = (v.municipio || '').replace(/,/g, ' ');
    const agente = (v.agenteNome || '').replace(/,/g, ' ');
    const data = v.dataVistoria ? new Date(v.dataVistoria).toLocaleDateString('pt-BR') : '';
    return `${v.id},${addr},${mun},${v.nivelRisco || ''},${v.pontuacaoTotal || ''},${data},${agente}`;
  });
  return [headers, ...rows].join('\n');
}

type FiltroPeriodo = '7d' | '30d' | '90d' | 'todos';
type FiltroRisco = 'todos' | 'r1' | 'r2' | 'r3' | 'r4';


// ─── Card memoizado para evitar re-renders desnecessários ──────────────────

interface CardProps {
  item: any;
  theme: any;
}

const VistoriaCard = React.memo(({ item: v, theme }: CardProps) => {
  const cor = riscoColor(v.nivelRisco);
  const addr = v.endereco || `${v.enderecoRua || ''}, ${v.enderecoNumero || ''} — ${v.enderecoBairro || ''}`;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
      onPress={() => router.push(`/(panel)/inspecoes/laudo?id=${v.id}`)}
    >
      <View style={[styles.riscoBadge, { backgroundColor: `${cor}15`, borderColor: `${cor}30` }]}>
        <Feather
          name={cor === '#EF4444' ? 'alert-triangle' : cor === '#F59E0B' ? 'alert-circle' : 'check-circle'}
          size={18} color={cor}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.cardAddr, { color: theme.text }]} numberOfLines={1}>{addr}</Text>
        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
          {v.agenteNome || '—'} · {formatarData(v.dataVistoria)}
          {v.pontuacaoTotal ? ` · ${v.pontuacaoTotal}pts` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[styles.nivelBadge, { backgroundColor: `${cor}20` }]}>
          <Text style={[styles.nivelText, { color: cor }]}>{riscoLabel(v.nivelRisco)}</Text>
        </View>
        <Feather name="file-text" size={14} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );
});

export default function RelatoriosScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [vistorias, setVistorias] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busca, setBusca] = useState('');
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
        .select('id, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, nivelRisco, pontuacaoTotal, dataVistoria, agenteNome, status')
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

  const exportarCsv = async () => {
    try {
      const csv = gerarCsv(filtradas);
      await Share.share({
        message: csv,
        title: `Relatório Defesa Civil — ${new Date().toLocaleDateString('pt-BR')}`,
      });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível exportar o relatório.');
    }
  };

  const filtradas = useMemo(() => vistorias.filter(v => {
    if (!busca) return true;
    const addr = (v.endereco || `${v.enderecoRua || ''} ${v.enderecoNumero || ''}`).toLowerCase();
    const agente = (v.agenteNome || '').toLowerCase();
    const mun = (v.municipio || '').toLowerCase();
    const q = busca.toLowerCase();
    return addr.includes(q) || agente.includes(q) || mun.includes(q);
  }), [vistorias, busca]);

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
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Relatórios</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{filtradas.length} vistoria{filtradas.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={exportarCsv}
        >
          <Feather name="download" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {[
          { label: 'Total', value: stats.total, color: theme.primary },
          { label: 'Crítico', value: stats.r4, color: '#7C3AED' },
          { label: 'Alto', value: stats.r3, color: '#EF4444' },
          { label: 'Médio', value: stats.r2, color: '#F59E0B' },
          { label: 'Baixo', value: stats.r1, color: '#10B981' },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="search" size={15} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar endereço, agente..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Filters */}
      <View style={[styles.filters, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['7d', '30d', '90d', 'todos'] as FiltroPeriodo[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, periodo === p ? { backgroundColor: theme.primary } : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 }]}
              onPress={() => setPeriodo(p)}
            >
              <Text style={{ color: periodo === p ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
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
                <Text style={{ color: risco === r ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
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
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
        renderItem={({ item }) => <VistoriaCard item={item} theme={theme} />}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Feather name="file-text" size={40} color={theme.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhuma vistoria</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Ajuste os filtros para ver mais resultados.</Text>
          </View>
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
  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  statsBar: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
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
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  nivelText: { fontSize: 10, fontWeight: '900' },
  empty: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  exportBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  loadMore: {
    borderRadius: 14, borderWidth: 1, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700' },
});
