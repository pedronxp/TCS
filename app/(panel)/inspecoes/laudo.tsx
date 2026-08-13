import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share,
  Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { buildLaudoHtml, buildTermoInterdicaoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
import { formatarPontuacaoRisco, parseCalculoRiscoSnapshot, resolverApresentacaoRisco } from '../../../utils/riscoUtils';
import { formatarData } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificarDocumentoGerado } from '../../../services/NotificationService';
import { getSignedUrl, uploadLaudoPdf } from '../../../services/StorageService';
import { prepareGeneratedDocument } from '../../../services/DocumentAcknowledgementService';
import { DOCUMENT_TEMPLATE_VERSIONS, GeneratedDocumentType, isAcknowledgementEnabled } from '../../../types/documentAcknowledgement';
import {
  ASSETS,
  getObservacaoCondicionalRiscoKey,
  getPerguntaIdFromObservacaoCondicionalRiscoKey,
  opcaoAcionaObservacaoCondicionalRisco,
} from '../../../utils/formulariosAssets';
import { AppHeader, Badge, Button, LoadingState, SectionHeader, StateBanner } from '../../../components/ui';
import { Spacing } from '../../../constants/Spacing';

// ─── Form JSONs ──────────────────────────────────────────────────────────────
const FORM_JSONS: Record<string, any> = {
  ...ASSETS,
};

function resolverItensVistoriados(
  formularioId: string,
  respostasJson: any,
  calculoRisco?: unknown,
): { grupo: string; itens: { pergunta: string; resposta: string; pesoRisco: number; observacao?: string }[] }[] {
  const calculo = parseCalculoRiscoSnapshot(calculoRisco);
  const itensPorPerguntaId = new Map((calculo?.itens || []).map(item => [item.perguntaId, item]));

  let respostas: Record<string, string> = {};
  try {
    respostas = typeof respostasJson === 'string'
      ? JSON.parse(respostasJson || '{}')
      : (respostasJson || {});
  } catch { return []; }

  const form = FORM_JSONS[formularioId];
  if (!form) {
    if (calculo?.itens?.length) {
      const grupos = new Map<string, { grupo: string; itens: { pergunta: string; resposta: string; pesoRisco: number; observacao?: string }[] }>();
      for (const item of calculo.itens) {
        const key = item.faseId || item.grupo || 'snapshot';
        if (!grupos.has(key)) grupos.set(key, { grupo: item.grupo || 'Itens avaliados', itens: [] });
        grupos.get(key)!.itens.push({ pergunta: item.pergunta, resposta: item.resposta, pesoRisco: item.pesoRisco, observacao: item.observacao });
      }
      return Array.from(grupos.values());
    }

    const itens = Object.entries(respostas)
      .filter(([k]) => !getPerguntaIdFromObservacaoCondicionalRiscoKey(k))
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .map(([k, v]) => ({ pergunta: k, resposta: String(v), pesoRisco: 0 }));
    return itens.length ? [{ grupo: 'Respostas', itens }] : [];
  }

  const grupos: { grupo: string; itens: { pergunta: string; resposta: string; pesoRisco: number }[] }[] = [];
  for (const fase of form.fases || []) {
    const itens: { pergunta: string; resposta: string; pesoRisco: number; observacao?: string }[] = [];
    for (const p of fase.perguntas || []) {
      if (p.tipo === 'foto') continue;
      const raw = respostas[p.id];
      const itemCalculado = itensPorPerguntaId.get(p.id);
      if ((raw === undefined || raw === null || raw === '') && !itemCalculado) continue;
      let respostaTexto = itemCalculado?.resposta ?? String(raw);
      let pesoRisco = itemCalculado?.pesoRisco ?? 0;
      if (!itemCalculado && (p.tipo === 'cards' || p.tipo === 'multipla_escolha')) {
        const op = (p.opcoes || []).find((o: any) => o.id === raw);
        if (op) { respostaTexto = op.texto; pesoRisco = op.pesoRisco ?? 0; }
      } else if (!itemCalculado && p.unidade && p.tipoEntrada === 'numero_decimal') {
        respostaTexto = `${respostaTexto} ${p.unidade}`;
      }
      const observacaoKey = getObservacaoCondicionalRiscoKey(p.id);
      const observacao = itemCalculado?.observacao || (opcaoAcionaObservacaoCondicionalRisco(formularioId, p, raw)
        ? respostas[observacaoKey]?.trim()
        : undefined);
      itens.push({ pergunta: p.texto, resposta: respostaTexto, pesoRisco, observacao: observacao || undefined });
    }
    if (itens.length) grupos.push({ grupo: fase.titulo, itens });
  }
  return grupos;
}

export default function LaudoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [vistoria, setVistoria] = useState<any>(null);

  const [showTermoModal, setShowTermoModal] = useState(false);
  const [termoNomeErro, setTermoNomeErro] = useState(false);
  const [termoForm, setTermoForm] = useState({
    nomeNotificado: '',
    cpfNotificado: '',
    enderecoRua: '',
    enderecoNumero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    telefone: '',
  });

  useEffect(() => { if (id) loadVistoria(); }, [id]);

  const abrirModalTermo = () => {
    if (!vistoria) return;
    const respJson = typeof vistoria.respostasJson === 'string'
      ? JSON.parse(vistoria.respostasJson || '{}') : (vistoria.respostasJson || {});

    setTermoForm({
      nomeNotificado: vistoria.responsavelNome || respJson['Responsável'] || respJson['Nome do Responsável'] || '',
      cpfNotificado: respJson['CPF do Responsável'] || respJson['CPF'] || '',
      enderecoRua: vistoria.enderecoRua || vistoria.endereco || '',
      enderecoNumero: String(vistoria.enderecoNumero || respJson['Número'] || ''),
      bairro: vistoria.enderecoBairro || respJson['Bairro'] || '',
      cidade: vistoria.municipio || '',
      complemento: respJson['Complemento'] || '',
      telefone: respJson['Telefone de Contato'] || respJson['Telefone'] || '',
    });
    setShowTermoModal(true);
  };

  const loadVistoria = async () => {
    try {
      // Filtrar por município para evitar acesso a vistorias de outros municípios
      let query = supabase.from('vistorias').select('*').eq('id', id);
      if (profile && profile.role !== 'master_admin') {
        query = query.eq('municipio', profile.municipio);
      }
      if (profile && profile.role === 'agent') {
        query = query.eq('agenteUid', profile.uid);
      }
      const { data, error } = await query.single();
      if (error) throw error;
      // Resolver paths de storage → URLs assinadas antes de usar no PDF
      if (data.fotoUrl) data.fotoUrl = await getSignedUrl(data.fotoUrl) ?? data.fotoUrl;
      if (Array.isArray(data.fotosUrls)) {
        data.fotosUrls = await Promise.all(data.fotosUrls.map(async (u: string) => await getSignedUrl(u) ?? u));
      }
      setVistoria(data);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar o laudo.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const prepararCiencia = async (
    documentType: GeneratedDocumentType,
    payload: object,
    html: string,
    pdfUri: string,
  ) => {
    if (!profile?.uid || !isAcknowledgementEnabled(documentType, profile.organizationId)) {
      return { documentId: null, enabled: false, errorMessage: null };
    }
    try {
      const document = await prepareGeneratedDocument({
        vistoriaId: vistoria.id,
        documentType,
        templateVersion: DOCUMENT_TEMPLATE_VERSIONS[documentType],
        payload,
        pdfUri,
        previewHtml: html,
        createdBy: profile.uid,
      });
      return { documentId: document.id, enabled: true, errorMessage: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('vistoria', 'Documento técnico gerado sem preparar ciência eletrônica', {
        documentType,
        vistoriaId: vistoria.id,
        erro: errorMessage,
      });
      return { documentId: null, enabled: true, errorMessage };
    }
  };

  const concluirOfertaCiencia = (result: Awaited<ReturnType<typeof prepararCiencia>>, titulo: string) => {
    if (result.documentId) {
      Alert.alert(`${titulo} preparado`, 'Deseja coletar a ciência eletrônica agora?', [
        { text: 'Depois', style: 'cancel' },
        { text: 'Coletar ciência', onPress: () => router.push(`/(panel)/inspecoes/ciencia?documentId=${result.documentId}`) },
      ]);
      return;
    }
    if (result.enabled && result.errorMessage) {
      Alert.alert(
        `${titulo} gerado sem ciência eletrônica`,
        `O PDF foi emitido, mas a versão para ciência não foi salva. Detalhe: ${result.errorMessage}`,
      );
    }
  };

  const gerarPDF = async () => {
    if (!vistoria) return;
    if (vistoria.laudo_gerado_em) {
      Alert.alert(
        'Documento já gerado',
        `Este laudo foi gerado em ${formatarData(vistoria.laudo_gerado_em)}.\nGerar novamente criará um novo arquivo no seu dispositivo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Gerar novamente', onPress: executarGerarPDF },
        ],
      );
      return;
    }
    await executarGerarPDF();
  };

  const executarGerarPDF = async () => {
    if (!vistoria) return;
    setGerando(true);
    try {
      const dados: LaudoData = {
        id: vistoria.id,
        protocolo: vistoria.protocolo,
        nivelRisco: vistoria.nivelRisco,
        pontuacaoTotal: vistoria.pontuacaoTotal ?? 0,
        endereco: vistoria.endereco || `${vistoria.enderecoRua || ''}, ${vistoria.enderecoNumero || ''}`,
        municipio: vistoria.municipio || '—',
        dataVistoria: vistoria.dataVistoria,
        agenteNome: vistoria.agenteNome || profile?.name || '—',
        formularioId: vistoria.formularioId || 'Padrão',
        respostasJson: typeof vistoria.respostasJson === 'string'
          ? vistoria.respostasJson
          : JSON.stringify(vistoria.respostasJson || {}),
        calculoRisco: vistoria.calculoRisco ?? null,
        bairro: vistoria.enderecoBairro,
        responsavelNome: vistoria.responsavelNome,
        foto_url: vistoria.fotosUrls?.[0] || vistoria.fotoUrl || null,
        fotosUrls: Array.isArray(vistoria.fotosUrls) && vistoria.fotosUrls.length > 0
          ? vistoria.fotosUrls
          : null,
      };
      const html = await buildLaudoHtml(dados);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const acknowledgementDocument = await prepararCiencia('technical_report', dados, html, uri);
      const agora = new Date().toISOString();
      const laudoUrl = await uploadLaudoPdf(uri, vistoria.id, vistoria.municipio || 'geral');
      if (!laudoUrl) throw new Error('Falha ao enviar o documento oficial.');
      const storedPath = laudoUrl.startsWith('laudos:') ? laudoUrl.slice('laudos:'.length) : laudoUrl;
      const { error: updateError } = await supabase.rpc('finalize_inspection_laudo_generation', {
        p_inspection_id: vistoria.id,
        p_storage_path: storedPath,
        p_generated_at: agora,
      });
      if (updateError) throw updateError;
      setVistoria((v: any) => v ? { ...v, laudo_url: laudoUrl, laudo_gerado_em: agora } : v);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar Laudo Técnico' });
      } else {
        Alert.alert('PDF Gerado', `Arquivo salvo em: ${uri}`);
      }
      notificarDocumentoGerado('laudo', vistoria.endereco || '').catch(() => null);
      concluirOfertaCiencia(acknowledgementDocument, 'Laudo');
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
      logger.error('vistoria', 'Erro PDF', { erro: String(e) });
    } finally {
      setGerando(false);
    }
  };

  const gerarTermoInterdicao = async () => {
    if (!vistoria) return;
    if (!termoForm.nomeNotificado.trim()) {
      setTermoNomeErro(true);
      return;
    }
    setTermoNomeErro(false);

    if (vistoria.termo_gerado_em) {
      Alert.alert(
        'Termo já gerado',
        `O Termo de Interdição foi gerado em ${formatarData(vistoria.termo_gerado_em)}.\nGerar novamente criará um novo arquivo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Gerar novamente', onPress: executarGerarTermo },
        ],
      );
      return;
    }
    await executarGerarTermo();
  };

  const executarGerarTermo = async () => {
    if (!vistoria) return;
    setShowTermoModal(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    setGerando(true);
    try {
      const laudoData = {
        id: vistoria.id || '',
        dataVistoria: vistoria.dataVistoria || new Date().toISOString(),
        municipio: vistoria.municipio || '—',
        agenteNome: vistoria.agenteNome || profile?.name || '—',
        nivelRisco: vistoria.nivelRisco || 'r1',
        pontuacaoTotal: vistoria.pontuacaoTotal || 0,
        endereco: vistoria.endereco || '—',
      };
      const html = buildTermoInterdicaoHtml(laudoData, termoForm);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const acknowledgementDocument = await prepararCiencia(
        'interdiction_term',
        { ...laudoData, notified: termoForm },
        html,
        uri,
      );
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar Termo de Interdição', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF Gerado', `Arquivo salvo em: ${uri}`);
      }
      // Registrar geração no Supabase
      const agora = new Date().toISOString();
      supabase.rpc('mark_inspection_document_generated', {
        p_inspection_id: vistoria.id,
        p_document_type: 'termo',
      }).then(() => {});
      setVistoria((v: any) => v ? { ...v, termo_gerado_em: agora } : v);
      notificarDocumentoGerado('termo', vistoria.endereco || '').catch(() => null);
      concluirOfertaCiencia(acknowledgementDocument, 'Termo');
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível gerar o Termo de Interdição.');
      logger.error('vistoria', 'Erro PDF Interdição', { erro: String(e) });
    } finally {
      setGerando(false);
    }
  };

  const handleCpfChange = (t: string) => {
    const limpo = t.replace(/\D/g, '').substring(0, 11);
    let formatted = limpo;
    if (limpo.length > 9) formatted = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
    else if (limpo.length > 6) formatted = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
    else if (limpo.length > 3) formatted = `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
    setTermoForm(f => ({ ...f, cpfNotificado: formatted }));
  };

  const handlePhoneChange = (t: string) => {
    const limpo = t.replace(/\D/g, '').substring(0, 11);
    let formatted = limpo;
    if (limpo.length > 6) formatted = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    else if (limpo.length > 2) formatted = `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    setTermoForm(f => ({ ...f, telefone: formatted }));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState message="Carregando laudo técnico..." />
      </View>
    );
  }

  if (!vistoria) return null;
  const apresentacao = resolverApresentacaoRisco({ formularioId: vistoria.formularioId, pontuacao: vistoria.pontuacaoTotal, nivelRisco: vistoria.nivelRisco, calculoRisco: vistoria.calculoRisco });
  const riskCode = apresentacao.nivelCompatibilidade.toLowerCase();
  const cor = ['r3', 'r4'].includes(riskCode) ? theme.error : riskCode === 'r2' ? theme.warning : theme.success;
  const nivel = apresentacao.label;
  const riskVariant = apresentacao.nivelCompatibilidade.toUpperCase() as 'R1' | 'R2' | 'R3' | 'R4';
  const isAvaliacaoArvore = vistoria.formularioId === 'avaliacao_arvore_cbmmg_v1';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Laudo técnico"
        subtitle="Relatório oficial da vistoria"
        onBack={() => router.back()}
        actionIcon="download"
        actionLabel="Gerar PDF"
        onAction={gerando ? undefined : gerarPDF}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Nível badge */}
        <View style={[styles.nivelCard, { backgroundColor: `${cor}12`, borderColor: `${cor}30` }]}>
          <View style={[styles.nivelIcon, { backgroundColor: `${cor}20` }]}>
            <Feather name={['r3', 'r4'].includes(riskCode) ? 'alert-triangle' : riskCode === 'r2' ? 'alert-circle' : 'check-circle'} size={32} color={cor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nivelLabel, { color: theme.textSecondary }]}>{isAvaliacaoArvore ? 'RESULTADO CBMMG' : 'NÍVEL DE RISCO'}</Text>
            <Badge label={isAvaliacaoArvore ? nivel : `Risco ${nivel}`} variant={riskVariant} size="sm" showDot />
          </View>
          <Text style={[styles.pontuacao, { color: cor }]}>{formatarPontuacaoRisco(vistoria.pontuacaoTotal ?? 0)}<Text style={{ fontSize: 14 }}>pts</Text></Text>
        </View>

        {/* Banner — laudo já gerado */}
        {vistoria.laudo_gerado_em && (
          <StateBanner
            variant="success"
            title="Laudo já gerado"
            description={`${formatarData(vistoria.laudo_gerado_em)} · arquivo disponível neste dispositivo`}
          />
        )}

        <SectionHeader title="Identificação" subtitle="Dados vinculados ao documento" />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          {[
            { icon: 'map-pin', label: 'Endereço', value: vistoria.endereco || `${vistoria.enderecoRua || ''}, ${vistoria.enderecoNumero || ''} — ${vistoria.enderecoBairro || ''}` },
            { icon: 'map', label: 'Município', value: vistoria.municipio || '—' },
            { icon: 'user', label: 'Responsável', value: vistoria.responsavelNome || '—' },
            { icon: 'calendar', label: 'Data', value: formatarData(vistoria.dataVistoria) },
            { icon: 'shield', label: 'Agente', value: vistoria.agenteNome || '—' },
          ].map((row, i) => (
            <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <Feather name={row.icon as any} size={15} color={theme.textSecondary} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: theme.text }]}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Itens Vistoriados */}
        {vistoria.respostasJson && (() => {
          const grupos = resolverItensVistoriados(vistoria.formularioId || '', vistoria.respostasJson, vistoria.calculoRisco);
          if (grupos.length === 0) return null;
          const riscoColors: Record<string, string> = {
            r1: theme.success, r2: theme.warning, r3: theme.error, r4: theme.error,
            baixo: theme.success, médio: theme.warning, alto: theme.error, iminente: theme.error,
          };
          let itemIndex = 0;
          return (
            <>
              <SectionHeader title="Itens vistoriados" subtitle="Respostas e observações registradas" />
              {grupos.map((grupo, gi) => (
                <View key={gi}>
                  {grupos.length > 1 && (
                    <Text style={[styles.grupoTitle, { color: theme.textSecondary }]}>{grupo.grupo}</Text>
                  )}
                  {grupo.itens.map((item, ii) => {
                    const idx = ++itemIndex;
                    const isRisco = ['r1', 'r2', 'r3', 'r4', 'alto', 'médio', 'baixo', 'iminente'].includes(item.resposta.toLowerCase());
                    const rCor = riscoColors[item.resposta.toLowerCase()];
                    return (
                      <View
                        key={ii}
                        style={[styles.respostaCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
                      >
                        <View style={styles.respostaNumero}>
                          <Text style={[styles.respostaNumeroText, { color: theme.textSecondary }]}>{idx}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.respostaPergunta, { color: theme.textSecondary }]} numberOfLines={3}>{item.pergunta}</Text>
                          {isRisco && rCor ? (
                            <View style={[styles.respostaBadge, { backgroundColor: `${rCor}18` }]}>
                              <Text style={[styles.respostaBadgeText, { color: rCor }]}>{item.resposta.toUpperCase()}</Text>
                            </View>
                          ) : (
                            <Text style={[styles.respostaValor, { color: theme.text }]}>{item.resposta}</Text>
                          )}
                          {item.observacao && (
                            <View style={[styles.observacaoBox, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                              <Text style={[styles.observacaoLabel, { color: theme.textSecondary }]}>Observação do agente</Text>
                              <Text style={[styles.observacaoText, { color: theme.text }]}>{item.observacao}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          );
        })()}

        {/* Banner — termo já gerado */}
        {vistoria.termo_gerado_em && (
          <StateBanner
            variant="warning"
            title="Termo de interdição já gerado"
            description={`${formatarData(vistoria.termo_gerado_em)} · arquivo disponível neste dispositivo`}
          />
        )}

        {!isAvaliacaoArvore && (vistoria.nivelRisco === 'r3' || vistoria.nivelRisco === 'r4') && (
          <Button
            label="Gerar termo de interdição"
            variant="danger"
            onPress={abrirModalTermo}
            disabled={gerando}
            iconLeft={<Feather name="alert-octagon" size={20} color={theme.onPrimary} />}
            fullWidth
          />
        )}

        <Button
          label="Gerar relatório de vistoria"
          onPress={gerarPDF}
          loading={gerando}
          iconLeft={<Feather name="file-text" size={20} color={theme.onPrimary} />}
          fullWidth
        />
      </ScrollView>

      {/* ═══════════════ MODAL TERMO DE INTERDIÇÃO ═══════════════ */}
      <Modal visible={showTermoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKav}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.surfaceHighlight }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <View style={styles.modalHeaderIcon}>
                  <Feather name="alert-triangle" size={20} color={theme.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Termo de Interdição</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Revise os dados do notificado
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

              <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowTermoModal(false)}
                >
                  <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalGerarBtn, { backgroundColor: theme.error }]}
                  onPress={gerarTermoInterdicao}
                >
                  <Feather name="file-text" size={18} color="#FFF" />
                  <Text style={styles.modalGerarText}>Gerar Termo</Text>
                </TouchableOpacity>
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
    paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  pdfBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 60 },
  nivelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderRadius: 18, borderWidth: 1, padding: 20, marginBottom: 24,
  },
  nivelIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  nivelLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  nivelText: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  pontuacao: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12, marginTop: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  rowLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '600' },
  respostaCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  respostaNumero: {
    width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(100,100,100,0.1)',
  },
  respostaNumeroText: { fontSize: 12, fontWeight: '800' },
  grupoTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 6 },
  respostaPergunta: { fontSize: 12, fontWeight: '600', marginBottom: 6, lineHeight: 17 },
  respostaValor: { fontSize: 14, fontWeight: '700' },
  respostaBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  respostaBadgeText: { fontSize: 12, fontWeight: '800' },
  observacaoBox: { marginTop: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  observacaoLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  observacaoText: { fontSize: 13, lineHeight: 19 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 60, borderRadius: 18, marginTop: 8,
  },
  shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Modal (Refatorado igual ao Relatório)
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKav: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
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
  docBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12,
  },
  docBannerTitle: { fontSize: 13, fontWeight: '700' },
  docBannerSub: { fontSize: 11, marginTop: 1 },
});
