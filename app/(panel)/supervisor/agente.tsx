import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { riscoColor, riscoLabel } from '../../../utils/riscoUtils';
import { formatarData } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FiltroRisco = 'todos' | 'alto' | 'medio' | 'baixo';


export default function AgenteVistoriasScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
        supabase.from('users').select('name, email, municipio').eq('uid', uid).single(),
        supabase
          .from('vistorias')
          .select('id, nivelRisco, endereco, dataVistoria, pontuacaoTotal')
          .eq('agenteUid', uid)
          .order('dataVistoria', { ascending: false }),
      ]);
      setAgente(agenteRes.data);
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {agente?.name || 'Agente'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {agente?.municipio} · {total} vistorias
          </Text>
        </View>
      </View>

      {/* Stats do agente */}
      <View style={[styles.statsBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {[
          { label: 'Total', value: total, color: theme.primary },
          { label: 'Alto', value: alto, color: '#EF4444' },
          { label: 'Médio', value: medio, color: '#F59E0B' },
          { label: 'Baixo', value: baixo, color: '#10B981' },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Filtros */}
      <View style={[styles.filterBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {([
          { key: 'todos', label: 'Todos', color: theme.primary },
          { key: 'alto', label: 'Alto', color: '#EF4444' },
          { key: 'medio', label: 'Médio', color: '#F59E0B' },
          { key: 'baixo', label: 'Baixo', color: '#10B981' },
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filtradas.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nenhuma vistoria encontrada.</Text>
          </View>
        ) : (
          filtradas.map(v => {
            const cor = riscoColor(v.nivelRisco);
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.vistoriaCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
                onPress={() => router.push(`/(panel)/inspecoes/${v.id}`)}
              >
                <View style={[styles.riscoBadge, { backgroundColor: `${cor}15`, borderColor: `${cor}30` }]}>
                  <Feather
                    name={cor === '#EF4444' ? 'alert-triangle' : cor === '#F59E0B' ? 'alert-circle' : 'check-circle'}
                    size={18} color={cor}
                  />
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
                    <Text style={[styles.nivelText, { color: cor }]}>{riscoLabel(v.nivelRisco)}</Text>
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
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  statsBar: {
    flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
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
