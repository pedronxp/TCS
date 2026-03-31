import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useReport } from '../../../context/ReportContext';
import { buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';

// ─── Componente de campo editável ─────────────────────────────────────────────

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

  const handleSave = () => {
    onSave(text);
    setEditing(false);
  };

  return (
    <View style={eStyles.wrapper}>
      <View style={eStyles.labelRow}>
        <Text style={[eStyles.label, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
        {!editing && (
          <TouchableOpacity onPress={() => { setText(value); setEditing(true); }} style={eStyles.editBtn}>
            <Feather name="edit-2" size={13} color={accent || theme.primary} />
            <Text style={[eStyles.editText, { color: accent || theme.primary }]}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <View>
          <TextInput
            style={[eStyles.input, {
              backgroundColor: theme.background,
              borderColor: accent || theme.primary,
              color: theme.text,
              minHeight: multiline ? 100 : 48,
            }]}
            value={text}
            onChangeText={setText}
            multiline={multiline}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            textAlignVertical="top"
            autoFocus
          />
          <View style={eStyles.actionRow}>
            <TouchableOpacity style={[eStyles.cancelBtn, { borderColor: theme.border }]} onPress={() => setEditing(false)}>
              <Text style={[eStyles.cancelText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[eStyles.saveBtn, { backgroundColor: accent || theme.primary }]} onPress={handleSave}>
              <Feather name="check" size={14} color="#FFF" />
              <Text style={eStyles.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={[eStyles.content, { color: theme.text }]}>
          {value || <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>{placeholder || 'Toque em Editar para preencher...'}</Text>}
        </Text>
      )}
    </View>
  );
}

const eStyles = StyleSheet.create({
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
  const { draft, updateField } = useReport();
  const [gerando, setGerando] = useState(false);

  if (!draft) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Feather name="file-text" size={48} color={theme.border} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Nenhum relatório ativo.{'\n'}Conclua uma vistoria primeiro.
        </Text>
        <TouchableOpacity style={[styles.backBtnCenter, { borderColor: theme.border }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cor = riscoColor(draft.nivelRisco);
  const label = riscoLabel(draft.nivelRisco);

  const buildDraftHtml = (): string => {
    const dados: LaudoData = {
      id: draft.vistoriaId,
      nivelRisco: draft.nivelRisco,
      pontuacaoTotal: draft.pontuacaoTotal,
      endereco: draft.endereco,
      municipio: draft.municipio,
      dataVistoria: draft.dataVistoria,
      agenteNome: draft.agenteNome,
      formularioId: draft.formularioId,
      respostasJson: JSON.stringify(draft.respostas || {}),
      condutaRecomendada: draft.condutaRecomendada,
      observacoesTecnicas: draft.observacoesTecnicas,
      cargo: draft.cargo,
    };
    return buildLaudoHtml(dados);
  };

  const exportarPDF = async () => {
    setGerando(true);
    try {
      const html = buildDraftHtml();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const disponivel = await Sharing.isAvailableAsync();
      if (disponivel) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Laudo Técnico — Defesa Civil',
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
      await Print.printAsync({ html: buildDraftHtml() });
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a impressão.');
    } finally {
      setGerando(false);
    }
  };

  const respostasEntries = Object.entries(draft.respostas).filter(([, v]) => v);
  const dataFormatada = draft.dataVistoria
    ? new Date(draft.dataVistoria).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Relatório Técnico</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Protocolo #{draft.protocolo}
          </Text>
        </View>
        <View style={[styles.riscoBadgeSmall, { backgroundColor: cor }]}>
          <Text style={styles.riscoBadgeText}>{label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── CARD DE PREVIEW ──────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>

          {/* Cabeçalho do laudo */}
          <View style={[styles.laudoHeader, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[styles.orgName, { color: theme.text }]}>DEFESA CIVIL</Text>
              <Text style={[styles.orgSub, { color: theme.textSecondary }]}>LAUDO TÉCNICO DE VISTORIA</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.protocolLabel, { color: theme.textSecondary }]}>PROTOCOLO</Text>
              <Text style={[styles.protocolNum, { color: theme.text }]}>#{draft.protocolo}</Text>
            </View>
          </View>

          {/* Badge de risco */}
          <View style={[styles.riscoBanner, { backgroundColor: cor }]}>
            <Text style={styles.riscoBannerLabel}>NÍVEL DE RISCO ESTRUTURAL</Text>
            <Text style={styles.riscoBannerVal}>RISCO {label}</Text>
            <Text style={styles.riscoBannerPts}>{draft.pontuacaoTotal} pontos acumulados</Text>
          </View>

          {/* Dados da vistoria */}
          <View style={[styles.section, { borderBottomColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DADOS DA VISTORIA</Text>
            <View style={styles.infoGrid}>
              <InfoItem label="Endereço" value={draft.endereco} theme={theme} />
              <InfoItem label="Município" value={draft.municipio} theme={theme} />
              <InfoItem label="Data / Hora" value={dataFormatada} theme={theme} />
              <InfoItem label="Agente" value={draft.agenteNome} theme={theme} />
              <InfoItem label="Formulário" value={draft.formularioId} theme={theme} />
            </View>
          </View>

          {/* Respostas */}
          {respostasEntries.length > 0 && (
            <View style={[styles.section, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>RESPOSTAS DO FORMULÁRIO</Text>
              {respostasEntries.map(([k, v]) => (
                <View key={k} style={[styles.respostaRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.respostaKey, { color: theme.textSecondary }]} numberOfLines={2}>{k}</Text>
                  <Text style={[styles.respostaVal, { color: theme.text }]} numberOfLines={2}>{v}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Conduta recomendada — editável */}
          <View style={[styles.section, { borderBottomColor: theme.border }]}>
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
          <View style={[styles.section, { borderBottomColor: theme.border }]}>
            <EditableField
              label="Observações Técnicas (opcional)"
              value={draft.observacoesTecnicas}
              placeholder="Adicione observações específicas do local, condições climáticas, acesso, etc..."
              onSave={v => updateField('observacoesTecnicas', v)}
              theme={theme}
            />
          </View>

          {/* Assinatura — editável */}
          <View style={[styles.section, { borderBottomWidth: 0 }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ASSINATURA</Text>
            <View style={[styles.assinaturaCard, { borderColor: theme.border }]}>
              <View style={[styles.assinaturaLinha, { borderColor: theme.textSecondary }]} />
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

        {/* ── AÇÕES DE EXPORTAÇÃO ───────────────────────────────────────── */}
        <Text style={[styles.exportTitle, { color: theme.textSecondary }]}>EXPORTAR</Text>

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: cor }]}
          onPress={exportarPDF}
          disabled={gerando}
        >
          {gerando
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Feather name="download" size={20} color="#FFF" />}
          <Text style={styles.exportBtnText}>
            {gerando ? 'Gerando PDF...' : 'Baixar PDF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtnOutline, { borderColor: theme.border }]}
          onPress={imprimir}
          disabled={gerando}
        >
          <Feather name="printer" size={20} color={theme.textSecondary} />
          <Text style={[styles.exportBtnOutlineText, { color: theme.textSecondary }]}>Imprimir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtnOutline, { borderColor: theme.border }]}
          onPress={exportarPDF}
          disabled={gerando}
        >
          <Feather name="share-2" size={20} color={theme.textSecondary} />
          <Text style={[styles.exportBtnOutlineText, { color: theme.textSecondary }]}>Compartilhar</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoItem({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.infoItem}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  riscoBadgeSmall: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  riscoBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  scroll: { padding: 20, paddingBottom: 60 },

  // Card de preview
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  laudoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, borderBottomWidth: 1,
  },
  orgName: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  orgSub: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' },
  protocolLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  protocolNum: { fontSize: 16, fontWeight: '900', marginTop: 2 },

  riscoBanner: { padding: 20, alignItems: 'center' },
  riscoBannerLabel: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 2, opacity: .85, textTransform: 'uppercase' },
  riscoBannerVal: { color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: -1, marginVertical: 4 },
  riscoBannerPts: { color: '#FFF', fontSize: 12, opacity: .8 },

  section: { padding: 18, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 },
  infoGrid: { gap: 12 },
  infoItem: { gap: 3 },
  infoLabel: { fontSize: 9, fontWeight: '700', letterSpacing: .5, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600' },

  respostaRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  respostaKey: { flex: 2, fontSize: 12, fontWeight: '700' },
  respostaVal: { flex: 3, fontSize: 12 },

  assinaturaCard: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'stretch', gap: 12 },
  assinaturaLinha: { width: 160, borderTopWidth: 1, marginBottom: 4 },

  // Exportação
  exportTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56, borderRadius: 14, marginBottom: 10,
  },
  exportBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  exportBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 52, borderRadius: 14, borderWidth: 1.5, marginBottom: 10,
  },
  exportBtnOutlineText: { fontSize: 14, fontWeight: '600' },

  // Empty state
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 24, marginTop: 16, marginBottom: 28 },
  backBtnCenter: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  backBtnText: { fontSize: 14, fontWeight: '700' },
});
