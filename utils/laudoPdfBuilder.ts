/**
 * utils/laudoPdfBuilder.ts
 * Gerador único de HTML para PDF de laudo técnico de vistoria.
 * Substitui as 3 implementações inline em resultado.tsx, laudo.tsx e relatorio.tsx.
 */

import { File, Paths } from 'expo-file-system';
import { escapeHtml, formatarDataHora } from './htmlUtils';
import {
  CalculoRiscoSnapshot,
  formatarPontuacaoRisco,
  normalizarNivelRisco,
  parseCalculoRiscoSnapshot,
  resolverApresentacaoRisco,
} from './riscoUtils';
import { DEFESA_CIVIL_LOGO_BASE64 } from '../supabase/functions/_shared/defesaCivilLogo';
import {
  buildPdfBaseCss,
  humanizePdfFieldKey,
  PDF_COLORS,
  PDF_DESIGN_LABEL,
  PDF_RISK_COLORS,
} from '../supabase/functions/_shared/pdfDesignSystem';
import {
  ASSETS,
  calcularRaioAlvoArvore,
  flattenPerguntas,
  getObservacaoCondicionalRiscoKey,
  getPerguntaIdFromObservacaoCondicionalRiscoKey,
  opcaoAcionaObservacaoCondicionalRisco,
  PerguntaModel,
} from './formulariosAssets';

export interface LaudoData {
  id: string;
  protocolo?: string;
  nivelRisco: string;
  pontuacaoTotal: number;
  endereco: string;
  municipio: string;
  dataVistoria: string | null;
  agenteNome: string;
  formularioId?: string;
  respostasJson?: string;
  calculoRisco?: CalculoRiscoSnapshot | string | null;
  foto_url?: string | null;
  fotosUrls?: string[] | null;
  // Mantido no contrato de entrada para compatibilidade com snapshots antigos.
  // A conduta não é mais exibida no PDF de vistoria.
  condutaRecomendada?: string;
  observacoesTecnicas?: string;
  cargo?: string;
  bairro?: string;
  responsavelNome?: string;
  modoTreinamento?: boolean;
}

/** Dados extras para o Termo de Interdição (R3/R4) */
export interface TermoInterdicaoData {
  nomeNotificado: string;
  cpfNotificado: string;
  enderecoRua: string;
  enderecoNumero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  telefone: string;
}

/**
 * Formata data ISO para formato extenso brasileiro.
 * Ex: "02 de abril de 2026"
 */
function dataExtenso(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '-';
  }
}

/**
 * Gera o HTML do TERMO DE INTERDIÇÃO — somente para R3/R4.
 * Segue o modelo oficial do Laudo.docx com {{DATA_EXTENSO}}, {{Cidade}} e {{ANO}}.
 */
export function buildTermoInterdicaoHtml(
  laudo: LaudoData,
  notificado: TermoInterdicaoData,
): string {
  const protocolo = (laudo.id || '000000').slice(0, 8).toUpperCase();
  const dataExt = dataExtenso(laudo.dataVistoria);
  const ano = laudo.dataVistoria ? new Date(laudo.dataVistoria).getFullYear() : new Date().getFullYear();
  const cidade = notificado.cidade || laudo.municipio || '-';
  const calculo = parseCalculoRiscoSnapshot(laudo.calculoRisco);
  const nivel = normalizarNivelRisco(laudo.nivelRisco || calculo?.nivelRisco, 'r1');
  const trainingNotice = laudo.modoTreinamento
    ? `<div class="training-notice">MODO DE TESTE - documento sem validade operacional</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  ${buildPdfBaseCss()}
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid ${PDF_COLORS.navy};
    padding-bottom: 14px;
    margin-bottom: 22px;
  }
  .training-notice {
    border: 1px solid ${PDF_COLORS.warning};
    background: ${PDF_COLORS.warningSoft};
    color: ${PDF_COLORS.warning};
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 14px;
    font-size: 9px;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.7px;
  }
  .doc-header-logo img {
    height: 54px;
    width: auto;
    display: block;
  }
  .doc-header-text {
    text-align: right;
  }
  .doc-title {
    font-size: 17px;
    font-weight: bold;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: ${PDF_COLORS.navy};
    margin-bottom: 4px;
  }
  .doc-number {
    font-size: 10px;
    color: ${PDF_COLORS.muted};
    font-weight: bold;
  }
  .preambulo {
    text-align: justify;
    margin-bottom: 20px;
    font-size: 10.5pt;
    line-height: 1.65;
  }
  .section-title {
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: ${PDF_COLORS.navy};
    border-bottom: 1px solid ${PDF_COLORS.line};
    padding-bottom: 5px;
    margin-bottom: 10px;
    margin-top: 20px;
  }
  .field-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    border: 1px solid ${PDF_COLORS.line};
  }
  .field-grid td {
    padding: 7px 9px;
    border: 1px solid ${PDF_COLORS.lineSoft};
    font-size: 9.5pt;
    vertical-align: top;
  }
  .field-grid .field-label {
    font-weight: bold;
    width: 118px;
    background: ${PDF_COLORS.surface};
    color: ${PDF_COLORS.muted};
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .motivo {
    text-align: justify;
    line-height: 1.65;
    margin-top: 12px;
    font-size: 10.5pt;
  }
  .motivo strong {
    font-weight: bold;
    text-transform: uppercase;
  }
  .lei {
    margin-top: 14px;
    padding: 11px 13px;
    font-size: 8.8pt;
    color: ${PDF_COLORS.text};
    border: 1px solid ${PDF_COLORS.lineSoft};
    border-left: 3px solid ${PDF_COLORS.blue};
    background: ${PDF_COLORS.surface};
    line-height: 1.55;
  }
  .assinatura-section {
    margin-top: 48px;
    text-align: center;
    page-break-inside: avoid;
  }
  .assinatura-linha {
    border-top: 1px solid ${PDF_COLORS.navy};
    width: 280px;
    margin: 0 auto 8px;
  }
  .assinatura-nome {
    font-size: 10pt;
    font-weight: bold;
    color: ${PDF_COLORS.navy};
  }
  .assinatura-cargo {
    font-size: 8.5pt;
    color: ${PDF_COLORS.muted};
  }
</style>
</head>
<body>
  ${trainingNotice}

  <div class="doc-header">
    <div class="doc-header-logo">
      <img src="${DEFESA_CIVIL_LOGO_BASE64}" alt="Defesa Civil Municipal" />
    </div>
    <div class="doc-header-text">
      <div class="doc-title">Termo de Interdição</div>
      <div class="doc-number">Nº ${escapeHtml(protocolo)}/${ano}</div>
    </div>
  </div>

  <div class="preambulo">
    Vistoria realizada em dia <strong>${escapeHtml(dataExt)}</strong>,
    equipe de Proteção e Defesa Civil de <strong>${escapeHtml(cidade)}</strong>,
    relacionado com o Relatório de Vistoria nº <strong>${escapeHtml(protocolo)}/${ano}</strong>.
  </div>

  <div class="section-title">Identificação do Notificado</div>
  <table class="field-grid">
    <tr>
      <td class="field-label">Nome</td>
      <td colspan="3">${escapeHtml(notificado.nomeNotificado || '-')}</td>
    </tr>
    <tr>
      <td class="field-label">CPF</td>
      <td colspan="3">${escapeHtml(notificado.cpfNotificado || '-')}</td>
    </tr>
    <tr>
      <td class="field-label">Endereço</td>
      <td>R: ${escapeHtml(notificado.enderecoRua || '-')}</td>
      <td class="field-label" style="width:50px">Nº</td>
      <td style="width:80px">${escapeHtml(notificado.enderecoNumero || '-')}</td>
    </tr>
    <tr>
      <td class="field-label">Complemento</td>
      <td>${escapeHtml(notificado.complemento || '-')}</td>
      <td class="field-label">Bairro</td>
      <td>${escapeHtml(notificado.bairro || '-')}</td>
    </tr>
    <tr>
      <td class="field-label">Cidade</td>
      <td>${escapeHtml(cidade)}</td>
      <td class="field-label">Contato</td>
      <td>${escapeHtml(notificado.telefone || '-')}</td>
    </tr>
  </table>

  <div class="section-title">Motivo da Interdição</div>

  <div class="motivo">
    Em decorrência das anomalias constatadas na edificação/solo pelo vistoriador de
    Proteção e Defesa Civil e relatadas no relatório de vistoria
    nº <strong>${escapeHtml(protocolo)}/${ano}</strong>, fica <strong>INTERDITADO</strong>,
    ${nivel === 'r4'
      ? 'as manifestações patológicas comprometem gravemente o desempenho da construção e representam risco iminente à vida de seus moradores/usuários.'
      : 'manifestações patológicas comprometem o desempenho da construção e colocam em risco à vida de seus moradores/usuários.'}
    O notificado deve providenciar a remoção imediata de todos os moradores e seus usuários,
    devendo a edificação permanecer <strong>INTERDITADA</strong> até que as condições de
    segurança e habitabilidade sejam restabelecidas.
  </div>

  <div class="lei">
    O vistoriador atesta que a presente interdição obedece criteriosamente aos princípios da
    <strong>Lei Federal Nº 12.608, de 10 de abril de 2012</strong>, que aduz no Art.2º a seguinte redação:<br/>
    <em>Art. 2º É dever da União, dos Estados, do Distrito Federal e dos Municípios adotar as medidas
    necessárias à redução dos riscos de desastre.</em><br/>
    <em>§ 2º A incerteza quanto ao risco de desastre não constituirá óbice para a adoção das medidas
    preventivas e mitigadoras da situação de risco.</em>
  </div>

  <div class="assinatura-section">
    <div class="assinatura-linha"></div>
    <div class="assinatura-nome">${escapeHtml(laudo.agenteNome || '-')}</div>
    <div class="assinatura-cargo">${escapeHtml(laudo.cargo || 'Vistoriador de Proteção e Defesa Civil')}</div>
  </div>

  <div class="pdf-page-footer">
    <div class="pdf-page-footer-row">
      <span>Defesa Civil - Termo de Interdição - ${PDF_DESIGN_LABEL}</span>
      <span>Protocolo ${escapeHtml(protocolo)}/${ano}</span>
    </div>
  </div>

</body>
</html>`;
}


/**
 * Gera o HTML completo do RELATÓRIO DE VISTORIA para exportação via expo-print.
 * Formato profissional com cabeçalho institucional, tabela de dados estruturada,
 * data por extenso, itens de resposta numerados e seção de assinatura formal.
 */
export async function buildLaudoHtml(dados: LaudoData): Promise<string> {
  const calculo = parseCalculoRiscoSnapshot(dados.calculoRisco);
  const nivel = normalizarNivelRisco(dados.nivelRisco || calculo?.nivelRisco, 'r1');
  const pontuacaoTotal = calculo?.pontuacaoTotal ?? dados.pontuacaoTotal ?? 0;
  const apresentacao = resolverApresentacaoRisco({
    formularioId: dados.formularioId,
    pontuacao: pontuacaoTotal,
    nivelRisco: nivel,
    calculoRisco: calculo,
  });
  const isAvaliacaoArvore = dados.formularioId === 'avaliacao_arvore_cbmmg_v1';
  const riskColorKey = apresentacao.codigo === 'risco_iminente'
    ? 'iminente'
    : apresentacao.codigo === 'nao_iminente'
      ? 'nao_iminente'
      : nivel;
  const cor = PDF_RISK_COLORS[riskColorKey];
  const label = apresentacao.label;
  const data = formatarDataHora(dados.dataVistoria);
  const protocolo = dados.protocolo?.trim() || (dados.id || '000000').slice(0, 8).toUpperCase();
  const agravantes = calculo?.agravantes || [];
  const regrasCondicionais = calculo?.regrasCondicionais || [];
  const agravantesHtml = agravantes.length
    ? `<div class="risk-aggravants">
        <div class="risk-aggravants-title">Agravante crítico aplicado</div>
        ${agravantes.map(agravante => `
          <div class="risk-aggravant-item">
            <strong>${escapeHtml(agravante.label)}</strong><br/>
            ${escapeHtml(agravante.descricao)}
          </div>
        `).join('')}
      </div>`
    : '';
  const regrasCondicionaisHtml = regrasCondicionais.length
    ? `<div class="risk-rules">
        <div class="risk-rules-title">Regra técnica aplicada</div>
        ${regrasCondicionais.map(regra => `
          <div class="risk-rule-item">
            <strong>${escapeHtml(regra.label)}</strong><br/>
            <span>${escapeHtml(regra.descricao)}</span><br/>
            <span><strong>Resposta do agente:</strong> ${escapeHtml(regra.resposta)}</span><br/>
            <span><strong>Efeito no cálculo:</strong> ${escapeHtml(regra.efeito)}</span>
            ${regra.justificativa ? `<div class="risk-rule-justification"><strong>Justificativa técnica:</strong> ${escapeHtml(regra.justificativa)}</div>` : ''}
          </div>
        `).join('')}
      </div>`
    : '';
  const trainingNotice = dados.modoTreinamento
    ? `<div class="training-notice">MODO DE TESTE - documento sem validade operacional</div>`
    : '';

  // O schema form mapeia os IDs para textos ricos
  let schemaForm = null;
  let perguntasFlat: PerguntaModel[] = [];
  if (dados.formularioId && ASSETS[dados.formularioId]) {
    schemaForm = ASSETS[dados.formularioId];
    perguntasFlat = flattenPerguntas(schemaForm);
  }
  let respostasObjeto: Record<string, unknown> = {};
  try {
    respostasObjeto = typeof dados.respostasJson === 'string'
      ? JSON.parse(dados.respostasJson || '{}')
      : (dados.respostasJson || {}) as Record<string, unknown>;
  } catch { /* respostas inválidas */ }

  // Gerar tabela de respostas mapeadas
  let respostasHtml = '';
  let itemCount = 0;
  if (calculo?.itens?.length && !isAvaliacaoArvore) {
    itemCount = calculo.itens.length;
    respostasHtml = calculo.itens.map((item, index) => {
      const pontuacaoDesc = item.pesoRisco > 0
        ? ` <span class="answer-score">(+${formatarPontuacaoRisco(item.pesoRisco)} pts)</span>`
        : '';
      const observacaoDesc = item.observacao
        ? `<div class="item-observation"><strong>Observação:</strong> ${escapeHtml(item.observacao)}</div>`
        : '';
      return `<tr><td class="td-param">${String(index + 1).padStart(2, '0')} - ${escapeHtml(item.pergunta)}</td><td class="td-resp">${escapeHtml(item.resposta)}${pontuacaoDesc}${observacaoDesc}</td></tr>`;
    }).join('');
  } else if (dados.respostasJson) {
    try {
      const respostas = respostasObjeto;

      respostasHtml = Object.entries(respostas as Record<string, unknown>)
        .map(([k, val]) => {
          // Remover campo foto das perguntas normais caso seja o "id"
          if (k.includes('foto')) return '';
          if (k.toLowerCase().includes('conduta_recomendada')) return '';
          if (k.toLowerCase().includes('formulario_utilizado')) return '';
          if (k.toLowerCase() === 'formularioid') return '';
          if (getPerguntaIdFromObservacaoCondicionalRiscoKey(k)) return '';

          itemCount++;
          let safeKey = escapeHtml(humanizePdfFieldKey(k));
          let safeVal = escapeHtml(Array.isArray(val) ? (val as string[]).join(', ') : String(val));
          let pontuacaoDesc = '';
          let observacaoDesc = '';

          // De-Para usando o Formulário JSON
          if (schemaForm) {
            const pDef = perguntasFlat.find((p: any) => p.id === k);
            if (pDef) {
              safeKey = escapeHtml(pDef.texto || safeKey);
              if (pDef.unidade && pDef.tipoEntrada === 'numero_decimal') {
                safeVal = `${safeVal} ${escapeHtml(pDef.unidade)}`;
              }
              if (pDef.tipo === 'cards' || pDef.tipo === 'multipla_escolha') {
                const opDef = pDef.opcoes?.find((o: any) => o.id === String(val));
                if (opDef) {
                  let vExtenso = escapeHtml(opDef.texto);
                  if (opDef.descricao) vExtenso += `<br/><span style="font-size: 10px; color: #64748B;">(${escapeHtml(opDef.descricao)})</span>`;
                  safeVal = vExtenso;
                  if (opDef.pesoRisco > 0) {
                      pontuacaoDesc = ` <span class="answer-score">(+${formatarPontuacaoRisco(opDef.pesoRisco)} pts)</span>`;
                  }
                  const observacaoKey = getObservacaoCondicionalRiscoKey(pDef.id);
                  const observacao = opcaoAcionaObservacaoCondicionalRisco(dados.formularioId, pDef, String(val))
                    ? String((respostas as Record<string, unknown>)[observacaoKey] ?? '').trim()
                    : '';
                  if (observacao) {
                    observacaoDesc = `<div class="item-observation"><strong>Observação:</strong> ${escapeHtml(observacao)}</div>`;
                  }
                }
              }
            }
          }
          const raioDerivado = isAvaliacaoArvore && k === 'arv_altura_m'
            ? calcularRaioAlvoArvore(String(val))
            : null;
          const derivadoHtml = raioDerivado !== null
            ? `<div class="item-observation"><strong>Raio de referência dos alvos (altura × 1,5):</strong> ${formatarPontuacaoRisco(raioDerivado)} m</div>`
            : '';
          return `<tr><td class="td-param">${String(itemCount).padStart(2, '0')} - ${safeKey}</td><td class="td-resp">${safeVal}${pontuacaoDesc}${observacaoDesc}${derivadoHtml}</td></tr>`;
        }).join('');
    } catch { /* sem respostas */ }
  }

  // Tratamento de múltiplas imagens
  // Prioridade: fotosUrls[] > [foto_url] — deduplica por valor
  const urlsParaProcessar: string[] = [];
  if (dados.fotosUrls && dados.fotosUrls.length > 0) {
    dados.fotosUrls.forEach(u => u && urlsParaProcessar.push(u));
  }
  if (dados.foto_url && !urlsParaProcessar.includes(dados.foto_url)) {
    urlsParaProcessar.unshift(dados.foto_url);
  }
  if (isAvaliacaoArvore) {
    perguntasFlat.filter(p => p.tipo === 'foto').forEach(p => {
      const uri = String(respostasObjeto[p.id] || '');
      if (uri && !urlsParaProcessar.includes(uri)) urlsParaProcessar.push(uri);
    });
  }

  const converterParaBase64 = async (url: string): Promise<string | null> => {
    let temporaryFile: File | null = null;
    try {
      if (url.startsWith('file://')) {
        const file = new File(url);
        if (!file.exists) return null;
        const b64 = await file.base64();
        return `data:image/jpeg;base64,${b64}`;
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        temporaryFile = new File(
          Paths.cache,
          `foto_laudo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`
        );
        const downloaded = await File.downloadFileAsync(url, temporaryFile, { idempotent: true });
        const b64 = await downloaded.base64();
        return `data:image/jpeg;base64,${b64}`;
      }
    } catch (e) {
      console.warn('[laudoPdfBuilder] Erro ao converter foto:', e);
    } finally {
      if (temporaryFile?.exists) {
        try { temporaryFile.delete(); } catch { /* arquivo temporário já removido */ }
      }
    }
    return null;
  };

  const fotosBase64 = (await Promise.all(urlsParaProcessar.map(converterParaBase64)))
    .filter((b): b is string => b !== null);

  let imageHtml = '';
  if (fotosBase64.length > 0) {
    const isSingle = fotosBase64.length === 1;
    const fotosHtml = fotosBase64.map((b64, i) => `
      <div class="photo-card" style="${isSingle ? 'max-width:480px; margin:0 auto;' : ''}">
        <img src="${b64}" alt="Evidência ${i + 1}"/>
        <div style="font-size:9px; color:#64748B; text-align:center; padding:5px;">Evidência fotográfica ${i + 1}${isAvaliacaoArvore && i === 0 ? ' - visão geral da árvore' : isAvaliacaoArvore ? ' - defeito determinante' : ''}</div>
      </div>`).join('');
    imageHtml = `
      <div class="section">
        <div class="section-title">Registro Fotográfico (${fotosBase64.length})</div>
        <div style="display:${isSingle ? 'block' : 'grid'}; ${isSingle ? '' : 'grid-template-columns: repeat(2, 1fr);'} gap:10px;">
          ${fotosHtml}
        </div>
      </div>`;
  }

  const obsHtml = dados.observacoesTecnicas
    ? `<div class="section">
        <div class="section-title">Observações Técnicas</div>
        <div class="obs-box pdf-preserve-lines">${escapeHtml(dados.observacoesTecnicas)}</div>
      </div>`
    : '';

  // Cor de fundo suave para o painel de risco
  const corBg = apresentacao.codigo === 'nao_iminente' || nivel === 'r1'
    ? PDF_COLORS.successSoft
    : nivel === 'r2'
      ? PDF_COLORS.warningSoft
      : PDF_COLORS.dangerSoft;
  const corBorder = PDF_COLORS.line;
  const riskDetailsHtml = agravantesHtml || regrasCondicionaisHtml
    ? `<div class="risk-details">${agravantesHtml}${regrasCondicionaisHtml}</div>`
    : '';
  const riskPanelHtml = `
  <!-- PAINEL DE RISCO -->
  <div class="risk-panel pdf-avoid-break">
    <div class="risk-indicator">
      <div class="risk-level-label">${isAvaliacaoArvore ? 'Resultado CBMMG' : 'Classificação Técnica'}</div>
      <div class="risk-level-value">${escapeHtml(isAvaliacaoArvore ? label : nivel.toUpperCase())}</div>
    </div>
    <div class="risk-score">
      <div class="risk-score-label">Pontuação apurada</div>
      <div class="risk-score-value">${formatarPontuacaoRisco(pontuacaoTotal)}</div>
    </div>
  </div>
  ${riskDetailsHtml}`;

  const metodologiaHtml = isAvaliacaoArvore ? `
  <div class="section" style="page-break-inside: avoid;">
    <div class="section-title">Metodologia e Quadro de Pontuação</div>
    <div class="legal-note" style="margin-bottom:12px;">
      <strong>${escapeHtml(schemaForm?.metodologia?.titulo || 'Quadro de Avaliação de Árvore de Risco')}</strong><br/>
      ${escapeHtml(calculo?.fonteMetodologica || schemaForm?.metodologia?.fonte || '')}<br/>
      Versão metodológica: ${escapeHtml(calculo?.metodologiaVersao || schemaForm?.metodologia?.versao || '1.0')}
    </div>
    <table class="resp-table">
      <thead><tr><th>Item</th><th>Critério determinante</th><th>Pontos</th></tr></thead>
      <tbody>${(calculo?.itens || []).map((item, index) => `<tr><td class="td-num">${index + 1}</td><td class="td-param">${escapeHtml(item.pergunta)}<br/><span style="font-weight:normal;">${escapeHtml(item.resposta)}</span></td><td class="td-resp"><strong>${formatarPontuacaoRisco(item.pesoRisco)}</strong></td></tr>`).join('')}</tbody>
      <tfoot>
        <tr><td colspan="2"><strong>Soma bruta</strong></td><td><strong>${formatarPontuacaoRisco(calculo?.somaBruta ?? pontuacaoTotal)}</strong></td></tr>
        <tr><td colspan="2"><strong>Total após teto metodológico</strong></td><td><strong>${formatarPontuacaoRisco(pontuacaoTotal)} / ${formatarPontuacaoRisco(calculo?.tetoAplicado ?? 10)}</strong></td></tr>
      </tfoot>
    </table>
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  ${buildPdfBaseCss()}
  @page { size: A4 portrait; margin: 13.5mm 16mm 20mm; }
  body {
    color: ${PDF_COLORS.ink};
    font-size: 10.5pt;
  }

  /* ═══ CABEÇALHO ═══ */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid ${PDF_COLORS.navy};
    padding-bottom: 10px;
    margin-bottom: 28px;
  }
  .training-notice {
    border: 1px solid ${PDF_COLORS.warning};
    background: ${PDF_COLORS.warningSoft};
    color: ${PDF_COLORS.warning};
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 14px;
    text-align: center;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .doc-brand {
    min-width: 76px;
  }
  .doc-brand img {
    display: block;
    width: 58px;
    height: 58px;
    object-fit: contain;
  }
  .doc-info { text-align: right; }
  .doc-type {
    font-size: 12pt;
    font-weight: 800;
    color: ${PDF_COLORS.navy};
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .doc-num {
    font-size: 9px;
    font-weight: 600;
    color: ${PDF_COLORS.muted};
    margin-top: 4px;
  }

  /* ═══ PAINEL DE RISCO ═══ */
  .risk-panel {
    display: flex;
    border: 0;
    border-radius: 0;
    overflow: hidden;
    margin-bottom: 26px;
  }
  .risk-indicator {
    background: ${cor};
    color: white;
    padding: 14px 16px;
    width: 60%;
    min-height: 62px;
  }
  .risk-level-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.2px;
    opacity: 0.85;
    text-transform: uppercase;
  }
  .risk-level-value {
    font-size: 19pt;
    font-weight: 900;
    margin: 4px 0 2px;
    letter-spacing: -0.5px;
  }
  .risk-score {
    background: ${corBg};
    padding: 12px 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: right;
  }
  .risk-score-label {
    font-size: 8px;
    font-weight: 800;
    color: ${cor};
    letter-spacing: 0.7px;
    text-transform: uppercase;
  }
  .risk-score-value {
    font-size: 24px;
    line-height: 1;
    font-weight: 900;
    color: ${cor};
    margin: 4px 0 2px;
  }
  .risk-details {
    background: ${corBg};
    border: 1px solid ${corBorder};
    border-radius: 6px;
    padding: 10px 12px;
    margin: 0 0 20px;
    page-break-inside: avoid;
  }
  .risk-aggravants {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }
  .risk-rules {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid ${corBorder};
  }
  .risk-aggravants-title,
  .risk-rules-title {
    font-size: 9px;
    font-weight: 800;
    color: ${cor};
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .risk-aggravant-item,
  .risk-rule-item {
    font-size: 11px;
    line-height: 1.5;
    color: ${PDF_COLORS.text};
  }
  .risk-rule-justification {
    margin-top: 6px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.55);
    border: 1px solid ${corBorder};
    border-radius: 6px;
  }

  /* ═══ SEÇÕES ═══ */
  .section { margin-bottom: 20px; }
  .section-title {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.9px;
    color: ${PDF_COLORS.navy};
    text-transform: uppercase;
    border-bottom: 1px solid ${PDF_COLORS.line};
    padding-bottom: 5px;
    margin-bottom: 10px;
  }

  /* ═══ TABELA DE DADOS ═══ */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid ${PDF_COLORS.line};
    border-radius: 6px;
    overflow: hidden;
  }
  .data-table td {
    padding: 7px 10px;
    border-bottom: 1px solid ${PDF_COLORS.lineSoft};
    font-size: 9.5pt;
    vertical-align: top;
  }
  .data-table .dt-label {
    font-weight: 700;
    color: ${PDF_COLORS.muted};
    background: ${PDF_COLORS.surface};
    width: 26%;
    font-size: 7.5pt;
  }
  .data-table .dt-value {
    color: ${PDF_COLORS.ink};
    font-weight: 400;
  }

  /* ═══ TABELA DE RESPOSTAS ═══ */
  .resp-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid ${PDF_COLORS.line};
  }
  .resp-table th {
    font-size: 7.5px;
    font-weight: 800;
    color: ${PDF_COLORS.muted};
    text-transform: uppercase;
    letter-spacing: 0.7px;
    text-align: left;
    padding: 7px 9px;
    background: ${PDF_COLORS.surface};
    border-bottom: 1px solid ${PDF_COLORS.line};
  }
  .resp-table td {
    font-size: 9.2pt;
    padding: 7px 9px;
    border-bottom: 1px solid ${PDF_COLORS.lineSoft};
    vertical-align: top;
  }
  .td-num {
    width: 36px;
    text-align: center;
    font-weight: 800;
    color: ${PDF_COLORS.subtle};
    font-size: 8px;
  }
  .td-param {
    font-weight: 600;
    color: ${PDF_COLORS.muted};
    width: 43%;
    font-size: 7.8pt;
  }
  .td-resp {
    color: ${PDF_COLORS.ink};
  }
  .answer-score {
    color: ${PDF_COLORS.ink};
    white-space: nowrap;
  }
  .item-observation {
    margin-top: 7px;
    padding: 7px 9px;
    border: 1px solid ${PDF_COLORS.lineSoft};
    border-left: 3px solid ${PDF_COLORS.blue};
    border-radius: 4px;
    background: ${PDF_COLORS.surface};
    font-size: 8px;
    line-height: 1.5;
    color: ${PDF_COLORS.text};
  }
  .resp-table tr:nth-child(even) {
    background: ${PDF_COLORS.surface};
  }

  /* ═══ OBSERVAÇÕES ═══ */
  .obs-box {
    background: transparent;
    border: 0;
    padding: 0;
    border-radius: 0;
    font-size: 9.2pt;
    line-height: 1.5;
    color: ${PDF_COLORS.text};
  }
  .photo-card {
    border: 1px solid ${PDF_COLORS.line};
    overflow: hidden;
    page-break-inside: avoid;
  }
  .photo-card img {
    display: block;
    width: 100%;
    max-height: 205px;
    object-fit: contain;
  }

  /* ═══ BASE LEGAL ═══ */
  .legal-note {
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    margin-bottom: 20px;
    font-size: 8.5pt;
    color: ${PDF_COLORS.muted};
    line-height: 1.6;
  }
  .legal-note strong {
    color: ${PDF_COLORS.text};
  }

  /* ═══ RODAPÉ & ASSINATURA ═══ */
  .footer-section {
    margin-top: 26px;
    page-break-inside: avoid;
  }
  .sig-block {
    width: 65%;
    margin: 0 auto;
    text-align: center;
  }
  .sig-line {
    border-top: 1px solid ${PDF_COLORS.navy};
    width: 100%;
    margin: 48px 0 12px;
  }
  .sig-name {
    font-size: 9.5pt;
    font-weight: 700;
    color: ${PDF_COLORS.navy};
    text-align: center;
  }
  .sig-role {
    margin-top: 4px;
    font-size: 8pt;
    color: ${PDF_COLORS.muted};
    text-align: center;
  }
</style>
</head>
<body>
  ${trainingNotice}

  <!-- CABEÇALHO -->
  <div class="doc-header">
    <div class="doc-brand">
      <img src="${DEFESA_CIVIL_LOGO_BASE64}" alt="Defesa Civil Municipal" />
    </div>
    <div class="doc-info">
      <div class="doc-type">RELATÓRIO TÉCNICO DE VISTORIA</div>
      <div class="doc-num">Protocolo ${escapeHtml(protocolo)}</div>
    </div>
  </div>

  ${riskPanelHtml}

  <!-- DADOS DA VISTORIA -->
  <div class="section">
    <div class="section-title">Dados da Vistoria</div>
    <table class="data-table">
      <tr>
        <td class="dt-label">Protocolo</td>
        <td class="dt-value">${escapeHtml(protocolo)}</td>
      </tr>
      <tr>
        <td class="dt-label">Data e hora</td>
        <td class="dt-value">${escapeHtml(data)}</td>
      </tr>
      <tr>
        <td class="dt-label">Município</td>
        <td class="dt-value">${escapeHtml(dados.municipio || '-')}</td>
      </tr>
      <tr>
        <td class="dt-label">Agente responsável</td>
        <td class="dt-value">${escapeHtml(dados.agenteNome || '-')}</td>
      </tr>
      <tr>
        <td class="dt-label">Responsável pelo imóvel</td>
        <td class="dt-value">${escapeHtml(dados.responsavelNome || '-')}</td>
      </tr>
      <tr>
        <td class="dt-label">Endereço</td>
        <td class="dt-value">${escapeHtml(dados.endereco || '-')}</td>
      </tr>
    </table>
  </div>

  ${metodologiaHtml}

  <!-- RESPOSTAS DO FORMULÁRIO -->
  ${respostasHtml ? `
  <div class="section">
    <div class="section-title">Itens Vistoriados</div>
    <table class="resp-table" style="page-break-inside: auto;">
      <tbody>${respostasHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- FOTO SE EXISTIR -->
  ${imageHtml}

  <!-- OBSERVAÇÕES -->
  ${obsHtml}

  <!-- BASE LEGAL -->
  <div class="section" style="page-break-inside: avoid;">
    <div class="section-title">Base Legal</div>
    <div class="legal-note">
      ${isAvaliacaoArvore ? `${escapeHtml(schemaForm?.metodologia?.fonte || '')}<br/>` : ''}
      Este relatório técnico foi elaborado em conformidade com a Lei Federal
      nº 12.608/2012, que institui a Política Nacional de Proteção e Defesa
      Civil, e com a Lei Federal nº 10.257/2001, denominada Estatuto da Cidade.
      Esses dispositivos estabelecem diretrizes para a prevenção de desastres
      e a proteção da vida.
    </div>
  </div>

  <div class="section" style="page-break-inside: avoid;">
    <div class="section-title">Responsabilidade Técnica</div>
    <div class="legal-note">
      Documento emitido com base nas condições observadas na data da vistoria.
      Sua interpretação deve considerar os registros fotográficos e as normas
      técnicas aplicáveis.
    </div>
  </div>

  <!-- ASSINATURA -->
  <div class="footer-section" style="page-break-inside: avoid;">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${escapeHtml(dados.agenteNome || '-')}</div>
      <div class="sig-role">${escapeHtml(dados.cargo || 'Agente de Proteção e Defesa Civil')}</div>
    </div>
  </div>

  <div class="pdf-page-footer">
    <div class="pdf-page-footer-row">
      <span>Defesa Civil - Relatório Técnico de Vistoria - ${PDF_DESIGN_LABEL}</span>
      <span>Protocolo ${escapeHtml(protocolo)}</span>
    </div>
  </div>

</body>
</html>`;
}
