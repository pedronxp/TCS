import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, EmptyState, ErrorState, LoadingState } from '../../../components/ui';

interface FilaItem {
  revisao_id: string;
  vistoria_id: string;
  ciclo: number;
  agente_nome: string | null;
  endereco: string | null;
  nivel_risco: string | null;
  data_vistoria: string | null;
  criado_em: string;
}

const RISCO_LABEL: Record<string, string> = { r1: 'R1 · Baixo', r2: 'R2 · Médio', r3: 'R3 · Alto', r4: 'R4 · Muito alto' };
const RISCO_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  r1: 'success', r2: 'warning', r3: 'error', r4: 'error',
};

export default function QeFilaScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [itens, setItens] = useState<FilaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc('qe_fila');
      if (error) throw error;
      setItens((data ?? []) as FilaItem[]);
    } catch {
      setErro('Não foi possível carregar a fila de qualidade.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  if (loading) return <LoadingState message="Carregando fila de qualidade..." />;
  if (erro) return <ErrorState message={erro} onRetry={() => void carregar(true)} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Revisão de qualidade"
          subtitle={`${itens.length} vistoria${itens.length === 1 ? '' : 's'} aguardando análise`}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void carregar(true)} tintColor={theme.primary} />}
      >
        {itens.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="Fila vazia"
            description="Todas as vistorias concluídas já foram revisadas. Vistorias novas entram aqui automaticamente."
          />
        ) : (
          itens.map(item => (
            <TouchableOpacity
              key={item.revisao_id}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/(panel)/qe/[id]', params: { id: item.revisao_id } })}
              accessibilityRole="button"
              accessibilityLabel={`Revisar vistoria de ${item.agente_nome ?? 'agente'}`}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agente, { color: theme.text }]}>{item.agente_nome ?? 'Agente'}</Text>
                  <Text style={[styles.endereco, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.endereco ?? 'Endereço não informado'}
                  </Text>
                </View>
                <Badge
                  label={RISCO_LABEL[item.nivel_risco ?? ''] ?? (item.nivel_risco ?? 'Risco n/d')}
                  variant={RISCO_VARIANT[item.nivel_risco ?? ''] ?? 'info'}
                  size="sm"
                />
              </View>
              <View style={styles.cardBottom}>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {item.data_vistoria ? new Date(item.data_vistoria).toLocaleDateString('pt-BR') : '—'}
                  {item.ciclo > 1 ? ` · ciclo ${item.ciclo} (reenvio)` : ''}
                </Text>
                <View style={styles.revisar}>
                  <Text style={[styles.revisarTexto, { color: theme.primary }]}>Revisar</Text>
                  <Feather name="chevron-right" size={16} color={theme.primary} />
                </View>
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
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  agente: { fontSize: 15, fontWeight: '700' },
  endereco: { fontSize: 12, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontSize: 12 },
  revisar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  revisarTexto: { fontSize: 13, fontWeight: '700' },
});
