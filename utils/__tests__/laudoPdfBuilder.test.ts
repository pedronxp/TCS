import { buildLaudoHtml } from '../laudoPdfBuilder';

describe('laudoPdfBuilder', () => {
  it('renderiza o nivel de risco abaixo da base legal e antes da conduta', async () => {
    const html = await buildLaudoHtml({
      id: 'vistoria-test-123456',
      nivelRisco: 'r4',
      pontuacaoTotal: 8.5,
      endereco: 'Rua Teste, 123',
      municipio: 'Cidade Teste',
      dataVistoria: '2026-05-30T12:00:00.000Z',
      agenteNome: 'Agente Teste',
      formularioId: 'vistoria_deslizamento_v3',
    });

    const baseLegalIndex = html.indexOf('<!-- BASE LEGAL -->');
    const riskPanelIndex = html.indexOf('<!-- PAINEL DE RISCO -->');
    const riskLabelIndex = html.indexOf('Nível de Risco');
    const conductIndex = html.indexOf('<!-- CONDUTA RECOMENDADA -->');
    const riskPanels = html.match(/class="risk-panel"/g) || [];

    expect(baseLegalIndex).toBeGreaterThan(-1);
    expect(riskPanelIndex).toBeGreaterThan(baseLegalIndex);
    expect(riskLabelIndex).toBeGreaterThan(baseLegalIndex);
    expect(riskLabelIndex).toBeLessThan(conductIndex);
    expect(conductIndex).toBeGreaterThan(riskPanelIndex);
    expect(html.slice(0, baseLegalIndex)).not.toContain('Nível de Risco');
    expect(riskPanels).toHaveLength(1);
  });
});
