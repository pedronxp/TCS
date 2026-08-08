import React, { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Pressable, Dimensions } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useReport } from '../../../context/ReportContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { forceSyncAll } from '../../../services/SyncService';
import { getSignedUrl } from '../../../services/StorageService';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { getOfficialVistoriaById, deleteVistoriaOffline } from '../../../utils/database';
import { formatarPontuacaoRisco, resolverApresentacaoRisco } from '../../../utils/riscoUtils';
import { generateProtocolo } from '../../../utils/uuid';
import { formatarData, formatarDataHora } from '../../../utils/htmlUtils';
import { VistoriaNormalizada } from '../../../types/vistoria';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tracarRota } from '../../../utils/routingUtils';
import { hasValidCoordinates } from '../../../utils/coordinateUtils';
import { safeBack } from '../../../utils/navigationUtils';
import { listAcknowledgementHistory } from '../../../utils/documentAcknowledgementDatabase';
import {
  AppHeader,
  Button,
  EmptyState,
  ListRow,
  LoadingState,
  SectionHeader,
  StateBanner,
} from '../../../components/ui';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';

export default function VistoriaDetalhesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { initReport } = useReport();
  const { profile } = useAuth();
  const { isTrainingActive, trainingProfile } = useTraining();
  const { isOnlineReal: isConnected } = useConnectivity();
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vistoria, setVistoria] = useState<VistoriaNormalizada | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [acknowledgementHistory, setAcknowledgementHistory] = useState<ReturnType<typeof listAcknowledgementHistory>>([]);

  useEffect(() => {
    if (isTrainingActive && trainingProfile) {
      router.replace('/(panel)/treinamento');
      return;
    }
    if (id) fetchDetalhes();
  }, [id, profile?.uid, isTrainingActive]);

  useFocusEffect(React.useCallback(() => {
    if (id) {
      setAcknowledgementHistory(listAcknowledgementHistory(id as string));
      void fetchDetalhes();
    }
  }, [id]));

  const populateReport = (data: any) => {
    let respostas: Record<string, string> = {};
    try { respostas = JSON.parse(data.respostasJson || '{}'); } catch { /* noop */ }
    initReport({
      vistoriaId: data.id,
      protocolo: generateProtocolo(data.id || '', data.dataVistoria, data.municipio),
      endereco: data.endereco || `${data.enderecoRua || ''}, ${data.enderecoNumero || ''} — ${data.enderecoBairro || ''}`,
      municipio: data.municipio || '',
      agenteNome: data.agenteNome || '',
      dataVistoria: data.dataVistoria || '',
      formularioId: data.formularioId || 'Padrão',
      nivelRisco: data.nivelRisco || 'r1',
      pontuacaoTotal: data.pontuacaoTotal ?? 0,
      calculoRisco: data.calculoRisco ?? null,
      respostas,
      foto_url: data.fotosUrls?.[0] ?? data.fotoUrl ?? null,
      fotosUrls: data.fotosUrls ?? (data.fotoUrl ? [data.fotoUrl] : null),
      condutaRecomendada: '',
      observacoesTecnicas: '',
      cargo: 'Agente de Defesa Civil',
    });
  };

  const handleSyncVistoria = async () => {
    if (syncing || !isConnected) return;
    setSyncing(true);
    try {
      await forceSyncAll();
      await fetchDetalhes(); // recarregar após sync
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteLocal = () => {
    if (!id) return;
    Alert.alert(
      'Excluir vistoria local?',
      'Esta vistoria ainda está pendente de sincronização. A exclusão remove apenas o registro salvo neste aparelho.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteVistoriaOffline(id as string);
            router.replace('/(panel)/inspecoes');
          },
        },
      ]
    );
  };

  const fetchDetalhes = async () => {
    try {
      // Construir query com filtros de segurança por role
      let query = supabase
        .from('vistorias')
        .select('id, nivelRisco, pontuacaoTotal, calculoRisco, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, dataVistoria, agenteNome, agenteUid, responsavelNome, respostasJson, formularioId, status, latitude, longitude, fotoUrl, fotosUrls')
        .eq('id', id as string);

      // Agentes só veem suas próprias vistorias
      if (profile?.role === 'agent') {
        query = query.eq('agenteUid', profile.uid);
      }
      // Admin e supervisor só veem vistorias do seu município
      if (profile?.role !== 'master_admin' && profile?.municipio) {
        query = query.eq('municipio', profile.municipio);
      }

      let { data, error } = await query.single();
      if (error && (error as any)?.code !== 'PGRST116') {
        logger.warn('vistoria', 'Busca remota detalhada falhou; tentando fallback amplo', {
          id,
          erro: error.message,
        });
        let fallbackQuery: any = supabase
          .from('vistorias')
          .select('*')
          .eq('id', id as string);

        if (profile?.role === 'agent') {
          fallbackQuery = fallbackQuery.eq('agenteUid', profile.uid);
        }
        if (profile?.role !== 'master_admin' && profile?.municipio) {
          fallbackQuery = fallbackQuery.eq('municipio', profile.municipio);
        }

        const fallbackRemote = await fallbackQuery.single();
        data = fallbackRemote.data;
        error = fallbackRemote.error;
      }

      if (!error && data) {
        // Resolver paths de storage para URLs assinadas antes de exibir
        const midias = Array.from(new Set([
          data.fotoUrl,
          ...(data.fotosUrls ?? []),
        ].filter((value): value is string => Boolean(value))));
        const fotosResolvidas = midias.length > 0
          ? await Promise.all(midias.map(async (u: string) => await getSignedUrl(u) ?? u))
          : null;
        const resolved = { ...data, fotosUrls: fotosResolvidas ?? null };
        setVistoria(resolved);
        populateReport(resolved);
        return;
      }

      // Fallback: SQLite local (vistorias não sincronizadas)
      const local = getOfficialVistoriaById(id as string);
      if (local) {
        // Verificar se pertence ao agente atual (segurança offline)
        if (profile?.role === 'agent' && local.agente_uid !== profile.uid) {
          logger.warn('vistoria', 'Acesso negado — vistoria de outro agente (SQLite)');
          return;
        }
        let adicionais: string[] = [];
        try { adicionais = local.fotos_urls ? JSON.parse(local.fotos_urls) : []; } catch { /* noop */ }
        const midias = Array.from(new Set([
          local.foto_url,
          ...adicionais,
        ].filter((value): value is string => Boolean(value))));
        // Resolver paths locais — offline paths (file://) ficam como estão;
        // paths de storage codificados são assinados se houver conectividade.
        const fotosUrlsParsed = midias.length > 0
          ? await Promise.all(midias.map(async u => await getSignedUrl(u) ?? u))
          : null;
        setVistoria({
          id: local.id,
          nivelRisco: local.nivel_risco,
          pontuacaoTotal: local.pontuacao_total,
          calculoRisco: local.calculo_json,
          endereco: `${local.endereco_rua}, ${local.endereco_numero} — ${local.endereco_bairro}`,
          enderecoRua: local.endereco_rua,
          enderecoNumero: local.endereco_numero,
          enderecoBairro: local.endereco_bairro,
          municipio: local.municipio,
          dataVistoria: local.data_vistoria,
          agenteNome: local.agente_nome,
          agenteUid: local.agente_uid,
          responsavelNome: local.responsavel_nome,
          respostasJson: local.respostas_json,
          formularioId: local.formulario_id,
          status: local.sincronizado === 1 ? 'concluida' : 'Pendente Sync',
          latitude: local.latitude,
          longitude: local.longitude,
          fotosUrls: fotosUrlsParsed,
        });
        return;
      }

      logger.warn('vistoria', 'Vistoria não encontrada — Supabase e SQLite');
    } catch (e) {
      logger.error('vistoria', 'Erro ao buscar vistoria', { erro: String(e) });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState message="Carregando dados da vistoria..." />
      </View>
    );
  }

  if (!vistoria) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="search"
          title="Vistoria não encontrada"
          description="O registro pode ter sido removido ou ainda não estar disponível neste aparelho."
          actionLabel="Voltar às vistorias"
          onAction={() => safeBack('/(panel)/inspecoes')}
        />
      </View>
    );
  }

  const apresentacao = resolverApresentacaoRisco({
    formularioId: vistoria.formularioId,
    pontuacao: vistoria.pontuacaoTotal,
    nivelRisco: vistoria.nivelRisco,
    calculoRisco: vistoria.calculoRisco,
  });
  const cor = apresentacao.cor;
  const nivel = apresentacao.label;
  const riskCode = apresentacao.nivelCompatibilidade.toLowerCase();
  const semanticRiskColor = ['r3', 'r4'].includes(riskCode) ? theme.error : riskCode === 'r2' ? theme.warning : theme.success;
  const riskIcon = ['r3', 'r4'].includes(riskCode) ? 'alert-triangle' : riskCode === 'r2' ? 'alert-circle' : 'check-circle';
  const isAvaliacaoArvore = vistoria.formularioId === 'avaliacao_arvore_cbmmg_v1';
  const endereco = vistoria.endereco || `${vistoria.enderecoRua || ''}, ${vistoria.enderecoNumero || ''} — ${vistoria.enderecoBairro || ''}`;
  const hasCoords = hasValidCoordinates(vistoria.latitude, vistoria.longitude);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title={`Vistoria #${id?.toString().slice(0, 6)}`}
        subtitle={vistoria.status === 'concluida' ? 'Concluída'
          : vistoria.status === 'pendente' ? 'Registrada'
            : vistoria.status === 'em_andamento' ? 'Em andamento'
              : vistoria.status === 'Pendente Sync' ? 'Aguardando sincronização'
                : 'Registrada'}
        onBack={() => safeBack('/(panel)/inspecoes')}
        {...(vistoria.status !== 'Pendente Sync' ? {
          actionIcon: 'file-text' as const,
          actionLabel: 'Abrir laudo',
          onAction: () => router.push(`/(panel)/inspecoes/laudo?id=${id}`),
        } : {})}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      {/* Modal foto ampliada */}
      <Modal visible={!!fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
        <Pressable style={styles.fotoModalBg} onPress={() => setFotoAmpliada(null)}>
          {fotoAmpliada && (
            <Image source={{ uri: fotoAmpliada }} style={styles.fotoModalImg} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.fotoModalClose} onPress={() => setFotoAmpliada(null)}>
            <Feather name="x" size={22} color="#FFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Nível de risco destaque */}
        <View style={[styles.nivelCard, { backgroundColor: `${semanticRiskColor}12`, borderColor: `${semanticRiskColor}30` }]}>
          <View style={[styles.nivelIcon, { backgroundColor: `${semanticRiskColor}20` }]}>
            <Feather name={riskIcon} size={28} color={semanticRiskColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.nivelLabel, { color: theme.textSecondary }]}>{isAvaliacaoArvore ? 'RESULTADO CBMMG' : 'NÍVEL DE RISCO'}</Text>
            <Text style={[styles.nivelText, { color: semanticRiskColor }]}>{nivel}</Text>
          </View>
          {vistoria.pontuacaoTotal != null && (
            <Text style={[styles.pontuacao, { color: cor }]}>{formatarPontuacaoRisco(vistoria.pontuacaoTotal)}<Text style={{ fontSize: 12 }}>pts</Text></Text>
          )}
        </View>

        <SectionHeader title="Dados da vistoria" subtitle="Identificação e localização registradas em campo" />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          {[
            { icon: 'map-pin', label: 'Endereço', value: endereco },
            { icon: 'map', label: 'Município', value: vistoria.municipio || '—' },
            { icon: 'user', label: 'Responsável', value: vistoria.responsavelNome || '—' },
            { icon: 'shield', label: 'Agente', value: vistoria.agenteNome || '—' },
            { icon: 'calendar', label: 'Data da Vistoria', value: formatarDataHora(vistoria.dataVistoria) },
          ].map((row, i) => (
            <View key={i} style={[styles.cardRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <Feather name={row.icon as any} size={18} color={theme.textSecondary} />
              <View style={styles.rowTextWrap}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.value, { color: theme.text }]}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Galeria de fotos */}
        {vistoria.fotosUrls && vistoria.fotosUrls.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Fotos ({vistoria.fotosUrls.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {vistoria.fotosUrls.map((url, idx) => (
                <TouchableOpacity key={idx} onPress={() => setFotoAmpliada(url)} activeOpacity={0.85}>
                  <Image
                    source={{ uri: url }}
                    style={styles.fotoThumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {acknowledgementHistory.length > 0 && (
          <View style={{ marginBottom: 22 }}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Ciência eletrônica por versão</Text>
            {acknowledgementHistory.map(({ document, event, historyStatus }) => {
              const statusColor = historyStatus === 'confirmed' ? theme.success
                : historyStatus === 'sync_failed' ? theme.error
                : historyStatus === 'not_collected' ? theme.muted : theme.warning;
              const statusLabel = {
                not_collected: 'Não coletada',
                pending_sync: 'Pendente de sincronização',
                confirmed: 'Ciência confirmada',
                refused: 'Recusa registrada',
                unable_to_sign: 'Impossibilidade registrada',
                sync_failed: 'Falha de sincronização',
              }[historyStatus];
              return (
                <TouchableOpacity
                  key={document.id}
                  onPress={() => router.push(`/(panel)/inspecoes/ciencia?documentId=${document.id}`)}
                  style={[styles.ackCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: theme.text }]}>{document.documentType} · versão {document.documentVersion}</Text>
                    <Text style={{ color: statusColor, fontSize: 12, fontWeight: '800', marginTop: 3 }}>{statusLabel}</Text>
                    {event?.protocol && <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>{event.protocol}</Text>}
                    {document.status === 'superseded' && <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Versão substituída — histórico preservado</Text>}
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {vistoria.status === 'Pendente Sync' && (
          <StateBanner
            variant="warning"
            title={syncing ? 'Sincronizando vistoria' : isConnected ? 'Sincronização pendente' : 'Aguardando conexão'}
            description={isConnected
              ? 'Envie este registro ao servidor para liberar laudo e ciência eletrônica.'
              : 'O registro permanece seguro neste aparelho e será enviado quando a conexão voltar.'}
            actionLabel={isConnected && !syncing ? 'Sincronizar' : undefined}
            onAction={isConnected && !syncing ? handleSyncVistoria : undefined}
          />
        )}

        <SectionHeader title="Documentos e evidências" subtitle="Ações disponíveis para este registro" />
        <View style={styles.actionList}>
          <ListRow
            title="Laudo técnico"
            subtitle={vistoria.status === 'Pendente Sync' ? 'Sincronize para gerar o documento' : 'Visualizar, exportar e coletar ciência'}
            icon="file-text"
            disabled={vistoria.status === 'Pendente Sync'}
            onPress={() => router.push(`/(panel)/inspecoes/laudo?id=${id}`)}
          />
          <ListRow
            title="Relatório personalizado"
            subtitle="Editar conteúdo técnico e exportar PDF"
            icon="edit-3"
            onPress={() => router.push('/(panel)/inspecoes/relatorio')}
          />
          <ListRow
            title="Fotos e evidências"
            subtitle="Revisar e adicionar registros fotográficos"
            icon="camera"
            badge={vistoria.fotosUrls?.length ? String(vistoria.fotosUrls.length) : undefined}
            onPress={() => router.push(`/(panel)/inspecoes/foto?id=${id}`)}
          />
        </View>

        {vistoria.status === 'Pendente Sync' && (
          <StateBanner
            variant="danger"
            title="Excluir registro local"
            description="Remove definitivamente esta vistoria antes da sincronização."
            actionLabel="Excluir"
            onAction={handleDeleteLocal}
          />
        )}

        {hasCoords && (
          <Button
            label="Traçar rota até o local"
            onPress={() => tracarRota(vistoria.latitude!, vistoria.longitude!)}
            iconLeft={<Feather name="navigation" size={18} color={theme.onPrimary} />}
            fullWidth
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  laudoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  laudoBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  scrollContent: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[4] },
  nivelCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: SpacingAlias.radiusLg, borderWidth: 1, padding: Spacing[4],
  },
  nivelIcon: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  nivelLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.6, textTransform: 'uppercase' },
  nivelText: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, letterSpacing: -0.5 },
  pontuacao: { fontSize: FontSize['4xl'], fontWeight: FontWeight.extrabold, letterSpacing: -1 },
  card: { borderRadius: SpacingAlias.radiusLg, borderWidth: 1, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  rowTextWrap: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '600' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12,
  },
  actionList: { gap: Spacing[2] },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  ackCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  actionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  actionDesc: { fontSize: 12 },
  rotaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderRadius: 14, marginTop: 12, justifyContent: 'center' },
  rotaBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16,
  },
  syncBannerTitle: { fontSize: 14, fontWeight: '700' },
  syncBannerSub: { fontSize: 12, marginTop: 2 },
  fotoThumb: { width: 110, height: 110, borderRadius: 12 },
  fotoModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fotoModalImg: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.75 },
  fotoModalClose: { position: 'absolute', top: 52, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
});
