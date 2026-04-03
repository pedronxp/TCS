import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useAuth } from '../../../context/AuthContext';
import { Card, EmptyState, LoadingState, ErrorState } from '../../../components/ui';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import { getVistoriasByAgente, getVistoriasByMunicipio, VistoriaLocal } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RISCO_COLORS: Record<string, string> = {
  r1: '#10B981',
  r2: '#F59E0B',
  r3: '#F97316',
  r4: '#EF4444',
};

// ─── Card memoizado ────────────────────────────────────────────────────────
interface InspecaoCardProps {
  item: VistoriaLocal;
  theme: any;
}

const InspecaoCard = React.memo(({ item, theme }: InspecaoCardProps) => {
  const cor = RISCO_COLORS[item.nivel_risco] || '#94A3B8';
  const isPendente = item.sincronizado === 0;
  const hasErro = isPendente && !!item.erro_sync;
  const maxTentativas = (item.tentativas_sync ?? 0) >= 5;
  return (
    <Card
      style={{ marginBottom: 12 }}
      onPress={() => router.push(`/(panel)/inspecoes/${item.id}`)}
    >
      <View style={[styles.cardInner, { borderColor: hasErro ? 'rgba(239,68,68,0.3)' : theme.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: cor }]}>
            <Text style={styles.badgeText}>{item.nivel_risco?.toUpperCase() || 'N/A'}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            {isPendente && !hasErro && !maxTentativas && (
              <View style={styles.pendenteBadge}>
                <Feather name="cloud-off" size={10} color="#F59E0B" />
                <Text style={styles.pendenteText}>Pendente de sincronização</Text>
              </View>
            )}
            {hasErro && !maxTentativas && (
              <View style={styles.erroBadge}>
                <Feather name="alert-triangle" size={10} color="#EF4444" />
                <Text style={styles.erroText}>Erro sync</Text>
              </View>
            )}
            {maxTentativas && (
              <View style={styles.erroBadge}>
                <Feather name="x-circle" size={10} color="#EF4444" />
                <Text style={styles.erroText}>Falhou</Text>
              </View>
            )}
            {!isPendente && (
              <View style={styles.sincronizadoBadge}>
                <Feather name="check-circle" size={10} color="#10B981" />
                <Text style={styles.sincronizadoText}>Sincronizado</Text>
              </View>
            )}
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {item.data_vistoria ? new Date(item.data_vistoria).toLocaleDateString('pt-BR') : '---'}
            </Text>
          </View>
        </View>
        <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>
          {item.endereco_rua ? `${item.endereco_rua}, ${item.endereco_numero} - ${item.endereco_bairro}` : 'Endereço não informado'}
        </Text>
        <Text style={[styles.agente, { color: theme.textSecondary }]}>
          {item.agente_nome} • {item.pontuacao_total} pts
          {hasErro && item.erro_sync ? ` • ⚠ ${item.erro_sync.substring(0, 40)}` : ''}
        </Text>
      </View>
    </Card>
  );
});

export default function InspecoesListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOnlineReal: isConnected } = useConnectivity();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vistorias, setVistorias] = useState<VistoriaLocal[]>([]);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Recarregar ao voltar para esta tela (ex: após criar nova vistoria)
  useFocusEffect(
    useCallback(() => {
      if (profile) fetchVistorias(profile);
    }, [profile, isConnected])
  );

  const fetchVistorias = async (perfil: NonNullable<typeof profile>) => {
    setFetchError(null);
    setLoading(true);
    try {
      const isAdmin = perfil.role === 'admin' || perfil.role === 'master_admin';

      // 1. Carregar do SQLite local imediatamente (offline-first)
      const locais = isAdmin
        ? getVistoriasByMunicipio(perfil.municipio)
        : getVistoriasByAgente(perfil.uid);

      setVistorias(locais);

      const pendentes = locais.filter(v => v.sincronizado === 0).length;
      setPendentesCount(pendentes);

      // 2. Se online, buscar do Supabase e mesclar
      if (isConnected) {
        let query = supabase
          .from('vistorias')
          .select('*')
          .order('dataVistoria', { ascending: false })
          .limit(50);

        if (!isAdmin) {
          query = query.eq('agenteUid', perfil.uid);
        } else if (perfil.municipio) {
          query = query.eq('municipio', perfil.municipio);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          // Mapear Supabase → formato VistoriaLocal para exibição unificada
          const remotas: VistoriaLocal[] = data.map((r: any) => ({
            id: r.id,
            agente_uid: r.agenteUid,
            agente_nome: r.agenteNome,
            municipio: r.municipio,
            endereco_rua: r.enderecoRua,
            endereco_numero: r.enderecoNumero,
            endereco_bairro: r.enderecoBairro,
            endereco_cep: r.enderecoCep,
            responsavel_nome: r.responsavelNome,
            latitude: r.latitude,
            longitude: r.longitude,
            data_vistoria: r.dataVistoria,
            formulario_id: r.formularioId,
            formulario_versao: r.formularioVersao,
            respostas_json: r.respostasJson,
            nivel_risco: r.nivelRisco,
            pontuacao_total: r.pontuacaoTotal,
            foto_url: r.fotoUrl,
            fotos_urls: Array.isArray(r.fotosUrls) ? JSON.stringify(r.fotosUrls) : r.fotosUrls ?? null,
            sincronizado: 1,
            erro_sync: null,
            tentativas_sync: 0,
            criado_em: r.dataVistoria,
          }));

          // Mesclar: locais pendentes + remotas (sem duplicatas)
          const idsPendentes = new Set(locais.filter(v => v.sincronizado === 0).map(v => v.id));
          const merged = [
            ...locais.filter(v => v.sincronizado === 0),
            ...remotas.filter(r => !idsPendentes.has(r.id)),
          ].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

          setVistorias(merged);
        }
      }
    } catch (e) {
      logger.error('vistoria', 'Erro ao buscar vistorias', { erro: String(e) });
      setFetchError('Erro ao carregar vistorias. Toque para tentar novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: VistoriaLocal }) => (
    <InspecaoCard item={item} theme={theme} />
  ), [theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.text }]}>Inspeções</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {pendentesCount > 0
              ? `${pendentesCount} pendente${pendentesCount > 1 ? 's' : ''} de sync`
              : 'Todos os laudos sincronizados'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(panel)/inspecoes/dados-iniciais')}
        >
          <Feather name="plus" color="#FFF" size={24} />
        </TouchableOpacity>
      </View>

      {loading && <LoadingState />}

      {fetchError !== null && !loading && (
        <ErrorState
          message={fetchError}
          onRetry={() => fetchVistorias(profile!)}
        />
      )}

      {!loading && fetchError === null && (
        <FlatList
          data={vistorias}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          ListEmptyComponent={
            <EmptyState
              icon="clipboard"
              title="Nenhuma vistoria encontrada"
              description="Toque no botão + para registrar a primeira vistoria."
              actionLabel="Nova Vistoria"
              onAction={() => router.push('/(panel)/inspecoes/dados-iniciais')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, marginRight: 16 },
  titleSection: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  addButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  listContent: { padding: 24, paddingBottom: 100, gap: 16 },
  cardInner: { borderWidth: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  pendenteBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  pendenteText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' },
  erroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  erroText: { color: '#EF4444', fontSize: 10, fontWeight: '700' },
  sincronizadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  sincronizadoText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  dateText: { fontSize: 12, fontWeight: '500' },
  address: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  agente: { fontSize: 12, fontWeight: '400' },
});
