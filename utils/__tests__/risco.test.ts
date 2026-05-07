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
