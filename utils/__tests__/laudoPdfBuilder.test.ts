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

import { buildLaudoHtml, buildTermoInterdicaoHtml } from '../laudoPdfBuilder';

describe('laudoPdfBuilder', () => {
  it('reproduz a estrutura da web e não inclui conduta recomendada', async () => {
    const html = await buildLaudoHtml({
      id: 'vistoria-test-123456',
      nivelRisco: 'r4',
      pontuacaoTotal: 8.5,
      endereco: 'Rua Teste, 123',
      municipio: 'Cidade Teste',
      dataVistoria: '2026-05-30T12:00:00.000Z',
      agenteNome: 'Agente Teste',
      formularioId: 'vistoria_deslizamento_v3',
      respostasJson: JSON.stringify({
        item_teste: 'Resposta técnica',
        formularioId: 'não deve aparecer',
        formulario_utilizado: 'não deve aparecer',
      }),
    });

    const inspectionDataIndex = html.indexOf('<!-- DADOS DA VISTORIA -->');
    const riskPanelIndex = html.indexOf('<!-- PAINEL DE RISCO -->');
    const riskLabelIndex = html.indexOf('Nível de Risco');
    const evaluatedItemsIndex = html.indexOf('<!-- RESPOSTAS DO FORMULÁRIO -->');
    const riskPanels = html.match(/class="risk-panel/g) || [];

    expect(inspectionDataIndex).toBeGreaterThan(-1);
    expect(riskPanelIndex).toBeLessThan(inspectionDataIndex);
    expect(riskLabelIndex).toBe(-1);
    expect(riskPanelIndex).toBeLessThan(evaluatedItemsIndex);
    expect(html).not.toMatch(/conduta recomendada/i);
    expect(html).toContain('Classificação Técnica');
    expect(html).toContain('Itens Vistoriados');
    expect(html).toContain('Responsabilidade Técnica');
    expect(html).toMatch(/Lei Federal\s+nº 12\.608\/2012/);
    expect(html).not.toContain('Lei Federal Nº');
    expect(html).toContain('Agente de Proteção e Defesa Civil');
    expect(html).toContain('width: 65%');
    expect(html).toContain('alt="Defesa Civil Municipal"');
    expect(html).toContain('data:image/jpeg;base64,');
    expect(html).not.toContain('>TCS<');
    expect(html).not.toContain('Coordenadas');
    expect(html).not.toContain('Formulário utilizado');
    expect(html).not.toContain('não deve aparecer');
    expect(html).not.toContain('Declaração de Ciência e Notificação');
    expect(html).not.toContain('carimbo institucional');
    expect(html).toContain('Modelo v2');
    expect(html).toContain('size: A4 portrait');
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
        arv_conduta_recomendada: 'Corte controlado da parte perigosa.',
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
    expect(html).not.toMatch(/conduta recomendada/i);
    expect(html).not.toContain('Corte controlado da parte perigosa.');
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
    expect(html).toContain('Registro Fotográfico (1)');
  });

  it('aplica o mesmo padrão A4 ao termo de interdição sem contador incompatível', () => {
    const html = buildTermoInterdicaoHtml({
      id: 'termo-test-123456', nivelRisco: 'r4', pontuacaoTotal: 9,
      endereco: 'Rua Teste, 123', municipio: 'Cidade Teste',
      dataVistoria: '2026-07-29T12:00:00.000Z', agenteNome: 'Agente Teste',
    }, {
      nomeNotificado: 'Pessoa Teste', cpfNotificado: '000.000.000-00',
      enderecoRua: 'Rua Teste', enderecoNumero: '123', complemento: '',
      bairro: 'Centro', cidade: 'Cidade Teste', telefone: '(00) 00000-0000',
    });

    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('Modelo v2');
    expect(html).not.toContain('pdf-page-number');
  });
});
