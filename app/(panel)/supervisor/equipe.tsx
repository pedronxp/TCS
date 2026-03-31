import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';

interface AgenteCard {
  uid: string;
  name: string;
  email: string;
  total: number;
  alto: number;
  medio: number;
  baixo: number;
  ultima: string | null;
}

function tempoRelativo(dt: string | null) {
  if (!dt) return 'Sem atividade';
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'ontem';
  return `há ${Math.floor(diff / 86400)}d`;
}

export default function EquipeScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [agentes, setAgentes] = useState<AgenteCard[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroRisco, setFiltroRisco] = useState<'todos' | 'alto' | 'medio' | 'baixo'>('todos');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { loadEquipe(); }, []);

  const loadEquipe = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErro('Sessão inválida ou não encontrada.');
        return;
      }

      const { data: user } = await supabase
        .from('users').select('municipio').eq('uid', session.user.id).single();
      if (!user?.municipio) return;

      const { data: agentesList } = await supabase
        .from('users')
        .select('uid, name, email')
        .eq('municipio', user.municipio)
        .eq('role', 'agent')
        .eq('isApproved', true);

      if (!agentesList) {
        setErro('Não foi possível carregar a lista de agentes.');
        return;
      }

      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const cards: AgenteCard[] = await Promise.all(
        agentesList.map(async (agente) => {
          const { data: vistorias } = await supabase
            .from('vistorias')
            .select('nivelRisco, dataVistoria')
            .eq('agenteUid', agente.uid)
            .gte('dataVistoria', trintaDiasAtras)
            .order('dataVistoria', { ascending: false });

          const lista = vistorias || [];
          const alto = lista.filter(v => v.nivelRisco === 'r3' || v.nivelRisco === 'r4' || v.nivelRisco === 'alto').length;
          const medio = lista.filter(v => v.nivelRisco === 'r2' || v.nivelRisco === 'medio').length;
          const baixo = lista.filter(v => v.nivelRisco === 'r1' || v.nivelRisco === 'baixo').length;

          return {
            uid: agente.uid,
            name: agente.name || '—',
            email: agente.email || '—',
            total: lista.length,
            alto, medio, baixo,
            ultima: lista[0]?.dataVistoria || null,
          };
        })
      );

      setAgentes(cards.sort((a, b) => b.total - a.total));
    } catch (e) {
      logger.error('system', 'Erro ao carregar equipe', { erro: String(e) });
      setErro('Ocorreu um erro ao carregar os dados da equipe.');
    } finally {
      setLoading(false);
    }
  };

  const filtrados = agentes.filter(a => {
    const matchBusca = a.name.toLowerCase().includes(busca.toLowerCase()) ||
      a.email.toLowerCase().includes(busca.toLowerCase());
    const matchRisco = filtroRisco === 'todos' ||
      (filtroRisco === 'alto' && a.alto > 0) ||
      (filtroRisco === 'medio' && a.medio > 0) ||
      (filtroRisco === 'baixo' && a.baixo > 0);
    return matchBusca && matchRisco;
  });

  if (loading) {
    return <LoadingState message="Carregando equipe..." />;
  }

  if (erro) {
    return <ErrorState message={erro} onRetry={loadEquipe} />;
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
          <Text style={[styles.title, { color: theme.text }]}>Equipe</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{agentes.length} agente{agentes.length !== 1 ? 's' : ''} ativos</Text>
        </View>
      </View>

      {/* Busca */}
      <View style={[styles.searchBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar agente..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Filtros de risco */}
      <View style={[styles.filterBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {([
          { key: 'todos', label: 'Todos', color: theme.primary },
          { key: 'alto', label: 'Alto Risco', color: '#EF4444' },
          { key: 'medio', label: 'Médio', color: '#F59E0B' },
          { key: 'baixo', label: 'Baixo', color: '#10B981' },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip,
              filtroRisco === f.key
                ? { backgroundColor: f.color }
                : { backgroundColor: theme.iconBackground, borderColor: theme.border, borderWidth: 1 },
            ]}
            onPress={() => setFiltroRisco(f.key)}
          >
            <Text style={{ color: filtroRisco === f.key ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filtrados.length === 0 ? (
          <EmptyState
            icon="users"
            title="Equipe vazia"
            description="Nenhum agente ativo no município ou compatível com o filtro."
            actionLabel={busca || filtroRisco !== 'todos' ? 'Limpar filtros' : undefined}
            onAction={busca || filtroRisco !== 'todos' ? () => {
              setBusca('');
              setFiltroRisco('todos');
            } : undefined}
          />
        ) : (
          filtrados.map(agente => (
            <TouchableOpacity
              key={agente.uid}
              style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(`/(panel)/supervisor/agente?uid=${agente.uid}`)}
            >
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>{agente.name[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={[styles.agenteName, { color: theme.text }]}>{agente.name}</Text>
                <Text style={[styles.agenteEmail, { color: theme.textSecondary }]}>{agente.email}</Text>
                <View style={styles.statsRow}>
                  <View style={[styles.statChip, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>{agente.alto} alto</Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>{agente.medio} médio</Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700' }}>{agente.baixo} baixo</Text>
                  </View>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.totalCount, { color: theme.primary }]}>{agente.total}</Text>
                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>30d</Text>
                <Text style={[styles.ultimaAt, { color: theme.textSecondary }]}>{tempoRelativo(agente.ultima)}</Text>
              </View>
            </TouchableOpacity>
          ))
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
  searchBar: { padding: 16, borderBottomWidth: 1 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 44,
  },
  searchText: { flex: 1, fontSize: 15 },
  filterBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, flexWrap: 'wrap',
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12,
  },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  agenteName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  agenteEmail: { fontSize: 12, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 6 },
  statChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  totalCount: { fontSize: 24, fontWeight: '900' },
  totalLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  ultimaAt: { fontSize: 10, marginTop: 4 },
  emptyCard: {
    borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
