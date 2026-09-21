import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share, Modal, TextInput, Image, Linking,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { useReport } from '../../../context/ReportContext';
import { supabase } from '../../../utils/supabase';
import { getOfficialVistoriaById, getTrainingVistoriaById, queueLaudoUpload, updateLaudoUrl } from '../../../utils/database';
import { syncPendentes } from '../../../services/SyncService';
import { getSignedUrl } from '../../../services/StorageService';
import { buildLaudoHtml, buildTermoInterdicaoHtml, LaudoData, LaudoLayout, LAUDO_LAYOUTS, TermoInterdicaoData } from '../../../utils/laudoPdfBuilder';
import { formatarPontuacaoRisco, normalizarNivelRisco, resolverApresentacaoRisco } from '../../../utils/riscoUtils';
import { protocolDisplay } from '../../../utils/protocoloDisplay';
import { buildShareMessage } from '../../../utils/shareUtils';
import { uploadLaudoPdf } from '../../../services/StorageService';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { checkRateLimit } from '../../../utils/rateLimitUtils';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { safeBack } from '../../../utils/navigationUtils';
import { logger } from '../../../utils/logger';
import { prepareGeneratedDocument } from '../../../services/DocumentAcknowledgementService';
import { resolveDocumentRelease } from '../../../services/DocumentReleaseWorkflow';
import { DOCUMENT_TEMPLATE_VERSIONS, GeneratedDocumentType, isAcknowledgementEnabled, SignatureStroke } from '../../../types/documentAcknowledgement';
import { listAcknowledgementHistory } from '../../../utils/documentAcknowledgementDatabase';
import { SignaturePad } from '../../../components/SignaturePad';
import {
  AppHeader,
  Badge,
  Button,
  ErrorState,
  ListRow,
  LoadingState,
  OptionSheet,
  SectionHeader,
} from '../../../components/ui';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';

/** Normaliza dados de qualquer fonte (Supabase camelCase ou SQLite snake_case) */
function normalizar(v: any): any {
  if (!v) return null;
  return {
    id: v.id,
    nivelRisco: v.nivelRisco ?? v.nivel_risco ?? 'r1',
    pontuacaoTotal: v.pontuacaoTotal ?? v.pontuacao_total ?? 0,
    endereco: v.endereco ?? `${v.endereco_rua ?? ''}, ${v.endereco_numero ?? ''} - ${v.endereco_bairro ?? ''}`,
    enderecoRua: v.enderecoRua ?? v.endereco_rua ?? '',
    enderecoNumero: v.enderecoNumero ?? v.endereco_numero ?? '',
    enderecoBairro: v.enderecoBairro ?? v.endereco_bairro ?? '',
    municipio: v.municipio ?? '',
    municipio_agente: v.municipio_agente ?? null,
    dataVistoria: v.dataVistoria ?? v.data_vistoria ?? v.created_at ?? null,
    agenteNome: v.agenteNome ?? v.agente_nome ?? '—',
    respostasJson: v.respostasJson ?? v.respostas_json ?? '{}',
    calculoRisco: v.calculoRisco ?? v.calculo_risco ?? v.calculo_json ?? null,
    formularioId: v.formularioId ?? v.formulario_id ?? 'Padrão',
    responsavelNome: v.responsavelNome ?? v.responsavel_nome ?? '',
    foto_url: v.foto_url ?? v.fotoUrl ?? null,
    fotosUrls: (() => {
      const raw = v.fotosUrls ?? v.fotos_urls ?? null;
      if (!raw) return null;
      if (Array.isArray(raw)) return raw as string[];
      try { return JSON.parse(raw) as string[]; } catch { return null; }
    })(),
    protocolo: v.protocolo ?? null,
    laudo_url: v.laudo_url ?? null,
    laudo_gerado_em: v.laudo_gerado_em ?? null,
  };
}

async function resolverMidias(vistoria: any): Promise<any> {
  if (!vistoria) return vistoria;
  const fotoPrincipal = vistoria.foto_url
    ? await getSignedUrl(vistoria.foto_url) ?? vistoria.foto_url
    : null;
  const fotos = Array.isArray(vistoria.fotosUrls)
    ? await Promise.all(vistoria.fotosUrls.map(async (stored: string) =>
        await getSignedUrl(stored) ?? stored
      ))
    : null;
  return { ...vistoria, foto_url: fotoPrincipal, fotosUrls: fotos };
}


const LAUDO_LAYOUT_STORAGE_KEY = '@laudo_layout_preferido';
/** Janela mínima entre gerações de PDF da mesma vistoria (limitador). */
const PDF_COOLDOWN_MINUTES = 15;

function formatarHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function statusCienciaLabel(status: string): string {
  const map: Record<string, string> = {
    not_collected: 'ciência pendente',
    pending_sync: 'ciência coletada · aguardando sincronização',
    confirmed: 'ciência confirmada',
    refused: 'recusa registrada',
    unable_to_sign: 'impossibilidade registrada',
    superseded: 'versão substituída',
    sync_failed: 'falha de sincronização',
  };
  return map[status] ?? status;
}

interface QeResumo {
  status: 'pendente' | 'aprovada' | 'devolvida';
  ciclo: number;
  nota: number | null;
  parecer: string | null;
}

export default function ResultadoScreen() {
  const { id, formularioId: formularioIdParam, nivelRisco: nivelParam, pontuacao: pontuacaoParam, municipio: municipioParam, treinamento } = useLocalSearchParams<{
    id: string; formularioId?: string; nivelRisco?: string; pontuacao?: string; municipio?: string; treinamento?: string;
  }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const { trainingProfile, isTrainingActive, isExpired, exit, revalidate, loading: trainingLoading } = useTraining();
  const activeProfile = trainingProfile || profile;
  const requestedTrainingMode = treinamento === '1' || (isTrainingActive && !!trainingProfile);
  const formalTrainingMode = requestedTrainingMode && isTrainingActive && !!trainingProfile;
  const isolatedMode = formalTrainingMode;
  const { isOnlineReal: isConnected } = useConnectivity();
  const { initReport } = useReport();
  const mountedRef = useRef(true);
  const generationLockRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [vistoria, setVistoria] = useState<ReturnType<typeof normalizar> | null>(null);
  const [acknowledgementHistory, setAcknowledgementHistory] = useState<ReturnType<typeof listAcknowledgementHistory>>([]);
  const [agentSignature, setAgentSignature] = useState<SignatureStroke[]>([]);
  const [agentSignatureImage, setAgentSignatureImage] = useState<string | null>(null);
  const [showAgentSignatureModal, setShowAgentSignatureModal] = useState(false);
  const [pendingGenerationAction, setPendingGenerationAction] = useState<'generate' | 'print' | 'share' | 'term' | null>(null);

  // Novo fluxo (set/2026): estado da QE, sheets de opções e modelo de relatório
  const [qe, setQe] = useState<QeResumo | null>(null);
  const [laudoSheetVisible, setLaudoSheetVisible] = useState(false);
  const [layoutSheetVisible, setLayoutSheetVisible] = useState(false);
  const [versionsSheetVisible, setVersionsSheetVisible] = useState(false);
  const [laudoLayout, setLaudoLayout] = useState<LaudoLayout>('ficha');
  const [lastPdfUri, setLastPdfUri] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(LAUDO_LAYOUT_STORAGE_KEY);
        if (saved && LAUDO_LAYOUTS.some(l => l.id === saved)) {
          setLaudoLayout(saved as LaudoLayout);
        }
      } catch {
        /* preferência de modelo é opcional */
      }
    })();
  }, []);

  // Status da revisão de qualidade desta vistoria (QE é retroativa; não bloqueia o fluxo)
  useEffect(() => {
    if (!id || isolatedMode) return;
    let ativo = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('qe_status_vistoria', { p_vistoria_id: id });
        if (ativo && !error && Array.isArray(data) && data.length > 0) {
          setQe(data[0] as QeResumo);
        }
      } catch {
        /* selo de QE é opcional */
      }
    })();
    return () => { ativo = false; };
  }, [id, isolatedMode]);

  // Modal Termo de Interdição
  const [showTermoModal, setShowTermoModal] = useState(false);
  const [termoNomeErro, setTermoNomeErro] = useState(false);
  const [termoForm, setTermoForm] = useState<TermoInterdicaoData>({
    nomeNotificado: '',
    cpfNotificado: '',
    enderecoRua: '',
    enderecoNumero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    telefone: '',
  });

  useEffect(() => {
    if (requestedTrainingMode && trainingLoading) return;
    mountedRef.current = true;
    loadDados();
    return () => { mountedRef.current = false; };
  }, [id, requestedTrainingMode, trainingLoading, profile?.uid]);

  const refreshAcknowledgementHistory = useCallback(() => {
    if (!vistoria?.id) {
      setAcknowledgementHistory([]);
      return;
    }
    setAcknowledgementHistory(listAcknowledgementHistory(vistoria.id));
  }, [vistoria?.id]);

  const populateReport = (v: ReturnType<typeof normalizar>, nome: string) => {
    if (!v) return;
    let respostas: Record<string, string> = {};
    try { respostas = JSON.parse(v.respostasJson || '{}'); } catch { /* noop */ }
    initReport({
      vistoriaId: v.id || '',
      protocolo: protocolDisplay(v.protocolo).value,
      endereco: v.endereco || '',
      municipio: v.municipio || '',
      agenteNome: nome,
      dataVistoria: v.dataVistoria || new Date().toISOString(),
      formularioId: v.formularioId || 'Padrão',
      nivelRisco: v.nivelRisco || 'r1',
      pontuacaoTotal: v.pontuacaoTotal ?? 0,
      calculoRisco: v.calculoRisco ?? null,
      respostas,
      foto_url: v.foto_url ?? v.fotosUrls?.[0] ?? null,
      fotosUrls: v.fotosUrls ?? (v.foto_url ? [v.foto_url] : null),
      modoTreinamento: isolatedMode,
      responsavelNome: v.responsavelNome ?? '',
      condutaRecomendada: '',
      observacoesTecnicas: '',
      cargo: 'Agente de Defesa Civil',
    });
  };

  const refreshEvidenceMedia = useCallback(async () => {
    if (!id) return;
    const localOwnerUid = trainingProfile?.uid;
    const local = isolatedMode && localOwnerUid
      ? getTrainingVistoriaById(id as string, localOwnerUid)
      : getOfficialVistoriaById(id as string);
    if (!local) return;
    const refreshed = await resolverMidias(normalizar(local));
    setVistoria((previous: any) => previous ? {
      ...previous,
      foto_url: refreshed.foto_url,
      fotosUrls: refreshed.fotosUrls,
    } : refreshed);
    populateReport(refreshed, refreshed.agenteNome || activeProfile?.name || '—');
  }, [id, isolatedMode, trainingProfile?.uid, activeProfile?.name]);

  useFocusEffect(useCallback(() => {
    refreshAcknowledgementHistory();
    void refreshEvidenceMedia();
  }, [refreshAcknowledgementHistory, refreshEvidenceMedia]));

  const loadDados = async () => {
    try {
      if (requestedTrainingMode) {
        if (!trainingProfile || !isTrainingActive || isExpired() || !(await revalidate())) {
          await exit();
          router.replace('/(auth)/treinamento');
          return;
        }

        const local = getTrainingVistoriaById(id as string, trainingProfile.uid);
        if (!local) {
          Alert.alert('Vistoria nao encontrada', 'Esta vistoria nao pertence ao treinamento ativo neste aparelho.');
          router.replace('/(panel)/treinamento');
          return;
        }
        if (local) {
          const norm = normalizar(local);
          setVistoria(norm);
          populateReport(norm, norm.agenteNome || activeProfile?.name || '—');
          prefillTermoForm(norm);
          return;
        }
      }

      // 1. Tentar Supabase
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, nivelRisco, pontuacaoTotal, calculoRisco, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, municipio_agente, dataVistoria, agenteNome, respostasJson, formularioId, responsavelNome, fotoUrl, fotosUrls, protocolo, laudo_url, laudo_gerado_em')
        .eq('id', id)
        .single();

      if (!error && data) {
        if (!mountedRef.current) return;
        const norm = await resolverMidias(normalizar(data));
        setVistoria(norm);
        populateReport(norm, norm.agenteNome || activeProfile?.name || '—');
        prefillTermoForm(norm);
        if (profile?.uid && !isolatedMode) {
          registrarAuditoria({
            acao: 'vistoria_acessada',
            adminUid: profile.uid,
            adminNome: profile.name || '—',
            adminRole: profile.role,
            municipio: norm.municipio || profile.municipio || '',
            organizationId: profile.organizationId ?? null,
            alvoId: norm.id,
          });
        }
        return;
      }

      // 2. Fallback: SQLite local
      const local = getOfficialVistoriaById(id as string);
      if (local) {
        const norm = await resolverMidias(normalizar(local));
        setVistoria(norm);
        populateReport(norm, norm.agenteNome || activeProfile?.name || '—');
        prefillTermoForm(norm);
        return;
      }

    } catch {
      if (requestedTrainingMode) {
        Alert.alert('Falha ao abrir vistoria', 'Nao foi possivel abrir esta vistoria de treinamento.');
        router.replace('/(panel)/treinamento');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  /** Pré-preenche os campos do modal do Termo de Interdição com dados da vistoria */
  const prefillTermoForm = (v: any) => {
    if (!v) return;
    setTermoForm(prev => ({
      ...prev,
      nomeNotificado: v.responsavelNome || '',
      enderecoRua: v.enderecoRua || '',
      enderecoNumero: v.enderecoNumero || '',
      bairro: v.enderecoBairro || '',
      cidade: v.municipio || '',
    }));
  };

  const buildDados = (agentSignatureStrokes: SignatureStroke[] | null = agentSignature): LaudoData => ({
    id: vistoria?.id || '',
    protocolo: protocolDisplay(vistoria?.protocolo).value,
    nivelRisco: vistoria?.nivelRisco || 'r1',
    pontuacaoTotal: vistoria?.pontuacaoTotal ?? 0,
    endereco: vistoria?.endereco || '—',
    municipio: vistoria?.municipio || '—',
    dataVistoria: vistoria?.dataVistoria || null,
    agenteNome: vistoria?.agenteNome || activeProfile?.name || '—',
    formularioId: vistoria?.formularioId || 'Padrão',
    respostasJson: vistoria?.respostasJson || '{}',
    calculoRisco: vistoria?.calculoRisco ?? null,
    foto_url: vistoria?.foto_url ?? (vistoria?.fotosUrls?.[0] ?? null),
    fotosUrls: vistoria?.fotosUrls ?? (vistoria?.foto_url ? [vistoria.foto_url] : null),
    modoTreinamento: isolatedMode,
    layout: laudoLayout,
    agentSignatureStrokes,
    agentSignatureImageBase64: agentSignatureImage,
  });

  const ensureTrainingActionsAllowed = async () => {
    if (!formalTrainingMode) return true;
    if (!isExpired() && await revalidate()) return true;
    await exit();
    Alert.alert('Treinamento encerrado', 'O prazo desta turma terminou. O acesso ao modo treinamento foi bloqueado.');
    router.replace('/(auth)/treinamento');
    return false;
  };

  const salvarLaudoNoStorage = async (uri: string) => {
    if (isolatedMode || !vistoria?.id) return;
    const agora = new Date().toISOString();
    if (!isConnected) {
      queueLaudoUpload(vistoria.id, uri, agora);
      setVistoria((prev: any) => prev ? { ...prev, laudo_gerado_em: agora } : prev);
      return;
    }
    const municipio = vistoria.municipio || municipioParam || activeProfile?.municipio || 'geral';
    const laudoUrl = await uploadLaudoPdf(uri, vistoria.id, municipio);
    if (laudoUrl) {
      updateLaudoUrl(vistoria.id, laudoUrl, agora);
      const storedPath = laudoUrl.startsWith('laudos:') ? laudoUrl.slice('laudos:'.length) : laudoUrl;
      const { error } = await supabase.rpc('finalize_inspection_laudo_generation', {
        p_inspection_id: vistoria.id,
        p_storage_path: storedPath,
        p_generated_at: agora,
      });
      if (!error) void syncPendentes().catch(() => null);
      setVistoria((prev: any) => prev ? { ...prev, laudo_url: laudoUrl, laudo_gerado_em: agora } : prev);
    } else {
      queueLaudoUpload(vistoria.id, uri, agora);
    }
  };

  const laudoExpirado = (): boolean => {
    if (!vistoria?.laudo_gerado_em) return false;
    const geradoEm = new Date(vistoria.laudo_gerado_em).getTime();
    return (Date.now() - geradoEm) / (1000 * 60 * 60 * 24) >= 7;
  };

  const prepararCiencia = async (
    documentType: GeneratedDocumentType,
    payload: object,
    html: string,
    uri: string
  ) => {
    if (!vistoria?.id || !activeProfile?.uid || !isAcknowledgementEnabled(documentType, profile?.organizationId, isolatedMode)) {
      return { documentId: null, errorCode: null, errorMessage: null, enabled: false };
    }
    try {
      const document = await prepareGeneratedDocument({
        vistoriaId: vistoria.id,
        documentType,
        templateVersion: DOCUMENT_TEMPLATE_VERSIONS[documentType],
        payload,
        pdfUri: uri,
        previewHtml: html,
        createdBy: activeProfile.uid,
        trainingMode: isolatedMode,
      });
      refreshAcknowledgementHistory();
      return { documentId: document.id, errorCode: null, errorMessage: null, enabled: true };
    } catch (error) {
      logger.warn('vistoria', 'Documento gerado sem preparar ciência eletrônica', {
        documentType,
        vistoriaId: vistoria.id,
        erro: error instanceof Error ? error.message : String(error),
      });
      return {
        documentId: null,
        errorCode: 'local_preparation_failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        enabled: true,
      };
    }
  };

  /**
   * Após gerar o PDF: a ciência NÃO é cobrada aqui — virou um passo próprio
   * e visível na tela (linha "Ciência do morador"). Só bloqueia quando a
   * versão do documento não pôde ser preservada localmente.
   */
  const liberarPdfGerado = async (
    result: Awaited<ReturnType<typeof prepararCiencia>>,
    liberar: () => Promise<unknown>,
  ) => {
    const decision = resolveDocumentRelease(result);
    if (decision === 'blocked') {
      Alert.alert(
        'Documento não liberado',
        'A versão usada na geração não foi preservada. Tente gerar novamente.',
      );
      return;
    }
    await liberar();
  };

  const gerarPdf = async (agentSignatureStrokes?: SignatureStroke[]) => {
    if (generationLockRef.current) return;
    generationLockRef.current = true;
    try {
      if (!(await ensureTrainingActionsAllowed())) return;

      if (profile?.uid && !isolatedMode) {
        const { allowed, message } = await checkRateLimit('gerar_pdf');
        if (!allowed) {
          Alert.alert('Limite atingido', message || 'Muitas gerações de PDF. Aguarde alguns minutos.');
          return;
        }
      }

      setGerando(true);
      const dados = buildDados(agentSignatureStrokes);
      const html = await buildLaudoHtml(dados);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const acknowledgementDocument = await prepararCiencia('report', dados, html, uri);
      setLastPdfUri(uri);

      // O PDF completo do app é a cópia oficial enviada ao Storage.
      salvarLaudoNoStorage(uri).catch(() => null);

      if (profile?.uid && !isolatedMode) {
        registrarAuditoria({
          acao: 'laudo_gerado',
          adminUid: profile.uid,
          adminNome: profile.name || '—',
          adminRole: profile.role,
            municipio: vistoria?.municipio || profile.municipio || '',
            organizationId: profile.organizationId ?? null,
            alvoId: vistoria?.id,
          detalhes: { protocolo: vistoria?.protocolo, nivel_risco: vistoria?.nivelRisco, layout: laudoLayout },
        });
      }

      await liberarPdfGerado(acknowledgementDocument, async () => {
        const disponivel = await Sharing.isAvailableAsync();
        if (disponivel) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'TCS — Relatório de Risco',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF Gerado', `Arquivo salvo em:\n${uri}`);
        }
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
      generationLockRef.current = false;
    }
  };

  const imprimir = async (agentSignatureStrokes?: SignatureStroke[]) => {
    if (!(await ensureTrainingActionsAllowed())) return;

    // Reaproveita o arquivo gerado nesta sessão — sem pedir assinatura de novo
    // e sem criar versão nova do documento.
    if (lastPdfUri) {
      setGerando(true);
      try {
        await Print.printAsync({ uri: lastPdfUri });
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir a impressão.');
      } finally {
        setGerando(false);
      }
      return;
    }

    setGerando(true);
    try {
      const dados = buildDados(agentSignatureStrokes);
      const html = await buildLaudoHtml(dados);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const acknowledgementDocument = await prepararCiencia('report', dados, html, uri);
      setLastPdfUri(uri);
      salvarLaudoNoStorage(uri).catch(() => null);
      await liberarPdfGerado(acknowledgementDocument, () => Print.printAsync({ html }));
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a impressão.');
    } finally {
      setGerando(false);
    }
  };

  const compartilhar = async (agentSignatureStrokes?: SignatureStroke[]) => {
    if (!(await ensureTrainingActionsAllowed())) return;

    // Reaproveita o arquivo gerado nesta sessão — sem nova assinatura/versão.
    if (lastPdfUri) {
      setGerando(true);
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(lastPdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: `TCS — ${protocolDisplay(vistoria?.protocolo).value}`,
            UTI: 'com.adobe.pdf',
          });
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível compartilhar o laudo.');
      } finally {
        setGerando(false);
      }
      return;
    }

    setGerando(true);
    try {
      const dados = buildDados(agentSignatureStrokes);
      const html = await buildLaudoHtml(dados);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const acknowledgementDocument = await prepararCiencia('report', dados, html, uri);
      setLastPdfUri(uri);

      const protocolo = protocolDisplay(vistoria?.protocolo).value;
      const mensagem = buildShareMessage({
        protocolo,
        endereco: vistoria?.endereco || 'Endereço não informado',
        municipio: vistoria?.municipio || municipioParam || '',
        municipio_agente: vistoria?.municipio_agente ?? null,
        nivelRisco: vistoria?.nivelRisco || 'r1',
        formularioId: vistoria?.formularioId,
        formularioTitulo: vistoria?.formularioId === 'avaliacao_arvore_cbmmg_v1' ? 'Avaliação de Árvore de Risco - CBMMG' : undefined,
        pontuacaoTotal: vistoria?.pontuacaoTotal,
        calculoRisco: vistoria?.calculoRisco,
        agenteNome: vistoria?.agenteNome || activeProfile?.name || 'Agente',
        dataVistoria: vistoria?.dataVistoria || new Date().toISOString(),
      });

      // Upload para Storage em background
      salvarLaudoNoStorage(uri).catch(() => null);

      await liberarPdfGerado(acknowledgementDocument, async () => {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `TCS — ${protocolo}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          await Share.share({ message: mensagem, title: 'TCS — Relatório de Risco' });
        }
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o laudo.');
    } finally {
      setGerando(false);
    }
  };

  /** Gera o Termo de Interdição */
  const gerarTermoInterdicao = async (agentSignatureStrokes?: SignatureStroke[]) => {
    if (!(await ensureTrainingActionsAllowed())) return;

    if (!termoForm.nomeNotificado.trim()) {
      // Não usar Alert dentro de Modal no Android — usar estado inline
      setTermoNomeErro(true);
      return;
    }
    setTermoNomeErro(false);
    setShowTermoModal(false);
    // Aguardar modal fechar antes de iniciar a geração
    await new Promise(resolve => setTimeout(resolve, 300));
    setGerando(true);
    try {
      const dados = buildDados(agentSignatureStrokes);
      const html = buildTermoInterdicaoHtml(dados, termoForm);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const acknowledgementDocument = await prepararCiencia('interdiction_term', { ...dados, notified: termoForm }, html, uri);
      await liberarPdfGerado(acknowledgementDocument, async () => {
        const disponivel = await Sharing.isAvailableAsync();
        if (disponivel) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'TCS — Termo de Interdição',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF Gerado', `Termo de Interdição salvo em:\n${uri}`);
        }
      });
    } catch (error) {
      logger.error('vistoria', 'Erro ao gerar Termo de Interdição', {
        vistoriaId: vistoria?.id,
        erro: error instanceof Error ? error.message : String(error),
      });
      Alert.alert('Erro', 'Não foi possível gerar o Termo de Interdição.');
    } finally {
      setGerando(false);
    }
  };

  /** Ações de documento passam por aqui: assinatura do agente é pedida só 1x por sessão da tela. */
  const executarAcaoDocumento = async (
    action: 'generate' | 'print' | 'share' | 'term',
    strokes: SignatureStroke[],
  ) => {
    if (action === 'generate') await gerarPdf(strokes);
    else if (action === 'print') await imprimir(strokes);
    else if (action === 'share') await compartilhar(strokes);
    else if (action === 'term') await gerarTermoInterdicao(strokes);
  };

  const solicitarAssinaturaAgente = (action: 'generate' | 'print' | 'share' | 'term') => {
    if (gerando) return;
    if (agentSignature.length > 0 || agentSignatureImage) {
      void executarAcaoDocumento(action, agentSignature);
      return;
    }
    setPendingGenerationAction(action);
    setShowAgentSignatureModal(true);
  };

  const abrirCopiaSalva = useCallback(() => {
    if (vistoria?.laudo_url) void Linking.openURL(vistoria.laudo_url);
  }, [vistoria?.laudo_url]);

  /**
   * Limitador de geração (aprovado em set/2026):
   * - Primeira geração: livre.
   * - Já existe PDF: avisa para salvar/enviar o arquivo atual.
   * - Dentro da janela de 15 min: bloqueia e aponta a cópia salva.
   */
  const iniciarGeracaoLaudo = () => {
    const geradoEmMs = vistoria?.laudo_gerado_em ? new Date(vistoria.laudo_gerado_em).getTime() : null;
    if (geradoEmMs) {
      const liberaEm = geradoEmMs + PDF_COOLDOWN_MINUTES * 60_000;
      if (Date.now() < liberaEm) {
        Alert.alert(
          'PDF recém-gerado',
          `Este documento foi gerado às ${formatarHora(vistoria?.laudo_gerado_em)}. Salve ou envie o arquivo atual antes de criar outro — a próxima geração libera às ${formatarHora(new Date(liberaEm).toISOString())}.`,
          [
            ...(vistoria?.laudo_url && !laudoExpirado()
              ? [{ text: 'Abrir cópia salva', onPress: abrirCopiaSalva }]
              : []),
            { text: 'Entendi', style: 'cancel' as const },
          ],
        );
        return;
      }
      Alert.alert(
        'Gerar nova versão',
        'Salve ou envie o PDF atual antes de continuar. A nova geração cria uma versão oficial e a anterior sai de circulação.',
        [
          { text: 'Cancelar', style: 'cancel' as const },
          { text: 'Escolher modelo e gerar', onPress: () => setLayoutSheetVisible(true) },
        ],
      );
      return;
    }
    setLayoutSheetVisible(true);
  };

  const escolherLayoutEGerar = (layout: LaudoLayout) => {
    setLaudoLayout(layout);
    void AsyncStorage.setItem(LAUDO_LAYOUT_STORAGE_KEY, layout).catch(() => null);
    setLayoutSheetVisible(false);
    solicitarAssinaturaAgente('generate');
  };

  const abrirCiencia = () => {
    if (acknowledgementRequiresInspectionSync) {
      void sincronizarVistoriaAntesDaCiencia();
      return;
    }
    if (activeReportAcknowledgement) {
      router.push(`/(panel)/inspecoes/ciencia?documentId=${activeReportAcknowledgement.document.id}`);
      return;
    }
    Alert.alert(
      'Laudo ainda não gerado',
      'Gere o PDF do laudo primeiro — a ciência do morador é coletada sobre a versão oficial.',
    );
  };

  const sincronizarVistoriaAntesDaCiencia = async () => {
    if (!isConnected) {
      Alert.alert('Conexão necessária', 'Conecte-se à internet para sincronizar a vistoria antes de coletar a ciência.');
      return;
    }
    setGerando(true);
    try {
      const resultado = await syncPendentes();
      await loadDados();
      if (resultado.falha > 0) {
        Alert.alert('Sincronização pendente', 'A vistoria ainda não foi enviada ao servidor. Revise a conexão e tente novamente.');
        return;
      }
      Alert.alert('Vistoria sincronizada', 'A vistoria foi enviada ao servidor. Toque novamente para gerar o documento e coletar a ciência.');
    } catch {
      Alert.alert('Não foi possível sincronizar', 'Tente novamente quando houver conexão estável.');
    } finally {
      setGerando(false);
    }
  };

  const escolherAssinaturaDaGaleria = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso às fotos para escolher a imagem da assinatura.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.9,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    const mimeType = ['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType || '')
      ? asset.mimeType!
      : 'image/jpeg';
    setAgentSignatureImage(`data:${mimeType};base64,${asset.base64}`);
    setAgentSignature([]);
  };

  const confirmarAssinaturaAgente = () => {
    if (agentSignature.length === 0 && !agentSignatureImage) {
      Alert.alert('Assinatura necessária', 'O agente responsável deve assinar antes da emissão deste documento.');
      return;
    }
    const action = pendingGenerationAction;
    const signatureForDocument = agentSignature;
    setShowAgentSignatureModal(false);
    setPendingGenerationAction(null);
    if (action) void executarAcaoDocumento(action, signatureForDocument);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState message="Preparando o resultado da vistoria..." />
      </View>
    );
  }

  if (!vistoria) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ErrorState
          title="Não foi possível abrir a vistoria"
          message="O registro não foi encontrado no servidor nem no armazenamento offline deste aparelho."
          onRetry={() => {
            setLoading(true);
            void loadDados();
          }}
        />
      </View>
    );
  }

  const nivel = normalizarNivelRisco(vistoria?.nivelRisco || nivelParam, 'r1');
  const apresentacao = resolverApresentacaoRisco({
    formularioId: vistoria?.formularioId || formularioIdParam,
    pontuacao: vistoria?.pontuacaoTotal ?? Number(pontuacaoParam || 0),
    nivelRisco: nivel,
    calculoRisco: vistoria?.calculoRisco,
  });
  const cor = apresentacao.cor;
  const label = apresentacao.label;
  const riskVariant = nivel.toUpperCase() as 'R1' | 'R2' | 'R3' | 'R4';
  const isAvaliacaoArvore = (vistoria?.formularioId || formularioIdParam) === 'avaliacao_arvore_cbmmg_v1';
  const isAltoRisco = nivel === 'r3' || nivel === 'r4';
  const currentAcknowledgements = acknowledgementHistory.filter(item => item.document.status !== 'superseded');
  const activeReportAcknowledgement = currentAcknowledgements.find(item => item.document.documentType === 'report') ?? null;
  const acknowledgementRequiresInspectionSync = !isolatedMode && !vistoria?.protocolo;
  const displayedEvidence = Array.from(new Set([
    vistoria?.foto_url,
    ...(vistoria?.fotosUrls ?? []),
  ].filter((value): value is string => Boolean(value))));

  // ── Resumo de andamento (QE + ciência) para a timeline ──
  const activeTermoAcknowledgement = currentAcknowledgements.find(
    item => item.document.documentType === 'interdiction_term',
  ) ?? null;

  const qeLinha: { icon: keyof typeof Feather.glyphMap; detail: string; tone: 'done' | 'pending' | 'warning' | 'muted' } = (() => {
    if (isolatedMode) return { icon: 'clock', detail: 'Não se aplica ao modo treinamento', tone: 'muted' };
    if (!qe) return { icon: 'clock', detail: 'Verificando status da revisão…', tone: 'muted' };
    if (qe.status === 'pendente') return { icon: 'clock', detail: 'Na fila do supervisor — não bloqueia seu trabalho', tone: 'pending' };
    if (qe.status === 'aprovada') return { icon: 'check-circle', detail: `Aprovada${qe.nota != null ? ` · nota ${qe.nota}/10` : ''}`, tone: 'done' };
    return { icon: 'rotate-ccw', detail: `Devolvida para correção${qe.ciclo > 1 ? ` · ciclo ${qe.ciclo}` : ''}`, tone: 'warning' };
  })();

  const cienciaStatus = activeReportAcknowledgement?.historyStatus ?? null;
  const cienciaLinha: { icon: keyof typeof Feather.glyphMap; detail: string; tone: 'done' | 'pending' | 'warning' | 'muted' } = (() => {
    if (acknowledgementRequiresInspectionSync) {
      return { icon: 'upload-cloud', detail: 'Sincronize a vistoria para liberar a coleta', tone: 'muted' };
    }
    if (!activeReportAcknowledgement) {
      return { icon: 'circle', detail: 'Disponível após gerar o laudo', tone: 'pending' };
    }
    if (cienciaStatus === 'confirmed') return { icon: 'check-circle', detail: 'Coletada e confirmada', tone: 'done' };
    if (cienciaStatus === 'refused') return { icon: 'check-circle', detail: 'Recusa registrada', tone: 'done' };
    if (cienciaStatus === 'unable_to_sign') return { icon: 'check-circle', detail: 'Impossibilidade registrada', tone: 'done' };
    if (cienciaStatus === 'pending_sync') return { icon: 'upload-cloud', detail: 'Coletada — aguardando sincronização', tone: 'pending' };
    if (cienciaStatus === 'sync_failed') return { icon: 'alert-circle', detail: 'Falha na sincronização — toque para revisar', tone: 'warning' };
    return { icon: 'circle', detail: 'Pendente — colete com o morador', tone: 'pending' };
  })();

  const cienciaBadge = !activeReportAcknowledgement
    ? undefined
    : cienciaStatus === 'confirmed'
      ? 'Coletada'
      : 'Pendente';
  const cienciaBadgeVariant = cienciaStatus === 'confirmed' ? 'success' as const : 'neutral' as const;

  const versaoAtual = activeReportAcknowledgement?.document.documentVersion ?? null;
  const laudoSubtitulo = vistoria?.laudo_gerado_em
    ? `Gerado ${formatarDataCurta(vistoria.laudo_gerado_em)} às ${formatarHora(vistoria.laudo_gerado_em)}${versaoAtual ? ` · versão ${versaoAtual}` : ''}`
    : 'Não gerado ainda — toque para ver as opções';

  // CPF mask
  const handleCpfChange = (t: string) => {
    const limpo = t.replace(/\D/g, '').substring(0, 11);
    let formatted = limpo;
    if (limpo.length > 9) formatted = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
    else if (limpo.length > 6) formatted = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
    else if (limpo.length > 3) formatted = `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
    setTermoForm(f => ({ ...f, cpfNotificado: formatted }));
  };

  // Phone mask
  const handlePhoneChange = (t: string) => {
    const limpo = t.replace(/\D/g, '').substring(0, 11);
    let formatted = limpo;
    if (limpo.length > 6) formatted = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    else if (limpo.length > 2) formatted = `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    setTermoForm(f => ({ ...f, telefone: formatted }));
  };

  // ── Opções do dropdown do laudo ──
  const laudoSheetOptions = (() => {
    const opts: {
      key: string;
      title: string;
      subtitle?: string;
      icon: React.ComponentProps<typeof Feather>['name'];
    }[] = [];
    if (!vistoria?.laudo_gerado_em) {
      opts.push({ key: 'gerar', title: 'Gerar PDF', subtitle: 'Escolher o modelo e assinar', icon: 'file-text' });
    } else {
      if (vistoria.laudo_url && !laudoExpirado()) {
        opts.push({ key: 'abrir', title: 'Abrir cópia salva', subtitle: `Gerada às ${formatarHora(vistoria.laudo_gerado_em)}`, icon: 'download' });
      }
      opts.push({ key: 'imprimir', title: 'Imprimir', subtitle: lastPdfUri ? 'Usa o arquivo gerado agora' : 'Gera e imprime', icon: 'printer' });
      opts.push({ key: 'compartilhar', title: 'Compartilhar', subtitle: 'WhatsApp, e-mail e outros', icon: 'share-2' });
      opts.push({ key: 'nova_versao', title: 'Gerar nova versão', subtitle: `Limite: 1 geração a cada ${PDF_COOLDOWN_MINUTES} min`, icon: 'refresh-cw' });
    }
    if (acknowledgementHistory.length > 0) {
      opts.push({ key: 'versoes', title: 'Histórico de versões', subtitle: `${acknowledgementHistory.length} versão(ões) registrada(s)`, icon: 'clock' });
    }
    return opts;
  })();

  const onLaudoSheetSelect = (key: string) => {
    setLaudoSheetVisible(false);
    if (key === 'gerar' || key === 'nova_versao') iniciarGeracaoLaudo();
    else if (key === 'abrir') abrirCopiaSalva();
    else if (key === 'imprimir') solicitarAssinaturaAgente('print');
    else if (key === 'compartilhar') solicitarAssinaturaAgente('share');
    else if (key === 'versoes') setVersionsSheetVisible(true);
  };

  // ── Opções do sheet de versões ──
  const versionsOptions = acknowledgementHistory.map(item => ({
    key: item.document.id,
    title: `Versão ${item.document.documentVersion} · ${item.document.documentType === 'interdiction_term' ? 'Termo de interdição' : item.document.documentType === 'technical_report' ? 'Relatório técnico' : 'Laudo'}`,
    subtitle: `${formatarDataCurta(item.document.createdAtDevice)} às ${formatarHora(item.document.createdAtDevice)} · ${statusCienciaLabel(item.historyStatus)}`,
    icon: (item.document.status === 'superseded' ? 'archive' : 'file-text') as 'archive' | 'file-text',
    selected: item.document.status !== 'superseded',
  }));

  const onVersionSelect = (key: string) => {
    setVersionsSheetVisible(false);
    const item = acknowledgementHistory.find(h => h.document.id === key);
    if (item && item.document.status !== 'superseded') {
      router.push(`/(panel)/inspecoes/ciencia?documentId=${item.document.id}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Resultado da vistoria"
        subtitle={protocolDisplay(vistoria?.protocolo).value}
        onBack={() => safeBack(formalTrainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes')}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
        {/* RESUMO — só o selo de risco mantém cor semântica; resto neutro */}
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.summaryTopRow}>
            <Badge label={isAvaliacaoArvore ? label : `Risco ${label}`} variant={riskVariant} showDot />
            <Text style={[styles.summaryPoints, { color: theme.textSecondary }]}>
              {formatarPontuacaoRisco(vistoria?.pontuacaoTotal ?? 0)} pontos
            </Text>
          </View>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>Vistoria concluída</Text>
          <Text style={[styles.summaryAddress, { color: theme.text }]}>
            {vistoria?.endereco || 'Endereço não informado'}
          </Text>
          <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
            {(vistoria?.agenteNome || activeProfile?.name || 'Agente responsável')}
            {' · '}
            {formatarDataCurta(vistoria?.dataVistoria ?? null)} às {formatarHora(vistoria?.dataVistoria ?? null)}
          </Text>
        </View>

        {/* ANDAMENTO — timeline do processo (QE é retroativa, nunca bloqueia) */}
        <SectionHeader title="Andamento" />
        <View style={[styles.timelineCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.timelineRow}>
            <View style={[styles.timelineIcon, { backgroundColor: theme.successLight }]}>
              <Feather name="check" size={15} color={theme.success} />
            </View>
            <View style={styles.timelineCopy}>
              <Text style={[styles.timelineTitle, { color: theme.text }]}>Vistoria salva</Text>
              <Text style={[styles.timelineDetail, { color: theme.textSecondary }]}>Registro concluído e preservado</Text>
            </View>
          </View>

          <View style={[styles.timelineConnector, { backgroundColor: theme.border }]} />
          <View style={styles.timelineRow}>
            <View style={[styles.timelineIcon, { backgroundColor: qeLinha.tone === 'done' ? theme.successLight : theme.iconBackground }]}>
              <Feather
                name={qeLinha.icon}
                size={15}
                color={qeLinha.tone === 'done' ? theme.success : theme.textSecondary}
              />
            </View>
            <View style={styles.timelineCopy}>
              <Text style={[styles.timelineTitle, { color: theme.text }]}>Revisão de qualidade</Text>
              <Text style={[styles.timelineDetail, { color: qeLinha.tone === 'warning' ? theme.warning : theme.textSecondary }]}>
                {qeLinha.detail}
              </Text>
              {qe?.status === 'devolvida' && qe.parecer ? (
                <Text style={[styles.timelineNote, { color: theme.warning }]}>Parecer: {qe.parecer}</Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.timelineConnector, { backgroundColor: theme.border }]} />
          <View style={styles.timelineRow}>
            <View style={[styles.timelineIcon, { backgroundColor: cienciaLinha.tone === 'done' ? theme.successLight : theme.iconBackground }]}>
              <Feather
                name={cienciaLinha.icon}
                size={15}
                color={cienciaLinha.tone === 'done' ? theme.success : theme.textSecondary}
              />
            </View>
            <View style={styles.timelineCopy}>
              <Text style={[styles.timelineTitle, { color: theme.text }]}>Ciência do morador</Text>
              <Text style={[styles.timelineDetail, { color: theme.textSecondary }]}>{cienciaLinha.detail}</Text>
            </View>
          </View>
        </View>

        {isAvaliacaoArvore && (
          <View style={[styles.condutaCard, { backgroundColor: `${cor}12`, borderColor: cor }]}>
            <Feather name={apresentacao.codigo === 'risco_iminente' ? 'alert-triangle' : 'clipboard'} size={20} color={cor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.condutaTitle, { color: cor }]}>Conduta metodológica</Text>
              <Text style={[styles.condutaText, { color: theme.text }]}>{apresentacao.conduta}</Text>
            </View>
          </View>
        )}

        {/* DOCUMENTOS — ações reunidas em dropdown (OptionSheet) */}
        <SectionHeader title="Documentos" subtitle="Gerar, abrir, imprimir ou compartilhar" />
        <TouchableOpacity
          style={[styles.docCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
          onPress={() => setLaudoSheetVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Abrir opções do laudo técnico"
          disabled={gerando}
        >
          <View style={[styles.docIcon, { backgroundColor: theme.iconBackground }]}>
            {gerando
              ? <ActivityIndicator size="small" color={theme.textSecondary} />
              : <Feather name="file-text" size={19} color={theme.text} />}
          </View>
          <View style={styles.docCopy}>
            <Text style={[styles.docTitle, { color: theme.text }]}>Laudo técnico (PDF)</Text>
            <Text style={[styles.docSub, { color: theme.textSecondary }]}>{laudoSubtitulo}</Text>
          </View>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {isAltoRisco && !isAvaliacaoArvore && (
          <TouchableOpacity
            style={[styles.docCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
            onPress={() => setShowTermoModal(true)}
            disabled={gerando}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={[styles.docIcon, { backgroundColor: theme.errorLight }]}>
              <Feather name="alert-triangle" size={17} color={theme.error} />
            </View>
            <View style={styles.docCopy}>
              <Text style={[styles.docTitle, { color: theme.text }]}>Termo de interdição</Text>
              <Text style={[styles.docSub, { color: theme.textSecondary }]}>Documento oficial — risco {label}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* REGISTRO */}
        <SectionHeader title="Registro" subtitle="Revisão, ciência e evidências" />
        <View style={styles.registroGroup}>
          <ListRow
            title="Revisar relatório técnico"
            subtitle="Editar textos e personalizar o documento"
            icon="edit-3"
            onPress={() => router.push('/(panel)/inspecoes/relatorio')}
          />
          <ListRow
            title="Ciência do morador"
            subtitle={cienciaLinha.detail}
            badge={cienciaBadge}
            badgeVariant={cienciaBadgeVariant}
            icon="check-square"
            onPress={abrirCiencia}
          />
          {activeTermoAcknowledgement && (
            <ListRow
              title={`Ciência do termo · versão ${activeTermoAcknowledgement.document.documentVersion}`}
              subtitle={statusCienciaLabel(activeTermoAcknowledgement.historyStatus)}
              icon="check-square"
              onPress={() => router.push(`/(panel)/inspecoes/ciencia?documentId=${activeTermoAcknowledgement.document.id}`)}
            />
          )}
          {!formalTrainingMode && (
            <View style={styles.evidenceBlock}>
              <ListRow
                title="Evidências fotográficas"
                subtitle={displayedEvidence.length > 0
                  ? `${displayedEvidence.length} de 3 fotos registradas`
                  : 'Adicionar fotos que sustentem a avaliação'}
                icon="camera"
                badge={displayedEvidence.length ? String(displayedEvidence.length) : undefined}
                onPress={() => router.push({ pathname: '/(panel)/inspecoes/foto', params: { id } })}
              />
              {displayedEvidence.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceStrip}>
                  {displayedEvidence.map((uri, index) => (
                    <TouchableOpacity
                      key={`${uri}-${index}`}
                      onPress={() => router.push({ pathname: '/(panel)/inspecoes/foto', params: { id } })}
                    >
                      <Image source={{ uri }} style={styles.evidenceThumb} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
        <Button
          label="Concluir e voltar ao painel"
          onPress={() => router.replace(formalTrainingMode ? '/(panel)/treinamento' : '/(panel)/dashboard')}
          iconLeft={<Feather name="home" size={18} color={theme.onPrimary} />}
          fullWidth
        />
      </View>

      {/* Dropdown de ações do laudo */}
      <OptionSheet
        visible={laudoSheetVisible}
        title="Laudo técnico (PDF)"
        description={laudoSubtitulo}
        options={laudoSheetOptions}
        onSelect={onLaudoSheetSelect}
        onDismiss={() => setLaudoSheetVisible(false)}
      />

      {/* Escolha do modelo do relatório (persistida no aparelho) */}
      <OptionSheet
        visible={layoutSheetVisible}
        title="Modelo do relatório"
        description="Vale para este PDF; a escolha fica salva neste aparelho."
        options={LAUDO_LAYOUTS.map(l => ({
          key: l.id,
          title: l.titulo,
          subtitle: l.descricao,
          icon: 'layout' as const,
          selected: laudoLayout === l.id,
        }))}
        onSelect={key => escolherLayoutEGerar(key as LaudoLayout)}
        onDismiss={() => setLayoutSheetVisible(false)}
      />

      {/* Histórico de versões do documento */}
      <OptionSheet
        visible={versionsSheetVisible}
        title="Versões do documento"
        description="Cada geração com mudança de conteúdo cria uma versão; a ciência fica presa à versão coletada."
        options={versionsOptions}
        onSelect={onVersionSelect}
        onDismiss={() => setVersionsSheetVisible(false)}
      />

      {/* ═══════════════ MODAL TERMO DE INTERDIÇÃO ═══════════════ */}
      <Modal visible={showTermoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKav}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.surfaceHighlight }]}>
              {/* Header do Modal */}
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <View style={styles.modalHeaderIcon}>
                  <Feather name="alert-triangle" size={20} color={theme.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Termo de Interdição</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Preencha os dados do notificado
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowTermoModal(false)}>
                  <Feather name="x" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Nome do Notificado *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.background, borderColor: termoNomeErro ? theme.error : theme.border, color: theme.text }]}
                  placeholder="Nome completo"
                  placeholderTextColor={theme.textSecondary}
                  value={termoForm.nomeNotificado}
                  onChangeText={t => { setTermoForm(f => ({ ...f, nomeNotificado: t })); setTermoNomeErro(false); }}
                />
                {termoNomeErro && (
                  <Text style={{ color: theme.error, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                    Campo obrigatório
                  </Text>
                )}

                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>CPF</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="000.000.000-00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  maxLength={14}
                  value={termoForm.cpfNotificado}
                  onChangeText={handleCpfChange}
                />

                <View style={styles.modalRow}>
                  <View style={{ flex: 3 }}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Rua</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Logradouro"
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.enderecoRua}
                      onChangeText={t => setTermoForm(f => ({ ...f, enderecoRua: t }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Nº</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Nº"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={termoForm.enderecoNumero}
                      onChangeText={t => setTermoForm(f => ({ ...f, enderecoNumero: t }))}
                    />
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Complemento</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Apto, Bloco..."
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.complemento}
                      onChangeText={t => setTermoForm(f => ({ ...f, complemento: t }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Bairro</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Bairro"
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.bairro}
                      onChangeText={t => setTermoForm(f => ({ ...f, bairro: t }))}
                    />
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Cidade</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Município"
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.cidade}
                      onChangeText={t => setTermoForm(f => ({ ...f, cidade: t }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Telefone</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="(00) 00000-0000"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="phone-pad"
                      maxLength={15}
                      value={termoForm.telefone}
                      onChangeText={handlePhoneChange}
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Ações do Modal */}
              <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowTermoModal(false)}
                >
                  <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalGerarBtn, { backgroundColor: theme.error }]}
                  onPress={() => solicitarAssinaturaAgente('term')}
                >
                  <Feather name="file-text" size={18} color="#FFF" />
                  <Text style={styles.modalGerarText}>Gerar Termo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showAgentSignatureModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAgentSignatureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKav}>
            <View style={[styles.signatureModalCard, { backgroundColor: theme.surfaceHighlight }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: theme.secondary }]}>
                  <Feather name="edit-3" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Assinatura do agente</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Será incorporada à versão imutável do documento.</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAgentSignatureModal(false)} accessibilityLabel="Fechar">
                  <Feather name="x" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.signatureModalContent}>
                <Text style={[styles.signatureNotice, { color: theme.textSecondary }]}>Assine como agente responsável pela vistoria antes de gerar, imprimir ou compartilhar.</Text>
                {agentSignatureImage ? (
                  <View style={[styles.signatureImagePreview, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <Image source={{ uri: agentSignatureImage }} style={styles.signatureImage} resizeMode="contain" />
                  </View>
                ) : (
                  <SignaturePad
                    value={agentSignature}
                    onChange={(value) => {
                      if (value.length > 0) setAgentSignatureImage(null);
                      setAgentSignature(value);
                    }}
                    color={theme.text}
                    borderColor={theme.border}
                    backgroundColor={theme.background}
                    textColor={theme.textSecondary}
                  />
                )}
                <View style={styles.signatureSourceActions}>
                  <TouchableOpacity
                    style={[styles.signatureSourceButton, { borderColor: theme.border }]}
                    onPress={() => void escolherAssinaturaDaGaleria()}
                  >
                    <Feather name="image" size={16} color={theme.primary} />
                    <Text style={[styles.signatureSourceText, { color: theme.primary }]}>Usar imagem da assinatura</Text>
                  </TouchableOpacity>
                  {agentSignatureImage && (
                    <TouchableOpacity
                      style={[styles.signatureSourceButton, { borderColor: theme.border }]}
                      onPress={() => setAgentSignatureImage(null)}
                    >
                      <Feather name="edit-3" size={16} color={theme.textSecondary} />
                      <Text style={[styles.signatureSourceText, { color: theme.textSecondary }]}>Assinar à mão</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
                <Button label="Cancelar" variant="ghost" onPress={() => setShowAgentSignatureModal(false)} style={{ flex: 1 }} />
                <Button label="Assinar e continuar" onPress={confirmarAssinaturaAgente} style={{ flex: 2 }} />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  titleSection: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 100, gap: 0 },
  summaryCard: {
    padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 4, gap: 6,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  summaryPoints: { fontSize: 13, fontWeight: '700' },
  summaryTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  summaryAddress: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  summaryMeta: { fontSize: 12.5, lineHeight: 18 },

  timelineCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timelineIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineConnector: { width: 2, height: 16, marginLeft: 14, marginVertical: 2 },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  timelineDetail: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  timelineNote: { fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: '600' },

  condutaCard: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 14, marginBottom: 4, alignItems: 'flex-start' },
  condutaTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  condutaText: { fontSize: 13, lineHeight: 20 },

  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  docIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  docCopy: { flex: 1, minWidth: 0 },
  docTitle: { fontSize: 15, fontWeight: '700' },
  docSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },

  registroGroup: { gap: 12 },
  evidenceBlock: { gap: 10 },
  evidenceStrip: { gap: 10, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 4 },
  evidenceThumb: { width: 92, height: 72, borderRadius: 12 },
  footer: { padding: 24, paddingBottom: 40, borderTopWidth: 1 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKav: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  signatureModalCard: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '94%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  modalScroll: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 10 },
  signatureModalContent: { padding: 20 },
  signatureNotice: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  signatureImagePreview: { height: 180, borderRadius: 14, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  signatureImage: { width: '100%', height: '100%' },
  signatureSourceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  signatureSourceButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  signatureSourceText: { fontSize: 12, fontWeight: '700' },
  modalLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
  modalInput: {
    height: 52, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15, fontWeight: '500',
  },
  modalRow: { flexDirection: 'row' },
  modalActions: {
    flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 36,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700' },
  modalGerarBtn: {
    flex: 2, height: 52, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  modalGerarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
