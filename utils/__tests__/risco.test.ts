/**
 * Testes unitarios: calculo de nivel de risco na escala oficial 0-10.
 */

import {
  calcularNivelRiscoPorPontuacao,
  calcularRiscoFormulario,
  formatarPontuacaoRisco,
  normalizarNivelRisco,
  parseCalculoRiscoSnapshot,
  riscoColor,
  riscoLabel,
} from '../riscoUtils';

const calcularNivelRisco = calcularNivelRiscoPorPontuacao;

describe('calcularNivelRisco - escala oficial 0-10', () => {
  it('classifica limites de R1 a R4', () => {
    expect(calcularNivelRisco(0)).toBe('r1');
    expect(calcularNivelRisco(2.0)).toBe('r1');
    expect(calcularNivelRisco(2.1)).toBe('r2');
    expect(calcularNivelRisco(3.9)).toBe('r2');
    expect(calcularNivelRisco(4.0)).toBe('r3');
    expect(calcularNivelRisco(6.9)).toBe('r3');
    expect(calcularNivelRisco(7.0)).toBe('r4');
    expect(calcularNivelRisco(10.0)).toBe('r4');
  });

  it('mantem R4 acima de 10 para falha defensiva sem exibir escala maior', () => {
    expect(calcularNivelRisco(100, [])).toBe('r4');
  });
});

describe('calcularNivelRisco - limites customizados do formulario', () => {
  const limites = [
    { max: 1, nivel: 'baixo' },
    { max: 3, nivel: 'medio' },
    { max: 5, nivel: 'alto' },
    { max: 10, nivel: 'critico' },
  ];

  it('normaliza aliases legados dos limites', () => {
    expect(calcularNivelRisco(1, limites)).toBe('r1');
    expect(calcularNivelRisco(2, limites)).toBe('r2');
    expect(calcularNivelRisco(4, limites)).toBe('r3');
    expect(calcularNivelRisco(8, limites)).toBe('r4');
  });

  it('aceita codigos internos r1-r4 diretamente', () => {
    expect(calcularNivelRisco(4, [{ max: 8, nivel: 'r1' }])).toBe('r1');
    expect(calcularNivelRisco(3, [{ max: 9, nivel: 'r3' }])).toBe('r3');
  });
});

describe('calcularRiscoFormulario', () => {
  it('soma pesos, limita em 10 e gera snapshot auditavel', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'form_teste',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: { p1: 'b', p2: 'c' },
      perguntas: [
        { id: 'p1', texto: 'Pergunta 1', tipo: 'cards', opcoes: [{ id: 'a', texto: 'Bom', pesoRisco: 0 }, { id: 'b', texto: 'Ruim', pesoRisco: 4.4 }] },
        { id: 'p2', texto: 'Pergunta 2', tipo: 'cards', opcoes: [{ id: 'c', texto: 'Critico', pesoRisco: 7.2 }] },
      ],
    });

    expect(calculo.pontuacaoTotal).toBe(10);
    expect(calculo.nivelRisco).toBe('r4');
    expect(calculo.itens).toHaveLength(2);
    expect(parseCalculoRiscoSnapshot(JSON.stringify(calculo))?.pontuacaoTotal).toBe(10);
  });

  const perguntaInclinacao = {
    id: 'desl2_q2',
    texto: 'Inclinação da encosta',
    tipo: 'cards',
    opcoes: [
      { id: 'q2_e', texto: '≥90° (vertical)', pesoRisco: 1 },
      { id: 'q2_f', texto: 'Inclinação negativa / talude solapado', pesoRisco: 1 },
    ],
  };

  const perguntaExposicao = {
    id: 'desl2_q2_exposicao_altura_distancia',
    texto: 'Classificação do risco considerando altura do talude e distância até o alvo vulnerável',
    tipo: 'multipla_escolha',
    auxiliarCalculo: true,
    opcoes: [
      { id: 'baixo', texto: 'Baixo', pesoRisco: 0 },
      { id: 'medio', texto: 'Médio', pesoRisco: 0 },
      { id: 'alto', texto: 'Alto', pesoRisco: 0 },
      { id: 'muito_alto', texto: 'Muito alto', pesoRisco: 0 },
      { id: 'nao_estimado', texto: 'Não foi possível estimar', pesoRisco: 0 },
    ],
  };

  const perguntaJustificativa = {
    id: 'desl2_q2_justificativa_tecnica',
    texto: 'Justificativa técnica',
    tipo: 'texto',
    auxiliarCalculo: true,
  };

  const perguntaFundacao = {
    id: 'est_q1',
    texto: 'Fundacao',
    tipo: 'cards',
    opcoes: [
      { id: 'inexistente', texto: 'Inexistente', pesoRisco: 0 },
      { id: 'q1_a', texto: 'Bom', pesoRisco: 0 },
    ],
  };

  const perguntaEstrutura = {
    id: 'est_q2',
    texto: 'Estrutura (pilares e vigas)',
    tipo: 'cards',
    opcoes: [
      { id: 'inexistente', texto: 'Inexistente', pesoRisco: 0 },
      { id: 'q2_d', texto: 'Pessimo', pesoRisco: 1 },
    ],
  };

  const perguntasEstruturaisInexistente = [
    perguntaFundacao,
    perguntaEstrutura,
    {
      id: 'est_q1_inexistente_classificacao_risco',
      texto: 'Classificacao de risco para fundacao inexistente',
      tipo: 'multipla_escolha',
      auxiliarCalculo: true,
      opcoes: [
        { id: 'baixo', texto: 'Risco baixo', pesoRisco: 0 },
        { id: 'medio', texto: 'Risco medio', pesoRisco: 0 },
        { id: 'alto', texto: 'Risco alto', pesoRisco: 0 },
        { id: 'critico', texto: 'Risco critico', pesoRisco: 0 },
      ],
    },
    {
      id: 'est_q1_inexistente_explicacao',
      texto: 'Explicacao tecnica da fundacao inexistente',
      tipo: 'texto',
      auxiliarCalculo: true,
    },
    {
      id: 'est_q2_inexistente_classificacao_risco',
      texto: 'Classificacao de risco para estrutura principal inexistente',
      tipo: 'multipla_escolha',
      auxiliarCalculo: true,
      opcoes: [
        { id: 'baixo', texto: 'Risco baixo', pesoRisco: 0 },
        { id: 'medio', texto: 'Risco medio', pesoRisco: 0 },
        { id: 'alto', texto: 'Risco alto', pesoRisco: 0 },
        { id: 'critico', texto: 'Risco critico', pesoRisco: 0 },
      ],
    },
    {
      id: 'est_q2_inexistente_explicacao',
      texto: 'Explicacao tecnica da estrutura principal inexistente',
      tipo: 'texto',
      auxiliarCalculo: true,
    },
  ];

  it('nao forca R4 apenas por marcar inclinacao negativa sem classificacao auxiliar', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'vistoria_deslizamento_v3',
      formularioVersao: 3,
      tipoCalculo: 'soma_total',
      respostas: { desl2_q2: 'q2_f' },
      perguntas: [perguntaInclinacao],
    });

    expect(calculo.pontuacaoBase).toBe(1);
    expect(calculo.pontuacaoTotal).toBe(1);
    expect(calculo.nivelRisco).toBe('r1');
    expect(calculo.regrasCondicionais).toHaveLength(0);
  });

  it('forca R4 quando agente classifica altura x distancia como muito alto', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'vistoria_deslizamento_v3',
      formularioVersao: 3,
      tipoCalculo: 'soma_total',
      respostas: {
        desl2_q2: 'q2_f',
        desl2_q2_exposicao_altura_distancia: 'muito_alto',
        desl2_q2_justificativa_tecnica: 'Talude de 10m com alvo a 5m e base solapada.',
      },
      perguntas: [perguntaInclinacao, perguntaExposicao, perguntaJustificativa],
    });

    expect(calculo.itens).toHaveLength(1);
    expect(calculo.pontuacaoBase).toBe(1);
    expect(calculo.pontuacaoTotal).toBe(7);
    expect(calculo.nivelRisco).toBe('r4');
    expect(calculo.regrasCondicionais?.[0].respostaId).toBe('muito_alto');
    expect(calculo.regrasCondicionais?.[0].justificativa).toContain('Talude de 10m');
    expect(parseCalculoRiscoSnapshot(JSON.stringify(calculo))?.regrasCondicionais?.[0].nivelMinimo).toBe('r4');
  });

  it('aplica pisos por classificacao altura x distancia sem somar pergunta auxiliar', () => {
    const base = [perguntaInclinacao, perguntaExposicao];

    const baixo = calcularRiscoFormulario({
      formularioId: 'vistoria_deslizamento_v3',
      respostas: { desl2_q2: 'q2_e', desl2_q2_exposicao_altura_distancia: 'baixo' },
      perguntas: base,
    });
    const medio = calcularRiscoFormulario({
      formularioId: 'vistoria_deslizamento_v3',
      respostas: { desl2_q2: 'q2_e', desl2_q2_exposicao_altura_distancia: 'medio' },
      perguntas: base,
    });
    const alto = calcularRiscoFormulario({
      formularioId: 'vistoria_deslizamento_v3',
      respostas: { desl2_q2: 'q2_e', desl2_q2_exposicao_altura_distancia: 'alto' },
      perguntas: base,
    });
    const naoEstimado = calcularRiscoFormulario({
      formularioId: 'vistoria_deslizamento_v3',
      respostas: { desl2_q2: 'q2_e', desl2_q2_exposicao_altura_distancia: 'nao_estimado' },
      perguntas: base,
    });

    expect(baixo.pontuacaoTotal).toBe(1);
    expect(baixo.nivelRisco).toBe('r1');
    expect(medio.pontuacaoTotal).toBe(2.1);
    expect(medio.nivelRisco).toBe('r2');
    expect(alto.pontuacaoTotal).toBe(4);
    expect(alto.nivelRisco).toBe('r3');
    expect(naoEstimado.pontuacaoTotal).toBe(4);
    expect(naoEstimado.nivelRisco).toBe('r3');
  });

  it('nao aplica agravante de inclinacao negativa em outros formularios', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'risco_estrutural_novo_v2',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: { desl2_q2: 'q2_f' },
      perguntas: [perguntaInclinacao, perguntaExposicao],
    });

    expect(calculo.pontuacaoTotal).toBe(1);
    expect(calculo.nivelRisco).toBe('r1');
    expect(calculo.agravantes).toHaveLength(0);
    expect(calculo.regrasCondicionais).toHaveLength(0);
  });

  it('anexa observacao condicional estrutural sem alterar pontuacao', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'risco_estrutural_novo_v2',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: {
        est_q1: 'q1_c',
        est_q1__observacao_risco: 'Trinca diagonal na base, com recalque aparente.',
      },
      perguntas: [{
        id: 'est_q1',
        texto: 'Fundacao',
        tipo: 'cards',
        opcoes: [
          { id: 'q1_a', texto: 'Bom', pesoRisco: 0 },
          { id: 'q1_c', texto: 'Ruim', pesoRisco: 0.6 },
        ],
      }],
    });

    expect(calculo.pontuacaoBase).toBe(0.6);
    expect(calculo.pontuacaoTotal).toBe(0.6);
    expect(calculo.itens[0].observacao).toContain('Trinca diagonal');
    expect(parseCalculoRiscoSnapshot(JSON.stringify(calculo))?.itens[0].observacao).toContain('Trinca diagonal');
  });

  it('ignora observacao condicional estrutural quando a opcao nao aciona risco', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'risco_estrutural_novo_v2',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: {
        est_q1: 'q1_a',
        est_q1__observacao_risco: 'Texto antigo que nao deve aparecer.',
      },
      perguntas: [{
        id: 'est_q1',
        texto: 'Fundacao',
        tipo: 'cards',
        opcoes: [
          { id: 'q1_a', texto: 'Bom', pesoRisco: 0 },
          { id: 'q1_c', texto: 'Ruim', pesoRisco: 0.6 },
        ],
      }],
    });

    expect(calculo.pontuacaoTotal).toBe(0);
    expect(calculo.itens[0].observacao).toBeUndefined();
  });

  it('nao aplica regra conservadora para Inexistente estrutural sem classificacao auxiliar', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'risco_estrutural_novo_v2',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: {
        est_q1: 'inexistente',
      },
      perguntas: perguntasEstruturaisInexistente,
    });

    expect(calculo.pontuacaoBase).toBe(0);
    expect(calculo.pontuacaoTotal).toBe(0);
    expect(calculo.nivelRisco).toBe('r1');
    expect(calculo.regrasCondicionais).toHaveLength(0);
  });

  it.each([
    ['est_q1', 'est_q1_inexistente_classificacao_risco', 'est_q1_inexistente_explicacao', 'baixo', 0, 'r1'],
    ['est_q1', 'est_q1_inexistente_classificacao_risco', 'est_q1_inexistente_explicacao', 'medio', 2.1, 'r2'],
    ['est_q1', 'est_q1_inexistente_classificacao_risco', 'est_q1_inexistente_explicacao', 'alto', 4, 'r3'],
    ['est_q1', 'est_q1_inexistente_classificacao_risco', 'est_q1_inexistente_explicacao', 'critico', 7, 'r4'],
    ['est_q2', 'est_q2_inexistente_classificacao_risco', 'est_q2_inexistente_explicacao', 'baixo', 0, 'r1'],
    ['est_q2', 'est_q2_inexistente_classificacao_risco', 'est_q2_inexistente_explicacao', 'medio', 2.1, 'r2'],
    ['est_q2', 'est_q2_inexistente_classificacao_risco', 'est_q2_inexistente_explicacao', 'alto', 4, 'r3'],
    ['est_q2', 'est_q2_inexistente_classificacao_risco', 'est_q2_inexistente_explicacao', 'critico', 7, 'r4'],
  ])('aplica classificacao de %s inexistente como %s', (perguntaId, classificacaoId, explicacaoId, classificacao, pontuacao, nivel) => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'risco_estrutural_novo_v2',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: {
        [perguntaId]: 'inexistente',
        [classificacaoId]: classificacao,
        [explicacaoId]: 'Evidencia opcional registrada em campo.',
      },
      perguntas: perguntasEstruturaisInexistente,
    });

    expect(calculo.pontuacaoBase).toBe(0);
    expect(calculo.pontuacaoTotal).toBe(pontuacao);
    expect(calculo.nivelRisco).toBe(nivel);
    expect(calculo.regrasCondicionais?.[0].perguntaId).toBe(classificacaoId);
    expect(calculo.regrasCondicionais?.[0].respostaId).toBe(classificacao);
    expect(calculo.regrasCondicionais?.[0].justificativa).toContain('Evidencia opcional');
    expect(parseCalculoRiscoSnapshot(JSON.stringify(calculo))?.regrasCondicionais?.[0].nivelMinimo).toBe(nivel);
  });

  it('mantem explicacao estrutural opcional quando nao preenchida', () => {
    const calculo = calcularRiscoFormulario({
      formularioId: 'risco_estrutural_novo_v2',
      formularioVersao: 2,
      tipoCalculo: 'soma_total',
      respostas: {
        est_q2: 'inexistente',
        est_q2_inexistente_classificacao_risco: 'alto',
      },
      perguntas: perguntasEstruturaisInexistente,
    });

    expect(calculo.pontuacaoTotal).toBe(4);
    expect(calculo.nivelRisco).toBe('r3');
    expect(calculo.regrasCondicionais?.[0].label).toBe('Estrutura principal inexistente');
    expect(calculo.regrasCondicionais?.[0].justificativa).toBeUndefined();
  });
});

describe('normalizacao e formatacao', () => {
  it('normaliza aliases e acentos antes de exibir label/cor', () => {
    expect(normalizarNivelRisco('Medio')).toBe('r2');
    expect(normalizarNivelRisco('alto')).toBe('r3');
    expect(riscoLabel('critico')).toBe('CRÍTICO');
    expect(riscoColor('baixo')).toBe('#10B981');
  });

  it('formata pontuacao decimal em padrao pt-BR simples', () => {
    expect(formatarPontuacaoRisco(4)).toBe('4');
    expect(formatarPontuacaoRisco(4.25)).toBe('4,3');
  });
});
