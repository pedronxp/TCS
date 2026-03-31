/**
 * utils/laudoPdfBuilder.ts
 * Gerador único de HTML para PDF de laudo técnico de vistoria.
 * Substitui as 3 implementações inline em resultado.tsx, laudo.tsx e relatorio.tsx.
 */

import { escapeHtml, formatarDataHora } from './htmlUtils';
import { riscoLabel, riscoColor, riscoConduta } from './riscoUtils';

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
  // Campos opcionais do relatório técnico editável
  condutaRecomendada?: string;
  observacoesTecnicas?: string;
  cargo?: string;
  bairro?: string;
  responsavelNome?: string;
}

/**
 * Gera o HTML completo do laudo técnico para exportação via expo-print.
 *
 * @param dados - Dados da vistoria normalizados
 * @returns string HTML pronto para Print.printToFileAsync({ html })
 */
export function buildLaudoHtml(dados: LaudoData): string {
  const nivel = dados.nivelRisco || 'r1';
  const cor = riscoColor(nivel);
  const label = riscoLabel(nivel);
  const data = formatarDataHora(dados.dataVistoria);
  const protocolo = (dados.id || '000000').slice(0, 8).toUpperCase();
  const conduta = dados.condutaRecomendada || riscoConduta(nivel);

  // Gerar tabela de respostas
  let respostasHtml = '';
  if (dados.respostasJson) {
    try {
      const respostas = typeof dados.respostasJson === 'string'
        ? JSON.parse(dados.respostasJson)
        : dados.respostasJson;
      respostasHtml = Object.entries(respostas as Record<string, unknown>)
        .map(([k, val]) => {
          const safeKey = escapeHtml(k);
          const safeVal = escapeHtml(Array.isArray(val) ? (val as string[]).join(', ') : String(val));
          return `<tr><td class="label">${safeKey}</td><td>${safeVal}</td></tr>`;
        }).join('');
    } catch { /* sem respostas */ }
  }

  // Seção de observações técnicas (apenas no relatório editável)
  const obsHtml = dados.observacoesTecnicas
    ? `<div class="section">
        <div class="section-title">Observações Técnicas</div>
        <div class="conduta">${escapeHtml(dados.observacoesTecnicas)}</div>
      </div>`
    : '';

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
      <div class="doc-num">#${protocolo}</div>
    </div>
  </div>

  <div class="risco-badge">
    <div class="risco-badge-label">NÍVEL DE RISCO ESTRUTURAL</div>
    <div class="risco-badge-value">RISCO ${escapeHtml(label)}</div>
    <div class="risco-badge-pts">${dados.pontuacaoTotal ?? 0} pontos acumulados</div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Vistoria</div>
    <div class="info-grid">
      <div class="info-item"><label>Endereço</label><span>${escapeHtml(dados.endereco || '—')}</span></div>
      <div class="info-item"><label>Município</label><span>${escapeHtml(dados.municipio || '—')}</span></div>
      <div class="info-item"><label>Data e Hora</label><span>${escapeHtml(data)}</span></div>
      <div class="info-item"><label>Agente Responsável</label><span>${escapeHtml(dados.agenteNome || '—')}</span></div>
      <div class="info-item"><label>Formulário</label><span>${escapeHtml(dados.formularioId || 'Padrão')}</span></div>
      ${dados.responsavelNome ? `<div class="info-item"><label>Responsável pelo Imóvel</label><span>${escapeHtml(dados.responsavelNome)}</span></div>` : ''}
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
    <div class="conduta">${escapeHtml(conduta)}</div>
  </div>

  ${obsHtml}

  <div class="footer">
    <div class="footer-left">
      Gerado automaticamente pelo Sistema de Vistoria Defesa Civil<br/>
      ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </div>
    <div class="assinatura">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${escapeHtml(dados.agenteNome || '—')}</div>
      <div class="assinatura-cargo">${escapeHtml(dados.cargo || 'Agente de Defesa Civil')}</div>
    </div>
  </div>
</body>
</html>`;
}
