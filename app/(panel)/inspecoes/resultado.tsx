import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert
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
import { Button, LoadingState } from '../../../components/ui';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const RISCO_LABELS: Record<string, string> = {
  r1: 'BAIXO', r2: 'MÉDIO', r3: 'ALTO', r4: 'CRÍTICO',
};

const RISCO_CORES: Record<string, string> = {
  r1: '#10B981', r2: '#F59E0B', r3: '#EF4444', r4: '#DC2626',
};

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

function gerarHtmlLaudo(v: ReturnType<typeof normalizar>, agenteNome: string): string {
  const nivel = v?.nivelRisco || 'r1';
  const cor = RISCO_CORES[nivel] || '#10B981';
  const label = RISCO_LABELS[nivel] || 'BAIXO';
  const data = v?.dataVistoria
    ? new Date(v.dataVistoria).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  let respostasHtml = '';
  try {
    const respostas = JSON.parse(v?.respostasJson || '{}');
    respostasHtml = Object.entries(respostas)
      .map(([k, val]) => {
        const safeKey = escapeHtml(k);
        const safeVal = escapeHtml(Array.isArray(val) ? (val as string[]).join(', ') : String(val));
        return `<tr><td class="label">${safeKey}</td><td>${safeVal}</td></tr>`;
      }).join('');
  } catch { /* sem respostas */ }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1A202C; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #E2E8F0; padding-bottom: 24px; }
  .logo-title { font-size: 20px; font-weight: 900; color: #1A365D; letter-spacing: -0.5px; }
  .logo-sub { font-size: 11px; color: #718096; font-weight: 600; letter-spacing: 1px; margin-top: 2px; }
  .doc-title { font-size: 12px; font-weight: 700; color: #718096; letter-spacing: 1px; text-align: right; }
  .doc-num { font-size: 18px; font-weight: 900; color: #1A365D; margin-top: 4px; text-align: right; }
  .risco-badge { background: ${cor}; color: white; padding: 20px 32px; border-radius: 16px; text-align: center; margin-bottom: 32px; }
  .risco-badge-label { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; opacity: 0.85; }
  .risco-badge-value { font-size: 36px; font-weight: 900; letter-spacing: -1px; margin: 8px 0; }
  .risco-badge-pts { font-size: 14px; opacity: 0.8; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #718096; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 16px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item label { font-size: 10px; font-weight: 700; color: #A0AEC0; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
  .info-item span { font-size: 14px; font-weight: 600; color: #1A202C; }
  table { width: 100%; border-collapse: collapse; }
  table th { font-size: 10px; font-weight: 800; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 10px 12px; background: #F7FAFC; border-bottom: 2px solid #E2E8F0; }
  table td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #EDF2F7; }
  table td.label { font-weight: 700; color: #4A5568; width: 40%; }
  .conduta { background: ${cor}15; border-left: 4px solid ${cor}; padding: 16px 20px; border-radius: 0 12px 12px 0; font-size: 13px; line-height: 1.6; color: #2D3748; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 10px; color: #A0AEC0; }
  .assinatura { border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px 32px; text-align: center; }
  .assinatura-linha { border-top: 1px solid #A0AEC0; width: 200px; margin: 0 auto 8px; }
  .assinatura-nome { font-size: 12px; font-weight: 700; }
  .assinatura-cargo { font-size: 10px; color: #718096; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-title">DEFESA CIVIL</div>
      <div class="logo-sub">LAUDO TÉCNICO DE VISTORIA</div>
    </div>
    <div>
      <div class="doc-title">PROTOCOLO</div>
      <div class="doc-num">#${(v?.id || '000000').toString().slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

  <div class="risco-badge">
    <div class="risco-badge-label">NÍVEL DE RISCO ESTRUTURAL</div>
    <div class="risco-badge-value">RISCO ${label}</div>
    <div class="risco-badge-pts">${v?.pontuacaoTotal ?? 0} pontos acumulados</div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Vistoria</div>
    <div class="info-grid">
      <div class="info-item"><label>Endereço</label><span>${escapeHtml(v?.endereco || '—')}</span></div>
      <div class="info-item"><label>Município</label><span>${escapeHtml(v?.municipio || '—')}</span></div>
      <div class="info-item"><label>Data e Hora</label><span>${escapeHtml(data)}</span></div>
      <div class="info-item"><label>Agente Responsável</label><span>${escapeHtml(agenteNome)}</span></div>
      <div class="info-item"><label>Formulário</label><span>${escapeHtml(v?.formularioId || 'Padrão')}</span></div>
    </div>
  </div>

  ${respostasHtml ? `
  <div class="section">
    <div class="section-title">Respostas do Formulário</div>
    <table>
      <thead><tr><th>Parâmetro</th><th>Resposta</th></tr></thead>
      <tbody>${respostasHtml}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Conduta Recomendada</div>
    <div class="conduta">${getConduta(nivel)}</div>
  </div>

  <div class="footer">
    <div class="footer-left">
      Gerado automaticamente pelo Sistema de Vistoria Defesa Civil<br/>
      ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </div>
    <div class="assinatura">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${escapeHtml(agenteNome)}</div>
      <div class="assinatura-cargo">Agente de Defesa Civil</div>
    </div>
  </div>
</body>
</html>`;
}

function getConduta(nivel: string): string {
  const map: Record<string, string> = {
    r1: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina.',
    r2: 'Foram identificadas irregularidades. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
    r3: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação até laudo estrutural por engenheiro habilitado.',
    r4: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória.',
  };
  return map[nivel] || map.r1;
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

  const gerarPdf = async () => {
    setGerando(true);
    try {
      const agenteNome = vistoria?.agenteNome || profile?.name || '—';
      const html = gerarHtmlLaudo(vistoria, agenteNome);
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
      const agenteNome = vistoria?.agenteNome || profile?.name || '—';
      const html = gerarHtmlLaudo(vistoria, agenteNome);
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a impressão.');
    } finally {
      setGerando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState />
      </View>
    );
  }

  const nivel = vistoria?.nivelRisco || nivelParam || 'r1';
  const cor = RISCO_CORES[nivel] || '#10B981';
  const label = RISCO_LABELS[nivel] || 'BAIXO';

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

        <Button
          variant="primary"
          label={gerando ? 'Gerando PDF...' : 'Baixar PDF'}
          onPress={gerarPdf}
          loading={gerando}
          disabled={gerando}
          iconLeft={<Feather name="download" size={20} color="#FFF" />}
          style={{ marginBottom: 12 }}
        />

        <Button
          variant="secondary"
          label="Imprimir"
          onPress={imprimir}
          disabled={gerando}
          iconLeft={<Feather name="printer" size={20} color={theme.primary} />}
          style={{ marginBottom: 12 }}
        />

        <Button
          variant="secondary"
          label="Compartilhar"
          onPress={gerarPdf}
          disabled={gerando}
          iconLeft={<Feather name="share-2" size={20} color={theme.primary} />}
          style={{ marginBottom: 12 }}
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border }]}>
        <Button
          variant="primary"
          label="Voltar ao Início"
          onPress={() => router.replace('/(panel)/dashboard')}
        />
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
  footer: { padding: 24, paddingBottom: 40, borderTopWidth: 1 },
});
