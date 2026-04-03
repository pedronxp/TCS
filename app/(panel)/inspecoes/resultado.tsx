import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useReport } from '../../../context/ReportContext';
import { supabase } from '../../../utils/supabase';
import { getVistoriaById } from '../../../utils/database';
import { buildLaudoHtml, buildTermoInterdicaoHtml, LaudoData, TermoInterdicaoData } from '../../../utils/laudoPdfBuilder';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';
import { generateProtocolo } from '../../../utils/uuid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    dataVistoria: v.dataVistoria ?? v.data_vistoria ?? v.created_at ?? null,
    agenteNome: v.agenteNome ?? v.agente_nome ?? '—',
    respostasJson: v.respostasJson ?? v.respostas_json ?? '{}',
    formularioId: v.formularioId ?? v.formulario_id ?? 'Padrão',
    responsavelNome: v.responsavelNome ?? v.responsavel_nome ?? '',
    foto_url: v.foto_url ?? v.fotoUrl ?? null,
  };
}


export default function ResultadoScreen() {
  const { id, nivelRisco: nivelParam, pontuacao: pontuacaoParam, municipio: municipioParam } = useLocalSearchParams<{
    id: string; nivelRisco?: string; pontuacao?: string; municipio?: string;
  }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { initReport } = useReport();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [vistoria, setVistoria] = useState<ReturnType<typeof normalizar> | null>(null);

  // Modal Termo de Interdição
  const [showTermoModal, setShowTermoModal] = useState(false);
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

  useEffect(() => { loadDados(); }, [id]);

  const populateReport = (v: ReturnType<typeof normalizar>, nome: string) => {
    if (!v) return;
    let respostas: Record<string, string> = {};
    try { respostas = JSON.parse(v.respostasJson || '{}'); } catch { /* noop */ }
    initReport({
      vistoriaId: v.id || '',
      protocolo: generateProtocolo(v.id || '', v.dataVistoria, v.municipio),
      endereco: v.endereco || '',
      municipio: v.municipio || '',
      agenteNome: nome,
      dataVistoria: v.dataVistoria || new Date().toISOString(),
      formularioId: v.formularioId || 'Padrão',
      nivelRisco: v.nivelRisco || 'r1',
      pontuacaoTotal: v.pontuacaoTotal ?? 0,
      respostas,
      foto_url: v.foto_url ?? null,
      condutaRecomendada: '',
      observacoesTecnicas: '',
      cargo: 'Agente de Defesa Civil',
    });
  };

  const loadDados = async () => {
    try {
      // 1. Tentar Supabase
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, nivelRisco, pontuacaoTotal, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, dataVistoria, agenteNome, respostasJson, formularioId, responsavelNome, foto_url')
        .eq('id', id)
        .single();

      if (!error && data) {
        const norm = normalizar(data);
        setVistoria(norm);
        populateReport(norm, norm.agenteNome || profile?.name || '—');
        // Pré-preenche o form do Termo com dados da vistoria
        prefillTermoForm(norm);
        return;
      }

      // 2. Fallback: SQLite local
      const local = getVistoriaById(id as string);
      if (local) {
        const norm = normalizar(local);
        setVistoria(norm);
        populateReport(norm, norm.agenteNome || profile?.name || '—');
        prefillTermoForm(norm);
        return;
      }

      // 3. Fallback mínimo: usar params da navegação
      if (nivelParam) {
        const norm = normalizar({
          id,
          nivelRisco: nivelParam,
          pontuacaoTotal: parseInt(pontuacaoParam || '0'),
          agenteNome: profile?.name,
          municipio: municipioParam || profile?.municipio,
        });
        setVistoria(norm);
        populateReport(norm, profile?.name || '—');
        prefillTermoForm(norm);
      }
    } catch {
      // Usar params da navegação como fallback silencioso
      if (nivelParam) {
        const norm = normalizar({
          id,
          nivelRisco: nivelParam,
          pontuacaoTotal: parseInt(pontuacaoParam || '0'),
          agenteNome: profile?.name,
          municipio: municipioParam || profile?.municipio,
        });
        setVistoria(norm);
        populateReport(norm, profile?.name || '—');
        prefillTermoForm(norm);
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

  const buildDados = (): LaudoData => ({
    id: vistoria?.id || '',
    nivelRisco: vistoria?.nivelRisco || 'r1',
    pontuacaoTotal: vistoria?.pontuacaoTotal ?? 0,
    endereco: vistoria?.endereco || '—',
    municipio: vistoria?.municipio || '—',
    dataVistoria: vistoria?.dataVistoria || null,
    agenteNome: vistoria?.agenteNome || profile?.name || '—',
    formularioId: vistoria?.formularioId || 'Padrão',
    respostasJson: vistoria?.respostasJson || '{}',
    foto_url: vistoria?.foto_url ?? null,
  });

  const gerarPdf = async () => {
    setGerando(true);
    try {
      const html = await buildLaudoHtml(buildDados());
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const disponivel = await Sharing.isAvailableAsync();
      if (disponivel) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Laudo Técnico — TCS',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Gerado', `Arquivo salvo em:\n${uri}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  const imprimir = async () => {
    setGerando(true);
    try {
      const html = await buildLaudoHtml(buildDados());
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a impressão.');
    } finally {
      setGerando(false);
    }
  };

  const compartilhar = async () => {
    setGerando(true);
    try {
      const html = await buildLaudoHtml(buildDados());
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Laudo ${generateProtocolo(vistoria?.id || '', vistoria?.dataVistoria, vistoria?.municipio)} — TCS`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({
          message: `Laudo Técnico TCS — ${vistoria?.endereco || 'Endereço não informado'}\nNível de Risco: ${riscoLabel(vistoria?.nivelRisco || 'r1')}\nArquivo: ${uri}`,
          title: 'Laudo Técnico — TCS',
        });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o laudo.');
    } finally {
      setGerando(false);
    }
  };

  /** Gera o Termo de Interdição */
  const gerarTermoInterdicao = async () => {
    if (!termoForm.nomeNotificado.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha o nome do notificado.');
      return;
    }
    setGerando(true);
    setShowTermoModal(false);
    try {
      const html = buildTermoInterdicaoHtml(buildDados(), termoForm);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const disponivel = await Sharing.isAvailableAsync();
      if (disponivel) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Termo de Interdição — TCS',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Gerado', `Termo de Interdição salvo em:\n${uri}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o Termo de Interdição.');
    } finally {
      setGerando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const nivel = vistoria?.nivelRisco || nivelParam || 'r1';
  const cor = riscoColor(nivel);
  const label = riscoLabel(nivel);
  const isAltoRisco = nivel === 'r3' || nivel === 'r4';

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
          <Text style={[styles.title, { color: theme.text }]}>Resultado Final</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {generateProtocolo(id?.toString() || '', vistoria?.dataVistoria, vistoria?.municipio)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
          <View style={[styles.statusIcon, { backgroundColor: `${cor}15` }]}>
            <Feather name="file-text" size={32} color={cor} />
          </View>
          <View style={[styles.nivelBadge, { backgroundColor: cor }]}>
            <Text style={styles.nivelText}>RISCO {label}</Text>
          </View>
          <Text style={[styles.statusTitle, { color: theme.text }]}>Vistoria Concluída</Text>
          <Text style={[styles.statusDesc, { color: theme.textSecondary }]}>
            {vistoria?.endereco
              ? `${vistoria.endereco}\n${vistoria.pontuacaoTotal} pontos · ${vistoria.agenteNome}`
              : 'Dados salvos localmente. PDF disponível após sincronização.'}
          </Text>
        </View>

        {/* Botão Termo de Interdição — SÓ R3/R4 */}
        {isAltoRisco && (
          <TouchableOpacity
            style={[styles.termoBtn]}
            onPress={() => setShowTermoModal(true)}
            disabled={gerando}
          >
            <View style={styles.termoBtnInner}>
              <View style={styles.termoBtnIconWrap}>
                <Feather name="alert-triangle" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.termoBtnTitle}>Gerar Termo de Interdição</Text>
                <Text style={styles.termoBtnDesc}>
                  Documento oficial — apenas para risco {label}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.reportBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(panel)/inspecoes/relatorio')}
        >
          <Feather name="edit-3" size={20} color="#FFF" />
          <View style={styles.reportBtnText}>
            <Text style={styles.reportBtnTitle}>Ver Relatório Técnico</Text>
            <Text style={styles.reportBtnDesc}>Editar e personalizar o laudo</Text>
          </View>
          <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Exportar Laudo</Text>

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.primary }]}
          onPress={gerarPdf}
          disabled={gerando}
        >
          <View style={[styles.exportIcon, { backgroundColor: theme.primary }]}>
            {gerando
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Feather name="download" size={22} color="#FFF" />
            }
          </View>
          <View style={styles.exportTextWrap}>
            <Text style={[styles.exportTitle, { color: theme.text }]}>
              {gerando ? 'Gerando PDF...' : 'Baixar PDF'}
            </Text>
            <Text style={[styles.exportDesc, { color: theme.textSecondary }]}>
              Laudo formatado com dados técnicos
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
          onPress={imprimir}
          disabled={gerando}
        >
          <View style={[styles.exportIcon, { backgroundColor: theme.iconBackground }]}>
            <Feather name="printer" size={22} color={theme.textSecondary} />
          </View>
          <View style={styles.exportTextWrap}>
            <Text style={[styles.exportTitle, { color: theme.text }]}>Imprimir Laudo</Text>
            <Text style={[styles.exportDesc, { color: theme.textSecondary }]}>Enviar para impressora</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
          onPress={compartilhar}
          disabled={gerando}
        >
          <View style={[styles.exportIcon, { backgroundColor: theme.iconBackground }]}>
            <Feather name="share-2" size={22} color={theme.textSecondary} />
          </View>
          <View style={styles.exportTextWrap}>
            <Text style={[styles.exportTitle, { color: theme.text }]}>Compartilhar</Text>
            <Text style={[styles.exportDesc, { color: theme.textSecondary }]}>
              Enviar via WhatsApp, e-mail, etc.
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.replace('/(panel)/dashboard')}
        >
          <Text style={styles.primaryBtnText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </View>

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
                  <Feather name="alert-triangle" size={20} color="#DC2626" />
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
                  style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  placeholder="Nome completo"
                  placeholderTextColor={theme.textSecondary}
                  value={termoForm.nomeNotificado}
                  onChangeText={t => setTermoForm(f => ({ ...f, nomeNotificado: t }))}
                />

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
                  style={styles.modalGerarBtn}
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
  scrollContent: { padding: 24, paddingBottom: 100 },
  statusCard: {
    padding: 28, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', marginBottom: 24,
  },
  statusIcon: {
    width: 72, height: 72, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  nivelBadge: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16,
  },
  nivelText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  statusTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  statusDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Termo de Interdição button
  termoBtn: {
    borderRadius: 18, marginBottom: 16, overflow: 'hidden',
    backgroundColor: '#DC2626',
  },
  termoBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18,
  },
  termoBtnIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  termoBtnTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  termoBtnDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: 18, marginBottom: 24,
  },
  reportBtnText: { flex: 1 },
  reportBtnTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  reportBtnDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 16,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 16, borderWidth: 1, marginBottom: 12,
  },
  exportIcon: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  exportTextWrap: { flex: 1 },
  exportTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  exportDesc: { fontSize: 13 },
  footer: { padding: 24, paddingBottom: 40, borderTopWidth: 1 },
  primaryBtn: {
    height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

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
    backgroundColor: '#DC2626',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  modalGerarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
