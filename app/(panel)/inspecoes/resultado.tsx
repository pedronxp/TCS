import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share
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
import { buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';

/** Normaliza dados de qualquer fonte (Supabase camelCase ou SQLite snake_case) */
function normalizar(v: any): any {
  if (!v) return null;
  return {
    id: v.id,
    nivelRisco: v.nivelRisco ?? v.nivel_risco ?? 'r1',
    pontuacaoTotal: v.pontuacaoTotal ?? v.pontuacao_total ?? 0,
    endereco: v.endereco ?? `${v.endereco_rua ?? ''}, ${v.endereco_numero ?? ''} - ${v.endereco_bairro ?? ''}`,
    municipio: v.municipio ?? '',
    dataVistoria: v.dataVistoria ?? v.data_vistoria ?? v.created_at ?? null,
    agenteNome: v.agenteNome ?? v.agente_nome ?? '—',
    respostasJson: v.respostasJson ?? v.respostas_json ?? '{}',
    formularioId: v.formularioId ?? v.formulario_id ?? 'Padrão',
  };
}


export default function ResultadoScreen() {
  const { id, nivelRisco: nivelParam, pontuacao: pontuacaoParam } = useLocalSearchParams<{
    id: string; nivelRisco?: string; pontuacao?: string;
  }>();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { initReport } = useReport();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [vistoria, setVistoria] = useState<ReturnType<typeof normalizar> | null>(null);

  useEffect(() => { loadDados(); }, [id]);

  const populateReport = (v: ReturnType<typeof normalizar>, nome: string) => {
    if (!v) return;
    let respostas: Record<string, string> = {};
    try { respostas = JSON.parse(v.respostasJson || '{}'); } catch { /* noop */ }
    initReport({
      vistoriaId: v.id || '',
      protocolo: (v.id || '').toString().slice(0, 8).toUpperCase(),
      endereco: v.endereco || '',
      municipio: v.municipio || '',
      agenteNome: nome,
      dataVistoria: v.dataVistoria || new Date().toISOString(),
      formularioId: v.formularioId || 'Padrão',
      nivelRisco: v.nivelRisco || 'r1',
      pontuacaoTotal: v.pontuacaoTotal ?? 0,
      respostas,
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
        .select('id, nivelRisco, pontuacaoTotal, endereco, municipio, dataVistoria, agenteNome, respostasJson, formularioId')
        .eq('id', id)
        .single();

      if (!error && data) {
        const norm = normalizar(data);
        setVistoria(norm);
        populateReport(norm, norm.agenteNome || profile?.name || '—');
        return;
      }

      // 2. Fallback: SQLite local
      const local = getVistoriaById(id as string);
      if (local) {
        const norm = normalizar(local);
        setVistoria(norm);
        populateReport(norm, norm.agenteNome || profile?.name || '—');
        return;
      }

      // 3. Fallback mínimo: usar params da navegação
      if (nivelParam) {
        const norm = normalizar({
          id,
          nivelRisco: nivelParam,
          pontuacaoTotal: parseInt(pontuacaoParam || '0'),
          agenteNome: profile?.name,
          municipio: profile?.municipio,
        });
        setVistoria(norm);
        populateReport(norm, profile?.name || '—');
      }
    } catch {
      // Usar params da navegação como fallback silencioso
      if (nivelParam) {
        const norm = normalizar({
          id,
          nivelRisco: nivelParam,
          pontuacaoTotal: parseInt(pontuacaoParam || '0'),
          agenteNome: profile?.name,
          municipio: profile?.municipio,
        });
        setVistoria(norm);
        populateReport(norm, profile?.name || '—');
      }
    } finally {
      setLoading(false);
    }
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
  });

  const gerarPdf = async () => {
    setGerando(true);
    try {
      const html = buildLaudoHtml(buildDados());
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
      const html = buildLaudoHtml(buildDados());
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
      const html = buildLaudoHtml(buildDados());
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Laudo ${(vistoria?.id || '').slice(0, 8).toUpperCase()} — Defesa Civil`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: compartilhar texto com link (iOS sem Files.app)
        await Share.share({
          message: `Laudo Técnico Defesa Civil — ${vistoria?.endereco || 'Endereço não informado'}\nNível de Risco: ${riscoLabel(vistoria?.nivelRisco || 'r1')}\nArquivo: ${uri}`,
          title: 'Laudo Técnico — Defesa Civil',
        });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o laudo.');
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.text }]}>Resultado Final</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Laudo #{id?.toString().slice(0, 8).toUpperCase()}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
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
    alignItems: 'center', marginBottom: 32,
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
});
