/**
 * Testes unitários: cálculo de nível de risco
 * Replica a lógica de calcularNivelRisco() do wizard.tsx
 */

// Lógica pura extraída do wizard — sem deps de React Native
function calcularNivelRisco(
  pontuacao: number,
  limites?: Array<{ max: number; nivel: string }>
): string {
  // Mapeia strings do JSON para códigos internos
  const nivelMap: Record<string, string> = {
    sem_risco: 'r1',
    baixo: 'r1',
    medio: 'r2',
    medio_baixo: 'r2',
    alto: 'r3',
    medio_alto: 'r3',
    iminente: 'r4',
    critico: 'r4',
  };

  if (limites && limites.length > 0) {
    const sorted = [...limites].sort((a, b) => a.max - b.max);
    for (const l of sorted) {
      if (pontuacao <= l.max) {
        return nivelMap[l.nivel] ?? l.nivel;
      }
    }
    return nivelMap[sorted[sorted.length - 1].nivel] ?? 'r4';
  }

  // Fallback hardcoded
  if (pontuacao <= 24) return 'r1';
  if (pontuacao <= 49) return 'r2';
  if (pontuacao <= 74) return 'r3';
  return 'r4';
}

describe('calcularNivelRisco — fallback hardcoded', () => {
  it('retorna r1 para pontuação 0', () => expect(calcularNivelRisco(0)).toBe('r1'));
  it('retorna r1 para pontuação 24', () => expect(calcularNivelRisco(24)).toBe('r1'));
  it('retorna r2 para pontuação 25', () => expect(calcularNivelRisco(25)).toBe('r2'));
  it('retorna r2 para pontuação 49', () => expect(calcularNivelRisco(49)).toBe('r2'));
  it('retorna r3 para pontuação 50', () => expect(calcularNivelRisco(50)).toBe('r3'));
  it('retorna r3 para pontuação 74', () => expect(calcularNivelRisco(74)).toBe('r3'));
  it('retorna r4 para pontuação 75', () => expect(calcularNivelRisco(75)).toBe('r4'));
  it('retorna r4 para pontuação 999', () => expect(calcularNivelRisco(999)).toBe('r4'));
});

describe('calcularNivelRisco — com limites do JSON', () => {
  const limites = [
    { max: 30, nivel: 'sem_risco' },
    { max: 60, nivel: 'medio' },
    { max: 90, nivel: 'alto' },
    { max: 999, nivel: 'iminente' },
  ];

  it('retorna r1 para pontuação 0 com limites customizados', () => {
    expect(calcularNivelRisco(0, limites)).toBe('r1');
  });
  it('retorna r1 para pontuação 30 (no limite)', () => {
    expect(calcularNivelRisco(30, limites)).toBe('r1');
  });
  it('retorna r2 para pontuação 31', () => {
    expect(calcularNivelRisco(31, limites)).toBe('r2');
  });
  it('retorna r3 para pontuação 61', () => {
    expect(calcularNivelRisco(61, limites)).toBe('r3');
  });
  it('retorna r4 para pontuação 91', () => {
    expect(calcularNivelRisco(91, limites)).toBe('r4');
  });
});

describe('calcularNivelRisco — strings alternativas do JSON', () => {
  it('mapeia "baixo" para r1', () => {
    expect(calcularNivelRisco(10, [{ max: 20, nivel: 'baixo' }])).toBe('r1');
  });
  it('mapeia "medio_alto" para r3', () => {
    expect(calcularNivelRisco(10, [{ max: 20, nivel: 'medio_alto' }])).toBe('r3');
  });
  it('mapeia "critico" para r4', () => {
    expect(calcularNivelRisco(10, [{ max: 20, nivel: 'critico' }])).toBe('r4');
  });
});

describe('calcularNivelRisco — edge cases', () => {
  it('retorna r4 com limites vazios e pontuação alta', () => {
    expect(calcularNivelRisco(100, [])).toBe('r4');
  });
  it('retorna r1 com pontuação negativa (edge)', () => {
    expect(calcularNivelRisco(-5)).toBe('r1');
  });
});
