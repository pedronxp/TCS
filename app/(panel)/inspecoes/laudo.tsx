import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { Button, LoadingState } from '../../../components/ui';

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function riscoLabel(nivel: string) {
  if (nivel === 'r4') return 'CRÍTICO';
  if (nivel === 'r3') return 'ALTO';
  if (nivel === 'r2') return 'MÉDIO';
  return 'BAIXO';
}
function riscoColor(nivel: string) {
  if (nivel === 'r4' || nivel === 'r3') return '#EF4444';
  if (nivel === 'r2') return '#F59E0B';
  return '#10B981';
}
function formatarData(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function LaudoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [vistoria, setVistoria] = useState<any>(null);

  useEffect(() => { if (id) loadVistoria(); }, [id]);

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
      setVistoria(data);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar o laudo.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const gerarPDF = async () => {
    if (!vistoria) return;
    setGerando(true);
    try {
      const cor = riscoColor(vistoria.nivelRisco);
      const nivel = riscoLabel(vistoria.nivelRisco);
      const respostas = vistoria.respostasJson
        ? (typeof vistoria.respostasJson === 'string' ? JSON.parse(vistoria.respostasJson) : vistoria.respostasJson)
        : {};
      const respostasHtml = Object.entries(respostas)
        .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td><b>${escapeHtml(v)}</b></td></tr>`)
        .join('');

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .header { background: #1e3a5f; color: white; padding: 24px 32px; margin: -32px -32px 32px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .badge { display: inline-block; background: ${cor}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 15px; font-weight: bold; margin-bottom: 24px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field label { font-size: 11px; color: #999; display: block; margin-bottom: 2px; }
  .field span { font-size: 15px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .score { font-size: 40px; font-weight: 900; color: ${cor}; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>Laudo Técnico de Vistoria</h1>
  <p>Defesa Civil — Sistema de Vistoria Técnica de Risco Estrutural</p>
</div>

<div class="badge">NÍVEL ${nivel}</div>

<div class="section">
  <h2>Identificação</h2>
  <div class="grid">
    <div class="field"><label>Endereço</label><span>${escapeHtml(vistoria.endereco || `${vistoria.enderecoRua || ''}, ${vistoria.enderecoNumero || ''}`)}</span></div>
    <div class="field"><label>Bairro</label><span>${escapeHtml(vistoria.enderecoBairro || '—')}</span></div>
    <div class="field"><label>Município</label><span>${escapeHtml(vistoria.municipio || '—')}</span></div>
    <div class="field"><label>Responsável</label><span>${escapeHtml(vistoria.responsavelNome || '—')}</span></div>
    <div class="field"><label>Data da Vistoria</label><span>${escapeHtml(formatarData(vistoria.dataVistoria))}</span></div>
    <div class="field"><label>Agente</label><span>${escapeHtml(vistoria.agenteNome || '—')}</span></div>
  </div>
</div>

<div class="section">
  <h2>Resultado</h2>
  <p>Pontuação Total: <span class="score">${vistoria.pontuacaoTotal ?? '—'}</span></p>
</div>

${respostasHtml ? `
<div class="section">
  <h2>Respostas do Formulário</h2>
  <table><tbody>${respostasHtml}</tbody></table>
</div>` : ''}

<div class="footer">
  Documento gerado automaticamente pelo Sistema Defesa Civil · ${new Date().toLocaleDateString('pt-BR')}
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar Laudo Técnico',
        });
      } else {
        Alert.alert('PDF Gerado', `Arquivo salvo em: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
      logger.error('vistoria', 'Erro PDF', { erro: String(e) });
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

  if (!vistoria) return null;
  const cor = riscoColor(vistoria.nivelRisco);
  const nivel = riscoLabel(vistoria.nivelRisco);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Laudo Técnico</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Relatório de vistoria</Text>
        </View>
        <Button
          variant="primary"
          loading={gerando}
          onPress={gerarPDF}
          disabled={gerando}
        >
          PDF
        </Button>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Nível badge */}
        <View style={[styles.nivelCard, { backgroundColor: `${cor}12`, borderColor: `${cor}30` }]}>
          <View style={[styles.nivelIcon, { backgroundColor: `${cor}20` }]}>
            <Feather name={cor === '#EF4444' ? 'alert-triangle' : cor === '#F59E0B' ? 'alert-circle' : 'check-circle'} size={32} color={cor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nivelLabel, { color: theme.textSecondary }]}>NÍVEL DE RISCO</Text>
            <Text style={[styles.nivelText, { color: cor }]}>{nivel}</Text>
          </View>
          <Text style={[styles.pontuacao, { color: cor }]}>{vistoria.pontuacaoTotal ?? '—'}<Text style={{ fontSize: 14 }}>pts</Text></Text>
        </View>

        {/* Identificação */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Identificação</Text>
        <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
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

        {/* Respostas */}
        {vistoria.respostasJson && (() => {
          try {
            const r = typeof vistoria.respostasJson === 'string'
              ? JSON.parse(vistoria.respostasJson) : vistoria.respostasJson;
            const entries = Object.entries(r);
            if (entries.length === 0) return null;
            return (
              <>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Respostas do Formulário</Text>
                <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                  {entries.map(([k, v], i) => (
                    <View key={k} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{k}</Text>
                        <Text style={[styles.rowValue, { color: theme.text }]}>{String(v)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            );
          } catch { return null; }
        })()}

        {gerando && <LoadingState />}
        <Button
          variant="primary"
          loading={gerando}
          onPress={gerarPDF}
          disabled={gerando}
        >
          Gerar Laudo PDF
        </Button>
      </ScrollView>
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
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
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
});
