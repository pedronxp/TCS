import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { buildLaudoHtml, LaudoData } from '../../../utils/laudoPdfBuilder';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';
import { formatarData } from '../../../utils/htmlUtils';

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
      const dados: LaudoData = {
        id: vistoria.id,
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
        bairro: vistoria.enderecoBairro,
        responsavelNome: vistoria.responsavelNome,
      };
      const html = buildLaudoHtml(dados);

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
        <TouchableOpacity
          style={[styles.pdfBtn, { backgroundColor: gerando ? theme.textSecondary : theme.primary }]}
          onPress={gerarPDF}
          disabled={gerando}
        >
          {gerando
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Feather name="download" size={18} color="#FFF" />
          }
          <Text style={styles.pdfBtnText}>{gerando ? '...' : 'PDF'}</Text>
        </TouchableOpacity>
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

        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: theme.primary }]}
          onPress={gerarPDF}
          disabled={gerando}
        >
          <Feather name="file-text" size={20} color="#FFF" />
          <Text style={styles.shareBtnText}>Gerar e Compartilhar PDF</Text>
        </TouchableOpacity>
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
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 60, borderRadius: 18, marginTop: 8,
  },
  shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
