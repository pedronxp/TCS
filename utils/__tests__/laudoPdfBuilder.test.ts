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

  it('renderiza relatório CBMMG com metodologia, total e resultado sem R1/R4', async () => {
    const html = await buildLaudoHtml({
      id: 'arvore-test-123456', nivelRisco: 'r4', pontuacaoTotal: 10,
      endereco: 'Rua das Árvores, 10', municipio: 'Belo Horizonte',
      dataVistoria: '2026-07-16T12:00:00.000Z', agenteNome: 'Agente Teste',
      formularioId: 'avaliacao_arvore_cbmmg_v1',
      respostasJson: JSON.stringify({
        arv_altura_m: '12', arv_especie_aparente: 'Sibipiruna',
        arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'extremamente_alto',
        arv_item3_diametro_faixa: 'maior_51', arv_item4_outros_fatores: 'sem_acrescimo',
      }),
      calculoRisco: {
        versaoRegra: 'cbmmg_ito06_quadro2_v1.0', escala: { min: 0, max: 10 },
        formularioId: 'avaliacao_arvore_cbmmg_v1', tipoCalculo: 'soma_total', pontuacaoTotal: 10, nivelRisco: 'r4',
        limites: [], itens: [], metodologiaId: 'cbmmg_ito06_quadro2', metodologiaVersao: '1.0',
        somaBruta: 10, tetoAplicado: 10, resultadoCodigo: 'risco_iminente', resultadoLabel: 'RISCO IMINENTE',
      },
    });

    expect(html).toContain('Metodologia e Quadro de Pontuação');
    expect(html).toContain('Raio de referência dos alvos');
    expect(html).toContain('RISCO IMINENTE');
    expect(html).toContain('Resultado CBMMG');
    expect(html).not.toContain('>R4<');
  });
});
