import {
  DocumentContentSnapshot,
  LocalAcknowledgementEvent,
  LocalGeneratedDocument,
  SignatureStroke,
} from '../types/documentAcknowledgement';
import { escapeHtml, formatarDataHora } from './htmlUtils';
import { DEFESA_CIVIL_LOGO_BASE64 } from '../supabase/functions/_shared/defesaCivilLogo';
import {
  buildPdfBaseCss,
  PDF_COLORS,
  PDF_DESIGN_LABEL,
} from '../supabase/functions/_shared/pdfDesignSystem';

const OUTCOME_LABELS: Record<LocalAcknowledgementEvent['outcome'], string> = {
  acknowledged: 'Ciência confirmada',
  refused: 'Recusa registrada',
  unable_to_sign: 'Impossibilidade de assinatura registrada',
};

const DOCUMENT_LABELS: Record<LocalGeneratedDocument['documentType'], string> = {
  report: 'Relatório de risco',
  technical_report: 'Laudo técnico',
  interdiction_term: 'Termo de interdição',
};

type ReceiptPayload = {
  endereco?: unknown;
  municipio?: unknown;
  dataVistoria?: unknown;
};

function readReceiptPayload(document: LocalGeneratedDocument): ReceiptPayload {
  try {
    const snapshot = JSON.parse(document.contentSnapshot) as DocumentContentSnapshot<ReceiptPayload>;
    return snapshot?.payload && typeof snapshot.payload === 'object' ? snapshot.payload : {};
  } catch {
    return {};
  }
}

function displayValue(value: unknown, fallback = 'Não informado'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatarDataHora(value);
}

function receiptExplanation(outcome: LocalAcknowledgementEvent['outcome']): string {
  if (outcome === 'refused') {
    return 'O documento identificado abaixo foi apresentado ao destinatário, e a recusa em registrar a ciência foi formalizada neste comprovante.';
  }
  if (outcome === 'unable_to_sign') {
    return 'O documento identificado abaixo foi apresentado ao destinatário, e a impossibilidade de realizar a assinatura foi formalizada neste comprovante.';
  }
  return 'Este comprovante registra que o destinatário recebeu acesso ao documento identificado abaixo e declarou estar ciente de seu conteúdo.';
}

function signatureSvg(strokes: SignatureStroke[] | null): string {
  if (!strokes?.length) return '';
  const paths = strokes.map(stroke => {
    const points = stroke.points
      .map(point => `${Math.round(point.x * 600)},${Math.round(point.y * 180)}`)
      .join(' ');
    return `<polyline points="${points}" fill="none" stroke="#172033" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join('');
  return `<svg viewBox="0 0 600 180" role="img" aria-label="Assinatura manuscrita" style="display:block;width:100%;height:86px">${paths}</svg>`;
}

function buildEvidenceBlock(event: LocalAcknowledgementEvent): string {
  if (event.outcome === 'acknowledged') {
    return `
      <div style="margin-top:16px;border:1px solid #cbd5e1;border-radius:10px;padding:10px 18px 8px;background:#ffffff">
        ${signatureSvg(event.signatureStrokes)}
        <div style="border-top:1px solid #64748b;padding-top:6px;text-align:center;font-size:10px;color:#475569">
          Assinatura do destinatário realizada no dispositivo
        </div>
      </div>`;
  }

  return `
    <div style="margin-top:16px;border-left:4px solid #d97706;border-radius:6px;padding:10px 14px;background:#fff7ed">
      <div style="font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9a3412">Motivo registrado</div>
      <div style="margin-top:4px;font-size:11px;line-height:1.45;color:#431407">${escapeHtml(event.reason || 'Motivo não informado.')}</div>
    </div>`;
}

export function buildAcknowledgementReceiptFragment(
  document: LocalGeneratedDocument,
  event: LocalAcknowledgementEvent,
  forcePageBreak = false
): string {
  const payload = readReceiptPayload(document);
  const vistoriaDate = formatOptionalDate(payload.dataVistoria);
  const protocol = event.protocol || 'Aguardando confirmação';
  const registrationTime = event.recordedAtServer || event.occurredAtDevice;
  const syncNote = event.recordedAtServer
    ? 'Registro confirmado no sistema'
    : 'Registro realizado no dispositivo e ainda não sincronizado';
  const footerNote = event.outcome === 'acknowledged'
    ? 'A ciência confirma a apresentação e o recebimento do documento, mas não significa concordância com suas conclusões. Este comprovante não substitui assinatura digital qualificada.'
    : 'Este comprovante registra a apresentação do documento e a ocorrência indicada acima. Ele não substitui assinatura digital qualificada.';
  const training = event.trainingMode
    ? '<div style="margin-bottom:12px;padding:8px 12px;border-radius:6px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;text-align:center">MODO DE TESTE - DOCUMENTO SEM VALIDADE OPERACIONAL</div>'
    : '';

  return `
    <section style="box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:${PDF_COLORS.ink};padding:0;${forcePageBreak ? 'page-break-before:always;' : ''}">
      ${training}
      <header style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid ${PDF_COLORS.navy};padding-bottom:12px;margin-bottom:14px">
        <img src="${DEFESA_CIVIL_LOGO_BASE64}" alt="Defesa Civil Municipal" style="display:block;width:auto;height:54px"/>
        <div style="max-width:330px;text-align:right">
          <div style="font-size:16px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:${PDF_COLORS.navy}">Comprovante de ciência</div>
          <div style="margin-top:2px;font-size:9px;color:${PDF_COLORS.muted}">Registro de apresentação e recebimento de documento</div>
          <div style="display:inline-block;margin-top:7px;border-radius:999px;padding:6px 10px;background:${event.outcome === 'acknowledged' ? PDF_COLORS.successSoft : PDF_COLORS.warningSoft};font-size:8px;font-weight:800;line-height:1.25;text-align:center;text-transform:uppercase;color:${event.outcome === 'acknowledged' ? PDF_COLORS.success : PDF_COLORS.warning}">
            ${escapeHtml(OUTCOME_LABELS[event.outcome])}
          </div>
        </div>
      </header>

      <p style="margin:0 0 12px;font-size:10.5px;line-height:1.5;color:${PDF_COLORS.text}">${escapeHtml(receiptExplanation(event.outcome))}</p>

      <div style="border:1px solid #cbd5e1;border-radius:10px;overflow:hidden">
        <div style="padding:8px 12px;background:${PDF_COLORS.blueSoft};font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${PDF_COLORS.navy}">Documento apresentado</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <tr>
            <td style="width:22%;padding:7px 12px;color:#64748b">Documento</td>
            <td style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(DOCUMENT_LABELS[document.documentType])}</td>
            <td style="width:14%;padding:7px 12px;color:#64748b">Versão</td>
            <td style="width:12%;padding:7px 12px;font-weight:700;color:#172033">${document.documentVersion}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0">
            <td style="padding:7px 12px;color:#64748b">Local</td>
            <td colspan="3" style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(displayValue(payload.endereco))}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0">
            <td style="padding:7px 12px;color:#64748b">Município</td>
            <td style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(displayValue(payload.municipio))}</td>
            <td style="padding:7px 12px;color:#64748b">Vistoria</td>
            <td style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(vistoriaDate || 'Não informada')}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top:12px;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden">
        <div style="padding:8px 12px;background:${PDF_COLORS.surface};font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${PDF_COLORS.navy}">Dados do registro</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <tr>
            <td style="width:22%;padding:7px 12px;color:#64748b">Destinatário</td>
            <td style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(event.recipientName)}</td>
            <td style="width:18%;padding:7px 12px;color:#64748b">Vínculo</td>
            <td style="width:24%;padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(event.recipientRelationship)}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0">
            <td style="padding:7px 12px;color:#64748b">Data e hora</td>
            <td style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(formatarDataHora(registrationTime))}</td>
            <td style="padding:7px 12px;color:#64748b">Situação</td>
            <td style="padding:7px 12px;font-weight:700;color:#172033">${escapeHtml(syncNote)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top:12px;border-radius:6px;padding:10px 14px;background:${PDF_COLORS.surface};border-left:3px solid ${PDF_COLORS.blue}">
        <div style="font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#475569">Declaração registrada</div>
        <p style="margin:5px 0 0;font-size:10.5px;line-height:1.45;color:#334155">${escapeHtml(event.declarationText)}</p>
      </div>

      ${buildEvidenceBlock(event)}
      ${event.witness ? `<p style="margin:8px 0 0;font-size:10px;color:#475569"><strong>Testemunha presente:</strong> ${escapeHtml(event.witness.name)}</p>` : ''}

      <footer style="margin-top:14px;border-top:1px solid ${PDF_COLORS.line};padding-top:10px;text-align:center">
        <div style="font-size:9px;color:#64748b">Protocolo do registro</div>
        <div style="margin-top:2px;font-size:12px;font-weight:800;letter-spacing:.3px;color:#102a56">${escapeHtml(protocol)}</div>
        <p style="margin:7px auto 0;max-width:650px;font-size:8.5px;line-height:1.4;color:#64748b">
          ${escapeHtml(footerNote)}
        </p>
        <div style="margin-top:7px;font-size:7px;color:${PDF_COLORS.subtle}">${PDF_DESIGN_LABEL}</div>
      </footer>
    </section>`;
}

export function buildAcknowledgementReceiptHtml(
  document: LocalGeneratedDocument,
  event: LocalAcknowledgementEvent
): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${buildPdfBaseCss()}</style></head><body>${buildAcknowledgementReceiptFragment(document, event, false)}</body></html>`;
}

export function buildCombinedDocumentHtml(
  originalHtml: string,
  document: LocalGeneratedDocument,
  event: LocalAcknowledgementEvent
): string {
  const receipt = buildAcknowledgementReceiptFragment(document, event, true);
  return originalHtml.includes('</body>')
    ? originalHtml.replace('</body>', `${receipt}</body>`)
    : `${originalHtml}${receipt}`;
}
