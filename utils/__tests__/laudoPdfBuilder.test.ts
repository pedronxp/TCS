jest.mock('expo-file-system', () => {
  class MockFile {
    static downloadFileAsync = jest.fn(async (_url: string, destination: MockFile) => destination);
    uri: string;
    exists = true;
    constructor(...parts: Array<string | { uri?: string }>) {
      this.uri = parts.map(part => typeof part === 'string' ? part : part.uri || '').join('/');
    }
    async base64() { return 'Zm90by10ZXN0ZQ=='; }
    delete() { this.exists = false; }
  }
  return {
    File: MockFile,
    Paths: { cache: { uri: 'file:///cache' } },
  };
});

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

  it('inclui foto remota no PDF usando a API atual do Expo FileSystem', async () => {
    const { File } = require('expo-file-system');
    const html = await buildLaudoHtml({
      id: 'vistoria-com-foto',
      nivelRisco: 'r2',
      pontuacaoTotal: 2.5,
      endereco: 'Rua da Foto, 10',
      municipio: 'Cataguases',
      dataVistoria: '2026-07-18T12:00:00.000Z',
      agenteNome: 'Agente Teste',
      formularioId: 'risco_estrutural_novo_v2',
      fotosUrls: ['https://storage.example.test/evidencia.jpg'],
    });

    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      'https://storage.example.test/evidencia.jpg',
      expect.any(File),
      { idempotent: true }
    );
    expect(html).toContain('data:image/jpeg;base64,Zm90by10ZXN0ZQ==');
    expect(html).toContain('Registro Fotográfico da Ocorrência (1 foto)');
  });
});
