/**
 * Testes de auditoria dos JSONs de formulários built-in.
 * Garante que wizard.tsx pode calcular risco em todos eles.
 */

const riscoEstruturalNovo = require('../../assets/formularios/risco_estrutural_novo_v1.json');
const vistoriaDeslizamento = require('../../assets/formularios/vistoria_deslizamento_v2.json');

const FORMULARIOS = [riscoEstruturalNovo, vistoriaDeslizamento];

// Níveis válidos do nivelMap do wizard (inclui ponderada_max_elemento e soma_total)
const NIVEL_VALIDOS_LIMITES = [
  'sem_risco', 'baixo', 'muito_baixo',
  'medio', 'medio_baixo',
  'alto', 'medio_alto',
  'iminente', 'critico', 'muito_alto',
];

const TIPO_CALCULO_VALIDOS = ['soma_total', 'ponderada_max_elemento'];

describe('JSONs built-in — estrutura base', () => {
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

describe('JSONs built-in — classificacao.limites[]', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} tem classificacao.limites[] não-vazio`, () => {
      expect(Array.isArray(f.classificacao?.limites)).toBe(true);
      expect(f.classificacao.limites.length).toBeGreaterThan(0);
    });

    it(`${f.id} limites usam nivel compatível com nivelMap`, () => {
      f.classificacao.limites.forEach((l: any) => {
        expect(NIVEL_VALIDOS_LIMITES).toContain(l.nivel);
      });
    });

    it(`${f.id} limites têm max numérico crescente`, () => {
      const maxes = f.classificacao.limites.map((l: any) => l.max);
      for (let i = 1; i < maxes.length; i++) {
        expect(maxes[i]).toBeGreaterThan(maxes[i - 1]);
      }
    });
  });
});

describe('JSONs built-in — perguntas com pesoRisco', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} todas opções têm pesoRisco numérico`, () => {
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

describe('risco_estrutural_novo_v1 — soma_total', () => {
  it('tem 1 fase com 12 perguntas', () => {
    expect(riscoEstruturalNovo.fases.length).toBe(1);
    expect(riscoEstruturalNovo.fases[0].perguntas.length).toBe(12);
  });

  it('primeira pergunta é foto geral', () => {
    const primeira = riscoEstruturalNovo.fases[0].perguntas[0];
    expect(primeira.tipo).toBe('foto');
  });

  it('thresholds: R1≤8, R2≤22, R3≤44, R4>44', () => {
    const limites = riscoEstruturalNovo.classificacao.limites;
    expect(limites[0].max).toBe(8);
    expect(limites[1].max).toBe(22);
    expect(limites[2].max).toBe(44);
    expect(limites[3].max).toBe(9999);
  });

  it('níveis dos limites seguem progressão de risco', () => {
    const limites = riscoEstruturalNovo.classificacao.limites;
    expect(limites[0].nivel).toBe('baixo');
    expect(limites[1].nivel).toBe('medio');
    expect(limites[2].nivel).toBe('alto');
    expect(limites[3].nivel).toBe('iminente');
  });

  it('perguntas do tipo cards têm 4 opções com pesoRisco numérico', () => {
    const cards = riscoEstruturalNovo.fases[0].perguntas.filter((p: any) => p.tipo === 'cards');
    expect(cards.length).toBeGreaterThan(0);
    for (const p of cards) {
      expect(p.opcoes.length).toBe(4);
      p.opcoes.forEach((o: any) => expect(typeof o.pesoRisco).toBe('number'));
    }
  });
});

describe('vistoria_deslizamento_v2 — soma_total', () => {
  it('tem 1 fase com 12 perguntas', () => {
    expect(vistoriaDeslizamento.fases.length).toBe(1);
    expect(vistoriaDeslizamento.fases[0].perguntas.length).toBe(12);
  });

  it('primeira pergunta é foto geral (opcional)', () => {
    const primeira = vistoriaDeslizamento.fases[0].perguntas[0];
    expect(primeira.tipo).toBe('foto');
    expect(primeira.obrigatoria).toBe(false);
  });

  it('thresholds: R1≤1, R2≤3, R3≤5, R4>5', () => {
    const limites = vistoriaDeslizamento.classificacao.limites;
    expect(limites[0].max).toBe(1);
    expect(limites[1].max).toBe(3);
    expect(limites[2].max).toBe(5);
    expect(limites[3].max).toBe(9999);
  });

  it('questão desl2_q2 tem 5 opções (0, 1, 2, 3, 4)', () => {
    const fase = vistoriaDeslizamento.fases[0];
    const q2 = fase.perguntas.find((p: any) => p.id === 'desl2_q2');
    expect(q2).toBeDefined();
    const scores = q2.opcoes.map((o: any) => o.pesoRisco);
    expect(scores).toEqual([0, 1, 2, 3, 4]);
  });
});
