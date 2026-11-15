jest.mock('expo-file-system', () => {
  // JPEG mínimo com APP0 JFIF — sem EXIF GPS, o que exercita o caminho de
  // foto sem georreferência.
  const jpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  class MockFile {
    static downloadFileAsync = jest.fn(async (_url: string, destination: MockFile) => destination);
    uri: string;
    exists = true;
    constructor(...parts: Array<string | { uri?: string }>) {
      this.uri = parts.map(part => typeof part === 'string' ? part : part.uri || '').join('/');
    }
    async base64() { return 'Zm90by10ZXN0ZQ=='; }
    async bytes() { return jpeg; }
    delete() { this.exists = false; }
  }
  return {
    File: MockFile,
    Paths: { cache: { uri: 'file:///cache' } },
  };
});

import { buildLaudoHtml, buildTermoInterdicaoHtml } from '../laudoPdfBuilder';

describe('laudoPdfBuilder', () => {
  it('identifica versão preliminar e fotos pendentes no próprio documento', async () => {
    const html = await buildLaudoHtml({
      id: 'partial', nivelRisco: 'r2', pontuacaoTotal: 2, endereco: 'Rua', municipio: 'Cidade',
      dataVistoria: null, agenteNome: 'Pedro', documentStatus: 'preliminary',
      mediaCompleteness: { expected_count: 3, available_count: 1, pending_count: 2 },
    });
    expect(html).toContain('VERSÃO PRELIMINAR');
    expect(html).toContain('1 de 3 fotos disponíveis');
    expect(html).toContain('2 pendente(s)');
  });
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

  it('atualiza a classificacao gerada de snapshots antigos no novo PDF', async () => {
    const html = await buildLaudoHtml({
      id: 'legacy-risk', nivelRisco: 'critico', pontuacaoTotal: 7, endereco: 'Rua', municipio: 'Cidade',
      dataVistoria: null, agenteNome: 'Agente',
      calculoRisco: {
        versaoRegra: 'risco_0_10_v1', escala: { min: 0, max: 10 }, tipoCalculo: 'soma_total',
        pontuacaoTotal: 7, nivelRisco: 'r4', limites: [], itens: [],
        regrasCondicionais: [{ id: 'fundacao_inexistente', label: 'Fundação inexistente',
          descricao: 'Classificar como risco baixo, médio, alto ou crítico.', perguntaId: 'est_q1_inexistente_classificacao_risco',
          respostaId: 'critico', resposta: 'Risco crítico', efeito: 'Classifica o risco em no mínimo R4.',
          nivelMinimo: 'r4', pontuacaoMinima: 7,
        }],
      },
    });
    expect(html).toContain('Resposta do agente:</strong> Risco muito alto');
    expect(html).toContain('baixo, médio, alto ou muito alto.');
    expect(html).not.toContain('Risco crítico');
  });

  it('exibe a justificativa técnica do fluxo altura x distância no relatório', async () => {
    const html = await buildLaudoHtml({
      id: 'vistoria-test-justificativa',
      nivelRisco: 'r4',
      pontuacaoTotal: 9.5,
      endereco: 'Rua do Talude, 45',
      municipio: 'Cidade Teste',
      dataVistoria: '2026-09-17T12:00:00.000Z',
      agenteNome: 'Agente Teste',
      formularioId: 'vistoria_deslizamento_v3',
      respostasJson: JSON.stringify({
        desl2_q1: 'q1_a',
        desl2_q2: 'q2_f',
        desl2_q2_exposicao_altura_distancia: 'muito_alto',
        desl2_q2_justificativa_tecnica: 'Talude com cerca de 10 m de altura, imóvel a 8 m da base, base solapada e trincas na crista.',
      }),
    });

    expect(html).toContain('Justificativa técnica da classificação');
    expect(html).toContain('Muito alto');
    expect(html).toContain('Talude com cerca de 10 m de altura');
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

  it('inclui campos auxiliares respondidos junto aos itens pontuados', async () => {
    const html = await buildLaudoHtml({
      id: 'inundacao-test-123456',
      nivelRisco: 'r3',
      pontuacaoTotal: 4.2,
      endereco: 'Avenida Beira-Rio, 120',
      municipio: 'Cidade Teste',
      dataVistoria: '2026-08-02T12:00:00.000Z',
      agenteNome: 'Agente Teste',
      formularioId: 'risco_inundacao_v1',
      respostasJson: JSON.stringify({
        inundacao_q1: 'inundacao_progressiva',
        inundacao_q2: 'lamina_media',
        inundacao_altura_agua_m: '0,45',
        inundacao_q8: 'acesso_restrito',
        inundacao_acao_imediata: 'Via isolada e moradores orientados.',
        inundacao_observacoes: 'Marca de agua registrada na fachada.',
      }),
      calculoRisco: {
        versaoRegra: 'risco_0_10_v1',
        escala: { min: 0, max: 10 },
        formularioId: 'risco_inundacao_v1',
        tipoCalculo: 'soma_total',
        pontuacaoTotal: 4.2,
        nivelRisco: 'r3',
        limites: [],
        itens: [
          {
            perguntaId: 'inundacao_q1',
            pergunta: 'Qual condicao hidrica foi identificada?',
            respostaId: 'inundacao_progressiva',
            resposta: 'Inundacao progressiva',
            pesoRisco: 0.6,
          },
        ],
      },
    });

    expect(html).toContain('0,45 m');
    expect(html).toContain('Via isolada e moradores orientados.');
    expect(html).toContain('Marca de agua registrada na fachada.');
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

  it('imprime a proveniência da foto e sinaliza a ausência de georreferência', async () => {
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

    // A foto do mock não tem EXIF GPS: o laudo precisa dizer isso, em vez de
    // omitir a informação e deixar o documento parecer mais forte do que é.
    expect(html).toContain('Foto sem georreferência');
    expect(html).toContain('SHA-256');
  });

  it('imprime as coordenadas quando a foto carrega EXIF GPS', async () => {
    const { buildExifApp1Payload, injectExifSegment } = require('../../supabase/functions/_shared/exifGps');
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const comGeo = injectExifSegment(
      jpeg,
      buildExifApp1Payload({
        latitude: -23.550123,
        longitude: -46.633456,
        accuracyMeters: 8,
        capturedAt: '2026-11-10T14:32:11.000Z',
      }),
    );

    const { File } = require('expo-file-system');
    const original = File.prototype.bytes;
    File.prototype.bytes = async () => comGeo;

    try {
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

      expect(html).toContain('GPS -23,550123, -46,633456');
      expect(html).toContain('precisão ±8 m');
      expect(html).not.toContain('Foto sem georreferência');
    } finally {
      File.prototype.bytes = original;
    }
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

  const baseLaudo = {
    id: 'vistoria-layouts-1', nivelRisco: 'r4', pontuacaoTotal: 9.6,
    endereco: 'Rua Marlene, 531 - Dico Leite', municipio: 'Cataguases',
    dataVistoria: '2026-09-20T21:16:00.000Z', agenteNome: 'Pedro Alves',
    responsavelNome: 'Paulo Pedro', formularioId: 'vistoria_deslizamento_v3',
    respostasJson: JSON.stringify({ item_teste: 'Resposta técnica' }),
  };

  it('layout "oficio": classificação em linha de tabela, sem painel colorido', async () => {
    const html = await buildLaudoHtml({ ...baseLaudo, layout: 'oficio' });
    expect(html).toContain('lx-head');
    expect(html).toContain('Identificação');
    expect(html).toContain('R4 — Muito alto');
    expect(html).toContain('9,6 pontos');
    expect(html).toContain('data:image/jpeg;base64,');
    expect(html).not.toMatch(/class="risk-panel/);
  });

  it('layout "ficha": hero azul com quadro de classificação e grade de dados', async () => {
    const html = await buildLaudoHtml({ ...baseLaudo, layout: 'ficha' });
    expect(html).toContain('lf-hero');
    expect(html).toContain('lf-class-val');
    expect(html).toContain('>R4<');
    expect(html).toContain('lf-grid');
    expect(html).toContain('Rua Marlene, 531 - Dico Leite');
    expect(html).toContain('data:image/jpeg;base64,');
  });

  it('layout "resumo": quadro 2×2 no topo e endereço em faixa', async () => {
    const html = await buildLaudoHtml({ ...baseLaudo, layout: 'resumo' });
    expect(html).toContain('lr-quad');
    expect(html).toContain('lr-addr');
    expect(html).toContain('R4 — Muito alto');
    expect(html).toContain('Paulo Pedro');
    expect(html).toContain('data:image/jpeg;base64,');
  });

  it('layout inválido cai no clássico com painel de risco', async () => {
    const html = await buildLaudoHtml({ ...baseLaudo, layout: 'inexistente' as never });
    expect(html).toMatch(/class="risk-panel/);
    expect(html).toContain('Classificação Técnica');
  });

  it('todos os modelos imprimem o nome do solicitante ou responsavel', async () => {
    // O solicitante sumia do PDF porque a tela de resultado nao repassava o
    // campo para o gerador — em nenhum dos modelos.
    for (const layout of ['classico', 'oficio', 'ficha', 'resumo'] as const) {
      const html = await buildLaudoHtml({ ...baseLaudo, layout });
      expect(html).toContain('Paulo Pedro');
    }
  });

  it('encontra o modelo nativo pelo codigo de sistema de formulario publicado', async () => {
    // Formulario publicado no servidor chega com UUID; o codigo de sistema vem
    // no snapshot do calculo e permite recuperar o schema e a metodologia.
    const html = await buildLaudoHtml({
      ...baseLaudo,
      formularioId: '3f0d5b2a-1c9e-4a7d-9b21-0f6d2f8a1c44',
      calculoRisco: {
        versaoRegra: 'risco_0_10_v1',
        escala: { min: 0, max: 10 },
        formularioId: '3f0d5b2a-1c9e-4a7d-9b21-0f6d2f8a1c44',
        formularioSystemCode: 'vistoria_deslizamento_v3',
        tipoCalculo: 'soma_total',
        pontuacaoTotal: 9.6,
        nivelRisco: 'r4',
        limites: [],
        itens: [],
      },
    });
    expect(html).toContain('Classificação Técnica');
    expect(html).toContain('Paulo Pedro');
  });
});
