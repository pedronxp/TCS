/**
 * Auditoria dos JSONs built-in ativos.
 * Garante que os formularios publicados no app usam a escala padronizada 0-10.
 */

import {
  filtrarPerguntasVisiveis,
  filtrarRespostasPorPerguntas,
  flattenPerguntas,
  getObservacaoCondicionalRiscoConfig,
  getObservacaoCondicionalRiscoKey,
  opcaoAcionaObservacaoCondicionalRisco,
  opcaoRequerJustificativaTecnica,
} from '../formulariosAssets';

const riscoEstrutural = require('../../assets/formularios/risco_estrutural_novo_v2.json');
const vistoriaDeslizamento = require('../../assets/formularios/vistoria_deslizamento_v3.json');

const FORMULARIOS_ATIVOS = [riscoEstrutural, vistoriaDeslizamento];
const TIPO_CALCULO_VALIDOS = ['soma_total', 'ponderada_max_elemento'];
const NIVEL_VALIDOS_LIMITES = ['r1', 'r2', 'r3', 'r4'];

function perguntasPontuaveis(form: any) {
  return form.fases.flatMap((fase: any) =>
    (fase.perguntas || []).filter((p: any) => ['cards', 'multipla_escolha'].includes(p.tipo) && !p.auxiliarCalculo),
  );
}

function maxTotal(form: any) {
  return perguntasPontuaveis(form).reduce((acc: number, p: any) => {
    const maxPergunta = Math.max(...(p.opcoes || []).map((o: any) => Number(o.pesoRisco || 0)));
    return acc + maxPergunta;
  }, 0);
}

describe('JSONs built-in ativos - estrutura base', () => {
  FORMULARIOS_ATIVOS.forEach(f => {
    it(`${f.id} tem id, versao, fases e tipoCalculo`, () => {
      expect(f.id).toBeTruthy();
      expect(f.versao).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(f.fases)).toBe(true);
      expect(f.fases.length).toBeGreaterThan(0);
      expect(TIPO_CALCULO_VALIDOS).toContain(f.tipoCalculo);
    });
  });
});

describe('JSONs built-in ativos - escala 0-10', () => {
  FORMULARIOS_ATIVOS.forEach(f => {
    it(`${f.id} tem quantidade esperada de perguntas pontuaveis e maximo 10`, () => {
      expect(perguntasPontuaveis(f)).toHaveLength(f.id === 'risco_estrutural_novo_v2' ? 11 : 10);
      expect(maxTotal(f)).toBeCloseTo(10, 5);
    });

    it(`${f.id} usa limites R1/R2/R3/R4 padronizados`, () => {
      const limites = f.classificacao.limites;
      expect(limites.map((l: any) => l.nivel)).toEqual(NIVEL_VALIDOS_LIMITES);
      expect(limites.map((l: any) => l.max)).toEqual([2.0, 3.9, 6.9, 10.0]);
    });

    it(`${f.id} todas opcoes tem pesoRisco numerico entre 0 e 1`, () => {
      for (const p of perguntasPontuaveis(f)) {
        for (const opcao of p.opcoes || []) {
          expect(typeof opcao.pesoRisco).toBe('number');
          expect(opcao.pesoRisco).toBeGreaterThanOrEqual(0);
          expect(opcao.pesoRisco).toBeLessThanOrEqual(1);
        }
      }
    });

    it(`${f.id} mantem pesos numericos por pergunta`, () => {
      for (const p of perguntasPontuaveis(f)) {
        const maxPergunta = Math.max(...(p.opcoes || []).map((o: any) => Number(o.pesoRisco || 0)));
        expect(maxPergunta).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('risco_estrutural_novo_v2 - laje e Inexistente critico', () => {
  it('separa laje da estrutura e insere a pergunta logo apos pilares e vigas', () => {
    const perguntas = perguntasPontuaveis(riscoEstrutural);
    const estruturaIdx = perguntas.findIndex((p: any) => p.id === 'est_q2');
    const laje = perguntas[estruturaIdx + 1];

    expect(perguntas[estruturaIdx].texto).toBe('Estrutura (pilares e vigas)');
    expect(perguntas[estruturaIdx].texto).not.toMatch(/laje/i);
    expect(laje.id).toBe('est_q2_laje');
    expect(laje.texto).toBe('Laje');
    expect(laje.opcoes.map((o: any) => o.texto)).toEqual(['Bom', 'Ruim', 'Péssimo']);
  });

  it('mantem Inexistente somente em fundacao e pilares/vigas com justificativa obrigatoria', () => {
    const perguntas = flattenPerguntas(riscoEstrutural);
    const comInexistente = perguntas
      .filter(p => p.opcoes.some(o => o.id === 'inexistente' || o.texto === 'Inexistente'))
      .map(p => p.id);
    const fundacao = perguntas.find(p => p.id === 'est_q1')!;
    const estrutura = perguntas.find(p => p.id === 'est_q2')!;
    const laje = perguntas.find(p => p.id === 'est_q2_laje')!;

    expect(comInexistente).toEqual(['est_q1', 'est_q2']);
    expect(opcaoRequerJustificativaTecnica(fundacao, 'inexistente')).toBe(true);
    expect(opcaoRequerJustificativaTecnica(estrutura, 'inexistente')).toBe(true);
    expect(laje.opcoes.some(o => o.id === 'inexistente')).toBe(false);
  });

  it('preserva justificativa obrigatoria vinculada a resposta Inexistente', () => {
    const perguntas = flattenPerguntas(riscoEstrutural);
    const fundacao = perguntas.find(p => p.id === 'est_q1')!;
    const obsKey = getObservacaoCondicionalRiscoKey('est_q1');
    const respostas = filtrarRespostasPorPerguntas(
      { est_q1: 'inexistente', [obsKey]: 'Fundacao nao observada no trecho vistoriado.' },
      perguntas,
      'risco_estrutural_novo_v2',
    );

    expect(opcaoAcionaObservacaoCondicionalRisco('risco_estrutural_novo_v2', fundacao, 'inexistente')).toBe(true);
    expect(respostas[obsKey]).toContain('Fundacao');
  });
});

describe('vistoria_deslizamento_v3 - ajustes tecnicos', () => {
  it('drenagem separa Inexistente de Sem drenagem', () => {
    const drenagem = vistoriaDeslizamento.fases[0].perguntas.find((p: any) => p.id === 'desl2_q3');
    expect(drenagem.opcoes.find((o: any) => o.id === 'inexistente').pesoRisco).toBe(0);
    expect(drenagem.opcoes.find((o: any) => o.id === 'q3_c').texto).toBe('Sem drenagem');
    expect(drenagem.opcoes.find((o: any) => o.id === 'q3_c').pesoRisco).toBe(1);
  });

  it('inclui inclinacao negativa apos a opcao vertical', () => {
    const inclinacao = vistoriaDeslizamento.fases[0].perguntas.find((p: any) => p.id === 'desl2_q2');
    const verticalIdx = inclinacao.opcoes.findIndex((o: any) => o.id === 'q2_e');
    const negativaIdx = inclinacao.opcoes.findIndex((o: any) => o.id === 'q2_f');

    expect(verticalIdx).toBeGreaterThan(-1);
    expect(negativaIdx).toBe(verticalIdx + 1);
    expect(inclinacao.opcoes[negativaIdx].texto).toBe('Inclinação negativa / talude solapado');
    expect(inclinacao.opcoes[negativaIdx].pesoRisco).toBe(inclinacao.opcoes[verticalIdx].pesoRisco);
  });

  it('inclui perguntas auxiliares condicionais apos a inclinacao', () => {
    const perguntas = vistoriaDeslizamento.fases[0].perguntas;
    const inclinacaoIdx = perguntas.findIndex((p: any) => p.id === 'desl2_q2');
    const classificacao = perguntas[inclinacaoIdx + 1];
    const justificativa = perguntas[inclinacaoIdx + 2];

    expect(classificacao.id).toBe('desl2_q2_exposicao_altura_distancia');
    expect(classificacao.auxiliarCalculo).toBe(true);
    expect(classificacao.mostrarQuando).toEqual({
      perguntaId: 'desl2_q2',
      respostaIds: ['q2_e', 'q2_f'],
    });
    expect(classificacao.opcoes.map((o: any) => o.id)).toEqual([
      'baixo',
      'medio',
      'alto',
      'muito_alto',
      'nao_estimado',
    ]);

    expect(justificativa.id).toBe('desl2_q2_justificativa_tecnica');
    expect(justificativa.tipo).toBe('texto');
    expect(justificativa.obrigatoria).toBe(true);
    expect(justificativa.auxiliarCalculo).toBe(true);
    expect(justificativa.descricao).toContain('altura aproximada');
    expect(justificativa.placeholder).toContain('talude');
    expect(justificativa.mostrarQuando).toEqual(classificacao.mostrarQuando);
  });

  it('mostra perguntas auxiliares somente para inclinacao vertical ou negativa', () => {
    const perguntas = flattenPerguntas(vistoriaDeslizamento);

    expect(filtrarPerguntasVisiveis(perguntas, { desl2_q2: 'q2_d' }).some(p => p.id === 'desl2_q2_exposicao_altura_distancia')).toBe(false);
    expect(filtrarPerguntasVisiveis(perguntas, { desl2_q2: 'q2_e' }).some(p => p.id === 'desl2_q2_exposicao_altura_distancia')).toBe(true);
    expect(filtrarPerguntasVisiveis(perguntas, { desl2_q2: 'q2_f' }).some(p => p.id === 'desl2_q2_justificativa_tecnica')).toBe(true);
  });
});

describe('risco_estrutural_novo_v2 - observacao condicional de risco', () => {
  it('habilita observacao opcional para opcoes com peso a partir de 0.3', () => {
    const config = getObservacaoCondicionalRiscoConfig('risco_estrutural_novo_v2');
    const perguntas = flattenPerguntas(riscoEstrutural);
    const fundacao = perguntas.find(p => p.id === 'est_q1')!;

    expect(config?.ativo).toBe(true);
    expect(config?.pesoMinimo).toBe(0.3);
    expect(opcaoAcionaObservacaoCondicionalRisco('risco_estrutural_novo_v2', fundacao, 'q1_a')).toBe(false);
    expect(opcaoAcionaObservacaoCondicionalRisco('risco_estrutural_novo_v2', fundacao, 'q1_b')).toBe(true);
    expect(opcaoAcionaObservacaoCondicionalRisco('risco_estrutural_novo_v2', fundacao, 'q1_c')).toBe(true);
    expect(opcaoAcionaObservacaoCondicionalRisco('risco_estrutural_novo_v2', fundacao, 'q1_d')).toBe(true);
  });

  it('mantem observacao visivel somente quando a resposta atual aciona a regra', () => {
    const perguntas = flattenPerguntas(riscoEstrutural);
    const obsKey = getObservacaoCondicionalRiscoKey('est_q1');

    const comRisco = filtrarRespostasPorPerguntas(
      { est_q1: 'q1_c', [obsKey]: 'Recalque visivel na fundacao.' },
      perguntas,
      'risco_estrutural_novo_v2',
    );
    const semRisco = filtrarRespostasPorPerguntas(
      { est_q1: 'q1_a', [obsKey]: 'Texto antigo.' },
      perguntas,
      'risco_estrutural_novo_v2',
    );

    expect(comRisco[obsKey]).toContain('Recalque');
    expect(semRisco[obsKey]).toBeUndefined();
  });
});
