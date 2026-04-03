/**
 * Testes de auditoria dos JSONs de formulários built-in.
 * Garante que wizard.tsx pode calcular risco em todos eles.
 */

const riscoEstrutural = require('../../assets/formularios/risco_estrutural_v1.json');
const riscoEstruturalV2 = require('../../assets/formularios/risco_estrutural_v2.json');
const vistoriaDeslizamento = require('../../assets/formularios/vistoria_deslizamento_v1.json');

const FORMULARIOS = [riscoEstrutural, riscoEstruturalV2, vistoriaDeslizamento];

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

describe('risco_estrutural_v1 — ponderada_max_elemento', () => {
  it('tem 12 fases com peso numérico', () => {
    expect(riscoEstrutural.fases.length).toBe(12);
    riscoEstrutural.fases.forEach((f: any) => {
      expect(typeof f.peso).toBe('number');
      expect(f.peso).toBeGreaterThan(0);
    });
  });

  it('cada fase tem 5 perguntas (estado, gravidade, extensão, ativa, foto)', () => {
    riscoEstrutural.fases.forEach((f: any) => {
      expect(f.perguntas.length).toBe(5);
    });
  });

  it('última pergunta de cada fase é do tipo foto', () => {
    riscoEstrutural.fases.forEach((f: any) => {
      const ultima = f.perguntas[f.perguntas.length - 1];
      expect(ultima.tipo).toBe('foto');
    });
  });

  it('pesos dos elementos estão dentro dos valores da planilha', () => {
    const pesosValidos = [0.8, 0.9, 1.0, 1.1, 1.4, 1.5];
    riscoEstrutural.fases.forEach((f: any) => {
      expect(pesosValidos).toContain(f.peso);
    });
  });

  it('Estado tem opções bom=0, regular=2, ruim=4, pessimo=6', () => {
    const primeiraFase = riscoEstrutural.fases[0];
    const questaoEstado = primeiraFase.perguntas[0];
    const scores = questaoEstado.opcoes.map((o: any) => o.pesoRisco);
    expect(scores).toEqual([0, 2, 4, 6]);
  });
});

describe('vistoria_deslizamento_v1 — soma_total', () => {
  it('tem 1 fase com as perguntas corretas', () => {
    expect(vistoriaDeslizamento.fases.length).toBe(1);
    expect(vistoriaDeslizamento.fases[0].perguntas.length).toBeGreaterThanOrEqual(10);
  });

  it('inclinação tem 5 opções (0, 1, 2, 3, 4)', () => {
    const fase = vistoriaDeslizamento.fases[0];
    const inclinacao = fase.perguntas.find((p: any) => p.id === 'desl_inclinacao');
    expect(inclinacao).toBeDefined();
    const scores = inclinacao.opcoes.map((o: any) => o.pesoRisco);
    expect(scores).toEqual([0, 1, 2, 3, 4]);
  });

  it('thresholds: R1≤2, R2≤4, R3≤9, R4>9', () => {
    const limites = vistoriaDeslizamento.classificacao.limites;
    expect(limites[0].max).toBe(2);
    expect(limites[1].max).toBe(4);
    expect(limites[2].max).toBe(9);
    expect(limites[3].max).toBe(9999);
  });

  it('primeira pergunta é foto geral (opcional)', () => {
    const primeira = vistoriaDeslizamento.fases[0].perguntas[0];
    expect(primeira.tipo).toBe('foto');
    expect(primeira.obrigatoria).toBe(false);
  });
});
