import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
  Modal, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useReport } from '../../../context/ReportContext';
import {
  formatarPontuacaoRisco,
  parseCalculoRiscoSnapshot,
  resolverApresentacaoRisco,
} from '../../../utils/riscoUtils';
import { parseProtocolo } from '../../../utils/uuid';
import { buildTermoInterdicaoHtml, buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
import { buildShareMessage } from '../../../utils/shareUtils';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';
import { notificarDocumentoGerado } from '../../../services/NotificationService';
import {
  ASSETS,
  getObservacaoCondicionalRiscoKey,
  getPerguntaIdFromObservacaoCondicionalRiscoKey,
  opcaoAcionaObservacaoCondicionalRisco,
} from '../../../utils/formulariosAssets';
import { safeBack } from '../../../utils/navigationUtils';
import { AppHeader, Button, EmptyState } from '../../../components/ui';
import { TCSPalette } from '../../../constants/Colors';

// ─── Form JSONs (require() deve ser estático no RN) ───────────────────────────
const FORM_JSONS: Record<string, any> = {
  ...ASSETS,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ItemResolvido {
  perguntaId: string;
  pergunta: string;
  resposta: string;
  tipo: string;
  pesoRisco: number;
  observacao?: string;
}

interface GrupoResolvido {
  grupo: string;
  faseId: string;
  peso?: number;
  itens: ItemResolvido[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve IDs de respostas em textos legíveis, agrupados por fase */
function resolverRespostas(formularioId: string, respostas: Record<string, string>, calculoRisco?: unknown): GrupoResolvido[] {
  const calculo = parseCalculoRiscoSnapshot(calculoRisco);
  const itensPorPerguntaId = new Map((calculo?.itens || []).map(item => [item.perguntaId, item]));

  const form = FORM_JSONS[formularioId];
  if (!form) {
    if (calculo?.itens?.length) {
      const grupos = new Map<string, GrupoResolvido>();
      for (const item of calculo.itens) {
        const faseId = item.faseId || item.grupo || 'snapshot';
        const grupo = item.grupo || 'Itens avaliados';
        if (!grupos.has(faseId)) grupos.set(faseId, { grupo, faseId, itens: [] });
        grupos.get(faseId)!.itens.push({
          perguntaId: item.perguntaId,
          pergunta: item.pergunta,
          resposta: item.resposta,
          tipo: 'cards',
          pesoRisco: item.pesoRisco,
          observacao: item.observacao,
        });
      }
      return Array.from(grupos.values());
    }

    // Fallback genérico: mostra chave → valor bruto
    const itens = Object.entries(respostas)
      .filter(([k]) => !getPerguntaIdFromObservacaoCondicionalRiscoKey(k))
      .filter(([, v]) => v)
      .map(([k, v]) => ({ perguntaId: k, pergunta: k, resposta: v, tipo: 'texto', pesoRisco: 0 }));
    return itens.length ? [{ grupo: 'Respostas', faseId: 'raw', itens }] : [];
  }

  const grupos: GrupoResolvido[] = [];
  for (const fase of form.fases || []) {
    const itens: ItemResolvido[] = [];
    for (const p of fase.perguntas || []) {
      if (p.tipo === 'foto') continue;
      const raw = respostas[p.id];
      const itemCalculado = itensPorPerguntaId.get(p.id);
      if ((raw === undefined || raw === null || raw === '') && !itemCalculado) continue;

      let respostaTexto = itemCalculado?.resposta ?? raw;
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
      itens.push({ perguntaId: p.id, pergunta: p.texto, resposta: respostaTexto, tipo: p.tipo, pesoRisco, observacao: observacao || undefined });
    }
    if (itens.length) grupos.push({ grupo: fase.titulo, faseId: fase.id, peso: fase.peso, itens });
  }
  return grupos;
}

/** Cor do indicador por pesoRisco */
function pesoColor(p: number) {
  if (p === 0) return TCSPalette.success;
  if (p <= 0.6) return TCSPalette.warning;
  return TCSPalette.danger;
}

/** Formata data ISO em pt-BR */
function fmtData(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Componente campo editável ─────────────────────────────────────────────────
interface EditableFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (v: string) => void;
  theme: any;
  accent?: string;
}

function EditableField({ label, value, placeholder, multiline = true, onSave, theme, accent }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  const handleSave = () => { onSave(text); setEditing(false); };

  return (
    <View style={ef.wrapper}>
      <View style={ef.labelRow}>
        <Text style={[ef.label, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
        {!editing && (
          <TouchableOpacity onPress={() => { setText(value); setEditing(true); }} style={ef.editBtn}>
            <Feather name="edit-2" size={13} color={accent || theme.primary} />
            <Text style={[ef.editText, { color: accent || theme.primary }]}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>
      {editing ? (
        <View>
          <TextInput
            style={[ef.input, { backgroundColor: theme.background, borderColor: accent || theme.primary, color: theme.text, minHeight: multiline ? 90 : 44 }]}
            value={text} onChangeText={setText} multiline={multiline}
            placeholder={placeholder} placeholderTextColor={theme.textSecondary}
            textAlignVertical="top" autoFocus
          />
          <View style={ef.actionRow}>
            <TouchableOpacity style={[ef.cancelBtn, { borderColor: theme.border }]} onPress={() => setEditing(false)}>
              <Text style={[ef.cancelText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ef.saveBtn, { backgroundColor: accent || theme.primary }]} onPress={handleSave}>
              <Feather name="check" size={14} color="#FFF" />
              <Text style={ef.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={[ef.content, { color: value ? theme.text : theme.textSecondary, fontStyle: value ? 'normal' : 'italic' }]}>
          {value || (placeholder || 'Toque em Editar para preencher...')}
        </Text>
      )}
    </View>
  );
}

const ef = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontSize: 12, fontWeight: '700' },
  input: { borderRadius: 10, borderWidth: 1.5, padding: 12, fontSize: 14, lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  cancelText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  content: { fontSize: 14, lineHeight: 22 },
});

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function RelatorioScreen() {
  const { theme } = useTheme();
  const { width: larguraTela } = useWindowDimensions();
  const telaCompacta = larguraTela <= 430;
  const insets = useSafeAreaInsets();
  const { draft, updateField } = useReport();
  const { profile } = useAuth();
  const { isExpired, exit, revalidate } = useTraining();
  const [gerando, setGerando] = useState(false);
  const [docTracking, setDocTracking] = useState<{
    relatorio_gerado_em?: string | null;
    termo_gerado_em?: string | null;
  }>({});
  const isTrainingReport = !!draft?.modoTreinamento;

  useEffect(() => {
    let alive = true;
    setDocTracking({});
    if (!draft?.vistoriaId || draft.modoTreinamento) {
      return () => { alive = false; };
    }
    supabase
      .from('vistorias')
      .select('relatorio_gerado_em, termo_gerado_em')
      .eq('id', draft.vistoriaId)
      .single()
      .then(({ data }) => { if (alive && data) setDocTracking(data); });
    return () => { alive = false; };
  }, [draft?.vistoriaId, draft?.modoTreinamento]);

  // Resolve respostas em textos legíveis agrupados por fase
  const grupos = useMemo<GrupoResolvido[]>(() => {
    if (!draft) return [];
    return resolverRespostas(draft.formularioId, draft.respostas || {}, draft.calculoRisco);
  }, [draft?.formularioId, draft?.respostas, draft?.calculoRisco]);

  const totalRespondidas = useMemo(() => grupos.reduce((acc, g) => acc + g.itens.length, 0), [grupos]);

  const [showTermoModal, setShowTermoModal] = useState(false);
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

  const ensureTrainingActionsAllowed = async () => {
    if (!isTrainingReport) return true;
    if (!isExpired() && await revalidate()) return true;
    await exit();
    Alert.alert('Treinamento encerrado', 'O prazo desta turma terminou. O acesso ao modo treinamento foi bloqueado.');
    router.replace('/(auth)/treinamento');
    return false;
  };

  const abrirModalTermo = async () => {
    if (!(await ensureTrainingActionsAllowed())) return;

    const abrir = () => {
      const r = draft?.respostas || {};
      setTermoForm({
        nomeNotificado: r['Responsável'] || r['Nome do Responsável'] || '',
        cpfNotificado: r['CPF do Responsável'] || r['CPF'] || '',
        enderecoRua: draft?.endereco || '',
        enderecoNumero: r['Número'] || '',
        bairro: r['Bairro'] || '',
        cidade: draft?.municipio || '',
        complemento: r['Complemento'] || '',
        telefone: r['Telefone de Contato'] || r['Telefone'] || '',
      });
      setShowTermoModal(true);
    };

    if (!isTrainingReport && docTracking.termo_gerado_em) {
      Alert.alert(
        'Termo já gerado',
        `O Termo de Interdição foi gerado em ${fmtData(docTracking.termo_gerado_em)}.\nDeseja gerar um novo documento?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Gerar novamente', onPress: abrir },
        ],
      );
      return;
    }
    abrir();
  };

  if (!draft) {
    return (
      <View style={[s.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <EmptyState
          icon="file-text"
          title="Nenhum relatório ativo"
          description="Conclua uma vistoria para gerar o relatório técnico."
          actionLabel="Voltar às vistorias"
          onAction={() => safeBack('/(panel)/inspecoes')}
        />
      </View>
    );
  }

  const apresentacao = resolverApresentacaoRisco({
    formularioId: draft.formularioId,
    pontuacao: draft.pontuacaoTotal,
    nivelRisco: draft.nivelRisco,
    calculoRisco: draft.calculoRisco,
  });
  const nivelNormalizado = String(draft.nivelRisco || '').toLowerCase();
  const cor = ['r3', 'r4', 'alto', 'critico', 'crítico', 'iminente'].includes(nivelNormalizado)
    ? theme.error
    : ['r2', 'medio', 'médio'].includes(nivelNormalizado) ? theme.warning : theme.success;
  const label = apresentacao.label;
  const isAvaliacaoArvore = draft.formularioId === 'avaliacao_arvore_cbmmg_v1';
  const formularioLabel = isAvaliacaoArvore
    ? 'Avaliação de Árvore de Risco - CBMMG'
    : draft.formularioId;
  const proto = parseProtocolo(draft.protocolo);

  const exportarPDF = async () => {
    if (!(await ensureTrainingActionsAllowed())) return;

    if (!isTrainingReport && docTracking.relatorio_gerado_em) {
      Alert.alert(
        'Relatório já gerado',
        `Este relatório foi gerado em ${fmtData(docTracking.relatorio_gerado_em)}.\nGerar novamente criará um novo arquivo no seu dispositivo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Gerar novamente', onPress: executarExportarPDF },
        ],
      );
      return;
    }
    await executarExportarPDF();
  };

  const executarExportarPDF = async () => {
    if (!(await ensureTrainingActionsAllowed())) return;

    setGerando(true);
    try {
      const dados: LaudoData = {
        id: draft.vistoriaId,
        protocolo: draft.protocolo,
        nivelRisco: draft.nivelRisco,
        pontuacaoTotal: draft.pontuacaoTotal,
        endereco: draft.endereco,
        municipio: draft.municipio,
        dataVistoria: draft.dataVistoria,
        agenteNome: draft.agenteNome,
        formularioId: draft.formularioId,
        respostasJson: JSON.stringify(draft.respostas || {}),
        calculoRisco: draft.calculoRisco ?? null,
        condutaRecomendada: draft.condutaRecomendada,
        observacoesTecnicas: draft.observacoesTecnicas,
        cargo: draft.cargo,
        foto_url: draft.foto_url ?? null,
        fotosUrls: draft.fotosUrls ?? (draft.foto_url ? [draft.foto_url] : null),
        responsavelNome: (draft.respostas || {})['Responsável'] || (draft.respostas || {})['Nome do Responsável'],
        bairro: (draft.respostas || {})['Bairro'],
        modoTreinamento: isTrainingReport,
      };
      const html = await buildLaudoHtml(dados);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const protocolo = draft.protocolo || '';
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: protocolo ? `TCS — ${protocolo}` : 'TCS — Relatório de Risco',
          UTI: 'com.adobe.pdf',
        });
      } else {
        const { Share } = require('react-native');
        const mensagem = buildShareMessage({
          protocolo,
          endereco: draft.endereco || 'Endereço não informado',
          municipio: draft.municipio || '',
          nivelRisco: draft.nivelRisco || 'r1',
          formularioId: draft.formularioId,
          formularioTitulo: isAvaliacaoArvore ? 'Avaliação de Árvore de Risco - CBMMG' : undefined,
          pontuacaoTotal: draft.pontuacaoTotal,
          calculoRisco: draft.calculoRisco,
          agenteNome: draft.agenteNome || profile?.name || 'Agente',
          dataVistoria: draft.dataVistoria || new Date().toISOString(),
        });
        await Share.share({ message: mensagem, title: 'TCS — Relatório de Risco' });
      }
      // Registrar geração
      if (!isTrainingReport && draft.vistoriaId) {
        const agora = new Date().toISOString();
        supabase.rpc('mark_inspection_document_generated', {
          p_inspection_id: draft.vistoriaId,
          p_document_type: 'relatorio',
        }).then(() => {});
        setDocTracking(t => ({ ...t, relatorio_gerado_em: agora }));
        notificarDocumentoGerado('relatorio', draft.endereco || '').catch(() => null);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const gerarTermoInterdicao = async () => {
    if (!(await ensureTrainingActionsAllowed())) return;

    if (!termoForm.nomeNotificado.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome do notificado.');
      return;
    }
    setGerando(true);
    setShowTermoModal(false);
    try {
      const laudoData: LaudoData = {
        id: draft.protocolo || draft.vistoriaId || '',
        dataVistoria: draft.dataVistoria || new Date().toISOString(),
        municipio: draft.municipio || '—',
        agenteNome: draft.agenteNome || '—',
        nivelRisco: draft.nivelRisco || 'r1',
        pontuacaoTotal: draft.pontuacaoTotal || 0,
        endereco: draft.endereco || '—',
        modoTreinamento: isTrainingReport,
      };

      const html = buildTermoInterdicaoHtml(laudoData, termoForm);

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Termo de Interdição', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF Gerado', `Salvo em:\n${uri}`);
      }
      // Registrar geração
      if (!isTrainingReport && draft?.vistoriaId) {
        const agora = new Date().toISOString();
        supabase.rpc('mark_inspection_document_generated', {
          p_inspection_id: draft.vistoriaId,
          p_document_type: 'termo',
        }).then(() => {});
        setDocTracking(t => ({ ...t, termo_gerado_em: agora }));
        notificarDocumentoGerado('termo', draft?.endereco || '').catch(() => null);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o Termo de Interdição.');
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

  const imprimir = async () => {
    if (!(await ensureTrainingActionsAllowed())) return;

    setGerando(true);
    try {
      const dados: LaudoData = {
        id: draft.vistoriaId,
        protocolo: draft.protocolo,
        nivelRisco: draft.nivelRisco,
        pontuacaoTotal: draft.pontuacaoTotal,
        endereco: draft.endereco,
        municipio: draft.municipio,
        dataVistoria: draft.dataVistoria,
        agenteNome: draft.agenteNome,
        formularioId: draft.formularioId,
        respostasJson: JSON.stringify(draft.respostas || {}),
        calculoRisco: draft.calculoRisco ?? null,
        condutaRecomendada: draft.condutaRecomendada,
        observacoesTecnicas: draft.observacoesTecnicas,
        cargo: draft.cargo,
        foto_url: draft.foto_url ?? null,
        fotosUrls: draft.fotosUrls ?? (draft.foto_url ? [draft.foto_url] : null),
        modoTreinamento: isTrainingReport,
      };

      const html = await buildLaudoHtml(dados);
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a impressão.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Relatório técnico"
          subtitle={`${draft.protocolo || 'Sem protocolo'} · ${label}`}
          onBack={() => safeBack(isTrainingReport ? '/(panel)/treinamento' : '/(panel)/inspecoes')}
        />
      </View>

      <ScrollView contentContainerStyle={[s.scroll, telaCompacta && s.scrollCompacto]} keyboardShouldPersistTaps="handled">

        {/* ── Card do Relatório ───────────────────────────────────────────── */}
        <View style={[s.card, telaCompacta && s.cardCompacto, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>

          {/* ── Brand + Protocolo ─────────────────────────────────────── */}
          <View style={[s.brandHeader, telaCompacta && s.brandHeaderCompacto, { borderBottomColor: theme.border }]}>
            {/* Logo + nome */}
            <View style={[s.brandLeft, telaCompacta && s.brandLeftCompacto]}>
              <Image source={require('../../../assets/brand/tcs-mark-v5.png')} style={[s.logo, telaCompacta && s.logoCompacto]} resizeMode="contain" />
              <View>
                <Text style={[s.brandName, { color: theme.text }]}>Defesa Civil</Text>
                <Text style={[s.brandSub, { color: theme.textSecondary }]}>RELATÓRIO DE RISCO</Text>
              </View>
            </View>

            {/* Protocolo em partes */}
            {proto ? (
              <View style={[s.protoBox, telaCompacta && s.protoBoxCompacto, { borderColor: theme.border, backgroundColor: theme.iconBackground }]}>
                <Text style={[s.protoBoxLabel, { color: theme.textSecondary }]}>PROTOCOLO OFICIAL</Text>
                {/* Linha 1: TCS · CIDADE */}
                <View style={[s.protoPartes, { marginBottom: 4 }]}>
                  <View style={[s.protoParte, { backgroundColor: cor }]}>
                    <Text style={s.protoParteText}>{proto.prefix}</Text>
                  </View>
                  <Text style={[s.protoDot, { color: theme.textSecondary }]}>·</Text>
                  <View style={[s.protoParte, { backgroundColor: cor + '22' }]}>
                    <Text style={[s.protoParteText, { color: cor }]}>{proto.cidade}</Text>
                  </View>
                </View>
                {/* Linha 2: DATA · HASH */}
                <View style={s.protoPartes}>
                  <View style={[s.protoParte, { backgroundColor: theme.cardBorder }]}>
                    <Text style={[s.protoParteText, { color: theme.textSecondary }]}>{proto.date}</Text>
                  </View>
                  <Text style={[s.protoDot, { color: theme.textSecondary }]}>·</Text>
                  <View style={[s.protoParte, { backgroundColor: theme.cardBorder }]}>
                    <Text style={[s.protoParteText, { color: theme.text, fontWeight: '900', letterSpacing: 2 }]}>{proto.hash}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.protoLabel, { color: theme.textSecondary }]}>PROTOCOLO</Text>
                <Text style={[s.protoNum, { color: theme.text }]}>{draft.protocolo}</Text>
              </View>
            )}
          </View>

          {/* Badge de risco */}
          <View style={[s.riscoBanner, telaCompacta && s.riscoBannerCompacto, { backgroundColor: cor }]}>
            <Text style={s.bannerLabel}>{isAvaliacaoArvore ? 'RESULTADO CBMMG' : 'NÍVEL DE RISCO'}</Text>
            <Text style={[s.bannerNivel, telaCompacta && s.bannerNivelCompacto]}>{isAvaliacaoArvore ? label : `RISCO ${label}`}</Text>
            <Text style={s.bannerPts}>{formatarPontuacaoRisco(draft.pontuacaoTotal)} pontos acumulados</Text>
          </View>

          {/* Dados da vistoria */}
          <View style={[s.section, telaCompacta && s.sectionCompacta, { borderBottomColor: theme.border }]}>
            <Text style={[s.secTitle, { color: theme.textSecondary }]}>DADOS DA VISTORIA</Text>
            <View style={s.infoGrid}>
              <InfoItem label="Endereço"   value={draft.endereco}    theme={theme} />
              <InfoItem label="Município"  value={draft.municipio}   theme={theme} />
              <InfoItem label="Data / Hora" value={fmtData(draft.dataVistoria)} theme={theme} />
              <InfoItem label="Agente"     value={draft.agenteNome}  theme={theme} />
              <InfoItem label="Formulário" value={formularioLabel} theme={theme} />
            </View>
          </View>

          {/* Resumo de cobertura */}
          <View style={[s.section, telaCompacta && s.sectionCompacta, { borderBottomColor: theme.border }]}>
            <View style={s.coverageRow}>
              <Feather name="check-square" size={14} color={cor} />
              <Text style={[s.coverageText, { color: theme.textSecondary }]}>
                <Text style={{ fontWeight: '800', color: theme.text }}>{totalRespondidas}</Text>
                {telaCompacta ? ' perguntas · ' : ' perguntas respondidas · '}
                <Text style={{ fontWeight: '800', color: theme.text }}>{grupos.length}</Text>
                {telaCompacta ? ' etapas' : ' elementos avaliados'}
              </Text>
            </View>
          </View>

          {/* ── Respostas agrupadas por fase ─────────────────────────────── */}
          {grupos.map((g, gi) => (
            <View key={g.faseId} style={[s.grupo, { borderBottomColor: theme.border, borderBottomWidth: gi < grupos.length - 1 ? 1 : 0 }]}>
              {/* Cabeçalho do grupo */}
              <View style={[s.grupoHeader, telaCompacta && s.grupoHeaderCompacto, { backgroundColor: theme.iconBackground }]}>
                <Text style={[s.grupoTitulo, { color: theme.text }]}>{g.grupo}</Text>
                {g.peso !== undefined && (
                  <View style={[s.pesoTag, { backgroundColor: cor + '22' }]}>
                    <Text style={[s.pesoText, { color: cor }]}>Peso {g.peso}</Text>
                  </View>
                )}
              </View>

              {/* Perguntas do grupo */}
              {g.itens.map((item, ii) => (
                <View
                  key={item.perguntaId}
                  style={[
                    s.itemRow,
                    telaCompacta && s.itemRowCompacto,
                    { borderBottomColor: theme.border, borderBottomWidth: ii < g.itens.length - 1 ? 1 : 0 },
                  ]}
                >
                  {/* Indicador de severidade */}
                  <View style={[s.dot, { backgroundColor: pesoColor(item.pesoRisco) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemPergunta, { color: theme.textSecondary }]}>{item.pergunta}</Text>
                    <Text style={[s.itemResposta, { color: theme.text }]}>{item.resposta}</Text>
                    {item.observacao && (
                      <View style={[s.itemObsBox, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                        <Text style={[s.itemObsLabel, { color: theme.textSecondary }]}>Observação do agente</Text>
                        <Text style={[s.itemObsText, { color: theme.text }]}>{item.observacao}</Text>
                      </View>
                    )}
                  </View>
                  {item.pesoRisco > 0 && (
                    <View style={[s.pesoBadge, { backgroundColor: pesoColor(item.pesoRisco) + '22' }]}>
                      <Text style={[s.pesoBadgeText, { color: pesoColor(item.pesoRisco) }]}>+{formatarPontuacaoRisco(item.pesoRisco)}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}

          {grupos.length === 0 && (
            <View style={[s.section, telaCompacta && s.sectionCompacta, { borderBottomColor: theme.border }]}>
              <Text style={[s.emptyText, { color: theme.textSecondary, textAlign: 'center', fontSize: 13 }]}>
                Nenhuma resposta registrada.
              </Text>
            </View>
          )}

          {/* Conduta recomendada — editável */}
          <View style={[s.section, telaCompacta && s.sectionCompacta, { borderBottomColor: theme.border }]}>
            <EditableField
              label="Conduta Recomendada"
              value={draft.condutaRecomendada}
              placeholder="Descreva a conduta recomendada..."
              onSave={v => updateField('condutaRecomendada', v)}
              theme={theme}
              accent={cor}
            />
          </View>

          {/* Observações técnicas — editável */}
          <View style={[s.section, telaCompacta && s.sectionCompacta, { borderBottomColor: theme.border }]}>
            <EditableField
              label="Observações Técnicas (opcional)"
              value={draft.observacoesTecnicas}
              placeholder="Condições climáticas, acesso, particularidades do local..."
              onSave={v => updateField('observacoesTecnicas', v)}
              theme={theme}
            />
          </View>

          {/* Assinatura — editável */}
          <View style={[s.section, telaCompacta && s.sectionCompacta, { borderBottomWidth: 0 }]}>
            <Text style={[s.secTitle, { color: theme.textSecondary }]}>ASSINATURA</Text>
            <View style={[s.assinaturaCard, { borderColor: theme.border }]}>
              <View style={[s.assinaturaLinha, { borderColor: theme.textSecondary }]} />
              <EditableField
                label="Nome do Técnico"
                value={draft.agenteNome}
                multiline={false}
                onSave={v => updateField('agenteNome', v)}
                theme={theme}
              />
              <EditableField
                label="Cargo / Função"
                value={draft.cargo}
                multiline={false}
                placeholder="Ex: Agente de Defesa Civil"
                onSave={v => updateField('cargo', v)}
                theme={theme}
              />
            </View>
          </View>
        </View>

        {/* Banners de rastreamento de documentos */}
        {!isTrainingReport && docTracking.relatorio_gerado_em && (
          <View style={[s.docBanner, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
            <Feather name="check-circle" size={15} color={theme.success} />
            <View style={{ flex: 1 }}>
              <Text style={[s.docBannerTitle, { color: theme.success }]}>Relatório já gerado</Text>
              <Text style={[s.docBannerSub, { color: theme.textSecondary }]}>
                {fmtData(docTracking.relatorio_gerado_em)} · arquivo no seu dispositivo
              </Text>
            </View>
          </View>
        )}
        {!isTrainingReport && docTracking.termo_gerado_em && (
          <View style={[s.docBanner, { backgroundColor: theme.warningLight, borderColor: theme.warning }]}>
            <Feather name="check-circle" size={15} color={theme.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[s.docBannerTitle, { color: theme.warning }]}>Termo de Interdição já gerado</Text>
              <Text style={[s.docBannerSub, { color: theme.textSecondary }]}>
                {fmtData(docTracking.termo_gerado_em)} · arquivo no seu dispositivo
              </Text>
            </View>
          </View>
        )}

        {/* ── Exportação ────────────────────────────────────────────────── */}
        <Text style={[s.exportLabel, { color: theme.textSecondary }]}>EXPORTAR RELATÓRIO</Text>

        {!isAvaliacaoArvore && (draft.nivelRisco === 'r3' || draft.nivelRisco === 'r4') && (
          <Button
            variant="danger"
            label={gerando ? 'Gerando...' : 'Gerar documento de intervenção'}
            onPress={abrirModalTermo}
            loading={gerando}
            disabled={gerando}
            fullWidth
            iconLeft={<Feather name="alert-octagon" size={20} color="#FFF" />}
            style={{ marginBottom: 10 }}
          />
        )}

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Baixar PDF da vistoria" accessibilityState={{ disabled: gerando }} style={[s.exportBtn, { backgroundColor: cor }]} onPress={exportarPDF} disabled={gerando}>
          {gerando
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Feather name="download" size={20} color="#FFF" />}
          <Text style={s.exportBtnText}>{gerando ? 'Gerando PDF...' : 'Baixar PDF Vistoria'}</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Imprimir relatório" accessibilityState={{ disabled: gerando }} style={[s.exportBtnOutline, { borderColor: theme.border }]} onPress={imprimir} disabled={gerando}>
          <Feather name="printer" size={20} color={theme.textSecondary} />
          <Text style={[s.exportBtnOutlineText, { color: theme.textSecondary }]}>Imprimir</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Compartilhar relatório" accessibilityState={{ disabled: gerando }} style={[s.exportBtnOutline, { borderColor: theme.border }]} onPress={exportarPDF} disabled={gerando}>
          <Feather name="share-2" size={20} color={theme.textSecondary} />
          <Text style={[s.exportBtnOutlineText, { color: theme.textSecondary }]}>Compartilhar</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ═══════════════ MODAL TERMO DE INTERDIÇÃO ═══════════════ */}
      <Modal visible={showTermoModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.modalKav}
          >
            <View style={[s.modalCard, { backgroundColor: theme.surfaceHighlight }]}>
              <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
                <View style={[s.modalHeaderIcon, { backgroundColor: theme.errorLight }]}>
                  <Feather name="alert-triangle" size={20} color={theme.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.modalTitle, { color: theme.text }]}>Termo de Interdição</Text>
                  <Text style={[s.modalSubtitle, { color: theme.textSecondary }]}>
                    Revise os dados do notificado
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowTermoModal(false)}>
                  <Feather name="x" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Nome do Notificado *</Text>
                <TextInput
                  style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="Nome completo"
                  placeholderTextColor={theme.textSecondary}
                  value={termoForm.nomeNotificado}
                  onChangeText={t => setTermoForm(f => ({ ...f, nomeNotificado: t }))}
                />

                <Text style={[s.modalLabel, { color: theme.textSecondary }]}>CPF</Text>
                <TextInput
                  style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="000.000.000-00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  maxLength={14}
                  value={termoForm.cpfNotificado}
                  onChangeText={handleCpfChange}
                />

                <View style={s.modalRow}>
                  <View style={{ flex: 3 }}>
                    <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Rua</Text>
                    <TextInput
                      style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Logradouro"
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.enderecoRua}
                      onChangeText={t => setTermoForm(f => ({ ...f, enderecoRua: t }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Nº</Text>
                    <TextInput
                      style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Nº"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={termoForm.enderecoNumero}
                      onChangeText={t => setTermoForm(f => ({ ...f, enderecoNumero: t }))}
                    />
                  </View>
                </View>

                <View style={s.modalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Complemento</Text>
                    <TextInput
                      style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Apto, Bloco..."
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.complemento}
                      onChangeText={t => setTermoForm(f => ({ ...f, complemento: t }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Bairro</Text>
                    <TextInput
                      style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Bairro"
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.bairro}
                      onChangeText={t => setTermoForm(f => ({ ...f, bairro: t }))}
                    />
                  </View>
                </View>

                <View style={s.modalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Cidade</Text>
                    <TextInput
                      style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      placeholder="Município"
                      placeholderTextColor={theme.textSecondary}
                      value={termoForm.cidade}
                      onChangeText={t => setTermoForm(f => ({ ...f, cidade: t }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.modalLabel, { color: theme.textSecondary }]}>Telefone</Text>
                    <TextInput
                      style={[s.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
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

              <View style={[s.modalActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[s.modalCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowTermoModal(false)}
                >
                  <Text style={[s.modalCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalGerarBtn, { backgroundColor: theme.error }]}
                  onPress={gerarTermoInterdicao}
                >
                  <Feather name="file-text" size={18} color="#FFF" />
                  <Text style={s.modalGerarText}>Gerar Termo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── InfoItem ──────────────────────────────────────────────────────────────────
function InfoItem({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={s.infoItem}>
      <Text style={[s.infoLabel, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
      <Text style={[s.infoValue, { color: theme.text }]}>{value || '—'}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  scroll: { padding: 20, paddingBottom: 60 },
  scrollCompacto: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 40 },

  // Card
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  cardCompacto: { borderRadius: 16, marginBottom: 18 },

  // Brand header
  brandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, gap: 12 },
  brandHeaderCompacto: { flexDirection: 'column', alignItems: 'stretch', padding: 14, gap: 12 },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  brandLeftCompacto: { flex: 0, gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 10 },
  logoCompacto: { width: 40, height: 40, borderRadius: 9 },
  brandName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 1 },
  protoLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  protoNum: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  // Protocolo em partes
  protoBox: { borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 150 },
  protoBoxCompacto: { minWidth: 0, width: '100%', paddingVertical: 9, paddingHorizontal: 8 },
  protoBoxLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  protoPartes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  protoParte: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  protoParteText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  protoDot: { fontSize: 12, fontWeight: '900' },

  // Risk banner
  riscoBanner: { padding: 20, alignItems: 'center' },
  riscoBannerCompacto: { paddingHorizontal: 12, paddingVertical: 15 },
  bannerLabel: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 2, opacity: 0.85 },
  bannerNivel: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginVertical: 4 },
  bannerNivelCompacto: { fontSize: 23, lineHeight: 28, textAlign: 'center' },
  bannerPts:   { color: '#FFF', fontSize: 12, opacity: 0.8 },

  // Section
  section: { padding: 18, borderBottomWidth: 1 },
  sectionCompacta: { paddingHorizontal: 14, paddingVertical: 14 },
  secTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 },

  // Info grid
  infoGrid: { gap: 12 },
  infoItem: { gap: 3 },
  infoLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600' },

  // Coverage summary
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coverageText: { fontSize: 13, flex: 1 },

  // Grupos de perguntas
  grupo: { paddingBottom: 0 },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  grupoHeaderCompacto: { paddingHorizontal: 14, paddingVertical: 9 },
  grupoTitulo: { fontSize: 13, fontWeight: '800', flex: 1 },
  pesoTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pesoText: { fontSize: 10, fontWeight: '800' },

  // Item de resposta
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 12 },
  itemRowCompacto: { alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 2 },
  itemPergunta: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  itemResposta: { fontSize: 14, fontWeight: '700' },
  itemObsBox: { marginTop: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  itemObsLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  itemObsText: { fontSize: 12, lineHeight: 18 },
  pesoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pesoBadgeText: { fontSize: 11, fontWeight: '800' },

  // Assinatura
  assinaturaCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  assinaturaLinha: { width: 160, borderTopWidth: 1, marginBottom: 4 },

  // Exportação
  exportLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 14, marginBottom: 10 },
  exportBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  exportBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  exportBtnOutlineText: { fontSize: 14, fontWeight: '600' },

  // Empty
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 24, marginTop: 16, marginBottom: 28 },
  emptyBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
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
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  docBannerTitle: { fontSize: 13, fontWeight: '700' },
  docBannerSub: { fontSize: 11, marginTop: 1 },
});
