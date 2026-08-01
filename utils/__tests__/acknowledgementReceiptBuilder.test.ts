import {
  buildAcknowledgementReceiptHtml,
  buildCombinedDocumentHtml,
} from '../acknowledgementReceiptBuilder';
import { LocalAcknowledgementEvent, LocalGeneratedDocument } from '../../types/documentAcknowledgement';

const document: LocalGeneratedDocument = {
  id: 'doc', vistoriaId: 'vistoria', documentType: 'report', documentVersion: 2,
  templateVersion: 'report-v1', contentSnapshot: JSON.stringify({
    documentType: 'report', templateVersion: 'report-v1', vistoriaId: 'vistoria', trainingMode: false,
    payload: { endereco: 'Rua das Flores, 10 - Centro', municipio: 'Cataguases', dataVistoria: '2026-07-17T09:00:00.000Z' },
  }), contentHash: 'a'.repeat(64),
  pdfHash: 'b'.repeat(64), pdfLocalUri: null, previewHtml: '<html><body><h1>Original</h1></body></html>',
  remotePath: 'u/v/d/document.pdf', byteSize: 100, createdBy: 'user',
  createdAtDevice: '2026-07-17T10:00:00.000Z', trainingMode: false,
  status: 'available', supersedesId: null,
};

const event: LocalAcknowledgementEvent = {
  id: 'event', clientEventId: 'client', documentId: 'doc', outcome: 'acknowledged',
  declarationVersion: 'v1', declarationText: 'Declaração de ciência de teste com conteúdo suficiente.',
  declarationHash: 'c'.repeat(64), recipientName: '<Pessoa>', recipientRelationship: 'Morador',
  signatureStrokes: [{ points: [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.6 }] }],
  signatureHash: 'd'.repeat(64), reason: null, witness: null,
  occurredAtDevice: '2026-07-17T10:01:00.000Z', recordedAtServer: '2026-07-17T10:02:00.000Z',
  deviceIdHash: null, createdBy: 'user', syncStatus: 'confirmed', protocol: 'TCS-CIE-1',
  remoteSignaturePath: 'u/v/d/signature.json', errorCode: null, attempts: 1,
  trainingMode: false, correctionOf: null, correctionReason: null,
};

describe('acknowledgementReceiptBuilder', () => {
  it('gera comprovante em linguagem clara sem expor dados técnicos de integridade', () => {
    const html = buildAcknowledgementReceiptHtml(document, event);
    expect(html).toContain('TCS-CIE-1');
    expect(html).toContain('Relatório de risco');
    expect(html).toContain('Rua das Flores, 10 - Centro');
    expect(html).not.toContain(document.contentHash);
    expect(html).not.toContain(document.pdfHash);
    expect(html).not.toContain('Hash do conteúdo');
    expect(html).toContain('&lt;Pessoa&gt;');
    expect(html).toContain('<svg');
    expect(html).not.toContain('page-break-before:always');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('Modelo v2');
    expect(html).toContain('alt="Defesa Civil Municipal"');
  });

  it('não atribui assinatura à recusa', () => {
    const html = buildAcknowledgementReceiptHtml(document, {
      ...event, outcome: 'refused', signatureStrokes: null, signatureHash: null,
      reason: 'Destinatário recusou',
    });
    expect(html).toContain('Recusa registrada');
    expect(html).not.toContain('<svg');
  });

  it('combina cópias sem alterar o HTML original recebido', () => {
    const original = document.previewHtml;
    const combined = buildCombinedDocumentHtml(original, document, event);
    expect(original).toBe('<html><body><h1>Original</h1></body></html>');
    expect(combined).toContain('<h1>Original</h1>');
    expect(combined).toContain('Comprovante de ciência');
    expect(combined).toContain('page-break-before:always');
  });
});
