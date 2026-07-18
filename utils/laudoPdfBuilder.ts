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
  riscoLabel,
  riscoColor,
  riscoConduta,
} from './riscoUtils';
import { logoBase64 } from './logoBase64';
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
  // Campos opcionais do relatório técnico editável
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
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '—';
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
  const cidade = notificado.cidade || laudo.municipio || '—';
  const calculo = parseCalculoRiscoSnapshot(laudo.calculoRisco);
  const nivel = normalizarNivelRisco(laudo.nivelRisco || calculo?.nivelRisco, 'r1');
  const trainingNotice = laudo.modoTreinamento
    ? `<div class="training-notice">MODO DE TESTE - documento sem validade operacional</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  @page { margin: 50px 60px; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #000;
    background: #fff;
    font-size: 13px;
    line-height: 1.6;
    padding: 0;
  }
  @media print {
    *, body, html {
      background-color: #fff !important;
      color: #000 !important;
      -webkit-print-color-adjust: exact;
    }
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 20px;
    margin-bottom: 30px;
  }
  .training-notice {
    border: 2px solid #10B981;
    background: #ECFDF5;
    color: #047857;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 18px;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .doc-header-logo img {
    height: 70px;
  }
  .doc-header-text {
    text-align: right;
  }
  .doc-title {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #1A365D;
    margin-bottom: 4px;
  }
  .doc-number {
    font-size: 14px;
    color: #666;
    font-weight: bold;
  }
  .preambulo {
    text-align: justify;
    margin-bottom: 28px;
    font-size: 13px;
    line-height: 1.8;
  }
  .section-title {
    font-size: 13px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #999;
    padding-bottom: 6px;
    margin-bottom: 16px;
    margin-top: 28px;
  }
  .field-grid {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .field-grid td {
    padding: 8px 10px;
    border: 1px solid #ccc;
    font-size: 13px;
    vertical-align: top;
  }
  .field-grid .field-label {
    font-weight: bold;
    width: 140px;
    background: #f8f8f8;
  }
  .motivo {
    text-align: justify;
    line-height: 1.9;
    margin-top: 16px;
    font-size: 13px;
  }
  .motivo strong {
    font-weight: bold;
    text-transform: uppercase;
  }
  .lei {
    margin-top: 16px;
    font-size: 12px;
    color: #333;
    border-left: 3px solid #666;
    padding-left: 12px;
    font-style: italic;
    line-height: 1.7;
  }
  .assinatura-section {
    margin-top: 60px;
    text-align: center;
  }
  .assinatura-linha {
    border-top: 1px solid #000;
    width: 300px;
    margin: 0 auto 8px;
  }
  .assinatura-nome {
    font-size: 13px;
    font-weight: bold;
  }
  .assinatura-cargo {
    font-size: 11px;
    color: #555;
  }
  .footer-info {
    margin-top: 40px;
    border-top: 1px solid #ccc;
    padding-top: 12px;
    font-size: 10px;
    color: #888;
    text-align: center;
  }
</style>
</head>
<body>
  ${trainingNotice}

  <div class="doc-header">
    <div class="doc-header-logo">
      <img src="${logoBase64}" alt="Logo Defesa Civil" />
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
      <td colspan="3">${escapeHtml(notificado.nomeNotificado || '—')}</td>
    </tr>
    <tr>
      <td class="field-label">CPF</td>
      <td colspan="3">${escapeHtml(notificado.cpfNotificado || '—')}</td>
    </tr>
    <tr>
      <td class="field-label">Endereço</td>
      <td>R: ${escapeHtml(notificado.enderecoRua || '—')}</td>
      <td class="field-label" style="width:50px">Nº</td>
      <td style="width:80px">${escapeHtml(notificado.enderecoNumero || '—')}</td>
    </tr>
    <tr>
      <td class="field-label">Complemento</td>
      <td>${escapeHtml(notificado.complemento || '—')}</td>
      <td class="field-label">Bairro</td>
      <td>${escapeHtml(notificado.bairro || '—')}</td>
    </tr>
    <tr>
      <td class="field-label">Cidade</td>
      <td>${escapeHtml(cidade)}</td>
      <td class="field-label">Contato</td>
      <td>${escapeHtml(notificado.telefone || '—')}</td>
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
    <div class="assinatura-nome">${escapeHtml(laudo.agenteNome || '—')}</div>
    <div class="assinatura-cargo">${escapeHtml(laudo.cargo || 'Vistoriador de Proteção e Defesa Civil')}</div>
  </div>

  <div class="footer-info">
    Documento gerado pelo TCS — Relatório de Risco<br/>
    ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
  const cor = apresentacao.cor;
  const label = apresentacao.label;
  const data = formatarDataHora(dados.dataVistoria);
  const protocolo = (dados.id || '000000').slice(0, 8).toUpperCase();
  const conduta = dados.condutaRecomendada || apresentacao.conduta;
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
  const dataExt = dataExtenso(dados.dataVistoria);
  const ano = dados.dataVistoria ? new Date(dados.dataVistoria).getFullYear() : new Date().getFullYear();
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
        ? `<div style="font-size:10px; color:#E53E3E; font-weight:bold; margin-top:4px;">[+${formatarPontuacaoRisco(item.pesoRisco)} pts]</div>`
        : '';
      const observacaoDesc = item.observacao
        ? `<div class="item-observation"><strong>Observação do agente:</strong> ${escapeHtml(item.observacao)}</div>`
        : '';
      return `<tr><td class="td-num">${String(index + 1).padStart(2, '0')}</td><td class="td-param">${escapeHtml(item.pergunta)}</td><td class="td-resp">${escapeHtml(item.resposta)}${pontuacaoDesc}${observacaoDesc}</td></tr>`;
    }).join('');
  } else if (dados.respostasJson) {
    try {
      const respostas = respostasObjeto;

      respostasHtml = Object.entries(respostas as Record<string, unknown>)
        .map(([k, val]) => {
          // Remover campo foto das perguntas normais caso seja o "id"
          if (k.includes('foto')) return '';
          if (getPerguntaIdFromObservacaoCondicionalRiscoKey(k)) return '';

          itemCount++;
          let safeKey = escapeHtml(k);
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
                      pontuacaoDesc = `<div style="font-size:10px; color:#E53E3E; font-weight:bold; margin-top:4px;">[+${formatarPontuacaoRisco(opDef.pesoRisco)} pts]</div>`;
                  }
                  const observacaoKey = getObservacaoCondicionalRiscoKey(pDef.id);
                  const observacao = opcaoAcionaObservacaoCondicionalRisco(dados.formularioId, pDef, String(val))
                    ? String((respostas as Record<string, unknown>)[observacaoKey] ?? '').trim()
                    : '';
                  if (observacao) {
                    observacaoDesc = `<div class="item-observation"><strong>Observação do agente:</strong> ${escapeHtml(observacao)}</div>`;
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
          return `<tr><td class="td-num">${String(itemCount).padStart(2, '0')}</td><td class="td-param">${safeKey}</td><td class="td-resp">${safeVal}${pontuacaoDesc}${observacaoDesc}${derivadoHtml}</td></tr>`;
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
      <div style="border:1px solid #E2E8F0; border-radius:8px; overflow:hidden; ${isSingle ? 'max-width:480px; margin:0 auto;' : ''}">
        <img src="${b64}" style="width:100%; max-height:240px; object-fit:contain; display:block;" alt="Evidência ${i + 1}"/>
        <div style="font-size:9px; color:#64748B; text-align:center; padding:5px;">Evidência fotográfica ${i + 1}${isAvaliacaoArvore && i === 0 ? ' — visão geral da árvore' : isAvaliacaoArvore ? ' — defeito determinante' : ''}</div>
      </div>`).join('');
    imageHtml = `
      <div class="section" style="page-break-inside: avoid;">
        <div class="section-title"><span class="section-icon">📷</span> Registro Fotográfico da Ocorrência (${fotosBase64.length} foto${fotosBase64.length !== 1 ? 's' : ''})</div>
        <div style="display:${isSingle ? 'block' : 'grid'}; ${isSingle ? '' : 'grid-template-columns: repeat(2, 1fr);'} gap:10px;">
          ${fotosHtml}
        </div>
      </div>`;
  }

  const obsHtml = dados.observacoesTecnicas
    ? `<div class="section">
        <div class="section-title"><span class="section-icon">📋</span> Observações Técnicas</div>
        <div class="obs-box">${escapeHtml(dados.observacoesTecnicas)}</div>
      </div>`
    : '';

  // Cor de fundo suave para o painel de risco
  const corBg = apresentacao.codigo === 'nao_iminente' || nivel === 'r1' ? '#ECFDF5' : nivel === 'r2' ? '#FFFBEB' : '#FEF2F2';
  const corBorder = apresentacao.codigo === 'nao_iminente' || nivel === 'r1' ? '#A7F3D0' : nivel === 'r2' ? '#FDE68A' : '#FECACA';
  const riskPanelHtml = `
  <!-- PAINEL DE RISCO -->
  <div class="risk-panel">
    <div class="risk-indicator">
      <div class="risk-level-label">${isAvaliacaoArvore ? 'Resultado CBMMG' : 'Nível de Risco'}</div>
      <div class="risk-level-value">${escapeHtml(isAvaliacaoArvore ? label : nivel.toUpperCase())}</div>
      <div class="risk-pts">${isAvaliacaoArvore ? `${formatarPontuacaoRisco(pontuacaoTotal)} pontos` : `${escapeHtml(label)} · ${formatarPontuacaoRisco(pontuacaoTotal)} pts`}</div>
    </div>
    <div class="risk-details">
      ${agravantesHtml}
      ${regrasCondicionaisHtml}
    </div>
  </div>`;

  const metodologiaHtml = isAvaliacaoArvore ? `
  <div class="section" style="page-break-inside: avoid;">
    <div class="section-title"><span class="section-icon">🌳</span> Metodologia e Quadro de Pontuação</div>
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
<style>
  @page { margin: 40px 50px; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1A202C;
    background: #fff;
    font-size: 13px;
    line-height: 1.5;
    padding: 0;
  }
  @media print {
    *, body, html {
      background-color: #fff !important;
      color: #000 !important;
      -webkit-print-color-adjust: exact;
    }
  }

  /* ═══ CABEÇALHO ═══ */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1A365D;
    padding-bottom: 20px;
    margin-bottom: 28px;
  }
  .training-notice {
    border: 2px solid #10B981;
    background: #ECFDF5;
    color: #047857;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 18px;
    text-align: center;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .doc-header-logo img {
    height: 80px;
  }
  .doc-info { text-align: right; }
  .doc-type {
    font-size: 18px;
    font-weight: 800;
    color: #1A365D;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .doc-num {
    font-size: 12px;
    font-weight: 600;
    color: #718096;
    margin-top: 4px;
  }
  .doc-date {
    font-size: 12px;
    color: #4A5568;
    margin-top: 2px;
  }

  /* ═══ PAINEL DE RISCO ═══ */
  .risk-panel {
    display: flex;
    border: 2px solid ${corBorder};
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 28px;
  }
  .risk-indicator {
    background: ${cor};
    color: white;
    padding: 20px 28px;
    text-align: center;
    min-width: 160px;
  }
  .risk-level-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    opacity: 0.85;
    text-transform: uppercase;
  }
  .risk-level-value {
    font-size: 28px;
    font-weight: 900;
    margin: 6px 0;
    letter-spacing: -0.5px;
  }
  .risk-pts {
    font-size: 12px;
    opacity: 0.8;
  }
  .risk-details {
    background: ${corBg};
    padding: 16px 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .risk-conduta-title {
    font-size: 10px;
    font-weight: 800;
    color: ${cor};
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .risk-conduta-text {
    font-size: 12px;
    line-height: 1.6;
    color: #2D3748;
  }
  .conduct-note {
    background: ${corBg};
    border: 1px solid ${corBorder};
    border-radius: 8px;
    padding: 14px 18px;
    margin: -10px 0 24px;
    page-break-inside: avoid;
  }
  .risk-aggravants {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid ${corBorder};
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
    color: #2D3748;
  }
  .risk-rule-justification {
    margin-top: 6px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.55);
    border: 1px solid ${corBorder};
    border-radius: 6px;
  }

  /* ═══ SEÇÕES ═══ */
  .section { margin-bottom: 24px; }
  .section-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #1A365D;
    text-transform: uppercase;
    border-bottom: 2px solid #E2E8F0;
    padding-bottom: 8px;
    margin-bottom: 14px;
  }
  .section-icon { margin-right: 6px; }

  /* ═══ TABELA DE DADOS ═══ */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    overflow: hidden;
  }
  .data-table td {
    padding: 10px 14px;
    border-bottom: 1px solid #F1F5F9;
    font-size: 13px;
    vertical-align: top;
  }
  .data-table .dt-label {
    font-weight: 700;
    color: #64748B;
    background: #F8FAFC;
    width: 180px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .data-table .dt-value {
    color: #1E293B;
    font-weight: 600;
  }

  /* ═══ TABELA DE RESPOSTAS ═══ */
  .resp-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #E2E8F0;
  }
  .resp-table th {
    font-size: 9px;
    font-weight: 800;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-align: left;
    padding: 10px 12px;
    background: #F1F5F9;
    border-bottom: 2px solid #CBD5E1;
  }
  .resp-table td {
    font-size: 12px;
    padding: 9px 12px;
    border-bottom: 1px solid #F1F5F9;
  }
  .td-num {
    width: 36px;
    text-align: center;
    font-weight: 800;
    color: #94A3B8;
    font-size: 11px;
  }
  .td-param {
    font-weight: 600;
    color: #334155;
    width: 42%;
  }
  .td-resp {
    color: #1E293B;
  }
  .item-observation {
    margin-top: 7px;
    padding: 7px 9px;
    border: 1px solid #E2E8F0;
    border-left: 3px solid #3B82F6;
    border-radius: 6px;
    background: #F8FAFC;
    font-size: 10.5px;
    line-height: 1.5;
    color: #334155;
  }
  .resp-table tr:nth-child(even) {
    background: #FAFBFC;
  }

  /* ═══ OBSERVAÇÕES ═══ */
  .obs-box {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-left: 4px solid #3B82F6;
    padding: 14px 18px;
    border-radius: 0 8px 8px 0;
    font-size: 13px;
    line-height: 1.7;
    color: #334155;
  }

  /* ═══ BASE LEGAL ═══ */
  .legal-note {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 24px;
    font-size: 11px;
    color: #64748B;
    line-height: 1.6;
  }
  .legal-note strong {
    color: #334155;
  }

  /* ═══ RODAPÉ & ASSINATURA ═══ */
  .footer-section {
    margin-top: 40px;
    border-top: 2px solid #E2E8F0;
    padding-top: 24px;
  }
  .sig-grid {
    display: flex;
    justify-content: space-between;
    gap: 32px;
    margin-top: 20px;
  }
  .sig-block {
    flex: 1;
    text-align: center;
  }
  .sig-line {
    border-top: 1px solid #1A365D;
    width: 100%;
    margin-bottom: 8px;
    margin-top: 60px;
  }
  .sig-name {
    font-size: 13px;
    font-weight: 700;
    color: #1A365D;
  }
  .sig-role {
    font-size: 10px;
    color: #718096;
    margin-top: 2px;
  }
  .stamp-area {
    flex: 1;
    text-align: center;
    font-size: 10px;
    color: #CBD5E1;
    border: 2px dashed #E2E8F0;
    border-radius: 12px;
    padding: 20px;
    margin-top: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .doc-footer {
    margin-top: 24px;
    text-align: center;
    font-size: 9px;
    color: #A0AEC0;
    letter-spacing: 0.5px;
  }
  .ciente-section {
    margin-top: 30px;
    padding: 16px;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    background: #F8FAFC;
    page-break-inside: avoid;
  }
  .ciente-title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: #1A365D;
    margin-bottom: 30px;
  }
  .ciente-grid {
    display: flex;
    justify-content: space-between;
    gap: 30px;
  }
</style>
</head>
<body>

  ${trainingNotice}

  <!-- CABEÇALHO -->
  <div class="doc-header">
    <div class="doc-header-logo">
      <img src="${logoBase64}" alt="Logo Defesa Civil" />
    </div>
    <div class="doc-info">
      <div class="doc-type">RELATÓRIO TÉCNICO VISTORIA</div>
      <div class="doc-num">Nº ${escapeHtml(protocolo)}/${ano}</div>
      <div class="doc-date">Vistoria realizada em ${escapeHtml(dataExt)}</div>
    </div>
  </div>
  <!-- DADOS DA VISTORIA -->
  <div class="section">
    <div class="section-title"><span class="section-icon">📍</span> Dados da Vistoria</div>
    <table class="data-table">
      <tr>
        <td class="dt-label">Endereço</td>
        <td class="dt-value">${escapeHtml(dados.endereco || '—')}</td>
      </tr>
      ${dados.bairro ? `<tr><td class="dt-label">Bairro</td><td class="dt-value">${escapeHtml(dados.bairro)}</td></tr>` : ''}
      <tr>
        <td class="dt-label">Município</td>
        <td class="dt-value">${escapeHtml(dados.municipio || '—')}</td>
      </tr>
      <tr>
        <td class="dt-label">Data e Hora</td>
        <td class="dt-value">${escapeHtml(data)}</td>
      </tr>
      <tr>
        <td class="dt-label">Agente Responsável</td>
        <td class="dt-value">${escapeHtml(dados.agenteNome || '—')}</td>
      </tr>
      <tr>
        <td class="dt-label">Formulário Utilizado</td>
        <td class="dt-value">${escapeHtml(dados.formularioId || 'Padrão')}</td>
      </tr>
      ${dados.responsavelNome ? `<tr><td class="dt-label">Responsável pelo Imóvel</td><td class="dt-value">${escapeHtml(dados.responsavelNome)}</td></tr>` : ''}
    </table>
  </div>

  ${metodologiaHtml}

  <!-- RESPOSTAS DO FORMULÁRIO -->
  ${respostasHtml ? `
  <div class="section">
    <div class="section-title"><span class="section-icon">📝</span> Itens Avaliados (${itemCount})</div>
    <table class="resp-table" style="page-break-inside: auto;">
      <thead><tr><th>#</th><th>Parâmetro Avaliado</th><th>Resposta / Constatação Técnica</th></tr></thead>
      <tbody>${respostasHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- FOTO SE EXISTIR -->
  ${imageHtml}

  <!-- OBSERVAÇÕES -->
  ${obsHtml}

  <!-- BASE LEGAL -->
  <div class="legal-note" style="page-break-inside: avoid;">
    <strong>${isAvaliacaoArvore ? 'Referência técnica e base legal:' : 'Base legal:'}</strong>
    ${isAvaliacaoArvore ? `${escapeHtml(schemaForm?.metodologia?.fonte || '')}<br/>` : ''}
    Este relatório de vistoria foi elaborado em conformidade com a
    <strong>Lei Federal Nº 12.608/2012</strong> (Política Nacional de Proteção e Defesa Civil)
    e a <strong>Lei Federal Nº 10.257/2001</strong> (Estatuto da Cidade), que estabelecem as
    diretrizes para prevenção de desastres e proteção à vida.
  </div>

  ${riskPanelHtml}

  <!-- CONDUTA RECOMENDADA -->
  <div class="conduct-note">
    <div class="risk-conduta-title">Conduta Recomendada</div>
    <div class="risk-conduta-text">${escapeHtml(conduta)}</div>
  </div>

  <!-- ASSINATURA -->
  <div class="footer-section" style="page-break-inside: avoid;">
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${escapeHtml(dados.agenteNome || '—')}</div>
        <div class="sig-role">${escapeHtml(dados.cargo || 'Vistoriador de Proteção e Defesa Civil')}</div>
      </div>
      <div class="stamp-area">
        Espaço reservado para<br/>carimbo institucional
      </div>
    </div>
  </div>

  <!-- CIENTE DO PROPRIETARIO / NOTIFICADO -->
  <div class="ciente-section">
    <div class="ciente-title">Declaração de Ciência e Notificação</div>
    <div class="ciente-grid">
      <div class="sig-block" style="flex: 2; text-align: left;">
        <span style="font-size: 11px; color: #4A5568;">
          Declaro ter acompanhado a vistoria, recebido as orientações técnicas de
          Defesa Civil e estar ciente da classificação de risco e da conduta recomendada.
        </span>
      </div>
      <div class="sig-block" style="flex: 1.5;">
        <div class="sig-line" style="margin-top: 30px;"></div>
        <div class="sig-name">Assinatura do Morador / Responsável</div>
        <div class="sig-role">Data: ___ / ___ / ______</div>
      </div>
    </div>
  </div>

  <div class="doc-footer">
    Documento gerado pelo TCS — Relatório de Risco<br/>
    ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    · Protocolo ${escapeHtml(protocolo)}/${ano}
    ${isAvaliacaoArvore ? ` · Metodologia ${escapeHtml(calculo?.metodologiaId || schemaForm?.metodologia?.id || 'CBMMG ITO nº 06')} v${escapeHtml(calculo?.metodologiaVersao || schemaForm?.metodologia?.versao || '1.0')}` : ''}
  </div>

</body>
</html>`;
}
