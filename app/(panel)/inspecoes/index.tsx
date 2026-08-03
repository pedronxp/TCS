import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  LoadingState,
  StateBanner,
} from '../../../components/ui';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import { deleteVistoriaOffline, getVistoriasByAgente, getVistoriasByMunicipio, getAllVistorias, getTrainingVistoriasByAgente, VistoriaLocal } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { syncPendentes, forceSyncAll } from '../../../services/SyncService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { safeBack } from '../../../utils/navigationUtils';
import { resolverApresentacaoRisco } from '../../../utils/riscoUtils';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../../constants/Spacing';

type ListFilter = 'todas' | 'pendentes' | 'alto_risco';

// ─── Card memoizado ────────────────────────────────────────────────────────
interface InspecaoCardProps {
  item: VistoriaLocal;
  theme: any;
  onDeleteLocal: (item: VistoriaLocal) => void;
  trainingMode?: boolean;
  localTestMode?: boolean;
}

const InspecaoCard = React.memo(({ item, theme, onDeleteLocal, trainingMode = false, localTestMode = false }: InspecaoCardProps) => {
  const apresentacao = resolverApresentacaoRisco({
    formularioId: item.formulario_id,
    pontuacao: item.pontuacao_total,
    nivelRisco: item.nivel_risco,
    calculoRisco: item.calculo_json,
  });
  const isPendente = item.sincronizado === 0;
  const hasErro = isPendente && !!item.erro_sync;
  const maxTentativas = (item.tentativas_sync ?? 0) >= 5;
  const feitoOffline = item.origem === 'offline';
  const riskVariant = apresentacao.nivelCompatibilidade.toUpperCase() as 'R1' | 'R2' | 'R3' | 'R4';
  const syncLabel = maxTentativas ? 'Falhou' : hasErro ? 'Erro no envio' : isPendente ? 'Pendente' : feitoOffline ? 'Feita offline' : 'Sincronizada';
  const syncVariant = maxTentativas || hasErro ? 'error' : isPendente ? 'warning' : 'success';
  const dateLabel = item.data_vistoria
    ? new Date(item.data_vistoria).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Data não informada';
  const address = item.endereco_rua
    ? `${item.endereco_rua}, ${item.endereco_numero || 's/n'}${item.endereco_bairro ? ` · ${item.endereco_bairro}` : ''}`
    : 'Endereço não informado';

  const openInspection = () => trainingMode
    ? router.push({
        pathname: '/(panel)/inspecoes/resultado',
        params: {
          id: item.id,
          nivelRisco: item.nivel_risco,
          formularioId: item.formulario_id,
          pontuacao: String(item.pontuacao_total ?? 0),
          municipio: item.municipio,
          treinamento: localTestMode ? '0' : '1',
          testeLocal: localTestMode ? '1' : '0',
        },
      })
    : router.push(`/(panel)/inspecoes/${item.id}`);

  return (
    <Card style={styles.inspectionCard} onPress={openInspection}>
      <View style={styles.cardHeader}>
        <Badge label={apresentacao.label} variant={riskVariant} size="sm" showDot />
        <Badge label={syncLabel} variant={syncVariant} size="sm" />
      </View>

      <View style={styles.addressRow}>
        <View style={[styles.addressIcon, { backgroundColor: theme.secondary }]}>
          <Feather name="map-pin" size={19} color={theme.primary} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>{address}</Text>
          <Text style={[styles.municipality, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.municipio || 'Município não informado'}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </View>

      <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
        <Text style={[styles.metadata, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.agente_nome || 'Agente não informado'} · {dateLabel}
        </Text>
        <Text style={[styles.points, { color: theme.text }]}>{item.pontuacao_total ?? 0} pts</Text>
        {isPendente ? (
          <Pressable
            style={({ pressed }) => [styles.deleteLocalBtn, { backgroundColor: theme.errorLight }, pressed && styles.pressed]}
            onPress={(event) => {
              event.stopPropagation();
              onDeleteLocal(item);
            }}
            accessibilityRole="button"
            accessibilityLabel="Excluir vistoria local"
          >
            <Feather name="trash-2" size={16} color={theme.error} />
          </Pressable>
        ) : null}
      </View>

      {hasErro && item.erro_sync ? (
        <Text style={[styles.syncError, { color: theme.error }]} numberOfLines={2}>
          {item.erro_sync}
        </Text>
      ) : null}
    </Card>
  );
});

export default function InspecoesListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { isOnlineReal: isConnected } = useConnectivity();
  const { profile, localTestMode } = useAuth();
  const { trainingProfile, isTrainingActive } = useTraining();
  const activeProfile = profile || trainingProfile;
  const formalTrainingMode = !profile && isTrainingActive && !!trainingProfile;
  const isolatedMode = localTestMode || formalTrainingMode;
  const [loading, setLoading] = useState(true);
  const [vistorias, setVistorias] = useState<VistoriaLocal[]>([]);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ListFilter>('todas');
  const [deleteCandidate, setDeleteCandidate] = useState<VistoriaLocal | null>(null);

  // Recarregar ao voltar para esta tela (ex: após criar nova vistoria)
  useFocusEffect(
    useCallback(() => {
      if (activeProfile) fetchVistorias(activeProfile);
    }, [activeProfile?.uid, isConnected])
  );

  const fetchVistorias = async (perfil: NonNullable<typeof activeProfile>) => {
    setFetchError(null);
    setLoading(true);
    try {
      const isAdmin = perfil.role === 'admin' || perfil.role === 'master_admin';

      // 1. Carregar do SQLite local imediatamente (offline-first)
      const locais = isolatedMode
        ? getTrainingVistoriasByAgente(perfil.uid)
        : perfil.role === 'master_admin'
        ? getAllVistorias()
        : isAdmin
          ? getVistoriasByMunicipio(perfil.municipio)
          : getVistoriasByAgente(perfil.uid);

      setVistorias(locais);

      const pendentes = locais.filter(v => v.sincronizado === 0).length;
      setPendentesCount(pendentes);

      // 2. Se online, buscar do Supabase e mesclar
      if (isConnected && !isolatedMode) {
        let query = supabase
          .from('vistorias')
          .select('*')
          .order('dataVistoria', { ascending: false })
          .limit(50);

        if (!isAdmin) {
          query = query.eq('agenteUid', perfil.uid);
        } else if (perfil.role !== 'master_admin' && perfil.municipio) {
          query = query.eq('municipio', perfil.municipio);
        }
        // master_admin: sem filtro — vê todas as vistorias do sistema

        const { data } = await query;
        if (data) {
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
            calculo_json: typeof r.calculoRisco === 'string' ? r.calculoRisco : JSON.stringify(r.calculoRisco ?? null),
            nivel_risco: r.nivelRisco,
            pontuacao_total: r.pontuacaoTotal,
            foto_url: r.fotoUrl ?? r.foto_url ?? null,
            fotos_urls: Array.isArray(r.fotosUrls) ? JSON.stringify(r.fotosUrls) : r.fotosUrls ?? null,
            feita_online: 1,
            municipio_agente: r.municipio_agente ?? null,
            laudo_url: r.laudo_url ?? null,
            laudo_gerado_em: r.laudo_gerado_em ?? null,
            sincronizado: 1,
            erro_sync: null,
            tentativas_sync: 0,
            criado_em: r.dataVistoria,
          }));

          // Mesclar: locais pendentes + remotas (sem duplicatas)
          const idsPendentes = new Set(locais.filter(v => v.sincronizado === 0).map(v => v.id));
          // Mapa id → feita_online para consultar a origem real de cada registro local
          const localOrigemMap = new Map(locais.map(v => [v.id, v.feita_online]));
          const merged = [
            ...locais.filter(v => v.sincronizado === 0).map(v => ({ ...v, origem: 'offline' as const })),
            ...remotas.filter(r => !idsPendentes.has(r.id)).map(r => {
              const feitaOnline = localOrigemMap.get(r.id);
              // feita_online=1 ou NULL (antigo/desconhecido) → sem badge; feita_online=0 → offline
              return { ...r, origem: feitaOnline === 0 ? 'offline' as const : 'online' as const };
            }),
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

  const handleSync = async () => {
    if (syncing || !isConnected) return;
    setSyncing(true);
    try {
      await forceSyncAll();
      if (activeProfile) await fetchVistorias(activeProfile);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteLocal = useCallback((item: VistoriaLocal) => {
    setDeleteCandidate(item);
  }, []);

  const confirmDeleteLocal = async () => {
    if (!deleteCandidate) return;
    deleteVistoriaOffline(deleteCandidate.id);
    setDeleteCandidate(null);
    if (activeProfile) await fetchVistorias(activeProfile);
  };

  const filteredVistorias = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return vistorias.filter((item) => {
      const apresentacao = resolverApresentacaoRisco({
        formularioId: item.formulario_id,
        pontuacao: item.pontuacao_total,
        nivelRisco: item.nivel_risco,
        calculoRisco: item.calculo_json,
      });
      const matchesFilter = filter === 'todas'
        || (filter === 'pendentes' && item.sincronizado === 0)
        || (filter === 'alto_risco' && ['r3', 'r4'].includes(apresentacao.nivelCompatibilidade));
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      return [
        item.endereco_rua,
        item.endereco_bairro,
        item.municipio,
        item.agente_nome,
        item.responsavel_nome,
      ].some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
    });
  }, [filter, query, vistorias]);

  const renderItem = useCallback(({ item }: { item: VistoriaLocal }) => (
    <InspecaoCard item={item} theme={theme} onDeleteLocal={handleDeleteLocal} trainingMode={isolatedMode} localTestMode={localTestMode} />
  ), [theme, handleDeleteLocal, isolatedMode, localTestMode]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Vistorias"
        subtitle={isolatedMode
          ? localTestMode ? 'Histórico local de testes' : 'Histórico do treinamento'
          : `${vistorias.length} registro${vistorias.length === 1 ? '' : 's'} na operação`}
        onBack={() => safeBack('/(panel)')}
        actionIcon="plus"
        actionLabel="Nova vistoria"
        onAction={() => router.push('/(panel)/inspecoes/dados-iniciais')}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      {loading ? <LoadingState /> : null}

      {fetchError !== null && !loading && (
        <ErrorState
          title="Não foi possível carregar as vistorias"
          message={fetchError}
          onRetry={() => activeProfile && fetchVistorias(activeProfile)}
        />
      )}

      {!loading && fetchError === null && (
        <FlatList
          data={filteredVistorias}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {!isConnected && !isolatedMode ? (
                <StateBanner
                  variant="warning"
                  title="Consulta offline"
                  description="Você está vendo os registros salvos neste aparelho. Novas vistorias continuam disponíveis."
                />
              ) : null}

              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.summaryIcon, { backgroundColor: theme.secondary }]}>
                    <Feather name="clipboard" size={20} color={theme.primary} />
                  </View>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{vistorias.length}</Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.summaryIcon, { backgroundColor: pendentesCount > 0 ? theme.warningLight : theme.successLight }]}>
                    <Feather name={pendentesCount > 0 ? 'upload-cloud' : 'check'} size={20} color={pendentesCount > 0 ? theme.warning : theme.success} />
                  </View>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{pendentesCount}</Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Pendentes</Text>
                </View>
              </View>

              {pendentesCount > 0 && isConnected && !isolatedMode ? (
                <Button
                  label={`Sincronizar ${pendentesCount} ${pendentesCount === 1 ? 'vistoria' : 'vistorias'}`}
                  variant="secondary"
                  onPress={handleSync}
                  loading={syncing}
                  iconLeft={<Feather name="upload-cloud" size={18} color={theme.primaryDark} />}
                  fullWidth
                />
              ) : null}

              <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Feather name="search" size={20} color={theme.textSecondary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar endereço, município ou agente"
                  placeholderTextColor={theme.muted}
                  style={[styles.searchInput, { color: theme.text }]}
                  returnKeyType="search"
                  accessibilityLabel="Buscar vistorias"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Limpar busca">
                    <Feather name="x-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.filterRow}>
                {([
                  ['todas', 'Todas'],
                  ['pendentes', 'Pendentes'],
                  ['alto_risco', 'Risco alto'],
                ] as const).map(([value, label]) => {
                  const selected = filter === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setFilter(value)}
                      style={({ pressed }) => [
                        styles.filterChip,
                        {
                          backgroundColor: selected ? theme.primary : theme.surface,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.filterLabel, { color: selected ? theme.onPrimary : theme.textSecondary }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.resultsLabel, { color: theme.textSecondary }]}>
                {filteredVistorias.length} {filteredVistorias.length === 1 ? 'resultado' : 'resultados'}
              </Text>
            </View>
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          ListEmptyComponent={
            <EmptyState
              icon={query || filter !== 'todas' ? 'search' : 'clipboard'}
              title={query || filter !== 'todas' ? 'Nenhum resultado' : 'Nenhuma vistoria registrada'}
              description={query || filter !== 'todas'
                ? 'Tente ajustar a busca ou selecionar outro filtro.'
                : 'Registre a primeira vistoria para iniciar o histórico técnico.'}
              actionLabel={query || filter !== 'todas' ? 'Limpar filtros' : 'Nova vistoria'}
              onAction={() => {
                if (query || filter !== 'todas') {
                  setQuery('');
                  setFilter('todas');
                } else {
                  router.push('/(panel)/inspecoes/dados-iniciais');
                }
              }}
            />
          }
        />
      )}

      <ConfirmSheet
        visible={Boolean(deleteCandidate)}
        title="Excluir vistoria local?"
        description="Esta vistoria ainda não foi sincronizada. A exclusão remove definitivamente o registro salvo neste aparelho."
        onDismiss={() => setDeleteCandidate(null)}
        actions={[
          { label: 'Excluir registro', variant: 'danger', onPress: confirmDeleteLocal },
          { label: 'Cancelar', variant: 'ghost', onPress: () => setDeleteCandidate(null) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing[4], paddingTop: Spacing[4], gap: Spacing[3] },
  listHeader: { gap: Spacing[4], marginBottom: Spacing[2] },
  summaryGrid: { flexDirection: 'row', gap: Spacing[3] },
  summaryCard: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusLg,
    padding: Spacing[3],
  },
  summaryIcon: {
    width: ComponentSize.buttonSm,
    height: ComponentSize.buttonSm,
    borderRadius: SpacingAlias.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  summaryValue: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold },
  summaryLabel: { marginTop: 2, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  searchBox: {
    minHeight: ComponentSize.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusMd,
    paddingHorizontal: Spacing[3],
  },
  searchInput: { flex: 1, minHeight: ComponentSize.input, fontSize: FontSize.base },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusFull,
    paddingHorizontal: Spacing[4],
  },
  filterLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  resultsLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  inspectionCard: { marginBottom: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[4] },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  addressIcon: {
    width: ComponentSize.buttonMd,
    height: ComponentSize.buttonMd,
    borderRadius: SpacingAlias.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  address: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, lineHeight: 21 },
  municipality: { marginTop: 3, fontSize: FontSize.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], borderTopWidth: 1, marginTop: Spacing[4], paddingTop: Spacing[3] },
  metadata: { flex: 1, fontSize: FontSize.xs },
  points: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  deleteLocalBtn: {
    width: 34,
    height: 34,
    borderRadius: SpacingAlias.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncError: { marginTop: Spacing[2], fontSize: FontSize.xs, lineHeight: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
