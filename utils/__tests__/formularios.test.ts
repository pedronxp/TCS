/**
 * Testes de auditoria dos JSONs de formularios built-in.
 * Garante que wizard.tsx pode calcular risco em todos eles.
 */

const riscoEstrutural = require('../../assets/formularios/risco_estrutural_novo_v1.json');
const vistoriaDeslizamento = require('../../assets/formularios/vistoria_deslizamento_v2.json');

const FORMULARIOS = [riscoEstrutural, vistoriaDeslizamento];

const NIVEL_VALIDOS_LIMITES = [
  'sem_risco', 'baixo', 'muito_baixo',
  'medio', 'medio_baixo',
  'alto', 'medio_alto',
  'iminente', 'critico', 'muito_alto',
];

const TIPO_CALCULO_VALIDOS = ['soma_total', 'ponderada_max_elemento'];

describe('JSONs built-in - estrutura base', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} tem id, versao, fases e tipoCalculo`, () => {
      expect(f.id).toBeTruthy();
      expect(f.versao).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(f.fases)).toBe(true);
      expect(f.fases.length).toBeGreaterThan(0);
      expect(TIPO_CALCULO_VALIDOS).toContain(f.tipoCalculo);
    });
  });
});

describe('JSONs built-in - classificacao.limites[]', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} tem classificacao.limites[] nao-vazio`, () => {
      expect(Array.isArray(f.classificacao?.limites)).toBe(true);
      expect(f.classificacao.limites.length).toBeGreaterThan(0);
    });

    it(`${f.id} limites usam nivel compativel com nivelMap`, () => {
      f.classificacao.limites.forEach((l: any) => {
        expect(NIVEL_VALIDOS_LIMITES).toContain(l.nivel);
      });
    });

    it(`${f.id} limites tem max numerico crescente`, () => {
      const maxes = f.classificacao.limites.map((l: any) => l.max);
      for (let i = 1; i < maxes.length; i++) {
        expect(maxes[i]).toBeGreaterThan(maxes[i - 1]);
      }
    });
  });
});

describe('JSONs built-in - perguntas com pesoRisco', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} todas opcoes tem pesoRisco numerico`, () => {
      for (const fase of f.fases) {
        for (const pergunta of fase.perguntas || []) {
          for (const opcao of pergunta.opcoes || []) {
            expect(typeof opcao.pesoRisco).toBe('number');
          }
        }
      }
    });
  });
});

describe('JSONs built-in - opcao Inexistente', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} tem Inexistente com peso 0 em todas perguntas de escolha`, () => {
      for (const fase of f.fases) {
        for (const pergunta of fase.perguntas || []) {
          if (!['cards', 'multipla_escolha'].includes(pergunta.tipo)) continue;
          const opcao = pergunta.opcoes.find((o: any) => o.texto === 'Inexistente');
          expect(opcao).toBeDefined();
          expect(opcao.pesoRisco).toBe(0);
        }
      }
    });
  });
});

describe('risco_estrutural_novo_v1 - soma_total', () => {
  it('tem uma fase com foto, 10 perguntas de avaliacao e observacoes', () => {
    expect(riscoEstrutural.fases.length).toBe(1);
    expect(riscoEstrutural.fases[0].perguntas.length).toBe(12);
    expect(riscoEstrutural.fases[0].perguntas[0].tipo).toBe('foto');
  });
});

describe('vistoria_deslizamento_v2 - soma_total', () => {
  it('tem uma fase com foto, 10 perguntas de avaliacao e observacoes', () => {
    expect(vistoriaDeslizamento.fases.length).toBe(1);
    expect(vistoriaDeslizamento.fases[0].perguntas.length).toBe(12);
    expect(vistoriaDeslizamento.fases[0].perguntas[0].tipo).toBe('foto');
  });

  it('inclinacao tem Inexistente + 5 opcoes tecnicas', () => {
    const fase = vistoriaDeslizamento.fases[0];
    const inclinacao = fase.perguntas.find((p: any) => p.id === 'desl2_q2');
    expect(inclinacao).toBeDefined();
    const scores = inclinacao.opcoes.map((o: any) => o.pesoRisco);
    expect(scores).toEqual([0, 0, 1, 2, 3, 4]);
  });

  it('thresholds: R1<=1, R2<=3, R3<=5, R4>5', () => {
    const limites = vistoriaDeslizamento.classificacao.limites;
    expect(limites[0].max).toBe(1);
    expect(limites[1].max).toBe(3);
    expect(limites[2].max).toBe(5);
    expect(limites[3].max).toBe(9999);
  });
});
