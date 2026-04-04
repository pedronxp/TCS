import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useReport } from '../../../context/ReportContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { getVistoriaById } from '../../../utils/database';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';
import { generateProtocolo } from '../../../utils/uuid';
import { formatarData } from '../../../utils/htmlUtils';
import { VistoriaNormalizada } from '../../../types/vistoria';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tracarRota } from '../../../utils/routingUtils';

export default function VistoriaDetalhesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { initReport } = useReport();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vistoria, setVistoria] = useState<VistoriaNormalizada | null>(null);

  useEffect(() => { if (id) fetchDetalhes(); }, [id]);

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
      respostas,
      condutaRecomendada: '',
      observacoesTecnicas: '',
      cargo: 'Agente de Defesa Civil',
    });
  };

  const fetchDetalhes = async () => {
    try {
      // Construir query com filtros de segurança por role
      let query = supabase
        .from('vistorias')
        .select('id, nivelRisco, pontuacaoTotal, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, dataVistoria, agenteNome, agenteUid, responsavelNome, respostasJson, formularioId, status, latitude, longitude, fotosUrls')
        .eq('id', id as string);

      // Agentes só veem suas próprias vistorias
      if (profile?.role === 'agent') {
        query = query.eq('agenteUid', profile.uid);
      }
      // Admin e supervisor só veem vistorias do seu município
      if (profile?.role !== 'master_admin' && profile?.municipio) {
        query = query.eq('municipio', profile.municipio);
      }

      const { data, error } = await query.single();

      if (!error && data) {
        setVistoria(data);
        populateReport(data);
        return;
      }

      // Fallback: SQLite local (vistorias não sincronizadas)
      const local = getVistoriaById(id as string);
      if (local) {
        // Verificar se pertence ao agente atual (segurança offline)
        if (profile?.role === 'agent' && local.agente_uid !== profile.uid) {
          logger.warn('vistoria', 'Acesso negado — vistoria de outro agente (SQLite)');
          return;
        }
        let fotosUrlsParsed: string[] | null = null;
        if (local.fotos_urls) {
          try { fotosUrlsParsed = JSON.parse(local.fotos_urls); } catch { /* noop */ }
        }
        setVistoria({
          id: local.id,
          nivelRisco: local.nivel_risco,
          pontuacaoTotal: local.pontuacao_total,
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
          status: 'Pendente Sync',
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
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!vistoria) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textSecondary }}>Vistoria não encontrada.</Text>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.back()}>
          <Text style={{ color: theme.primary }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cor = riscoColor(vistoria.nivelRisco);
  const nivel = riscoLabel(vistoria.nivelRisco);
  const endereco = vistoria.endereco || `${vistoria.enderecoRua || ''}, ${vistoria.enderecoNumero || ''} — ${vistoria.enderecoBairro || ''}`;
  const hasCoords = vistoria.latitude && vistoria.latitude !== 0 && vistoria.longitude && vistoria.longitude !== 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={() => router.back()}>
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>Vistoria #{id?.toString().slice(0, 6)}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{vistoria.status || 'Registrado'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.laudoBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push(`/(panel)/inspecoes/laudo?id=${id}`)}
        >
          <Feather name="file-text" size={16} color="#FFF" />
          <Text style={styles.laudoBtnText}>Laudo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Nível de risco destaque */}
        <View style={[styles.nivelCard, { backgroundColor: `${cor}12`, borderColor: `${cor}30` }]}>
          <View style={[styles.nivelIcon, { backgroundColor: `${cor}20` }]}>
            <Feather
              name={cor === '#EF4444' ? 'alert-triangle' : cor === '#F59E0B' ? 'alert-circle' : 'check-circle'}
              size={28} color={cor}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.nivelLabel, { color: theme.textSecondary }]}>NÍVEL DE RISCO</Text>
            <Text style={[styles.nivelText, { color: cor }]}>{nivel}</Text>
          </View>
          {vistoria.pontuacaoTotal != null && (
            <Text style={[styles.pontuacao, { color: cor }]}>{vistoria.pontuacaoTotal}<Text style={{ fontSize: 12 }}>pts</Text></Text>
          )}
        </View>

        {/* Info Card */}
        <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
          {[
            { icon: 'map-pin', label: 'Endereço', value: endereco },
            { icon: 'map', label: 'Município', value: vistoria.municipio || '—' },
            { icon: 'user', label: 'Responsável', value: vistoria.responsavelNome || '—' },
            { icon: 'shield', label: 'Agente', value: vistoria.agenteNome || '—' },
            { icon: 'calendar', label: 'Data da Vistoria', value: formatarData(vistoria.dataVistoria) },
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

        {/* Ações */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Ações</Text>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => router.push(`/(panel)/inspecoes/laudo?id=${id}`)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="file-text" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>Ver Laudo Técnico</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Visualizar e exportar PDF</Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => router.push('/(panel)/inspecoes/relatorio')}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="edit-3" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>Relatório Técnico</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Editar texto e exportar PDF personalizado</Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => router.push(`/(panel)/inspecoes/foto?id=${id}`)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: theme.iconBackground }]}>
            <Feather name="camera" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>Fotos e Evidências</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Gerenciar registros fotográficos</Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {hasCoords && (
          <TouchableOpacity
            style={[styles.rotaBtn, { backgroundColor: theme.primary }]}
            onPress={() => tracarRota(vistoria.latitude!, vistoria.longitude!)}
          >
            <Feather name="navigation" size={18} color="#FFF" />
            <Text style={styles.rotaBtnText}>Como Chegar</Text>
          </TouchableOpacity>
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
  scrollContent: { padding: 20, paddingBottom: 60 },
  nivelCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 20,
  },
  nivelIcon: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  nivelLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  nivelText: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  pontuacao: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  rowTextWrap: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '600' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  actionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  actionDesc: { fontSize: 12 },
  rotaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderRadius: 14, marginTop: 12, justifyContent: 'center' },
  rotaBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
