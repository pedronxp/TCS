import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { useReport } from '../../../context/ReportContext';
import { riscoLabel, riscoColor, riscoConduta } from '../../../utils/riscoUtils';
import { parseProtocolo } from '../../../utils/uuid';

// ─── Form JSONs (require() deve ser estático no RN) ───────────────────────────
const FORM_JSONS: Record<string, any> = {
  risco_estrutural_v1:     require('../../../assets/formularios/risco_estrutural_v1.json'),
  vistoria_deslizamento_v1: require('../../../assets/formularios/vistoria_deslizamento_v1.json'),
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ItemResolvido {
  perguntaId: string;
  pergunta: string;
  resposta: string;
  tipo: string;
  pesoRisco: number;
}

interface GrupoResolvido {
  grupo: string;
  faseId: string;
  peso?: number;
  itens: ItemResolvido[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve IDs de respostas em textos legíveis, agrupados por fase */
function resolverRespostas(formularioId: string, respostas: Record<string, string>): GrupoResolvido[] {
  const form = FORM_JSONS[formularioId];
  if (!form) {
    // Fallback genérico: mostra chave → valor bruto
    const itens = Object.entries(respostas)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ perguntaId: k, pergunta: k, resposta: v, tipo: 'texto', pesoRisco: 0 }));
    return itens.length ? [{ grupo: 'Respostas', faseId: 'raw', itens }] : [];
  }

  const grupos: GrupoResolvido[] = [];
  for (const fase of form.fases || []) {
    const itens: ItemResolvido[] = [];
    for (const p of fase.perguntas || []) {
      if (p.tipo === 'foto') continue; // fotos não entram no relatório de texto
      const raw = respostas[p.id];
      if (raw === undefined || raw === null || raw === '') continue;

      let respostaTexto = raw;
      let pesoRisco = 0;
      if (p.tipo === 'cards' || p.tipo === 'multipla_escolha') {
        const op = (p.opcoes || []).find((o: any) => o.id === raw);
        if (op) { respostaTexto = op.texto; pesoRisco = op.pesoRisco ?? 0; }
      }

      itens.push({ perguntaId: p.id, pergunta: p.texto, resposta: respostaTexto, tipo: p.tipo, pesoRisco });
    }
    if (itens.length) grupos.push({ grupo: fase.titulo, faseId: fase.id, peso: fase.peso, itens });
  }
  return grupos;
}

/** Cor do indicador por pesoRisco */
function pesoColor(p: number) {
  if (p === 0) return '#22C55E';
  if (p <= 2)  return '#EAB308';
  if (p <= 4)  return '#F97316';
  return '#DC2626';
}

/** Formata data ISO em pt-BR */
function fmtData(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Gera HTML do relatório para exportação ───────────────────────────────────
function buildRelatorioHtml(
  draft: NonNullable<ReturnType<typeof useReport>['draft']>,
  grupos: GrupoResolvido[],
): string {
  const nivel = draft.nivelRisco;
  const cor   = riscoColor(nivel);
  const label = riscoLabel(nivel);
  const conduta = draft.condutaRecomendada || riscoConduta(nivel);

  const gruposHtml = grupos.map(g => {
    const rows = g.itens.map(item => {
      const dotColor = pesoColor(item.pesoRisco);
      return `
        <tr>
          <td class="q-cell">${item.pergunta}</td>
          <td class="a-cell">
            <span class="dot" style="background:${dotColor}"></span>
            ${item.resposta}
          </td>
        </tr>`;
    }).join('');

    const pesoLabel = g.peso !== undefined ? ` <span class="peso-tag">Peso ${g.peso}</span>` : '';
    return `
      <div class="grupo">
        <div class="grupo-header">${g.grupo}${pesoLabel}</div>
        <table class="respostas-table">
          <thead><tr><th>Pergunta</th><th>Resposta</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  const obsHtml = draft.observacoesTecnicas
    ? `<div class="section">
        <div class="sec-title">Observações Técnicas</div>
        <p class="conduta-box" style="border-color:${cor};background:${cor}18">${draft.observacoesTecnicas}</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  @page { margin: 40px 50px; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1A202C; background:#fff; font-size:12px; line-height:1.5; }

  /* ── Cabeçalho ── */
  .doc-header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #E2E8F0; padding-bottom:18px; margin-bottom:24px; }
  .brand { display:flex; flex-direction:column; }
  .brand-name { font-size:22px; font-weight:900; color:#1A365D; letter-spacing:-0.5px; }
  .brand-sub  { font-size:10px; font-weight:700; color:#718096; letter-spacing:1.5px; margin-top:2px; }
  .proto-block { text-align:right; }
  .proto-label { font-size:9px; font-weight:700; color:#A0AEC0; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px; }
  .proto-partes { display:flex; align-items:center; gap:6px; }
  .proto-parte { padding:4px 10px; border-radius:6px; font-size:12px; font-weight:800; }
  .proto-prefix { background:${cor}; color:#fff; }
  .proto-date   { background:#EDF2F7; color:#2D3748; }
  .proto-hash   { background:#EDF2F7; color:#1A202C; letter-spacing:2px; font-size:14px; font-weight:900; }
  .proto-dot    { color:#A0AEC0; font-size:14px; font-weight:900; }

  /* ── Badge de risco ── */
  .risco-badge { background:${cor}; color:#fff; text-align:center; padding:18px 24px; border-radius:12px; margin-bottom:24px; }
  .risco-badge-titulo { font-size:9px; font-weight:700; letter-spacing:2px; opacity:.85; }
  .risco-badge-nivel  { font-size:32px; font-weight:900; letter-spacing:-1px; margin:6px 0 4px; }
  .risco-badge-pts    { font-size:12px; opacity:.8; }

  /* ── Dados ── */
  .section { margin-bottom:22px; }
  .sec-title { font-size:9px; font-weight:800; letter-spacing:1.5px; color:#718096; text-transform:uppercase; border-bottom:1px solid #E2E8F0; padding-bottom:6px; margin-bottom:12px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .info-item label { font-size:9px; font-weight:700; color:#A0AEC0; text-transform:uppercase; display:block; margin-bottom:3px; }
  .info-item span  { font-size:13px; font-weight:600; }

  /* ── Grupos de respostas ── */
  .grupo { margin-bottom:18px; }
  .grupo-header { font-size:11px; font-weight:800; color:#1A365D; background:#EBF4FF; padding:8px 12px; border-radius:6px; margin-bottom:8px; }
  .peso-tag { background:#BEE3F8; color:#2B6CB0; font-size:9px; font-weight:700; padding:2px 7px; border-radius:10px; margin-left:8px; }
  .respostas-table { width:100%; border-collapse:collapse; }
  .respostas-table th { font-size:9px; font-weight:800; color:#718096; text-transform:uppercase; text-align:left; padding:7px 10px; background:#F7FAFC; border-bottom:2px solid #E2E8F0; }
  .respostas-table td { padding:8px 10px; border-bottom:1px solid #EDF2F7; vertical-align:top; font-size:12px; }
  .q-cell { width:50%; color:#4A5568; }
  .a-cell { font-weight:700; color:#1A202C; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:middle; }

  /* ── Conduta ── */
  .conduta-box { border-left:4px solid ${cor}; background:${cor}12; padding:12px 16px; border-radius:0 8px 8px 0; font-size:13px; line-height:1.7; color:#2D3748; margin-top:0; }

  /* ── Assinatura ── */
  .assinatura { margin-top:36px; display:flex; justify-content:flex-end; }
  .assinatura-inner { text-align:center; }
  .assinatura-linha { border-top:1px solid #A0AEC0; width:220px; margin:0 auto 8px; }
  .assinatura-nome  { font-size:13px; font-weight:700; }
  .assinatura-cargo { font-size:10px; color:#718096; }

  /* ── Rodapé ── */
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #E2E8F0; font-size:9px; color:#A0AEC0; text-align:center; }
</style>
</head>
<body>

  <div class="doc-header">
    <div class="brand">
      <div class="brand-name">TCS</div>
      <div class="brand-sub">RELATÓRIO DE VISTORIA</div>
    </div>
    <div class="proto-block">
      <div class="proto-label">PROTOCOLO OFICIAL</div>
      ${(() => {
        const p = parseProtocolo(draft.protocolo);
        return p
          ? `<div class="proto-partes">
               <span class="proto-parte proto-prefix">${p.prefix}</span>
               <span class="proto-dot">·</span>
               <span class="proto-parte proto-date">${p.date}</span>
               <span class="proto-dot">·</span>
               <span class="proto-parte proto-hash">${p.hash}</span>
             </div>`
          : `<div class="proto-num">${draft.protocolo}</div>`;
      })()}
    </div>
  </div>

  <div class="risco-badge">
    <div class="risco-badge-titulo">NÍVEL DE RISCO — ${draft.formularioId}</div>
    <div class="risco-badge-nivel">RISCO ${label}</div>
    <div class="risco-badge-pts">${draft.pontuacaoTotal} pontos acumulados</div>
  </div>

  <div class="section">
    <div class="sec-title">Dados da Vistoria</div>
    <div class="info-grid">
      <div class="info-item"><label>Endereço</label><span>${draft.endereco || '—'}</span></div>
      <div class="info-item"><label>Município</label><span>${draft.municipio || '—'}</span></div>
      <div class="info-item"><label>Data / Hora</label><span>${fmtData(draft.dataVistoria)}</span></div>
      <div class="info-item"><label>Agente</label><span>${draft.agenteNome || '—'}</span></div>
      <div class="info-item"><label>Formulário</label><span>${draft.formularioId || '—'}</span></div>
      <div class="info-item"><label>Cargo</label><span>${draft.cargo || 'Agente de Defesa Civil'}</span></div>
    </div>
  </div>

  ${gruposHtml ? `<div class="section"><div class="sec-title">Respostas do Formulário</div>${gruposHtml}</div>` : ''}

  <div class="section">
    <div class="sec-title">Conduta Recomendada</div>
    <p class="conduta-box">${conduta}</p>
  </div>

  ${obsHtml}

  <div class="assinatura">
    <div class="assinatura-inner">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${draft.agenteNome || '—'}</div>
      <div class="assinatura-cargo">${draft.cargo || 'Agente de Defesa Civil'}</div>
    </div>
  </div>

  <div class="footer">
    TCS — Relatório de Vistoria · Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
  </div>

</body>
</html>`;
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
  const { draft, updateField } = useReport();
  const [gerando, setGerando] = useState(false);

  // Resolve respostas em textos legíveis agrupados por fase
  const grupos = useMemo<GrupoResolvido[]>(() => {
    if (!draft) return [];
    return resolverRespostas(draft.formularioId, draft.respostas || {});
  }, [draft?.formularioId, draft?.respostas]);

  const totalRespondidas = useMemo(() => grupos.reduce((acc, g) => acc + g.itens.length, 0), [grupos]);

  if (!draft) {
    return (
      <View style={[s.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Feather name="file-text" size={48} color={theme.border} />
        <Text style={[s.emptyText, { color: theme.textSecondary }]}>
          Nenhum relatório ativo.{'\n'}Conclua uma vistoria primeiro.
        </Text>
        <TouchableOpacity style={[s.emptyBtn, { borderColor: theme.border }]} onPress={() => router.back()}>
          <Text style={[{ fontSize: 14, fontWeight: '700' }, { color: theme.textSecondary }]}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cor   = riscoColor(draft.nivelRisco);
  const label = riscoLabel(draft.nivelRisco);
  const proto = parseProtocolo(draft.protocolo);

  const exportarPDF = async () => {
    setGerando(true);
    try {
      const html = buildRelatorioHtml(draft, grupos);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Relatório TCS', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF Gerado', `Salvo em:\n${uri}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const imprimir = async () => {
    setGerando(true);
    try {
      await Print.printAsync({ html: buildRelatorioHtml(draft, grupos) });
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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.text }]}>Relatório Técnico</Text>
          <Text style={[s.headerSub, { color: theme.textSecondary }]}>{draft.protocolo}</Text>
        </View>
        <View style={[s.riscoBadgeSmall, { backgroundColor: cor }]}>
          <Text style={s.riscoBadgeText}>{label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Card do Relatório ───────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>

          {/* ── Brand + Protocolo ─────────────────────────────────────── */}
          <View style={[s.brandHeader, { borderBottomColor: theme.border }]}>
            {/* Logo + nome */}
            <View style={s.brandLeft}>
              <Image source={require('../../../assets/logo.png')} style={s.logo} resizeMode="contain" />
              <View>
                <Text style={[s.brandName, { color: theme.text }]}>TCS</Text>
                <Text style={[s.brandSub, { color: theme.textSecondary }]}>RELATÓRIO DE VISTORIA</Text>
              </View>
            </View>

            {/* Protocolo em partes */}
            {proto ? (
              <View style={[s.protoBox, { borderColor: theme.border, backgroundColor: theme.iconBackground }]}>
                <Text style={[s.protoBoxLabel, { color: theme.textSecondary }]}>PROTOCOLO</Text>
                <View style={s.protoPartes}>
                  <View style={[s.protoParte, { backgroundColor: cor }]}>
                    <Text style={s.protoParteText}>{proto.prefix}</Text>
                  </View>
                  <Text style={[s.protoDot, { color: theme.textSecondary }]}>·</Text>
                  <View style={[s.protoParte, { backgroundColor: theme.cardBorder }]}>
                    <Text style={[s.protoParteText, { color: theme.text }]}>{proto.date}</Text>
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
          <View style={[s.riscoBanner, { backgroundColor: cor }]}>
            <Text style={s.bannerLabel}>NÍVEL DE RISCO</Text>
            <Text style={s.bannerNivel}>RISCO {label}</Text>
            <Text style={s.bannerPts}>{draft.pontuacaoTotal} pontos acumulados</Text>
          </View>

          {/* Dados da vistoria */}
          <View style={[s.section, { borderBottomColor: theme.border }]}>
            <Text style={[s.secTitle, { color: theme.textSecondary }]}>DADOS DA VISTORIA</Text>
            <View style={s.infoGrid}>
              <InfoItem label="Endereço"   value={draft.endereco}    theme={theme} />
              <InfoItem label="Município"  value={draft.municipio}   theme={theme} />
              <InfoItem label="Data / Hora" value={fmtData(draft.dataVistoria)} theme={theme} />
              <InfoItem label="Agente"     value={draft.agenteNome}  theme={theme} />
              <InfoItem label="Formulário" value={draft.formularioId} theme={theme} />
            </View>
          </View>

          {/* Resumo de cobertura */}
          <View style={[s.section, { borderBottomColor: theme.border }]}>
            <View style={s.coverageRow}>
              <Feather name="check-square" size={14} color={cor} />
              <Text style={[s.coverageText, { color: theme.textSecondary }]}>
                <Text style={{ fontWeight: '800', color: theme.text }}>{totalRespondidas}</Text>
                {' perguntas respondidas · '}
                <Text style={{ fontWeight: '800', color: theme.text }}>{grupos.length}</Text>
                {' elementos avaliados'}
              </Text>
            </View>
          </View>

          {/* ── Respostas agrupadas por fase ─────────────────────────────── */}
          {grupos.map((g, gi) => (
            <View key={g.faseId} style={[s.grupo, { borderBottomColor: theme.border, borderBottomWidth: gi < grupos.length - 1 ? 1 : 0 }]}>
              {/* Cabeçalho do grupo */}
              <View style={[s.grupoHeader, { backgroundColor: theme.iconBackground }]}>
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
                    { borderBottomColor: theme.border, borderBottomWidth: ii < g.itens.length - 1 ? 1 : 0 },
                  ]}
                >
                  {/* Indicador de severidade */}
                  <View style={[s.dot, { backgroundColor: pesoColor(item.pesoRisco) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemPergunta, { color: theme.textSecondary }]}>{item.pergunta}</Text>
                    <Text style={[s.itemResposta, { color: theme.text }]}>{item.resposta}</Text>
                  </View>
                  {item.pesoRisco > 0 && (
                    <View style={[s.pesoBadge, { backgroundColor: pesoColor(item.pesoRisco) + '22' }]}>
                      <Text style={[s.pesoBadgeText, { color: pesoColor(item.pesoRisco) }]}>+{item.pesoRisco}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}

          {grupos.length === 0 && (
            <View style={[s.section, { borderBottomColor: theme.border }]}>
              <Text style={[s.emptyText, { color: theme.textSecondary, textAlign: 'center', fontSize: 13 }]}>
                Nenhuma resposta registrada.
              </Text>
            </View>
          )}

          {/* Conduta recomendada — editável */}
          <View style={[s.section, { borderBottomColor: theme.border }]}>
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
          <View style={[s.section, { borderBottomColor: theme.border }]}>
            <EditableField
              label="Observações Técnicas (opcional)"
              value={draft.observacoesTecnicas}
              placeholder="Condições climáticas, acesso, particularidades do local..."
              onSave={v => updateField('observacoesTecnicas', v)}
              theme={theme}
            />
          </View>

          {/* Assinatura — editável */}
          <View style={[s.section, { borderBottomWidth: 0 }]}>
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

        {/* ── Exportação ────────────────────────────────────────────────── */}
        <Text style={[s.exportLabel, { color: theme.textSecondary }]}>EXPORTAR RELATÓRIO</Text>

        <TouchableOpacity style={[s.exportBtn, { backgroundColor: cor }]} onPress={exportarPDF} disabled={gerando}>
          {gerando
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Feather name="download" size={20} color="#FFF" />}
          <Text style={s.exportBtnText}>{gerando ? 'Gerando PDF...' : 'Baixar PDF'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.exportBtnOutline, { borderColor: theme.border }]} onPress={imprimir} disabled={gerando}>
          <Feather name="printer" size={20} color={theme.textSecondary} />
          <Text style={[s.exportBtnOutlineText, { color: theme.textSecondary }]}>Imprimir</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.exportBtnOutline, { borderColor: theme.border }]} onPress={exportarPDF} disabled={gerando}>
          <Feather name="share-2" size={20} color={theme.textSecondary} />
          <Text style={[s.exportBtnOutlineText, { color: theme.textSecondary }]}>Compartilhar</Text>
        </TouchableOpacity>

      </ScrollView>
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

  // Header
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  riscoBadgeSmall: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  riscoBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  scroll: { padding: 20, paddingBottom: 60 },

  // Card
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },

  // Brand header
  brandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, gap: 12 },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 10 },
  brandName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginTop: 1 },
  protoLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  protoNum: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  // Protocolo em partes
  protoBox: { borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 150 },
  protoBoxLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  protoPartes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  protoParte: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  protoParteText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  protoDot: { fontSize: 12, fontWeight: '900' },

  // Risk banner
  riscoBanner: { padding: 20, alignItems: 'center' },
  bannerLabel: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 2, opacity: 0.85 },
  bannerNivel: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginVertical: 4 },
  bannerPts:   { color: '#FFF', fontSize: 12, opacity: 0.8 },

  // Section
  section: { padding: 18, borderBottomWidth: 1 },
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
  grupoTitulo: { fontSize: 13, fontWeight: '800', flex: 1 },
  pesoTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pesoText: { fontSize: 10, fontWeight: '800' },

  // Item de resposta
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 2 },
  itemPergunta: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  itemResposta: { fontSize: 14, fontWeight: '700' },
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
});
