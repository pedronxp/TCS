/**
 * Testes de auditoria dos JSONs de formulários built-in.
 * Garante que wizard.tsx pode calcular risco em todos eles.
 */

const estrutural = require('../../assets/formularios/estrutural.json');
const deslizamento = require('../../assets/formularios/deslizamento_campo.json');
const estruturalAvancado = require('../../assets/formularios/estrutural_avancado.json');
const inundacao = require('../../assets/formularios/inundacao.json');

const FORMULARIOS = [estrutural, deslizamento, estruturalAvancado, inundacao];
const NIVEL_VALIDOS = ['sem_risco', 'baixo', 'medio', 'medio_baixo', 'alto', 'medio_alto', 'iminente', 'critico'];

describe('JSONs built-in — estrutura base', () => {
  FORMULARIOS.forEach(f => {
    it(`${f.id} tem id, versao, fases e tipoCalculo`, () => {
      expect(f.id).toBeTruthy();
      expect(f.versao).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(f.fases)).toBe(true);
      expect(f.fases.length).toBeGreaterThan(0);
      expect(f.tipoCalculo).toBeTruthy();
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
        expect(NIVEL_VALIDOS).toContain(l.nivel);
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
