/**
 * utils/riscoUtils.ts
 * Funções compartilhadas para exibição de nível de risco estrutural.
 * Fonte única da verdade — consolidado de 7 arquivos que tinham cópias inline.
 */

/** Labels de exibição para cada nível de risco */
export const RISCO_LABELS: Record<string, string> = {
  r1: 'BAIXO',
  r2: 'MÉDIO',
  r3: 'ALTO',
  r4: 'CRÍTICO',
};

/** Cores de exibição para cada nível de risco */
export const RISCO_CORES: Record<string, string> = {
  r1: '#10B981',
  r2: '#F59E0B',
  r3: '#EF4444',
  r4: '#DC2626',
};

/**
 * Retorna o label textual do nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoLabel(nivel: string): string {
  return RISCO_LABELS[nivel] ?? 'BAIXO';
}

/**
 * Retorna a cor hex do nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoColor(nivel: string): string {
  return RISCO_CORES[nivel] ?? '#10B981';
}

/**
 * Retorna o ícone Feather adequado para o nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoIcon(nivel: string): 'check-circle' | 'alert-circle' | 'alert-triangle' {
  if (nivel === 'r4' || nivel === 'r3') return 'alert-triangle';
  if (nivel === 'r2') return 'alert-circle';
  return 'check-circle';
}

/**
 * Texto de conduta recomendada por nível de risco.
 */
export function riscoConduta(nivel: string): string {
  const map: Record<string, string> = {
    r1: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina.',
    r2: 'Foram identificadas irregularidades. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
    r3: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação até laudo estrutural por engenheiro habilitado.',
    r4: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória.',
  };
  return map[nivel] ?? map.r1;
}
