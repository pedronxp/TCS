import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../utils/supabase';
import { logger } from '../../utils/logger';
import { resolverApresentacaoRisco } from '../../utils/riscoUtils';
import { formatarData } from '../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { AppHeader, EmptyState, MetricCard } from '../../components/ui';

type FiltroRisco = 'todos' | 'alto' | 'medio' | 'baixo';


export default function AgenteVistoriasScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [loading, setLoading] = useState(true);
  const [agente, setAgente] = useState<any>(null);
  const [vistorias, setVistorias] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<FiltroRisco>('todos');

  useEffect(() => { loadData(); }, [uid]);

  const loadData = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [agenteRes, vistoriasRes] = await Promise.all([
        supabase.rpc('get_operational_user', { p_uid: uid }),
        supabase
          .from('vistorias')
          .select('id, nivelRisco, endereco, dataVistoria, pontuacaoTotal, formularioId, calculoRisco')
          .eq('agenteUid', uid)
          .order('dataVistoria', { ascending: false }),
      ]);
      let supervisores = '';
      const { data: atribuicoes } = await supabase
        .from('atribuicoes')
        .select('supervisor_uid')
        .eq('agente_uid', uid);

      const supervisorUids = (atribuicoes || [])
        .map((a: any) => a.supervisor_uid)
        .filter(Boolean);

      if (supervisorUids.length > 0) {
        const { data: supervisoresData } = await supabase.rpc('list_operational_users', {
          p_role: 'supervisor', p_municipio: null, p_include_unapproved: false, p_offset: 0, p_limit: 500,
        });

        supervisores = (supervisoresData || [])
          .filter((s: any) => supervisorUids.includes(s.uid))
          .map((s: any) => s.name)
          .filter(Boolean)
          .join(', ');
      }

      setAgente({ ...(agenteRes.data || {}), supervisores });
      setVistorias(vistoriasRes.data || []);
    } catch (e) {
      logger.error('system', 'Erro ao carregar agente', { erro: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const filtradas = vistorias.filter(v => {
    if (filtro === 'todos') return true;
    if (filtro === 'alto') return v.nivelRisco === 'r3' || v.nivelRisco === 'r4' || v.nivelRisco === 'alto';
    if (filtro === 'medio') return v.nivelRisco === 'r2' || v.nivelRisco === 'medio';
    return v.nivelRisco === 'r1' || v.nivelRisco === 'baixo';
  });

  const total = vistorias.length;
  const alto = vistorias.filter(v => v.nivelRisco === 'r3' || v.nivelRisco === 'r4' || v.nivelRisco === 'alto').length;
  const medio = vistorias.filter(v => v.nivelRisco === 'r2' || v.nivelRisco === 'medio').length;
  const baixo = vistorias.filter(v => v.nivelRisco === 'r1' || v.nivelRisco === 'baixo').length;

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
        <AppHeader
          title={agente?.name || 'Agente'}
          subtitle={`${agente?.municipio || 'Município não informado'} · ${total} vistorias`}
          onBack={() => router.back()}
          actionIcon="refresh-cw"
          actionLabel="Atualizar agente"
          onAction={() => void loadData()}
        />
      </View>

      {/* Stats do agente */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Total', value: total, tone: 'primary' as const },
          { label: 'Alto', value: alto, tone: 'danger' as const },
          { label: 'Médio', value: medio, tone: 'warning' as const },
          { label: 'Baixo', value: baixo, tone: 'success' as const },
        ].map(s => (
          <MetricCard key={s.label} {...s} style={styles.metricCard} />
        ))}
      </View>

      {!!agente?.supervisores && (
        <View style={[styles.supervisorBar, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Feather name="shield" size={15} color={theme.primary} />
          <Text style={[styles.supervisorText, { color: theme.textSecondary }]} numberOfLines={1}>Supervisor: {agente.supervisores}</Text>
        </View>
      )}

      {/* Filtros */}
      <View style={[styles.filterBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        {([
          { key: 'todos', label: 'Todos', color: theme.primary },
          { key: 'alto', label: 'Alto', color: theme.error },
          { key: 'medio', label: 'Médio', color: theme.warning },
          { key: 'baixo', label: 'Baixo', color: theme.success },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            accessibilityRole="button"
            accessibilityLabel={`Filtrar por risco ${f.label}`}
            accessibilityState={{ selected: filtro === f.key }}
            style={[
              styles.chip,
              filtro === f.key
                ? { backgroundColor: f.color }
                : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
            ]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={{ color: filtro === f.key ? theme.onPrimary : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
        {filtradas.length === 0 ? (
          <EmptyState icon="clipboard" title="Nenhuma vistoria encontrada" description="Altere o filtro ou aguarde novos registros deste agente." />
        ) : (
          filtradas.map(v => {
            const apresentacao = resolverApresentacaoRisco({ formularioId: v.formularioId, pontuacao: v.pontuacaoTotal, nivelRisco: v.nivelRisco, calculoRisco: v.calculoRisco });
            const nivel = String(v.nivelRisco || '').toLowerCase();
            const cor = ['r3', 'r4', 'alto', 'critico', 'iminente'].includes(nivel)
              ? theme.error
              : ['r2', 'medio', 'médio'].includes(nivel) ? theme.warning : theme.success;
            const riskIcon = cor === theme.error ? 'alert-triangle' : cor === theme.warning ? 'alert-circle' : 'check-circle';
            return (
              <TouchableOpacity
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir vistoria em ${v.endereco || 'endereço não informado'}, risco ${apresentacao.label}`}
                style={[styles.vistoriaCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
                onPress={() => router.push(`/(panel)/inspecoes/${v.id}`)}
              >
                <View style={[styles.riscoBadge, { backgroundColor: `${cor}15`, borderColor: `${cor}30` }]}>
                  <Feather name={riskIcon} size={18} color={cor} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.endereco, { color: theme.text }]} numberOfLines={1}>
                    {v.endereco || 'Endereço não informado'}
                  </Text>
                  <Text style={[styles.dataText, { color: theme.textSecondary }]}>
                    {formatarData(v.dataVistoria)}
                    {v.pontuacaoTotal ? ` · ${v.pontuacaoTotal} pts` : ''}
                  </Text>
                </View>
                <View>
                  <View style={[styles.nivelBadge, { backgroundColor: `${cor}20` }]}>
                    <Text style={[styles.nivelText, { color: cor }]}>{apresentacao.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  metricCard: { flexGrow: 1, flexBasis: '46%' },
  supervisorBar: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  supervisorText: { flex: 1, fontSize: 12, fontWeight: '600' },
  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  vistoriaCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 10,
  },
  riscoBadge: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  endereco: { fontSize: 15, fontWeight: '700' },
  dataText: { fontSize: 12, marginTop: 2 },
  nivelBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  nivelText: { fontSize: 10, fontWeight: '900' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
